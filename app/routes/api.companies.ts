import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
import { logApiError } from "@/lib/error-logger.server";
import { companySchema } from "@/lib/schemas";

export async function loader({ request }: { request: Request }) {
  try {
    const user = await getApiUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const companies = await prisma.company.findMany({
      where: { userId: user.id },
      include: { _count: { select: { invoices: true, customers: true } } },
      orderBy: { name: "asc" },
    });

    return Response.json(companies);
  } catch (error) {
    logApiError(error, {
      request,
      endpoint: "/api/companies",
      statusCode: 500,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function action({ request }: { request: Request }) {
  try {
    const user = await getApiUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = companySchema.safeParse(body);
    if (!parsed.success) {
      console.warn("[CompanyAPI] Validation failed:", parsed.error.issues);
      return Response.json({ error: parsed.error.issues }, { status: 400 });
    }

    const company = await prisma.company.create({
      data: { ...parsed.data, userId: user.id },
    });

    await log({ userId: user.id, action: "CREATE_COMPANY", entity: "Company", entityId: company.id, request });

    return Response.json(company, { status: 201 });
  } catch (error) {
    logApiError(error, {
      request,
      endpoint: "/api/companies",
      statusCode: 500,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
