import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({ where: { id: params.id, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: { companyId: params.id },
    include: { customer: { select: { name: true } } },
    orderBy: { issueDate: "desc" },
  });

  return Response.json(invoices);
}
