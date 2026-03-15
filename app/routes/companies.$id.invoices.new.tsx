import { Link, useLoaderData, useNavigate, redirect } from "react-router";

export const handle = {
  breadcrumbs: (data: { company: { id: string; name: string } }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.company.name, href: `/companies/${data.company.id}` },
    { label: "Rechnungen", href: `/companies/${data.company.id}/invoices` },
    { label: "Neue Rechnung" },
  ],
};
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceForm } from "@/components/invoice/invoice-form";
import { ChevronLeft } from "lucide-react";

/**
 * Loads the company, customers, and services for the given company ID.
 *
 * If the company is not found, returns a 404 response with an error message.
 * If the user is not authorized, returns a 401 response with an error message.
 * If there are no customers, redirects to the customers page.
 *
 * @param {Request} request - The request object.
 * @param {{ id: string }} params - The route parameters.
 * @returns {Promise<Response>} - The response data.
 */
export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const { id } = params;

  const company = await prisma.company.findFirst({
    where: { id, userId: user.id },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  const customers = await prisma.customer.findMany({
    where: { companyId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (customers.length === 0) {
    throw redirect(`/companies/${id}/customers`);
  }

  const services = await prisma.service.findMany({
    where: { companyId: id },
    orderBy: { name: "asc" },
  });

  return {
    company,
    customers,
    services: services.map((s) => ({
      ...s,
      unitPrice: Number(s.unitPrice),
      taxRate: Number(s.taxRate),
    })),
  };
}

/**
 * NewInvoicePage
 *
 * This page allows the user to create a new invoice for a given company.
 * It will display the company's name and allow the user to select a customer and add items to the invoice.
 * After submitting the form, the user will be redirected to the invoice detail page.
 */
export default function NewInvoicePage() {
  const { company, customers, services } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const invoice = await res.json();
      navigate(`/companies/${company.id}/invoices/${invoice.id}`);
    } else {
      alert("Fehler beim Erstellen der Rechnung.");
    }
  }

  return (
    <div>
      <Link
        to={`/companies/${company.id}/invoices`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zu Rechnungen
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Neue Rechnung</h1>
        <p className="text-gray-500 mt-1">Für Mandant: {company.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechnungsdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm customers={customers} companyId={company.id} defaultKleinunternehmer={company.kleinunternehmer} services={services} onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
