import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";
import { EinnahmeKategorie } from "@prisma/client";

const updateSchema = z.object({
  kategorie: z.nativeEnum(EinnahmeKategorie),
  betrag: z.number().positive(),
  steuersatz: z.number().min(0).default(0),
  zahlungsart: z.enum(["KASSE", "BANK"]).default("BANK"),
  datum: z.string().min(1),
  beschreibung: z.string().optional(),
});

/**
 * Handles an API request to create, update or delete a einnahme.
 *
 * @param {Request} request - The request object.
 * @param {Object} params - The route parameters.
 * @param {string} params.id - The id of the einnahme to update or delete.
 *
 * @returns {Promise<Response>} - A promise resolving to a Response object.
 *
 * @throws {Response} - If the request is unauthorized, returns a 401 response with an error message.
 * @throws {Response} - If the einnahme is not found, returns a 404 response with an error message.
 * @throws {Response} - If the request body is invalid, returns a 400 response with an error message containing the validation errors.
 */
export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const einnahme = await prisma.betriebseinnahme.findFirst({
    where: { id: params.id, company: { userId: user.id } },
  });
  if (!einnahme) return Response.json({ error: "Not found" }, { status: 404 });

  if (request.method === "DELETE") {
    await prisma.betriebseinnahme.delete({ where: { id: params.id } });
    return Response.json({ ok: true });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const updated = await prisma.betriebseinnahme.update({
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
