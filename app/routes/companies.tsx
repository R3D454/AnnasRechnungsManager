import { Link, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, FileText, Users } from "lucide-react";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const companies = await prisma.company.findMany({
    where: { userId: user.id },
    include: { _count: { select: { invoices: true, customers: true } } },
    orderBy: { name: "asc" },
  });
  return { companies };
}

export default function CompaniesPage() {
  const { companies } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mandanten</h1>
          <p className="text-gray-500 mt-1">{companies.length} Mandanten verwaltet</p>
        </div>
        <Button asChild>
          <Link to="/companies/new">
            <Plus className="h-4 w-4" />
            Mandant anlegen
          </Link>
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-2">Noch keine Mandanten</h3>
            <p className="text-gray-500 mb-6 text-sm">Legen Sie Ihren ersten Mandanten an, um loszulegen.</p>
            <Button asChild>
              <Link to="/companies/new">
                <Plus className="h-4 w-4" />
                Ersten Mandanten anlegen
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Link key={company.id} to={`/companies/${company.id}`}>
              <Card className="hover:shadow-md transition-all hover:border-indigo-200 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 shrink-0">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{company.name}</CardTitle>
                      {company.legalForm && (
                        <p className="text-xs text-gray-500 mt-0.5">{company.legalForm}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {company._count.invoices} Rechnungen
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {company._count.customers} Kunden
                    </span>
                  </div>
                  {company.city && (
                    <p className="text-xs text-gray-400 mt-2">{company.zip} {company.city}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
