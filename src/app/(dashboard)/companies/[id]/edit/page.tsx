"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { CompanyForm } from "@/components/company/company-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function EditCompanyPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/companies/${id}`).then((r) => r.json()).then(setCompany);
  }, [id]);

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch(`/api/companies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) router.push(`/companies/${id}`);
  }

  if (!company) return <div className="p-8 text-gray-500">Lade...</div>;

  return (
    <div>
      <Link
        href={`/companies/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zum Mandanten
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mandant bearbeiten</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mandantendaten</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyForm
            defaultValues={company as Record<string, string>}
            onSubmit={handleSubmit}
            submitLabel="Änderungen speichern"
          />
        </CardContent>
      </Card>
    </div>
  );
}
