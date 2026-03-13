import { useLoaderData } from "react-router";
import { requireAdmin } from "@/session.server";
import prisma from "@/lib/prisma";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Anmeldung",
  LOGIN_FAILED: "Anmeldung fehlgeschlagen",
  LOGOUT: "Abmeldung",
  CREATE_USER: "Benutzer erstellt",
  UPDATE_USER: "Benutzer bearbeitet",
  DELETE_USER: "Benutzer gelöscht",
  CREATE_COMPANY: "Firma erstellt",
  UPDATE_COMPANY: "Firma bearbeitet",
  DELETE_COMPANY: "Firma gelöscht",
  CREATE_INVOICE: "Rechnung erstellt",
  UPDATE_INVOICE: "Rechnung bearbeitet",
  DELETE_INVOICE: "Rechnung gelöscht",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-green-100 text-green-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  LOGOUT: "bg-slate-100 text-slate-600",
  CREATE_USER: "bg-blue-100 text-blue-700",
  UPDATE_USER: "bg-amber-100 text-amber-700",
  DELETE_USER: "bg-red-100 text-red-700",
  CREATE_COMPANY: "bg-blue-100 text-blue-700",
  UPDATE_COMPANY: "bg-amber-100 text-amber-700",
  DELETE_COMPANY: "bg-red-100 text-red-700",
  CREATE_INVOICE: "bg-blue-100 text-blue-700",
  UPDATE_INVOICE: "bg-amber-100 text-amber-700",
  DELETE_INVOICE: "bg-red-100 text-red-700",
};

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const pageSize = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true, username: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
      userName: l.user?.name ?? null,
      userUsername: l.user?.username ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export default function AdminLogsPage() {
  const { logs, total, page, totalPages } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit-Log</h1>
        <p className="text-slate-500 text-sm mt-1">{total} Einträge insgesamt</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Zeitpunkt</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Aktion</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Benutzer</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Objekt</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  Noch keine Einträge vorhanden.
                </td>
              </tr>
            )}
            {logs.map((log, i) => (
              <tr
                key={log.id}
                style={{ borderBottom: i < logs.length - 1 ? "1px solid #f1f5f9" : "none" }}
              >
                <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("de-DE")}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {log.userName ? (
                    <span>
                      {log.userName}{" "}
                      <span className="text-slate-400 text-xs">@{log.userUsername}</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">
                  {log.entity ? (
                    <span>
                      {log.entity}
                      {log.entityId && (
                        <span className="text-slate-300"> #{log.entityId.slice(0, 8)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-400 text-xs font-mono">
                  {log.ipAddress ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && (
            <a
              href={`?page=${page - 1}`}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Zurück
            </a>
          )}
          <span className="px-3 py-1.5 text-sm text-slate-500">
            Seite {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`?page=${page + 1}`}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Weiter
            </a>
          )}
        </div>
      )}
    </div>
  );
}
