import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
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
  kleinunternehmer: z.boolean().optional(),
});

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({ where: { id: params.id, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(company);
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({ where: { id: params.id, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    await prisma.company.delete({ where: { id: params.id, userId: user.id } });
    await log({ userId: user.id, action: "DELETE_COMPANY", entity: "Company", entityId: params.id, request });
    return Response.json({ ok: true });
  }

  if (request.method === "PATCH") {
    const body = await request.json();
    const archive = body.archived === true;
    await prisma.company.update({
      where: { id: params.id },
      data: {
        archived: archive,
        archivedAt: archive ? new Date() : null,
      },
    });
    return Response.json({ ok: true });
  }

  // PUT
  const body = await request.json();
  const parsed = companySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.company.update({ where: { id: params.id }, data: parsed.data });
  return Response.json(updated);
}
