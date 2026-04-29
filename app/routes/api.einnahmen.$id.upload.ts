import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/** Absolute path to the document storage root (configurable via env). */
function storageRoot(): string {
  return resolve(process.env.BELEG_STORAGE_PATH ?? "data/documents");
}

/** belegUrl format stored in DB: "beleg:{userId}/{filename}" */
function parseBelegPath(belegUrl: string | null): string | null {
  if (!belegUrl?.startsWith("beleg:")) return null;
  return belegUrl.slice("beleg:".length); // "{userId}/{filename}"
}

async function removeUploadedFile(belegUrl: string | null) {
  const rel = parseBelegPath(belegUrl);
  if (!rel) return;
  try {
    await unlink(join(storageRoot(), rel));
  } catch {
    // File may already be gone
  }
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const buchung = await prisma.buchung.findFirst({
    where: { id: params.id, company: { userId: user.id }, isBusinessRecord: true },
    select: { id: true, companyId: true, belegUrl: true },
  });
  if (!buchung) return Response.json({ error: "Not found" }, { status: 404 });

  // DELETE — remove beleg
  if (request.method === "DELETE") {
    await removeUploadedFile(buchung.belegUrl);
    await prisma.buchung.update({ where: { id: params.id }, data: { belegUrl: null } });
    await log({
      userId: user.id,
      action: "DELETE_BELEG",
      entity: "Buchung",
      entityId: params.id,
      request,
    });
    return Response.json({ ok: true });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // POST — upload new beleg
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Ungültige Formulardaten" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Keine Datei angegeben" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 413 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return Response.json(
      { error: "Dateityp nicht erlaubt (erlaubt: PDF, JPG, PNG, WebP, GIF)" },
      { status: 415 }
    );
  }

  // Replace old file if present
  await removeUploadedFile(buchung.belegUrl);

  const safeName = `${buchung.id}-${Date.now()}.${ext}`;
  const userDir = join(storageRoot(), user.id);
  await mkdir(userDir, { recursive: true });
  await writeFile(join(userDir, safeName), Buffer.from(await file.arrayBuffer()));

  // Store as "beleg:{userId}/{storedName}|{originalName}"
  // storedName is used for serving; originalName is preserved for display
  const originalName = file.name;
  const belegUrl = `beleg:${user.id}/${safeName}|${originalName}`;
  await prisma.buchung.update({ where: { id: params.id }, data: { belegUrl } });

  await log({
    userId: user.id,
    action: "UPLOAD_BELEG",
    entity: "Buchung",
    entityId: params.id,
    metadata: { filename: file.name, size: file.size, type: file.type },
    request,
  });

  return Response.json({ belegUrl, originalName: file.name, size: file.size });
}
