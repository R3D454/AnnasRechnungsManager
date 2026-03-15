import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { generateInvoiceNumber } from "@/lib/invoice-number.server";
import { log } from "@/lib/logger.server";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

async function getInvoice(id: string, userId: string) {
  return prisma.invoice.findFirst({
    where: { id, company: { userId } },
    include: { items: { orderBy: { position: "asc" } }, customer: true, company: true },
  });
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await getInvoice(params.id, user.id);
  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(invoice);
}

const statusSchema = z.object({ status: z.nativeEnum(InvoiceStatus) });

const itemSchema = z.object({
  position: z.number().int(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  unitPrice: z.number(),
  taxRate: z.number(),
  netAmount: z.number(),
  taxAmount: z.number(),
  grossAmount: z.number(),
});

const updateSchema = z.object({
  customerId: z.string().min(1),
  issueDate: z.string(),
  deliveryDate: z.string().optional(),
  dueDate: z.string(),
  notes: z.string().optional(),
  kleinunternehmer: z.boolean().optional().default(false),
  items: z.array(itemSchema).min(1),
  netTotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  grossTotal: z.number().nonnegative(),
});

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await getInvoice(params.id, user.id);
  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "PUT") {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

    const { items, ...invoiceData } = parsed.data;
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
          kleinunternehmer: invoiceData.kleinunternehmer,
          netTotal: invoiceData.netTotal,
          taxTotal: invoiceData.taxTotal,
          grossTotal: invoiceData.grossTotal,
          items: { create: items },
        },
      });
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
    await log({ userId: user.id, action: "DELETE_INVOICE", entity: "Invoice", entityId: params.id, request });
    return Response.json({ ok: true });
  }

  // PATCH
  const body = await request.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const newStatus = parsed.data.status;

  let numberUpdate: string | null | undefined = undefined;
  if (newStatus === "DELETED") {
    numberUpdate = null;
  } else if (invoice.status === "DELETED") {
    numberUpdate = await generateInvoiceNumber(invoice.companyId);
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      deletedAt: newStatus === "DELETED" ? new Date() : null,
      ...(numberUpdate !== undefined && { number: numberUpdate }),
    },
  });
  return Response.json(updated);
}
