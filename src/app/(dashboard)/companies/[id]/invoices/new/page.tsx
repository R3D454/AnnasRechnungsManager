import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceFormClient } from "./invoice-form-client";
import { ChevronLeft } from "lucide-react";

export default async function NewInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const company = await prisma.company.findFirst({
    where: { id, userId: session!.user!.id! },
  });
  if (!company) notFound();

  const customers = await prisma.customer.findMany({
    where: { companyId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (customers.length === 0) {
    redirect(`/companies/${id}/customers`);
  }

  return (
    <div>
      <Link
        href={`/companies/${id}/invoices`}
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
          <InvoiceFormClient customers={customers} companyId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
