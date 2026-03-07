import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const customerSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1),
  vatId: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().min(1),
  zip: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional().default("DE"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  // Verify company belongs to user
  const company = await prisma.company.findFirst({
    where: { id: parsed.data.companyId, userId: session.user.id },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const customer = await prisma.customer.create({ data: parsed.data });
  return NextResponse.json(customer, { status: 201 });
}
