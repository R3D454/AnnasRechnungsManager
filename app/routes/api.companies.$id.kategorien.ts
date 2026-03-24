import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  typ: z.enum(["EINNAHME", "AUSGABE"]),
});

/**
 * Loader: GET all categories for a company
 *
 * Query params:
 *   - typ (optional): "EINNAHME" or "AUSGABE" to filter by type
 *
 * Returns a JSON array of BuchungKategorie records.
 */
export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const typ = searchParams.get("typ");

  const kategorien = await prisma.buchungKategorie.findMany({
    where: {
      companyId: params.id,
      ...(typ ? { typ } : {}),
    },
    orderBy: { name: "asc" },
  });

  return Response.json(kategorien);
}

/**
 * Action: POST to create a new category, DELETE to remove one
 *
 * POST body:
 *   { name: string, typ: "EINNAHME" | "AUSGABE" }
 *
 * DELETE query param:
 *   - kategorieId: the id of the category to delete
 */
export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  if (request.method === "DELETE") {
    const { searchParams } = new URL(request.url);
    const kategorieId = searchParams.get("kategorieId");

    if (!kategorieId) {
      return Response.json({ error: "kategorieId required" }, { status: 400 });
    }

    // Check that kategorie belongs to this company
    const kategorie = await prisma.buchungKategorie.findFirst({
      where: { id: kategorieId, companyId: params.id },
    });
    if (!kategorie) return Response.json({ error: "Category not found" }, { status: 404 });

    // Check if kategorie is in use
    const inUse = await prisma.buchung.findFirst({
      where: { kategorie: kategorie.name, companyId: params.id },
    });
    if (inUse) {
      return Response.json(
        { error: "Category is in use and cannot be deleted" },
        { status: 409 }
      );
    }

    await prisma.buchungKategorie.delete({ where: { id: kategorieId } });
    return Response.json({ ok: true });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const kategorie = await prisma.buchungKategorie.create({
    data: {
      companyId: params.id,
      name: parsed.data.name,
      typ: parsed.data.typ,
    },
  });

  return Response.json(kategorie, { status: 201 });
}
