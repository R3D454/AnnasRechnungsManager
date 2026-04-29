import { readFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { requireUser } from "@/session.server";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

function storageRoot(): string {
  return resolve(process.env.BELEG_STORAGE_PATH ?? "data/documents");
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { userId: string; filename: string };
}) {
  const user = await requireUser(request);

  // Users may only access their own documents
  if (params.userId !== user.id) {
    throw new Response("Forbidden", { status: 403 });
  }

  // Prevent path traversal
  const root = storageRoot();
  const filePath = join(root, params.userId, params.filename);
  if (!filePath.startsWith(root)) {
    throw new Response("Forbidden", { status: 403 });
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    throw new Response("Not Found", { status: 404 });
  }

  const ext = extname(params.filename).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const disposition = contentType === "application/pdf" ? "inline" : "inline";

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${params.filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
