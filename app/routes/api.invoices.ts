import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { generateInvoiceNumber } from "@/lib/invoice-number.server";
import { z } from "zod";

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

const invoiceSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1),
  issueDate: z.string(),
  deliveryDate: z.string().optional(),
  dueDate: z.string(),
  notes: z.string().optional(),
  kleinunternehmer: z.boolean().optional().default(false),
  items: z.array(itemSchema).min(1),
  netTotal: z.number(),
  taxTotal: z.number(),
  grossTotal: z.number(),
});

export async function action({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const { items, companyId, ...invoiceData } = parsed.data;

  const company = await prisma.company.findFirst({ where: { id: companyId, userId: user.id } });
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const number = await generateInvoiceNumber(companyId);

  const invoice = await prisma.invoice.create({
    data: {
      ...invoiceData,
      number,
      companyId,
      issueDate: new Date(invoiceData.issueDate),
      deliveryDate: invoiceData.deliveryDate ? new Date(invoiceData.deliveryDate) : null,
      dueDate: new Date(invoiceData.dueDate),
      items: { create: items },
    },
    include: { items: true, customer: true },
  });

  return Response.json(invoice, { status: 201 });
}
