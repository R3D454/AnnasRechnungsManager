import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const updateSchema = z.object({
  kategorie: z.string().min(1),
  betrag: z.number().positive(),
  steuersatz: z.number().min(0).default(0),
  zahlungsart: z.enum(["KASSE", "BANK"]).default("BANK"),
  datum: z.string().min(1),
  beschreibung: z.string().optional(),
  belegUrl: z.string().optional(),
});

/**
 * Handles an API request to update or delete a einnahme (Buchung).
 *
 * @param {Request} request - The request object.
 * @param {Object} params - The route parameters.
 * @param {string} params.id - The id of the Buchung (einnahme) to update or delete.
 *
 * @returns {Promise<Response>} - A promise resolving to a Response object.
 */
export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const buchung = await prisma.buchung.findFirst({
    where: { id: params.id, company: { userId: user.id }, type: "EINLAGE", isBusinessRecord: true },
  });
  if (!buchung) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    await prisma.buchung.delete({ where: { id: params.id } });
    return Response.json({ ok: true });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.buchung.update({
    where: { id: params.id },
    data: {
      kategorie: parsed.data.kategorie,
      amount: parsed.data.betrag,
      steuersatz: parsed.data.steuersatz,
      zahlungsart: parsed.data.zahlungsart,
      account: parsed.data.zahlungsart === "KASSE" ? "KASSE" : "BANK",
      date: new Date(parsed.data.datum),
      description: parsed.data.beschreibung,
      belegUrl: parsed.data.belegUrl || null,
    },
  });

  return Response.json({
    ...updated,
    amount: Number(updated.amount),
    date: updated.date.toISOString(),
  });
}
