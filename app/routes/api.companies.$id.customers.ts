import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({ where: { id: params.id, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const customers = await prisma.customer.findMany({
    where: { companyId: params.id },
    orderBy: { name: "asc" },
  });

  return Response.json(customers);
}
