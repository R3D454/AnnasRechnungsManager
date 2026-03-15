import { Link, useLoaderData, useNavigate } from "react-router";

export const handle = {
  breadcrumbs: (data: { invoice: { companyId: string; number: string | null; company: { name: string } } }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.invoice.company.name, href: `/companies/${data.invoice.companyId}` },
    { label: "Rechnungen", href: `/companies/${data.invoice.companyId}/invoices` },
    { label: data.invoice.number ?? "-", href: `/companies/${data.invoice.companyId}/invoices/${data.invoice.id}` },
    { label: "Bearbeiten" },
  ],
};

import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceForm } from "@/components/invoice/invoice-form";
import { ChevronLeft } from "lucide-react";

/**
 * Loads an invoice by its ID.
 *
 * The response contains the invoice's details, including the issue date, delivery date, due date, items, customers, and services.
 *
 * If the invoice is not found, returns a 404 response with an error message.
 * If the user is not authorized, returns a 401 response with an error message.
 *
 * @param {Request} request - The request object.
 * @param {{ id: string; invoiceId: string }} params - The route parameters.
 * @returns {Promise<Response>} - The response data.
 */
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
      company: true,
    },
  });

  if (!invoice) throw new Response("Not Found", { status: 404 });

  const [customers, services] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { companyId: id },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    invoice: {
      ...invoice,
      issueDate: invoice.issueDate.toISOString(),
      deliveryDate: invoice.deliveryDate?.toISOString() ?? null,
      dueDate: invoice.dueDate.toISOString(),
      items: invoice.items.map((item) => ({
        ...item,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        taxRate: String(item.taxRate),
        netAmount: Number(item.netAmount),
        taxAmount: Number(item.taxAmount),
        grossAmount: Number(item.grossAmount),
      })),
    },
    customers,
    services: services.map((s) => ({
      ...s,
      unitPrice: Number(s.unitPrice),
      taxRate: Number(s.taxRate),
    })),
  };
}

/**
 * EditInvoicePage
 *
 * This page allows the user to edit an existing invoice.
 * It will display the current data of the invoice and allow the user to update it.
 * The page will automatically revalidate when the user updates the invoice.
 *
 * @returns {JSX.Element} The JSX element representing the EditInvoicePage.
 */
export default function EditInvoicePage() {
  const { invoice, customers, services } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const defaultValues = {
    customerId: invoice.customerId,
    issueDate: invoice.issueDate.split("T")[0],
    deliveryDate: invoice.deliveryDate?.split("T")[0] ?? "",
    dueDate: invoice.dueDate.split("T")[0],
    notes: invoice.notes ?? "",
    items: invoice.items,
  };

  /**
   * Submits the edited invoice to the API.
   * If the request is successful, navigates the user to the invoice detail page.
   * If the request fails, displays an error message.
   *
   * @param {Record<string, unknown>} data - The edited invoice data.
   */
  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      navigate(`/companies/${invoice.companyId}/invoices/${invoice.id}`);
    } else {
      alert("Fehler beim Speichern der Rechnung.");
    }
  }

  return (
    <div>
      <Link
        to={`/companies/${invoice.companyId}/invoices/${invoice.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zur Rechnung
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Rechnung bearbeiten</h1>
        <p className="text-gray-500 mt-1">Rechnungsnummer: {invoice.number ?? "-"}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechnungsdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm
            customers={customers}
            companyId={invoice.companyId}
            defaultValues={defaultValues}
            defaultKleinunternehmer={invoice.kleinunternehmer}
            services={services}
            submitLabel="Änderungen speichern"
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
