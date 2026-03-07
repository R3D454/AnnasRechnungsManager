"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "@prisma/client";
import { Download, CheckCircle, Send, Trash2 } from "lucide-react";

interface Props {
  invoice: {
    id: string;
    status: InvoiceStatus;
    companyId: string;
  };
}

export function InvoiceActions({ invoice }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: InvoiceStatus) {
    setLoading(true);
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Rechnung wirklich löschen?")) return;
    await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    router.push(`/companies/${invoice.companyId}/invoices`);
  }

  async function downloadPdf() {
    const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rechnung-${invoice.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
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
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
