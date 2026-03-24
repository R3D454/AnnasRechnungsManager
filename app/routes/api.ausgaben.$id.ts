import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";
import { AusgabeKategorie } from "@prisma/client";

const updateSchema = z.object({
  kategorie: z.nativeEnum(AusgabeKategorie),
  betrag: z.number().positive(),
  steuersatz: z.number().min(0).default(0),
  zahlungsart: z.enum(["KASSE", "BANK"]).default("BANK"),
  datum: z.string().min(1),
  beschreibung: z.string().optional(),
});

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ausgabe = await prisma.betriebsausgabe.findFirst({
    where: { id: params.id, company: { userId: user.id } },
  });
  if (!ausgabe) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    await prisma.betriebsausgabe.delete({ where: { id: params.id } });
    return Response.json({ ok: true });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.betriebsausgabe.update({
    where: { id: params.id },
    data: {
      kategorie: parsed.data.kategorie,
      betrag: parsed.data.betrag,
      steuersatz: parsed.data.steuersatz,
      zahlungsart: parsed.data.zahlungsart,
      datum: new Date(parsed.data.datum),
      beschreibung: parsed.data.beschreibung,
    },
  });

  return Response.json({
    ...updated,
    betrag: Number(updated.betrag),
    steuersatz: Number(updated.steuersatz),
    datum: updated.datum.toISOString(),
  });
}
