import prisma from "@/lib/prisma.server";

export type LogAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "CHANGE_PASSWORD"
  | "CREATE_USER"
  | "UPDATE_USER"
  | "DELETE_USER"
  | "CREATE_COMPANY"
  | "UPDATE_COMPANY"
  | "DELETE_COMPANY"
  | "ARCHIVE_COMPANY"
  | "CREATE_INVOICE"
  | "UPDATE_INVOICE"
  | "DELETE_INVOICE"
  | "UPDATE_INVOICE_STATUS"
  | "CREATE_CUSTOMER"
  | "UPDATE_CUSTOMER"
  | "DELETE_CUSTOMER"
  | "CREATE_SERVICE"
  | "UPDATE_SERVICE"
  | "DELETE_SERVICE"
  | "UPLOAD_BELEG"
  | "DELETE_BELEG";

export async function log({
  userId,
  action,
  entity,
  entityId,
  metadata,
  request,
}: {
  userId?: string | null;
  action: LogAction;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  const ipAddress = request
    ? request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      undefined
    : undefined;

  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId ?? null,
        metadata: (metadata as any) ?? undefined,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never let logging failures break the app
    console.error("[AuditLog] Failed to write log entry:", err);
  }

  console.log(
    `[AUDIT] ${new Date().toISOString()} | ${action}${entity ? ` | ${entity}` : ""}${entityId ? `:${entityId}` : ""}${userId ? ` | user:${userId}` : ""}${ipAddress ? ` | ip:${ipAddress}` : ""}`
  );
}
