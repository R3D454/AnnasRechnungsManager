import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const customerSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1),
  vatId: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().min(1),
  zip: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional().default("DE"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

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
  return Response.json(customer, { status: 201 });
}
