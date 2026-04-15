import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
import { customerSchema } from "@/lib/schemas";

export async function action({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const company = await prisma.company.findFirst({
    where: { id: parsed.data.companyId, userId: user.id },
  });
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const customer = await prisma.customer.create({ data: parsed.data });
  await log({ userId: user.id, action: "CREATE_CUSTOMER", entity: "Customer", entityId: customer.id, request });
  return Response.json(customer, { status: 201 });
}
