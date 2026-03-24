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

export async function loader({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;

  if (!companyId) return Response.json({ error: "companyId required" }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { id: companyId, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const ausgaben = await prisma.buchung.findMany({
    where: {
      companyId,
      type: "ENTNAHME",
      isBusinessRecord: true,
      ...(year ? {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      } : {}),
    },
    orderBy: { date: "desc" },
  });

  return Response.json(
    ausgaben.map((a) => ({
      ...a,
      amount: Number(a.amount),
      date: a.date.toISOString(),
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

  const ausgabe = await prisma.buchung.create({
    data: {
      companyId: parsed.data.companyId,
      account: parsed.data.zahlungsart === "KASSE" ? "KASSE" : "BANK",
      type: "ENTNAHME",
      amount: parsed.data.betrag,
      date: new Date(parsed.data.datum),
      description: parsed.data.beschreibung,
      kategorie: parsed.data.kategorie,
      steuersatz: parsed.data.steuersatz,
      zahlungsart: parsed.data.zahlungsart,
      isBusinessRecord: true,
    },
  });

  return Response.json({
    ...ausgabe,
    amount: Number(ausgabe.amount),
    date: ausgabe.date.toISOString(),
  }, { status: 201 });
}
