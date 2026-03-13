import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

async function getInvoice(id: string, userId: string) {
  return prisma.invoice.findFirst({
    where: { id, company: { userId } },
    include: { items: { orderBy: { position: "asc" } }, customer: true, company: true },
  });
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await getInvoice(params.id, user.id);
  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(invoice);
}

const statusSchema = z.object({ status: z.nativeEnum(InvoiceStatus) });

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await getInvoice(params.id, user.id);
  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    const isAdmin = user.role === "ADMIN";
    const deletableStatuses: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED];
    if (!isAdmin && !deletableStatuses.includes(invoice.status)) {
      return Response.json(
        { error: "Nur Entwürfe und stornierte Rechnungen können gelöscht werden." },
        { status: 403 }
      );
    }
    await prisma.invoice.delete({ where: { id: params.id } });
    return Response.json({ ok: true });
  }

  // PATCH
  const body = await request.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });
  return Response.json(updated);
}
