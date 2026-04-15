import { Outlet, useParams, useLocation, Link } from "react-router";
import { requireUser } from "@/session.server";
import { Scale, TrendingDown, TrendingUp, Landmark, DollarSign, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Buchhaltung" },
  ],
};

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  // Verify company ownership
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  await prisma.$disconnect();
  if (!company) throw new Response("Not Found", { status: 404 });
  return { companyId: company.id, companyName: company.name };
}

const accountingTabs = [
  {
    id: "bilanzen",
    label: "Bilanzen",
    icon: Scale,
    href: "bilanzen",
    color: "teal",
  },
  {
    id: "ausgaben",
    label: "Ausgaben",
    icon: TrendingDown,
    href: "ausgaben",
    color: "rose",
  },
  {
    id: "einnahmen",
    label: "Einnahmen",
    icon: TrendingUp,
    href: "einnahmen",
    color: "emerald",
  },
  {
    id: "anlagevermoegen",
    label: "Anlagevermögen",
    icon: Landmark,
    href: "anlagevermoegen",
    color: "violet",
  },
  {
    id: "money",
    label: "Finanzmittel",
    icon: DollarSign,
    href: "money",
    color: "cyan",
  },
];

export default function BuchhaltungLayout() {
  const params = useParams();
  const location = useLocation();
  const companyId = params.id;

  // Determine which tab is active based on current pathname
  const pathSegments = location.pathname.split("/");
  const activeSegment = pathSegments[pathSegments.length - 1];
  const activeTa = accountingTabs.find((tab) => tab.href === activeSegment);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Buchhaltung</h2>
        <p className="text-sm text-gray-600">Verwaltung von Bilanzen, Ausgaben, Einnahmen und Vermögen</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {accountingTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.href === activeSegment;
          const bgColor = `${tab.color}-50`;
          const borderColor = `${tab.color}-200`;
          const textColor = `${tab.color}-600`;
          const activeBg = `${tab.color}-100`;
          
          return (
            <Link key={tab.id} to={`/companies/${companyId}/buchhaltung/${tab.href}`} className="block">
              <Card 
                className={`hover:shadow-sm transition-all cursor-pointer ${
                  isActive ? `border-${borderColor} bg-${activeBg}` : `hover:border-${borderColor}`
                }`}
              >
                <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3 text-center">
                  <div className={`p-3 rounded-lg bg-${bgColor}`}>
                    <Icon className={`h-5 w-5 text-${textColor}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{tab.label}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <Outlet />
      </div>
    </div>
  );
}
