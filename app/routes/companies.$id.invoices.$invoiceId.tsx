import { Link, useLoaderData, useNavigate, useRevalidator } from "react-router";

export const handle = {
  breadcrumbs: (data: { invoice: { companyId: string; number: string | null; company: { name: string } } }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.invoice.company.name, href: `/companies/${data.invoice.companyId}` },
    { label: "Rechnungen", href: `/companies/${data.invoice.companyId}/invoices` },
    { label: data.invoice.number ?? "-" },
  ],
};
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/tax";
import { ChevronLeft, Download, CheckCircle, Send, Trash2, RotateCcw, Pencil } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";

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
    isAdmin: user.role === "ADMIN",
    invoice: {
      ...invoice,
      netTotal: Number(invoice.netTotal),
      taxTotal: Number(invoice.taxTotal),
      grossTotal: Number(invoice.grossTotal),
      kleinunternehmer: invoice.kleinunternehmer,
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

/**
 * InvoiceDetailPage
 *
 * This page displays the details of a single invoice, including the customer, items, and totals.
 * It also allows the user to download the invoice as a PDF and to update the status of the invoice.
 *
 * The page will only be accessible if the user is logged in and has the necessary permissions.
 * The page will automatically revalidate when the user updates the status of the invoice.
 *
 * @returns {JSX.Element} The JSX element representing the InvoiceDetailPage.
 */
export default function InvoiceDetailPage() {
  const { invoice, isAdmin } = useLoaderData<typeof loader>();
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

  /**
   * Updates the status of an invoice.
   *
   * This function sends a PATCH request to the API to update the status of the invoice.
   * It sets the loading state to true before sending the request and to false after the request is finished.
   * It also revalidates the page after the request is finished, so the user is shown the updated status.
   *
   * @param {InvoiceStatus} status The new status of the invoice.
   */
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

  /**
   * Soft deletes an invoice.
   *
   * This function shows a confirmation dialog to the user and if the user confirms, it sends a PATCH request to the API to update the status of the invoice to "DELETED".
   * It sets the loading state to true before sending the request and to false after the request is finished.
   * It also revalidates the page after the request is finished, so the user is shown the updated status.
   */
  async function handleSoftDelete() {
    if (!confirm("Rechnung in den Papierkorb verschieben?")) return;
    setLoading(true);
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DELETED" }),
    });
    setLoading(false);
    revalidate();
  }

  /**
   * Restores an invoice to the "DRAFT" status.
   *
   * This function sends a PATCH request to the API to update the status of the invoice to "DRAFT".
   * It sets the loading state to true before sending the request and to false after the request is finished.
   * It also revalidates the page after the request is finished, so the user is shown the updated status.
   */
  async function handleRestore() {
    setLoading(true);
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    });
    setLoading(false);
    revalidate();
  }

  /**
   * Hard deletes an invoice.
   *
   * This function shows a confirmation dialog to the user and if the user confirms, it sends a DELETE request to the API to delete the invoice.
   * It then navigates to the invoice list page.
   */
  async function handleHardDelete() {
    if (!confirm("Rechnung endgültig löschen? Dies kann nicht rückgängig gemacht werden.")) return;
    await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    navigate(`/companies/${id}/invoices`);
  }

/**
 * Downloads the invoice as a PDF file.
 *
 * This function sends a GET request to the API to get the PDF file.
 * It then creates a blob URL from the response and creates a new anchor element with the blob URL and a download attribute with the filename.
 * It then simulates a click event on the anchor element, so the user is prompted to download the PDF file.
 */
  async function downloadFile(url: string, filename: string) {
    const res = await fetch(url);
    if (!res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json() as { error?: string; missingFields?: string[] };
        const detail = data.missingFields?.length
          ? `\n\n• ${data.missingFields.join("\n• ")}`
          : "";
        alert(`${data.error ?? "Fehler"}${detail}`);
      }
      return;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  function downloadPdf() {
    return downloadFile(`/api/invoices/${invoice.id}/pdf`, `rechnung-${invoice.number ?? invoice.id}.pdf`);
  }

  const xmlMissingFields: string[] = [];
  if (!invoice.company.email && !invoice.company.phone) {
    xmlMissingFields.push("E-Mail oder Telefon der Firma fehlt");
  }

  function downloadXml() {
    return downloadFile(`/api/invoices/${invoice.id}/xml`, `rechnung-${invoice.number ?? invoice.id}.xml`);
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
            <h1 className="text-2xl font-bold text-gray-900">{invoice.number ?? "-"}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="text-gray-500">
            {invoice.customer.name} · {formatDate(invoice.issueDate)}
          </p>
        </div>

        {/* Invoice Actions */}
        <div className="flex items-center gap-2">
          {invoice.status !== "DELETED" && (
            <>
              <Button variant="outline" size="sm" onClick={downloadPdf}>
                <Download className="h-4 w-4" /> PDF
              </Button>
              <span
                title={xmlMissingFields.length > 0 ? `Pflichtfelder fehlen:\n• ${xmlMissingFields.join("\n• ")}` : undefined}
                className="inline-flex"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadXml}
                  disabled={xmlMissingFields.length > 0}
                  className={xmlMissingFields.length > 0 ? "pointer-events-none opacity-50" : ""}
                >
                  <Download className="h-4 w-4" /> E-Rechnung
                </Button>
              </span>
            </>
          )}
          {invoice.status === "DRAFT" && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/companies/${id}/invoices/${invoice.id}/edit`}>
                <Pencil className="h-4 w-4" /> Bearbeiten
              </Link>
            </Button>
          )}
          {invoice.status === "DRAFT" && (
            <Button size="sm" onClick={() => updateStatus("SENT")} disabled={loading}>
              <Send className="h-4 w-4" /> Als versendet markieren
            </Button>
          )}
          {invoice.status === "SENT" && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => updateStatus("PAID")}
              disabled={loading}
            >
              <CheckCircle className="h-4 w-4" /> Als bezahlt markieren
            </Button>
          )}
          {/* Soft-Delete für alle nicht-gelöschten Status */}
          {invoice.status !== "DELETED" && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleSoftDelete}
              disabled={loading}
              title="In Papierkorb verschieben"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {/* Gelöschte Rechnung: Wiederherstellen + endgültig löschen (Admin) */}
          {invoice.status === "DELETED" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-slate-600 hover:text-slate-800"
                onClick={handleRestore}
                disabled={loading}
                title="Als Storniert wiederherstellen"
              >
                <RotateCcw className="h-4 w-4" /> Wiederherstellen
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleHardDelete}
                  disabled={loading}
                  title="Endgültig löschen"
                >
                  <Trash2 className="h-4 w-4" /> Endgültig löschen
                </Button>
              )}
            </>
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
                        <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
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
                  {invoice.kleinunternehmer ? (
                    <>
                      <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-2">
                        <span>Gesamtbetrag</span>
                        <span>{formatCurrency(invoice.grossTotal)}</span>
                      </div>
                      <p className="text-xs text-gray-500 pt-1">
                        Dieser Rechnungsbetrag enthält nach §19 Abs. 1 UStG keine USt.
                      </p>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
              {invoice.kleinunternehmer ? (
                <>
                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-xs text-gray-500">Gesamtbetrag</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(invoice.grossTotal)}</p>
                  </div>
                  <p className="text-xs text-gray-400">Keine USt. gem. §19 UStG</p>
                </>
              ) : (
                <>
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
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
