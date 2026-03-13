import { Link, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/tax";
import { Archive, Building2, FileText, Users, ArchiveRestore } from "lucide-react";
import { useRevalidator } from "react-router";

export const handle = {
  breadcrumbs: () => [{ label: "Archiv" }],
};

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);

  const companies = await prisma.company.findMany({
    where: { userId: user.id, archived: true },
    include: {
      _count: { select: { invoices: true, customers: true } },
      invoices: {
        where: { status: "PAID" },
        select: { grossTotal: true },
      },
    },
    orderBy: { archivedAt: "desc" },
  });

  return {
    isAdmin: user.role === "ADMIN",
    companies: companies.map((c) => ({
      ...c,
      archivedAt: c.archivedAt?.toISOString() ?? null,
      revenue: c.invoices.reduce((s, inv) => s + Number(inv.grossTotal), 0),
      invoices: undefined,
    })),
  };
}

export default function ArchivPage() {
  const { companies, isAdmin } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  async function restore(id: string) {
    if (!confirm("Archivierung aufheben?")) return;
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    revalidate();
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Archive className="h-6 w-6 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900">Archiv</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          {companies.length === 0
            ? "Keine archivierten Mandanten"
            : `${companies.length} archivierte ${companies.length === 1 ? "Mandant" : "Mandanten"}`}
        </p>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-4">
            <Archive className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium mb-1">Archiv ist leer</p>
          <p className="text-slate-400 text-sm">Archivierte Mandanten erscheinen hier.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 shrink-0">
                <Building2 className="h-5 w-5 text-slate-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/companies/${company.id}`}
                    className="font-semibold text-slate-700 hover:text-indigo-600 transition-colors text-sm truncate"
                  >
                    {company.name}
                  </Link>
                  {company.legalForm && (
                    <span className="text-xs text-slate-400">{company.legalForm}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {company._count.invoices} Rechnungen
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {company._count.customers} Kunden
                  </span>
                  <span>Umsatz (bezahlt): {formatCurrency(company.revenue)}</span>
                  {company.archivedAt && (
                    <span>
                      Archiviert: {new Date(company.archivedAt).toLocaleDateString("de-DE")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/companies/${company.id}`}
                  className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Öffnen
                </Link>
                {isAdmin && (
                  <button
                    onClick={() => restore(company.id)}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Wiederherstellen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
