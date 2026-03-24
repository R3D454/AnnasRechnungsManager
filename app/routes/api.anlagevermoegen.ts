import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";
import { afaFuerJahr, buchwert, assetStatus } from "@/lib/afa";

const createSchema = z.object({
  companyId: z.string().min(1),
  bezeichnung: z.string().min(1),
  anschaffungsdatum: z.string().min(1),
  anschaffungskosten: z.number().positive(),
  nutzungsdauerJahre: z.number().int().min(1),
  restwert: z.number().min(0).default(0),
  beschreibung: z.string().optional(),
  aktiv: z.boolean().default(true),
});

function toRaw(a: {
  anschaffungskosten: unknown;
  nutzungsdauerJahre: number;
  restwert: unknown;
  anschaffungsdatum: Date;
  aktiv: boolean;
}) {
  return {
    anschaffungskosten: Number(a.anschaffungskosten),
    nutzungsdauerJahre: a.nutzungsdauerJahre,
    restwert: Number(a.restwert),
    anschaffungsdatum: a.anschaffungsdatum.toISOString(),
    aktiv: a.aktiv,
  };
}

export async function loader({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  if (!companyId) return Response.json({ error: "companyId required" }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { id: companyId, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const assets = await prisma.anlagegut.findMany({
    where: { companyId },
    orderBy: { anschaffungsdatum: "asc" },
  });

  return Response.json({
    year,
    assets: assets.map((a) => {
      const raw = toRaw(a);
      return {
        id: a.id,
        bezeichnung: a.bezeichnung,
        beschreibung: a.beschreibung,
        anschaffungsdatum: a.anschaffungsdatum.toISOString(),
        anschaffungskosten: raw.anschaffungskosten,
        nutzungsdauerJahre: a.nutzungsdauerJahre,
        restwert: raw.restwert,
        aktiv: a.aktiv,
        afaJahr: afaFuerJahr(raw, year),
        buchwert: buchwert(raw, year),
        status: assetStatus(raw, year),
      };
    }),
  });
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

  const asset = await prisma.anlagegut.create({
    data: {
      companyId: parsed.data.companyId,
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
    ...asset,
    anschaffungskosten: Number(asset.anschaffungskosten),
    restwert: Number(asset.restwert),
    anschaffungsdatum: asset.anschaffungsdatum.toISOString(),
  }, { status: 201 });
}
