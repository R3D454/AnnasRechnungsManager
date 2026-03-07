import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/invoice-number";
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
  items: z.array(itemSchema).min(1),
  netTotal: z.number(),
  taxTotal: z.number(),
  grossTotal: z.number(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { items, companyId, ...invoiceData } = parsed.data;

  // Verify company belongs to user
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.user.id },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const number = await generateInvoiceNumber(companyId);

  const invoice = await prisma.invoice.create({
    data: {
      ...invoiceData,
      number,
      companyId,
      issueDate: new Date(invoiceData.issueDate),
      deliveryDate: invoiceData.deliveryDate ? new Date(invoiceData.deliveryDate) : null,
      dueDate: new Date(invoiceData.dueDate),
      items: {
        create: items.map((item) => ({
          ...item,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          netAmount: item.netAmount,
          taxAmount: item.taxAmount,
          grossAmount: item.grossAmount,
        })),
      },
    },
    include: { items: true, customer: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}
