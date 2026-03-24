import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const createSchema = z.object({
  companyId: z.string().min(1),
  kategorie: z.string().min(1),
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
 * Returns a list of einnahmen (Buchungen with isBusinessRecord=true, type=EINLAGE) as a JSON object.
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

  const einnahmen = await prisma.buchung.findMany({
    where: {
      companyId,
      type: "EINLAGE",
      isBusinessRecord: true,
      ...(year ? {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      } : {}),
    },
    orderBy: { date: "asc" },
  });

  return Response.json(
    einnahmen.map((e) => ({
      ...e,
      amount: Number(e.amount),
      date: e.date.toISOString(),
    }))
  );
}

/**
 * Creates a new einnahme (Buchung) for a given company.
 *
 * Requires a JSON object in the request body with the following shape:
 * {
 *   companyId: string,
 *   kategorie: string (BuchungKategorie name),
 *   betrag: number,
 *   steuersatz: number,
 *   zahlungsart: "KASSE" | "BANK",
 *   datum: string,
 *   beschreibung: string,
 * }
 *
 * Returns the created Buchung as a JSON object.
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

  const einnahme = await prisma.buchung.create({
    data: {
      companyId: parsed.data.companyId,
      account: parsed.data.zahlungsart === "KASSE" ? "KASSE" : "BANK",
      type: "EINLAGE",
      amount: parsed.data.betrag,
      date: new Date(parsed.data.datum),
      description: parsed.data.beschreibung,
      kategorie: parsed.data.kategorie,
      steuersatz: parsed.data.steuersatz,
      zahlungsart: parsed.data.zahlungsart,
      isBusinessRecord: true,
    },
  });

  return Response.json(
    {
      ...einnahme,
      amount: Number(einnahme.amount),
      date: einnahme.date.toISOString(),
    },
    { status: 201 }
  );
}
