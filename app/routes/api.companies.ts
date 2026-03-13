import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().min(1),
  legalForm: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().min(1),
  zip: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional().default("DE"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  bankName: z.string().optional(),
  invoicePrefix: z.string().optional().default("RE"),
  kleinunternehmer: z.boolean().optional().default(false),
});

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

  return Response.json(company, { status: 201 });
}
