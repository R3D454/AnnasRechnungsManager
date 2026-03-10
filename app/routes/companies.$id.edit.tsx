import { Link, useLoaderData, useNavigate } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { CompanyForm } from "@/components/company/company-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!company) throw new Response("Not Found", { status: 404 });
  return { company };
}

export default function EditCompanyPage() {
  const { company } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) navigate(`/companies/${company.id}`);
  }

  return (
    <div>
      <Link
        to={`/companies/${company.id}`}
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
