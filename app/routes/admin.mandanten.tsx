import { Link, useLoaderData } from "react-router";
import { requireAdmin } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Badge } from "@/components/ui/badge";
import { Building2, Archive, Trash2 } from "lucide-react";
import { useState } from "react";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const companies = await prisma.company.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { invoices: true, customers: true } },
    },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });

  return {
    companies: companies.map((c) => ({
      ...c,
      archivedAt: c.archivedAt?.toISOString() ?? null,
    })),
  };
}

export default function AdminMandanten() {
  const { companies } = useLoaderData<typeof loader>();

  const active = companies.filter((c) => !c.archived);
  const archived = companies.filter((c) => c.archived);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Alle Mandanten</h1>
        <p className="text-sm text-slate-500 mt-1">
          {companies.length} Mandanten gesamt · {active.length} aktiv · {archived.length} archiviert
        </p>
      </div>

      <MandantenTabelle companies={active} title="Aktive Mandanten" />
      {archived.length > 0 && (
        <div className="mt-8">
          <MandantenTabelle companies={archived} title="Archivierte Mandanten" archived />
        </div>
      )}
    </div>
  );
}

type Company = {
  id: string;
  name: string;
  legalForm: string | null;
  city: string;
  email: string | null;
  archived: boolean;
  user: { id: string; name: string; email: string };
  _count: { invoices: number; customers: number };
};

function MandantenTabelle({
  companies,
  title,
  archived = false,
}: {
  companies: Company[];
  title: string;
  archived?: boolean;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (companyId: string, companyName: string) => {
    if (deleteConfirm !== companyId) {
      setDeleteConfirm(companyId);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/companies/${companyId}/delete`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Reload the page to refresh the list
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Fehler beim Löschen: ${error.error || response.statusText}`);
        setDeleteConfirm(null);
      }
    } catch (error) {
      alert(`Fehler beim Löschen: ${error}`);
      setDeleteConfirm(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (companies.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {title}
      </h2>
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Mandant</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ort</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Benutzer</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Rechnungen</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Kunden</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((company) => (
              <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {company.name}
                        {archived && (
                          <Archive className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                      {company.legalForm && (
                        <div className="text-xs text-slate-400">{company.legalForm}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{company.city}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-700">{company.user.name}</div>
                  <div className="text-xs text-slate-400">{company.user.email}</div>
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{company._count.invoices}</td>
                <td className="px-4 py-3 text-right text-slate-600">{company._count.customers}</td>
                <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                  <Link
                    to={`/companies/${company.id}`}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                  >
                    Öffnen →
                  </Link>
                  <button
                    onClick={() => handleDelete(company.id, company.name)}
                    disabled={isDeleting}
                    className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      deleteConfirm === company.id
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "text-slate-500 hover:text-red-600"
                    } ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleteConfirm === company.id ? "Bestätigen?" : "Löschen"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
