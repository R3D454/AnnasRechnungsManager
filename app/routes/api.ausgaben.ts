import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";
import { AusgabeKategorie } from "@prisma/client";

const createSchema = z.object({
  companyId: z.string().min(1),
  kategorie: z.nativeEnum(AusgabeKategorie),
  betrag: z.number().positive(),
  datum: z.string().min(1),
  beschreibung: z.string().optional(),
});

export async function loader({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;

  if (!companyId) return Response.json({ error: "companyId required" }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { id: companyId, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const ausgaben = await prisma.betriebsausgabe.findMany({
    where: {
      companyId,
      ...(year ? {
        datum: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      } : {}),
    },
    orderBy: { datum: "desc" },
  });

  return Response.json(
    ausgaben.map((a) => ({
      ...a,
      betrag: Number(a.betrag),
      datum: a.datum.toISOString(),
    }))
  );
}

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

  const ausgabe = await prisma.betriebsausgabe.create({
    data: {
      companyId: parsed.data.companyId,
      kategorie: parsed.data.kategorie,
      betrag: parsed.data.betrag,
      datum: new Date(parsed.data.datum),
      beschreibung: parsed.data.beschreibung,
    },
  });

  return Response.json({ ...ausgabe, betrag: Number(ausgabe.betrag), datum: ausgabe.datum.toISOString() }, { status: 201 });
}
