import { Outlet, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import { Sidebar } from "@/components/layout/sidebar";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  return { userName: user.name };
}

export default function DashboardLayout() {
  const { userName } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={userName} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
