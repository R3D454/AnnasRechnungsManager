import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
import { companySchema } from "@/lib/schemas";

export async function loader({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({
    where: { userId: user.id },
    include: { _count: { select: { invoices: true, customers: true } } },
    orderBy: { name: "asc" },
  });

  return Response.json(companies);
}

export async function action({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = companySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: { ...parsed.data, userId: user.id },
  });

  await log({ userId: user.id, action: "CREATE_COMPANY", entity: "Company", entityId: company.id, request });

  return Response.json(company, { status: 201 });
}
