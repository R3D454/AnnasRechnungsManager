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
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceForm } from "@/components/invoice/invoice-form";
import { ChevronLeft } from "lucide-react";

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

  return { company, customers };
}

export default function NewInvoicePage() {
  const { company, customers } = useLoaderData<typeof loader>();
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
          <InvoiceForm customers={customers} companyId={company.id} defaultKleinunternehmer={company.kleinunternehmer} onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
