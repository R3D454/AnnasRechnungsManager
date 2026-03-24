import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  typ: z.enum(["AUSGABE", "EINNAHME"]),
});

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const typ = searchParams.get("typ") as "AUSGABE" | "EINNAHME" | null;
  if (!typ || !["AUSGABE", "EINNAHME"].includes(typ)) {
    return Response.json({ error: "typ (AUSGABE|EINNAHME) required" }, { status: 400 });
  }

  const kats = await prisma.buchungKategorie.findMany({
    where: { companyId: params.id, typ },
    orderBy: { name: "asc" },
  });

  const withUsage = await Promise.all(
    kats.map(async (k) => ({
      id: k.id,
      name: k.name,
      typ: k.typ,
      inUse:
        (await prisma.buchung.count({
          where: { companyId: params.id, kategorie: k.name, isBusinessRecord: true },
        })) > 0,
    }))
  );

  return Response.json(withUsage);
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const kat = await prisma.buchungKategorie.create({
    data: {
      companyId: params.id,
      name: parsed.data.name,
      typ: parsed.data.typ,
    },
  });

  return Response.json(kat, { status: 201 });
}
