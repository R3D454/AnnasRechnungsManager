import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, company: { userId: user.id } },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      company: true,
    },
  });

  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const React = (await import("react")).default;
  const { InvoicePDFDocument } = await import("@/components/invoice/invoice-pdf");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoicePDFDocument as any, { invoice }) as any;
  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rechnung-${invoice.number ?? invoice.id}.pdf"`,
    },
  });
}
