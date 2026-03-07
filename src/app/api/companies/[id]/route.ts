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
  country: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  bankName: z.string().optional(),
  invoicePrefix: z.string().optional(),
});

async function getCompany(id: string, userId: string) {
  return prisma.company.findFirst({ where: { id, userId } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await getCompany(id, session.user.id);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(company);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await getCompany(id, session.user.id);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = companySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.company.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await getCompany(id, session.user.id);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.company.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
