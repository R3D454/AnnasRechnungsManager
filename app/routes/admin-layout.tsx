import { Outlet, useLoaderData, Link, useLocation } from "react-router";
import { requireAdmin } from "@/session.server";
import { Shield, Users, ScrollText, LayoutDashboard, Building2 } from "lucide-react";

export async function loader({ request }: { request: Request }) {
  const user = await requireAdmin(request);
  return { userName: user.name };
}

export default function AdminLayout() {
  const { userName } = useLoaderData<typeof loader>();
  const location = useLocation();

  const navItems = [
    { to: "/admin/mandanten", label: "Mandanten", icon: Building2 },
    { to: "/admin/users", label: "Benutzerverwaltung", icon: Users },
    { to: "/admin/logs", label: "Audit-Log", icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header
        className="sticky top-0 z-10 shrink-0"
        style={{
          height: "3.5rem",
          background: "#1e1b4b",
          borderBottom: "1px solid #312e81",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Shield className="w-5 h-5 text-indigo-300" />
          <span style={{ color: "#c7d2fe", fontWeight: 600, fontSize: "0.9rem" }}>
            Admin
          </span>
          <span style={{ color: "#4338ca", marginLeft: "0.25rem" }}>/</span>
          <nav style={{ display: "flex", gap: "0.25rem" }}>
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    fontSize: "0.8125rem",
                    padding: "0.25rem 0.625rem",
                    borderRadius: "0.375rem",
                    color: active ? "#e0e7ff" : "#818cf8",
                    background: active ? "#312e81" : "transparent",
                    textDecoration: "none",
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#818cf8" }}>{userName}</span>
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.8125rem",
              color: "#818cf8",
              textDecoration: "none",
              padding: "0.25rem 0.625rem",
              borderRadius: "0.375rem",
              border: "1px solid #312e81",
            }}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            App
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
