import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

async function getInvoice(id: string, userId: string) {
  return prisma.invoice.findFirst({
    where: { id, company: { userId } },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      company: true,
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const invoice = await getInvoice(id, session.user.id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

const statusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const invoice = await getInvoice(id, session.user.id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const invoice = await getInvoice(id, session.user.id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
