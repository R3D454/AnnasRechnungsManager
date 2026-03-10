import { Link, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/tax";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, Euro } from "lucide-react";
import { InvoiceStatus } from "@prisma/client";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const userId = user.id;

  const [companies, invoiceStats, paidTotal, openInvoices] = await Promise.all([
    prisma.company.findMany({
      where: { userId },
      include: { _count: { select: { invoices: true, customers: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.invoice.aggregate({
      where: { company: { userId } },
      _count: true,
      _sum: { grossTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { company: { userId }, status: InvoiceStatus.PAID },
      _sum: { grossTotal: true },
    }),
    prisma.invoice.count({
      where: { company: { userId }, status: { in: [InvoiceStatus.SENT, InvoiceStatus.DRAFT] } },
    }),
  ]);

  return {
    companies,
    totalInvoices: invoiceStats._count,
    paidTotal: Number(paidTotal._sum.grossTotal ?? 0),
    openInvoices,
  };
}

export default function DashboardPage() {
  const { companies, totalInvoices, paidTotal, openInvoices } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Übersicht aller Mandanten und Rechnungen</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
                <p className="text-sm text-gray-500">Mandanten</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
                <p className="text-sm text-gray-500">Rechnungen gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-yellow-50">
                <FileText className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{openInvoices}</p>
                <p className="text-sm text-gray-500">Offen / Entwurf</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-green-50">
                <Euro className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(paidTotal)}</p>
                <p className="text-sm text-gray-500">Bezahlt (brutto)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Mandanten</h2>
          <Link to="/companies" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Alle anzeigen →
          </Link>
        </div>

        {companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Noch keine Mandanten angelegt.</p>
              <Link
                to="/companies/new"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Mandant anlegen
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {companies.map((company) => (
              <Link key={company.id} to={`/companies/${company.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{company.name}</CardTitle>
                    {company.legalForm && (
                      <p className="text-xs text-gray-500">{company.legalForm}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{company._count.invoices} Rechnungen</span>
                      <span>{company._count.customers} Kunden</span>
                    </div>
                    {company.city && (
                      <p className="text-xs text-gray-400 mt-1">{company.zip} {company.city}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
