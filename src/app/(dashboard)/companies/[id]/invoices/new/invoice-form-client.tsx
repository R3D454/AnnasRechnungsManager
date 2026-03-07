"use client";

import { useRouter } from "next/navigation";
import { InvoiceForm } from "@/components/invoice/invoice-form";

interface Props {
  customers: { id: string; name: string }[];
  companyId: string;
}

export function InvoiceFormClient({ customers, companyId }: Props) {
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const invoice = await res.json();
      router.push(`/companies/${companyId}/invoices/${invoice.id}`);
    } else {
      alert("Fehler beim Erstellen der Rechnung.");
    }
  }

  return <InvoiceForm customers={customers} companyId={companyId} onSubmit={handleSubmit} />;
}
