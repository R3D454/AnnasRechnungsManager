import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";
import { EinnahmeKategorie } from "@prisma/client";

const createSchema = z.object({
  companyId: z.string().min(1),
  kategorie: z.nativeEnum(EinnahmeKategorie),
  betrag: z.number().positive(),
  steuersatz: z.number().min(0).default(0),
  zahlungsart: z.enum(["KASSE", "BANK"]).default("BANK"),
  datum: z.string().min(1),
  beschreibung: z.string().optional(),
});

/**
 * Loads the data for the EinnahmenPage.
 *
 * Requires a companyId search parameter. If year is provided, filters einnahmen for the given year.
 *
 * Returns a list of einnahmen as a JSON object.
 *
 * If the request is unauthorized, returns a 401 response with an error message.
 * If the request body is invalid, returns a 400 response with an error message containing the validation errors.
 * If the company is not found, returns a 404 response with an error message.
 */
export async function loader({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;

  if (!companyId) return Response.json({ error: "companyId required" }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { id: companyId, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const einnahmen = await prisma.betriebseinnahme.findMany({
    where: {
      companyId,
      ...(year ? {
        datum: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      } : {}),
    },
    orderBy: { datum: "asc" },
  });

  return Response.json(
    einnahmen.map((e) => ({
      ...e,
      betrag: Number(e.betrag),
      steuersatz: Number(e.steuersatz),
      datum: e.datum.toISOString(),
    }))
  );
}

/**
 * Creates a new einnahme for a given company.
 *
 * Requires a JSON object in the request body with the following shape:
 * {
 *   companyId: string,
 *   kategorie: EinnahmeKategorie,
 *   betrag: number,
 *   datum: string,
 *   beschreibung: string,
 * }
 *
 * Returns the created einnahme as a JSON object.
 *
 * If the request is unauthorized, returns a 401 response with an error message.
 * If the request body is invalid, returns a 400 response with an error message containing the validation errors.
 * If the company is not found, returns a 404 response with an error message.
 */
export async function action({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const company = await prisma.company.findFirst({
    where: { id: parsed.data.companyId, userId: user.id },
  });
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const einnahme = await prisma.betriebseinnahme.create({
    data: {
      companyId: parsed.data.companyId,
      kategorie: parsed.data.kategorie,
      betrag: parsed.data.betrag,
      steuersatz: parsed.data.steuersatz,
      zahlungsart: parsed.data.zahlungsart,
      datum: new Date(parsed.data.datum),
      beschreibung: parsed.data.beschreibung,
    },
  });

  return Response.json(
    {
      ...einnahme,
      betrag: Number(einnahme.betrag),
      steuersatz: Number(einnahme.steuersatz),
      datum: einnahme.datum.toISOString(),
    },
    { status: 201 }
  );
}
