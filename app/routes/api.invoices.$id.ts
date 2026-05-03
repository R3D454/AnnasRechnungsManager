import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { generateInvoiceNumber } from "@/lib/invoice-number.server";
import { calcItemAmounts, calcInvoiceTotals, calcItemAmountsKleinunternehmer } from "@/lib/tax";
import { log } from "@/lib/logger.server";
import { InvoiceStatus } from "@prisma/client";
import { invoiceUpdateSchema, invoiceStatusSchema, invoiceItemSchema } from "@/lib/schemas";
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

async function getInvoice(id: string, userId: string) {
  return prisma.invoice.findFirst({
    where: { id, company: { userId } },
    include: { items: { orderBy: { position: "asc" } }, customer: true, company: true },
  });
}

/** Storage root for documents */
function storageRoot(): string {
  return resolve(process.env.BELEG_STORAGE_PATH ?? "data/documents");
}

/** Generate and save invoice PDF as beleg (receipt) */
async function generateAndSaveInvoicePDF(invoice: Awaited<ReturnType<typeof getInvoice>>, userId: string): Promise<string | null> {
  if (!invoice) return null;

  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { InvoicePDFDocument } = await import("@/components/invoice/invoice-pdf");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(InvoicePDFDocument as any, { invoice }) as any;
    const buffer = await renderToBuffer(element);

    // Save to storage
    const safeName = `${invoice.id}-${Date.now()}.pdf`;
    const userDir = join(storageRoot(), userId);
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, safeName), Buffer.from(buffer));

    // Return as "beleg:{userId}/{storedName}|{originalName}"
    const originalName = `rechnung-${invoice.number ?? invoice.id}.pdf`;
    return `beleg:${userId}/${safeName}|${originalName}`;
  } catch {
    console.error("Failed to generate invoice PDF");
    return null;
  }
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await getInvoice(params.id, user.id);
  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(invoice);
}

