import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
import { customerUpdateSchema } from "@/lib/schemas";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findFirst({
    where: { id: params.id, company: { userId: user.id } },
  });
  if (!customer) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(customer);
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findFirst({
    where: { id: params.id, company: { userId: user.id } },
  });
  if (!customer) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    await prisma.customer.delete({ where: { id: params.id, company: { userId: user.id } } });
    await log({ userId: user.id, action: "DELETE_CUSTOMER", entity: "Customer", entityId: params.id, request });
    return Response.json({ ok: true });
  }

  // PUT
  const body = await request.json();
  const parsed = customerUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.customer.update({ where: { id: params.id }, data: parsed.data });
  await log({ userId: user.id, action: "UPDATE_CUSTOMER", entity: "Customer", entityId: params.id, request });
  return Response.json(updated);
}
