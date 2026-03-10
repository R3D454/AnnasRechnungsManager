import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1),
  vatId: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().min(1),
  zip: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

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
    await prisma.customer.delete({ where: { id: params.id } });
    return Response.json({ ok: true });
  }

  // PUT
  const body = await request.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.customer.update({ where: { id: params.id }, data: parsed.data });
  return Response.json(updated);
}
