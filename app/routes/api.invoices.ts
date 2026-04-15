import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { generateInvoiceNumber } from "@/lib/invoice-number.server";
import { calcItemAmounts, calcInvoiceTotals, calcItemAmountsKleinunternehmer } from "@/lib/tax";
import { log } from "@/lib/logger.server";
import { invoiceSchema, invoiceItemSchema } from "@/lib/schemas";

const itemSchema = invoiceItemSchema;

const invoiceCreateSchema = invoiceSchema;

/**
 * Creates a new invoice for a given company.
 *
 * Requires a JSON object in the request body with the following shape:
 * {
 *   companyId: string,
 *   customerId: string,
 *   issueDate: string,
 *   deliveryDate?: string,
 *   dueDate: string,
 *   notes?: string,
 *   kleinunternehmer?: boolean,
 *   items: [
 *     {
 *       position: number,
 *       description: string,
 *       quantity: number,
 *       unit?: string,
 *       unitPrice: number,
 *       taxRate: number,
 *       netAmount: number,
 *       taxAmount: number,
 *       grossAmount: number,
 *     },
 *   ],
 * }
 *
 * Returns the created invoice as a JSON object.
 *
 * If the request is unauthorized, returns a 401 response with an error message.
 * If the request body is invalid, returns a 400 response with an error message containing the validation errors.
 * If the company is not found, returns a 404 response with an error message.
 */
export async function action({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const { items, companyId, kleinunternehmer, ...invoiceData } = parsed.data;

  const company = await prisma.company.findFirst({ where: { id: companyId, userId: user.id } });
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  // Use company's kleinunternehmer setting, fallback to request data
  const isKleinunternehmer = kleinunternehmer ?? company.kleinunternehmer;

  // Server-side recalculation of all amounts
  const recalculatedItems = items.map(item => ({
    ...item,
    ...(isKleinunternehmer
      ? calcItemAmountsKleinunternehmer(item.quantity, item.unitPrice)
      : calcItemAmounts(item.quantity, item.unitPrice, item.taxRate)),
  }));

  const totals = calcInvoiceTotals(recalculatedItems);

  const number = await generateInvoiceNumber(companyId);

  const invoice = await prisma.invoice.create({
    data: {
      ...invoiceData,
      number,
      companyId,
      kleinunternehmer: isKleinunternehmer,
      issueDate: new Date(invoiceData.issueDate),
      deliveryDate: invoiceData.deliveryDate ? new Date(invoiceData.deliveryDate) : null,
      dueDate: new Date(invoiceData.dueDate),
      netTotal: totals.netTotal,
      taxTotal: totals.taxTotal,
      grossTotal: totals.grossTotal,
      items: { create: recalculatedItems },
    },
    include: { items: true, customer: true },
  });

  await log({
    userId: user.id,
    action: "CREATE_INVOICE",
    entity: "Invoice",
    entityId: invoice.id,
    metadata: {
      number: invoice.number,
      customerId: invoice.customerId,
      grossTotal: invoice.grossTotal.toString(),
      itemCount: recalculatedItems.length,
      kleinunternehmer: isKleinunternehmer,
    },
    request,
  });

  return Response.json(invoice, { status: 201 });
}