const statusSchema = invoiceStatusSchema;

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await getInvoice(params.id, user.id);
  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "PUT") {
    const body = await request.json();
    const parsed = invoiceUpdateSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

    const { items, kleinunternehmer, ...invoiceData } = parsed.data;

    // Use provided kleinunternehmer or fall back to company setting
    const isKleinunternehmer = kleinunternehmer ?? invoice.company.kleinunternehmer;

    // Server-side recalculation of all amounts
    const recalculatedItems = items.map(item => ({
      ...item,
      ...(isKleinunternehmer
        ? calcItemAmountsKleinunternehmer(item.quantity, item.unitPrice)
        : calcItemAmounts(item.quantity, item.unitPrice, item.taxRate)),
    }));

    const totals = calcInvoiceTotals(recalculatedItems);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
      return tx.invoice.update({
        where: { id: params.id },
        data: {
          customerId: invoiceData.customerId,
          issueDate: new Date(invoiceData.issueDate),
          deliveryDate: invoiceData.deliveryDate ? new Date(invoiceData.deliveryDate) : null,
          dueDate: new Date(invoiceData.dueDate),
          notes: invoiceData.notes ?? null,
          kleinunternehmer: isKleinunternehmer,
          netTotal: totals.netTotal,
          taxTotal: totals.taxTotal,
          grossTotal: totals.grossTotal,
          items: { create: recalculatedItems },
        },
        include: { items: true, customer: true, company: true },
      });
    });

    await log({
      userId: user.id,
      action: "UPDATE_INVOICE",
      entity: "Invoice",
      entityId: params.id,
      metadata: {
        customerId: invoiceData.customerId,
        oldGrossTotal: invoice.grossTotal.toString(),
        newGrossTotal: totals.grossTotal.toString(),
        itemCount: recalculatedItems.length,
        kleinunternehmer: isKleinunternehmer,
      },
      request,
    });

    return Response.json(updated);
  }

  if (request.method === "DELETE") {
    const isAdmin = user.role === "ADMIN";
    const deletableStatuses: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.DELETED];
    if (!isAdmin && !deletableStatuses.includes(invoice.status)) {
      return Response.json(
        { error: "Nur Entwürfe und stornierte Rechnungen können gelöscht werden." },
        { status: 403 }
      );
    }
    await prisma.invoice.delete({ where: { id: params.id } });
    await log({
      userId: user.id,
      action: "DELETE_INVOICE",
      entity: "Invoice",
      entityId: params.id,
      metadata: {
        status: invoice.status,
        grossTotal: invoice.grossTotal.toString(),
        number: invoice.number,
      },
      request,
    });
    return Response.json({ ok: true });
  }

  // PATCH – Status change with validation
  const body = await request.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const newStatus = parsed.data.status;
  const oldStatus = invoice.status;

  // Validate status transitions
  const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["SENT", "CANCELLED", "DELETED"],
    SENT: ["PAID", "CANCELLED", "DRAFT", "DELETED"],
    PAID: ["CANCELLED", "DELETED"],
    CANCELLED: ["DRAFT", "DELETED"],
    DELETED: ["DRAFT"],
  };

  if (!validTransitions[oldStatus]?.includes(newStatus)) {
    return Response.json(
      { error: `Ungültiger Statuswechsel von ${oldStatus} zu ${newStatus}` },
      { status: 400 }
    );
  }

  let numberUpdate: string | null | undefined = undefined;
  if (newStatus === "DELETED") {
    numberUpdate = null;
  } else if (oldStatus === "DELETED") {
    numberUpdate = await generateInvoiceNumber(invoice.companyId);
  }

  // Handle Buchung sync: Create when PAID, delete when unpaying
  if (newStatus === "PAID" && oldStatus !== "PAID") {
    // Generate and save invoice PDF as beleg
    const belegUrl = await generateAndSaveInvoicePDF(invoice, user.id);

    // Calculate weighted average tax rate (kann mehrere Items mit unterschiedlichen Steuersätzen geben)
    let averageTaxRate = 0;
    if (invoice.taxTotal > 0 && invoice.netTotal > 0) {
      // steuersatz = (taxTotal / netTotal) * 100
      averageTaxRate = Math.round((invoice.taxTotal / invoice.netTotal) * 100);
    }

    // Create a Buchung for the invoice payment
    const buchung = await prisma.buchung.create({
      data: {
        companyId: invoice.companyId,
        date: invoice.issueDate,
        account: "BANK",
        type: "EINLAGE",
        amount: invoice.grossTotal,
        description: `Rechnung ${invoice.number}`,
        kategorie: "Rechnungseinnahme",
        isBusinessRecord: true,
        steuersatz: invoice.kleinunternehmer ? 0 : averageTaxRate, // 0 for Kleinunternehmer
        belegUrl: belegUrl, // Attach the generated invoice PDF
      },
    });

    // Update invoice with buchungId
    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        buchungId: buchung.id,
        deletedAt: null,
        ...(numberUpdate !== undefined && { number: numberUpdate }),
      },
      include: { items: true, customer: true, company: true },
    });

    await log({
      userId: user.id,
      action: "UPDATE_INVOICE_STATUS",
      entity: "Invoice",
      entityId: params.id,
      metadata: { oldStatus, newStatus, buchungId: buchung.id, belegUrl, steuersatz: averageTaxRate },
      request,
    });

    return Response.json(updated);
  }

  if (newStatus !== "PAID" && oldStatus === "PAID" && invoice.buchungId) {
    // Delete the linked Buchung when unpaying
    await prisma.buchung.delete({ where: { id: invoice.buchungId } });
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      buchungId: newStatus === "PAID" ? invoice.buchungId : null,
      deletedAt: newStatus === "DELETED" ? new Date() : null,
      ...(numberUpdate !== undefined && { number: numberUpdate }),
    },
    include: { items: true, customer: true, company: true },
  });

  await log({
    userId: user.id,
    action: "UPDATE_INVOICE_STATUS",
    entity: "Invoice",
    entityId: params.id,
    metadata: { oldStatus, newStatus },
    request,
  });

  return Response.json(updated);
}
