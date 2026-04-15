import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
import { companyUpdateSchema } from "@/lib/schemas";

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
    const action = archive ? "ARCHIVE_COMPANY" : "UPDATE_COMPANY";
    await log({ userId: user.id, action, entity: "Company", entityId: params.id, request });
    return Response.json({ ok: true });
  }

  // PUT
  const body = await request.json();
  const parsed = companyUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.company.update({ where: { id: params.id }, data: parsed.data });
  await log({ userId: user.id, action: "UPDATE_COMPANY", entity: "Company", entityId: params.id, request });
  return Response.json(updated);
}
