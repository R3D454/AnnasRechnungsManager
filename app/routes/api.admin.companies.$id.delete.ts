import { requireAdmin } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireAdmin(request);

  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
  });

  if (!company) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  await prisma.company.delete({
    where: { id: params.id },
  });

  await log({
    userId: user.id,
    action: "DELETE_COMPANY",
    entity: "Company",
    entityId: params.id,
    metadata: { companyName: company.name },
    request,
  });

  return Response.json({ ok: true });
}
