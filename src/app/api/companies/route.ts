import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().min(1),
  legalForm: z.string().optional(),
  taxId: z.string().optional(),
  vatId: z.string().optional(),
  address: z.string().min(1),
  zip: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional().default("DE"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  bankName: z.string().optional(),
  invoicePrefix: z.string().optional().default("RE"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { invoices: true, customers: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = companySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(company, { status: 201 });
}
