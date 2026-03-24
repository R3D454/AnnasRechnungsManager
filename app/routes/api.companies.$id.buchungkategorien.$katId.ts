import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
});

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string; katId: string };
}) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const kat = await prisma.buchungKategorie.findFirst({
    where: { id: params.katId, companyId: params.id, company: { userId: user.id } },
  });
  if (!kat) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    const usedCount = await prisma.buchung.count({
      where: { companyId: params.id, kategorie: kat.name, isBusinessRecord: true },
    });
    if (usedCount > 0) {
      return Response.json(
        { error: `Kategorie wird von ${usedCount} Buchung(en) verwendet und kann nicht gelöscht werden.` },
        { status: 409 }
      );
    }
    await prisma.buchungKategorie.delete({ where: { id: params.katId } });
    return Response.json({ ok: true });
  }

  if (request.method === "PUT") {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

    const updated = await prisma.buchungKategorie.update({
      where: { id: params.katId },
      data: { name: parsed.data.name },
    });
    return Response.json(updated);
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
