import { Link, useNavigate } from "react-router";
import { CompanyForm } from "@/components/company/company-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export default function NewCompanyPage() {
  const navigate = useNavigate();

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const company = await res.json();
      navigate(`/companies/${company.id}`);
    }
  }

  return (
    <div>
      <Link
        to="/companies"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zu Mandanten
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Neuer Mandant</h1>
        <p className="text-gray-500 mt-1">Legen Sie einen neuen Mandanten an</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mandantendaten</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyForm
            onSubmit={handleSubmit}
            submitLabel="Mandant anlegen"
          />
        </CardContent>
      </Card>
    </div>
  );
}
