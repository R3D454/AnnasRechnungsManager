import { Link, useLoaderData } from "react-router";
import { useState } from "react";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import {
  Building2, Plus, FileText, Users, X, Edit, Receipt,
  Mail, Phone, CreditCard, ChevronRight, ChevronDown, Archive,
} from "lucide-react";
import { InvoiceStatus } from "@prisma/client";

export const handle = {
  breadcrumbs: () => [{ label: "Mandanten" }],
};

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Entwurf",
  SENT: "Versendet",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
  DELETED: "Gelöscht",
};

const statusVariants: Record<
  InvoiceStatus,
  "secondary" | "default" | "success" | "destructive" | "warning" | "outline"
> = {
  DRAFT: "secondary",
  SENT: "warning",
  PAID: "success",
  CANCELLED: "destructive",
  DELETED: "outline",
};

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const companies = await prisma.company.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { invoices: true, customers: true } },
      invoices: {
        include: { customer: { select: { name: true } } },
        orderBy: { issueDate: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });
  return {
    companies: companies.map((c) => ({
      ...c,
      invoices: c.invoices.map((inv) => ({
        ...inv,
        grossTotal: Number(inv.grossTotal),
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
      })),
    })),
  };
}

type Company = ReturnType<typeof useLoaderData<typeof loader>>["companies"][number];

function CompanyCard({
  company,
  isActive,
  onSelect,
}: {
  company: Company;
  isActive: boolean;
  onSelect: () => void;
}) {
  const archived = company.archived;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-2xl border shadow-sm p-5 transition-all duration-200 cursor-pointer w-full ${
        archived
          ? "bg-slate-50 border-slate-200 opacity-70 hover:opacity-100"
          : isActive
            ? "bg-white border-indigo-400 ring-2 ring-indigo-100"
            : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${archived ? "bg-slate-100" : "bg-indigo-50"}`}>
          {archived
            ? <Archive className="h-5 w-5 text-slate-400" />
            : <Building2 className="h-5 w-5 text-indigo-600" />}
        </div>
        <div className="min-w-0">
          <p className={`font-semibold text-sm truncate ${archived ? "text-slate-500" : "text-slate-900"}`}>{company.name}</p>
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
          <Users className="h-3.5 w-3.5" />
          {company._count.customers} Kunden
        </span>
      </div>
      {company.city && (
        <p className="text-xs text-slate-400 mt-2">{company.zip} {company.city}</p>
      )}
    </button>
  );
}

export default function CompaniesPage() {
  const { companies } = useLoaderData<typeof loader>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const selected = companies.find((c) => c.id === selectedId) ?? null;

  const active = companies.filter((c) => !c.archived);
  const archived = companies.filter((c) => c.archived);

  return (
    <div className="animate-fade-in flex gap-6">
      {/* Kacheln */}
      <div className={selected ? "flex-1 min-w-0" : "w-full"}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mandanten</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {active.length} aktive Mandanten
              {archived.length > 0 && <span className="text-slate-400"> · {archived.length} archiviert</span>}
            </p>
          </div>
          <Button asChild>
            <Link to="/companies/new">
              <Plus className="h-4 w-4" />
              Mandant anlegen
            </Link>
          </Button>
        </div>

        {active.length === 0 && archived.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-4">
              <Building2 className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Noch keine Mandanten</h3>
            <p className="text-slate-400 mb-6 text-sm">Legen Sie Ihren ersten Mandanten an, um loszulegen.</p>
            <Button asChild>
              <Link to="/companies/new">
                <Plus className="h-4 w-4" />
                Ersten Mandanten anlegen
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Aktive Mandanten */}
            {active.length > 0 && (
              <div className={`grid gap-4 ${selected ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
                {active.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    isActive={selectedId === company.id}
                    onSelect={() => setSelectedId(selectedId === company.id ? null : company.id)}
                  />
                ))}
              </div>
            )}

            {/* Archivierte Mandanten */}
            {archived.length > 0 && (
              <div>
                <button
                  onClick={() => setArchivedOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
                >
                  {archivedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Archive className="h-3.5 w-3.5" />
                  Archivierte Mandanten ({archived.length})
                </button>
                {archivedOpen && (
                  <div className={`grid gap-4 ${selected ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
                    {archived.map((company) => (
                      <CompanyCard
                        key={company.id}
                        company={company}
                        isActive={selectedId === company.id}
                        onSelect={() => setSelectedId(selectedId === company.id ? null : company.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail-Panel */}
      {selected && (
        <div className="w-[460px] shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-[calc(3.5rem+2rem)] max-h-[calc(100vh-3.5rem-4rem)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 shrink-0">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{selected.name}</h2>
                  {selected.legalForm && (
                    <p className="text-xs text-slate-400 mt-0.5">{selected.legalForm}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Aktionen */}
            <div className="flex gap-2 p-4 border-b border-slate-100">
              <Button variant="outline" size="sm" asChild className="flex-1">
                <Link to={`/companies/${selected.id}/edit`}>
                  <Edit className="h-3.5 w-3.5" />
                  Bearbeiten
                </Link>
              </Button>
              <Button size="sm" asChild className="flex-1">
                <Link to={`/companies/${selected.id}/invoices/new`}>
                  <Plus className="h-3.5 w-3.5" />
                  Neue Rechnung
                </Link>
              </Button>
            </div>

            {/* Firmendaten */}
            <div className="p-4 border-b border-slate-100 grid grid-cols-2 gap-3 text-sm">
              {selected.city && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Adresse</p>
                  <p className="text-slate-700">{selected.zip} {selected.city}</p>
                </div>
              )}
              {selected.email && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">E-Mail</p>
                  <p className="text-slate-700 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{selected.email}</span>
                  </p>
                </div>
              )}
              {selected.phone && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Telefon</p>
                  <p className="text-slate-700 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    {selected.phone}
                  </p>
                </div>
              )}
              {selected.taxId && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Steuernummer</p>
                  <p className="text-slate-700 font-mono text-xs">{selected.taxId}</p>
                </div>
              )}
              {selected.vatId && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">USt-IdNr.</p>
                  <p className="text-slate-700 font-mono text-xs">{selected.vatId}</p>
                </div>
              )}
              {selected.bankIban && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">IBAN</p>
                  <p className="text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-xs">{selected.bankIban}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Rechnungen */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Rechnungen</h3>
                <Link
                  to={`/companies/${selected.id}/invoices`}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
                >
                  Alle <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {selected.invoices.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Receipt className="h-7 w-7 mx-auto mb-2 text-slate-200" />
                  <p className="text-sm">Noch keine Rechnungen</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {selected.invoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      to={`/companies/${selected.id}/invoices/${invoice.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{invoice.number ?? "-"}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {invoice.customer.name} · {formatDate(invoice.issueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant={statusVariants[invoice.status]}>
                          {statusLabels[invoice.status]}
                        </Badge>
                        <span className="text-sm font-medium text-slate-900">
                          {formatCurrency(invoice.grossTotal)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
