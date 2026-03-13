import { Link, useLoaderData } from "react-router";

export const handle = {
  breadcrumbs: (data: { company: { id: string; name: string } }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.company.name, href: `/companies/${data.company.id}` },
    { label: "Rechnungen" },
  ],
};
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import { Plus, FileText, ChevronLeft, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const { id } = params;

  const company = await prisma.company.findFirst({
    where: { id, userId: user.id },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: { companyId: id },
    include: { customer: { select: { name: true } } },
    orderBy: { issueDate: "desc" },
  });

  return {
    company,
    invoices: invoices.map((inv) => ({
      ...inv,
      grossTotal: Number(inv.grossTotal),
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
    })),
  };
}

type InvoiceRow = ReturnType<typeof useLoaderData<typeof loader>>["invoices"][number];

function groupByYear(invoices: InvoiceRow[]): Map<number, InvoiceRow[]> {
  const map = new Map<number, InvoiceRow[]>();
  for (const inv of invoices) {
    const year = new Date(inv.issueDate).getFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(inv);
  }
  return map;
}

function InvoiceRow({ invoice, companyId }: { invoice: InvoiceRow; companyId: string }) {
  return (
    <Link
      to={`/companies/${companyId}/invoices/${invoice.id}`}
      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-50 transition-colors">
          <FileText className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">{invoice.number}</p>
          <p className="text-xs text-slate-400">{invoice.customer.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-5">
        <p className="text-sm text-slate-400 hidden sm:block">{formatDate(invoice.issueDate)}</p>
        <InvoiceStatusBadge status={invoice.status} />
        <p className="font-medium text-slate-700 w-24 text-right text-sm">
          {formatCurrency(invoice.grossTotal)}
        </p>
      </div>
    </Link>
  );
}

function YearPanel({
  year,
  invoices,
  companyId,
  defaultOpen,
}: {
  year: number;
  invoices: InvoiceRow[];
  companyId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalGross = invoices.reduce((s, i) => s + i.grossTotal, 0);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="font-semibold text-slate-800">{year}</span>
          <span className="text-sm text-slate-400">
            {invoices.length} {invoices.length === 1 ? "Rechnung" : "Rechnungen"}
          </span>
        </div>
        <span className="text-sm font-medium text-slate-600">{formatCurrency(totalGross)}</span>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} companyId={companyId} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeletedPanel({
  invoices,
  companyId,
}: {
  invoices: InvoiceRow[];
  companyId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-red-100 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-red-50/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-red-300 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-red-300 shrink-0" />
          )}
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span className="font-medium text-red-700 text-sm">Papierkorb</span>
          <span className="text-sm text-red-300">
            {invoices.length} {invoices.length === 1 ? "Rechnung" : "Rechnungen"}
          </span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-red-50 border-t border-red-100">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} companyId={companyId} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const { company, invoices } = useLoaderData<typeof loader>();
  const id = company.id;
  const currentYear = new Date().getFullYear();

  const activeInvoices = invoices.filter((i) => i.status !== "DELETED");
  const deletedInvoices = invoices.filter((i) => i.status === "DELETED");

  const byYear = groupByYear(activeInvoices);
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <div>
      <Link
        to={`/companies/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> {company.name}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rechnungen</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {activeInvoices.length} Rechnungen für {company.name}
            {deletedInvoices.length > 0 && (
              <span className="text-red-400"> · {deletedInvoices.length} im Papierkorb</span>
            )}
          </p>
        </div>
        <Button asChild>
          <Link to={`/companies/${id}/invoices/new`}>
            <Plus className="h-4 w-4" /> Neue Rechnung
          </Link>
        </Button>
      </div>

      {activeInvoices.length === 0 && deletedInvoices.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <FileText className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-700 mb-2">Noch keine Rechnungen</h3>
            <p className="text-slate-500 mb-6 text-sm">Erstellen Sie die erste Rechnung für diesen Mandanten.</p>
            <Button asChild>
              <Link to={`/companies/${id}/invoices/new`}>
                <Plus className="h-4 w-4" /> Erste Rechnung erstellen
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {years.map((year) => (
            <YearPanel
              key={year}
              year={year}
              invoices={byYear.get(year)!}
              companyId={id}
              defaultOpen={year === currentYear}
            />
          ))}
          {deletedInvoices.length > 0 && (
            <DeletedPanel invoices={deletedInvoices} companyId={id} />
          )}
        </div>
      )}
    </div>
  );
}
