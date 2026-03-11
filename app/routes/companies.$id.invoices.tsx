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
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import { Plus, FileText, ChevronLeft } from "lucide-react";

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

export default function InvoicesPage() {
  const { company, invoices } = useLoaderData<typeof loader>();
  const id = company.id;

  return (
    <div>
      <Link
        to={`/companies/${id}`}
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
          <Link to={`/companies/${id}/invoices/new`}>
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
              <Link to={`/companies/${id}/invoices/new`}>
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
                to={`/companies/${id}/invoices/${invoice.id}`}
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
                    {formatCurrency(invoice.grossTotal)}
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
