import { Outlet, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import { Topbar } from "@/components/layout/topbar";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  return { userName: user.name, userRole: user.role };
}

export default function DashboardLayout() {
  const { userName, userRole } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Topbar userName={userName} userRole={userRole} />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
