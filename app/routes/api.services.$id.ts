import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().optional(),
  unitPrice: z.number(),
  taxRate: z.number(),
});

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = await prisma.service.findFirst({
    where: { id: params.id, company: { userId: user.id } },
  });
  if (!service) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    await prisma.service.delete({ where: { id: params.id, company: { userId: user.id } } });
    return Response.json({ ok: true });
  }

  // PUT
  const body = await request.json();
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.service.update({ where: { id: params.id }, data: parsed.data });
  return Response.json(updated);
}
