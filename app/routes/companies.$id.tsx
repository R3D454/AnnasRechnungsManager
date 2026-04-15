import { Link, useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import {
  FileText, Users, BarChart3, Plus, Edit, Building2,
  Mail, Phone, CreditCard, Receipt, Archive, ArchiveRestore, AlertTriangle, Briefcase, Scale, TrendingDown, TrendingUp, PackageSearch, DollarSign
} from "lucide-react";
import { InvoiceStatus } from "@prisma/client";
import { useState } from "react";

export const handle = {
  breadcrumbs: (data: { company: { id: string; name: string } }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.company.name },
  ],
};

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Entwurf",
  SENT: "Versendet",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
  DELETED: "Gelöscht",
};

const statusVariants: Record<InvoiceStatus, "secondary" | "default" | "success" | "destructive" | "warning" | "outline"> = {
  DRAFT: "secondary",
  SENT: "warning",
  PAID: "success",
  CANCELLED: "destructive",
  DELETED: "outline",
};

/**
 * Loads a company by its ID.
 *
 * The response contains the company's name, archived at date, invoices, and revenue.
 *
 * The invoices are paginated to show the 5 most recent ones.
 *
 * The revenue is the sum of all paid invoices.
 *
 * If the company is not found, returns a 404 response with an error message.
 * If the user is not authorized, returns a 401 response with an error message.
 */
export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const { id } = params;
  const isAdmin = user.role === "ADMIN";

  const company = await prisma.company.findFirst({
    where: isAdmin ? { id } : { id, userId: user.id },
    include: {
      invoices: {
        where: { status: { not: InvoiceStatus.DELETED } },
        include: { customer: { select: { name: true } } },
        orderBy: { issueDate: "desc" },
        take: 5,
      },
      _count: { select: { invoices: true, customers: true } },
    },
  });

  if (!company) throw new Response("Not Found", { status: 404 });

  const revenue = await prisma.invoice.aggregate({
    where: { companyId: id, status: InvoiceStatus.PAID },
    _sum: { grossTotal: true },
  });

  return {
    isAdmin,
    company: {
      ...company,
      archivedAt: company.archivedAt?.toISOString() ?? null,
      invoices: company.invoices.map((inv) => ({
        ...inv,
        grossTotal: Number(inv.grossTotal),
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
      })),
    },
    revenue: Number(revenue._sum.grossTotal ?? 0),
  };
}

/**
 * CompanyPage displays information about a company.
 *
 * The page displays the company's name, address, and legal form.
 * It also displays the company's archived status, if applicable.
 * If the user is an admin, the page displays buttons to toggle the company's archived status and to edit the company.
 *
 * The page also displays a list of the company's most recent invoices.
 * The list shows the invoice number, customer name, issue date, and gross total.
 * The user can click on an invoice to view its details.
 *
 * The page also displays the company's revenue, which is the sum of all paid invoices.
 * If the company has a tax ID or VAT ID, the page displays it.
 *
 * Finally, the page displays contact information for the company, if applicable.
 */
export default function CompanyPage() {
  const { company, revenue, isAdmin } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [archiving, setArchiving] = useState(false);
  const id = company.id;

  async function toggleArchive() {
    const action = company.archived ? "Archivierung aufheben?" : "Mandanten archivieren?";
    if (!confirm(action)) return;
    setArchiving(true);
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !company.archived }),
    });
    setArchiving(false);
    revalidate();
  }

  return (
    <div>
      {/* Archiv-Banner */}
      {company.archived && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Dieser Mandant ist archiviert
            {company.archivedAt && ` seit ${new Date(company.archivedAt).toLocaleDateString("de-DE")}`}.
          </span>
          {isAdmin && (
            <button
              onClick={toggleArchive}
              disabled={archiving}
              className="ml-auto text-amber-700 underline hover:text-amber-900 text-xs"
            >
              Archivierung aufheben
            </button>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${company.archived ? "bg-slate-100" : "bg-indigo-50"}`}>
            <Building2 className={`h-6 w-6 ${company.archived ? "text-slate-400" : "text-indigo-600"}`} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${company.archived ? "text-slate-500" : "text-gray-900"}`}>
              {company.name}
            </h1>
            <p className="text-gray-500 mt-0.5">
              {company.legalForm && `${company.legalForm} · `}
              {company.zip} {company.city}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !company.archived && (
            <Button variant="outline" onClick={toggleArchive} disabled={archiving}>
              <Archive className="h-4 w-4" />
              Archivieren
            </Button>
          )}
          {isAdmin && company.archived && (
            <Button variant="outline" onClick={toggleArchive} disabled={archiving}>
              <ArchiveRestore className="h-4 w-4" />
              Wiederherstellen
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/companies/${id}/edit`}>
              <Edit className="h-4 w-4" />
              Bearbeiten
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Link to={`/companies/${id}/invoices/new`} className="block">
          <Card className="hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Plus className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Rechnung erstellen</span>
            </CardContent>
          </Card>
        </Link>
        <Link to={`/companies/${id}/invoices`} className="block">
          <Card className="hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Rechnungen</span>
            </CardContent>
          </Card>
        </Link>
        <Link to={`/companies/${id}/customers`} className="block">
          <Card className="hover:border-green-200 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Kunden</span>
            </CardContent>
          </Card>
        </Link>
        <Link to={`/companies/${id}/leistungen`} className="block">
          <Card className="hover:border-orange-200 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <Briefcase className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Leistungen</span>
            </CardContent>
          </Card>
        </Link>
        <Link to={`/companies/${id}/reports`} className="block">
          <Card className="hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Berichte</span>
            </CardContent>
          </Card>
        </Link>
        <Link to={`/companies/${id}/buchhaltung/bilanzen`} className="block">
          <Card className="hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Briefcase className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Buchhaltung</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Letzte Rechnungen</h2>
            <Link to={`/companies/${id}/invoices`} className="text-sm text-indigo-600 hover:text-indigo-700">
              Alle anzeigen →
            </Link>
          </div>
          <Card>
            {company.invoices.length === 0 ? (
              <CardContent className="py-8 text-center text-gray-500">
                <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Noch keine Rechnungen</p>
              </CardContent>
            ) : (
              <div className="divide-y divide-gray-100">
                {company.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={`/companies/${id}/invoices/${invoice.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{invoice.number ?? "-"}</p>
                      <p className="text-xs text-gray-500">{invoice.customer.name} · {formatDate(invoice.issueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariants[invoice.status]}>{statusLabels[invoice.status]}</Badge>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.grossTotal)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Steuer & Umsatz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Bezahlt (gesamt)</p>
                <p className="font-semibold text-gray-900">{formatCurrency(revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Rechnungen</p>
                <p className="font-semibold text-gray-900">{company._count.invoices}</p>
              </div>
              {company.taxId && (
                <div>
                  <p className="text-xs text-gray-500">Steuernummer</p>
                  <p className="text-sm font-mono text-gray-900">{company.taxId}</p>
                </div>
              )}
              {company.vatId && (
                <div>
                  <p className="text-xs text-gray-500">USt-IdNr.</p>
                  <p className="text-sm font-mono text-gray-900">{company.vatId}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(company.email || company.phone) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Kontakt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {company.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {company.email}
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {company.phone}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {company.bankIban && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Bankverbindung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CreditCard className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="font-mono text-xs">{company.bankIban}</span>
                </div>
                {company.bankName && <p className="text-xs text-gray-500 ml-5">{company.bankName}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
