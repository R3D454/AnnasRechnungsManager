import { Link, Form, useLocation } from "react-router";
import { Calculator, Building2, LayoutDashboard, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Mandanten", href: "/companies", icon: <Building2 className="h-4 w-4" /> },
];

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function Sidebar({ userName }: { userName?: string | null }) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <aside
      className="fixed inset-y-0 left-0 z-20 flex flex-col"
      style={{ width: "var(--sidebar-width)", background: "#0f172a", borderRight: "1px solid #1e293b" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid #1e293b" }}>
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}
        >
          <Calculator className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-semibold text-sm leading-tight block" style={{ color: "#f1f5f9" }}>
            Rechnungsmanager
          </span>
          <span className="text-xs" style={{ color: "#475569" }}>Buchhaltung</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5" style={{ overflowY: "auto" }}>
        <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: "#334155" }}>
          Navigation
        </p>
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5",
              )}
              style={
                active
                  ? { background: "#4f46e5", color: "#ffffff" }
                  : { color: "#94a3b8" }
              }
            >
              {item.icon}
              {item.label}
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5" style={{ color: "#a5b4fc" }} />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid #1e293b" }}>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2"
          style={{ background: "#1e293b" }}
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, #818cf8, #7c3aed)" }}
          >
            {getInitials(userName)}
          </div>
          {userName && (
            <p className="text-sm font-medium truncate" style={{ color: "#cbd5e1" }}>{userName}</p>
          )}
        </div>
        <Form method="post" action="/logout">
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ color: "#64748b" }}
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </Form>
      </div>
    </aside>
  );
}
