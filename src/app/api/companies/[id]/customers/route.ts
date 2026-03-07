import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify company belongs to user
  const company = await prisma.company.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const customers = await prisma.customer.findMany({
    where: { companyId: id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}
