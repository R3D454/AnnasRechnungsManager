import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import { Plus, FileText, ChevronLeft } from "lucide-react";

export default async function InvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const company = await prisma.company.findFirst({
    where: { id, userId: session!.user!.id! },
  });
  if (!company) notFound();

  const invoices = await prisma.invoice.findMany({
    where: { companyId: id },
    include: { customer: { select: { name: true } } },
    orderBy: { issueDate: "desc" },
  });

  return (
    <div>
      <Link
        href={`/companies/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> {company.name}
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rechnungen</h1>
          <p className="text-gray-500 mt-1">{invoices.length} Rechnungen für {company.name}</p>
        </div>
        <Button asChild>
          <Link href={`/companies/${id}/invoices/new`}>
            <Plus className="h-4 w-4" /> Neue Rechnung
          </Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-2">Noch keine Rechnungen</h3>
            <p className="text-gray-500 mb-6 text-sm">Erstellen Sie die erste Rechnung für diesen Mandanten.</p>
            <Button asChild>
              <Link href={`/companies/${id}/invoices/new`}>
                <Plus className="h-4 w-4" /> Erste Rechnung erstellen
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/companies/${id}/invoices/${invoice.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-indigo-50 transition-colors">
                    <FileText className="h-4 w-4 text-gray-500 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{invoice.number}</p>
                    <p className="text-sm text-gray-500">{invoice.customer.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <p className="text-sm text-gray-500">{formatDate(invoice.issueDate)}</p>
                  <InvoiceStatusBadge status={invoice.status} />
                  <p className="font-medium text-gray-900 w-28 text-right">
                    {formatCurrency(Number(invoice.grossTotal))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
