import { Link, useLoaderData } from "react-router";
import { requireAdmin } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Badge } from "@/components/ui/badge";
import { Building2, Archive } from "lucide-react";

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
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/companies/${company.id}`}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                  >
                    Öffnen →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
