import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { InvoiceActions } from "./invoice-actions";
import { formatCurrency, formatDate } from "@/lib/tax";
import { ChevronLeft } from "lucide-react";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const { id, invoiceId } = await params;
  const session = await auth();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: id, company: { userId: session!.user!.id! } },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      company: true,
    },
  });

  if (!invoice) notFound();

  // Group items by tax rate for totals block
  const taxGroups = invoice.items.reduce(
    (acc, item) => {
      const rate = Number(item.taxRate);
      if (!acc[rate]) acc[rate] = { net: 0, tax: 0 };
      acc[rate].net += Number(item.netAmount);
      acc[rate].tax += Number(item.taxAmount);
      return acc;
    },
    {} as Record<number, { net: number; tax: number }>
  );

  return (
    <div>
      <Link
        href={`/companies/${id}/invoices`}
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
        <InvoiceActions invoice={{ id: invoice.id, status: invoice.status, companyId: id }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice document preview */}
          <Card>
            <CardContent className="p-6">
              {/* Sender & Recipient */}
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

              {/* Dates */}
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

              {/* Items table */}
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
                          {Number(item.quantity)} {item.unit && <span className="text-gray-500">{item.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(item.unitPrice))}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{Number(item.taxRate)}%</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(Number(item.grossAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Nettobetrag</span>
                    <span>{formatCurrency(Number(invoice.netTotal))}</span>
                  </div>
                  {Object.entries(taxGroups).map(([rate, { net, tax }]) => (
                    <div key={rate} className="flex justify-between text-sm text-gray-600">
                      <span>MwSt. {rate}% auf {formatCurrency(net)}</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-2">
                    <span>Gesamtbetrag (brutto)</span>
                    <span>{formatCurrency(Number(invoice.grossTotal))}</span>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hinweise</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {/* Bank details */}
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

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Zusammenfassung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Netto</p>
                <p className="font-medium text-gray-900">{formatCurrency(Number(invoice.netTotal))}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">MwSt.</p>
                <p className="font-medium text-gray-900">{formatCurrency(Number(invoice.taxTotal))}</p>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <p className="text-xs text-gray-500">Brutto</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(Number(invoice.grossTotal))}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
