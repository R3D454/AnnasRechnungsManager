import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, company: { userId: session.user.id } },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      company: true,
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Dynamic import to avoid SSR bundling issues with @react-pdf/renderer
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const React = (await import("react")).default;
  const { InvoicePDFDocument } = await import("@/components/invoice/invoice-pdf");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoicePDFDocument as any, { invoice }) as any;
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rechnung-${invoice.number}.pdf"`,
    },
  });
}
