import { Link, useLoaderData, useNavigate, useRevalidator } from "react-router";

export const handle = {
  breadcrumbs: (data: { invoice: { companyId: string; number: string; company: { name: string } } }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.invoice.company.name, href: `/companies/${data.invoice.companyId}` },
    { label: "Rechnungen", href: `/companies/${data.invoice.companyId}/invoices` },
    { label: data.invoice.number },
  ],
};
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import { ChevronLeft, Download, CheckCircle, Send, Trash2 } from "lucide-react";
import { InvoiceStatus } from "@prisma/client";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string; invoiceId: string };
}) {
  const user = await requireUser(request);
  const { id, invoiceId } = params;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: id, company: { userId: user.id } },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      company: true,
    },
  });

  if (!invoice) throw new Response("Not Found", { status: 404 });

  return {
    invoice: {
      ...invoice,
      netTotal: Number(invoice.netTotal),
      taxTotal: Number(invoice.taxTotal),
      grossTotal: Number(invoice.grossTotal),
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      deliveryDate: invoice.deliveryDate?.toISOString() ?? null,
      items: invoice.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        netAmount: Number(item.netAmount),
        taxAmount: Number(item.taxAmount),
        grossAmount: Number(item.grossAmount),
      })),
    },
  };
}

export default function InvoiceDetailPage() {
  const { invoice } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();
  const [loading, setLoading] = useState(false);
  const id = invoice.companyId;

  const taxGroups = invoice.items.reduce(
    (acc, item) => {
      const rate = item.taxRate;
      if (!acc[rate]) acc[rate] = { net: 0, tax: 0 };
      acc[rate].net += item.netAmount;
      acc[rate].tax += item.taxAmount;
      return acc;
    },
    {} as Record<number, { net: number; tax: number }>
  );

  async function updateStatus(status: InvoiceStatus) {
    setLoading(true);
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    revalidate();
  }

  async function handleDelete() {
    if (!confirm("Rechnung wirklich löschen?")) return;
    await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    navigate(`/companies/${id}/invoices`);
  }

  async function downloadPdf() {
    const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rechnung-${invoice.number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Link
        to={`/companies/${id}/invoices`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zu Rechnungen
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="text-gray-500">
            {invoice.customer.name} · {formatDate(invoice.issueDate)}
          </p>
        </div>

        {/* Invoice Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4" /> PDF
          </Button>
          {invoice.status === "DRAFT" && (
            <Button size="sm" onClick={() => updateStatus(InvoiceStatus.SENT)} disabled={loading}>
              <Send className="h-4 w-4" /> Als versendet markieren
            </Button>
          )}
          {invoice.status === "SENT" && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => updateStatus(InvoiceStatus.PAID)}
              disabled={loading}
            >
              <CheckCircle className="h-4 w-4" /> Als bezahlt markieren
            </Button>
          )}
          {(invoice.status === "DRAFT" || invoice.status === "CANCELLED") && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Absender</p>
                  <p className="font-semibold text-gray-900">{invoice.company.name}</p>
                  {invoice.company.legalForm && <p className="text-sm text-gray-600">{invoice.company.legalForm}</p>}
                  <p className="text-sm text-gray-600">{invoice.company.address}</p>
                  <p className="text-sm text-gray-600">{invoice.company.zip} {invoice.company.city}</p>
                  {invoice.company.taxId && (
                    <p className="text-xs text-gray-500 mt-1">St.-Nr.: {invoice.company.taxId}</p>
                  )}
                  {invoice.company.vatId && (
                    <p className="text-xs text-gray-500">USt-IdNr.: {invoice.company.vatId}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rechnungsempfänger</p>
                  <p className="font-semibold text-gray-900">{invoice.customer.name}</p>
                  <p className="text-sm text-gray-600">{invoice.customer.address}</p>
                  <p className="text-sm text-gray-600">{invoice.customer.zip} {invoice.customer.city}</p>
                  {invoice.customer.vatId && (
                    <p className="text-xs text-gray-500 mt-1">USt-IdNr.: {invoice.customer.vatId}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Rechnungsnummer</p>
                  <p className="text-sm font-semibold text-gray-900">{invoice.number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Rechnungsdatum</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(invoice.issueDate)}</p>
                </div>
                {invoice.deliveryDate && (
                  <div>
                    <p className="text-xs text-gray-500">Leistungsdatum</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(invoice.deliveryDate)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Fällig am</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-8">#</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Beschreibung</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">Menge</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">EP (netto)</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">MwSt.</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">Betrag (brutto)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{item.position}</td>
                        <td className="px-4 py-3 text-gray-900">{item.description}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {item.quantity} {item.unit && <span className="text-gray-500">{item.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{item.taxRate}%</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.grossAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-72 space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Nettobetrag</span>
                    <span>{formatCurrency(invoice.netTotal)}</span>
                  </div>
                  {Object.entries(taxGroups).map(([rate, { net, tax }]) => (
                    <div key={rate} className="flex justify-between text-sm text-gray-600">
                      <span>MwSt. {rate}% auf {formatCurrency(net)}</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-2">
                    <span>Gesamtbetrag (brutto)</span>
                    <span>{formatCurrency(invoice.grossTotal)}</span>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hinweise</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {invoice.company.bankIban && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Bankverbindung: {invoice.company.bankName && `${invoice.company.bankName} · `}
                    IBAN: {invoice.company.bankIban}
                    {invoice.company.bankBic && ` · BIC: ${invoice.company.bankBic}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Zusammenfassung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Netto</p>
                <p className="font-medium text-gray-900">{formatCurrency(invoice.netTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">MwSt.</p>
                <p className="font-medium text-gray-900">{formatCurrency(invoice.taxTotal)}</p>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <p className="text-xs text-gray-500">Brutto</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(invoice.grossTotal)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
