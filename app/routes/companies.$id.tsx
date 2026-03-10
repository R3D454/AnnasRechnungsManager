import { Link, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import {
  FileText, Users, BarChart3, Plus, Edit, Building2,
  Mail, Phone, CreditCard, Receipt
} from "lucide-react";
import { InvoiceStatus } from "@prisma/client";

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Entwurf",
  SENT: "Versendet",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
};

const statusVariants: Record<InvoiceStatus, "secondary" | "default" | "success" | "destructive" | "warning"> = {
  DRAFT: "secondary",
  SENT: "warning",
  PAID: "success",
  CANCELLED: "destructive",
};

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const { id } = params;

  const company = await prisma.company.findFirst({
    where: { id, userId: user.id },
    include: {
      invoices: {
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
    company: {
      ...company,
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

export default function CompanyPage() {
  const { company, revenue } = useLoaderData<typeof loader>();
  const id = company.id;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-50">
            <Building2 className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-gray-500 mt-0.5">
              {company.legalForm && `${company.legalForm} · `}
              {company.zip} {company.city}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/companies/${id}/edit`}>
            <Edit className="h-4 w-4" />
            Bearbeiten
          </Link>
        </Button>
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
                      <p className="text-sm font-medium text-gray-900">{invoice.number}</p>
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
