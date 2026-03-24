import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const updateSchema = z.object({
  bezeichnung: z.string().min(1),
  anschaffungsdatum: z.string().min(1),
  anschaffungskosten: z.number().positive(),
  nutzungsdauerJahre: z.number().int().min(1),
  restwert: z.number().min(0),
  beschreibung: z.string().optional(),
  aktiv: z.boolean(),
});

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const asset = await prisma.anlagegut.findFirst({
    where: { id: params.id, company: { userId: user.id } },
  });
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    await prisma.anlagegut.delete({ where: { id: params.id } });
    return Response.json({ ok: true });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.anlagegut.update({
    where: { id: params.id },
    data: {
      bezeichnung: parsed.data.bezeichnung,
      anschaffungsdatum: new Date(parsed.data.anschaffungsdatum),
      anschaffungskosten: parsed.data.anschaffungskosten,
      nutzungsdauerJahre: parsed.data.nutzungsdauerJahre,
      restwert: parsed.data.restwert,
      beschreibung: parsed.data.beschreibung,
      aktiv: parsed.data.aktiv,
    },
  });

  return Response.json({
    ...updated,
    anschaffungskosten: Number(updated.anschaffungskosten),
    restwert: Number(updated.restwert),
    anschaffungsdatum: updated.anschaffungsdatum.toISOString(),
  });
}
