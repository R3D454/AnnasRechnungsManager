import prisma from "@/lib/prisma.server";

export type LogAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "CREATE_USER"
  | "UPDATE_USER"
  | "DELETE_USER"
  | "CREATE_COMPANY"
  | "UPDATE_COMPANY"
  | "DELETE_COMPANY"
  | "CREATE_INVOICE"
  | "UPDATE_INVOICE"
  | "DELETE_INVOICE";

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
        metadata: metadata ?? undefined,
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
