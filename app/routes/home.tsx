import { Link, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/tax";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, Euro, TrendingUp } from "lucide-react";
import { InvoiceStatus } from "@prisma/client";

export const handle = {
  breadcrumbs: () => [{ label: "Dashboard" }],
};

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const userId = user.id;

  const [companies, invoiceStats, paidTotal, openInvoices] = await Promise.all([
    prisma.company.findMany({
      where: { userId, archived: false },
      include: { _count: { select: { invoices: true, customers: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.invoice.aggregate({
      where: { company: { userId, archived: false } },
      _count: true,
      _sum: { grossTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { company: { userId, archived: false }, status: InvoiceStatus.PAID },
      _sum: { grossTotal: true },
    }),
    prisma.invoice.count({
      where: { company: { userId, archived: false }, status: { in: [InvoiceStatus.SENT, InvoiceStatus.DRAFT] } },
    }),
  ]);

  return {
    companies,
    totalInvoices: invoiceStats._count,
    paidTotal: Number(paidTotal._sum.grossTotal ?? 0),
    openInvoices,
  };
}

const statCards = [
  {
    key: "companies",
    label: "Mandanten",
    icon: Building2,
    gradient: "from-indigo-500 to-violet-600",
    bg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    shadowColor: "shadow-indigo-500/15",
  },
  {
    key: "totalInvoices",
    label: "Rechnungen gesamt",
    icon: FileText,
    gradient: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
    shadowColor: "shadow-blue-500/15",
  },
  {
    key: "openInvoices",
    label: "Offen / Entwurf",
    icon: TrendingUp,
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
    shadowColor: "shadow-amber-500/15",
  },
  {
    key: "paidTotal",
    label: "Bezahlt (brutto)",
    icon: Euro,
    gradient: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    shadowColor: "shadow-emerald-500/15",
  },
];

export default function DashboardPage() {
  const { companies, totalInvoices, paidTotal, openInvoices } = useLoaderData<typeof loader>();

  const statValues: Record<string, string | number> = {
    companies: companies.length,
    totalInvoices,
    openInvoices,
    paidTotal: formatCurrency(paidTotal),
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1 text-sm">Übersicht aller Mandanten und Rechnungen</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${card.shadowColor} p-5 hover:shadow-md transition-shadow duration-200`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  Gesamt
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {statValues[card.key]}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Companies */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Mandanten</h2>
            <p className="text-xs text-slate-500 mt-0.5">{companies.length} Mandanten verwaltet</p>
          </div>
          <Link
            to="/companies"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1 transition-colors"
          >
            Alle anzeigen
            <span aria-hidden>→</span>
          </Link>
        </div>

        {companies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-14 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-4">
              <Building2 className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium mb-1">Noch keine Mandanten angelegt</p>
            <p className="text-slate-400 text-sm mb-6">Legen Sie Ihren ersten Mandanten an, um loszulegen.</p>
            <Link
              to="/companies/new"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/25"
            >
              Mandant anlegen
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {companies.map((company) => (
              <Link key={company.id} to={`/companies/${company.id}`} className="w-full sm:w-80">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer h-full">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 shrink-0">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{company.name}</p>
                      {company.legalForm && (
                        <p className="text-xs text-slate-400 mt-0.5">{company.legalForm}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {company._count.invoices} Rechnungen
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {company._count.customers} Kunden
                    </span>
                  </div>
                  {company.city && (
                    <p className="text-xs text-slate-400 mt-2">
                      {company.zip} {company.city}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
