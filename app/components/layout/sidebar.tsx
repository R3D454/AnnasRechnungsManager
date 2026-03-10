import { Link, Form, useLocation } from "react-router";
import {
  Calculator,
  Building2,
  LayoutDashboard,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Mandanten", href: "/companies", icon: <Building2 className="h-4 w-4" /> },
];

export function Sidebar({ userName }: { userName?: string | null }) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
          <Calculator className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 text-sm leading-tight">
          Rechnungs-<br />manager
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              {item.icon}
              {item.label}
              {active && <ChevronRight className="ml-auto h-3 w-3 text-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        {userName && (
          <p className="text-xs text-gray-500 px-3 mb-2 truncate">{userName}</p>
        )}
        <Form method="post" action="/logout">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </Button>
        </Form>
      </div>
    </aside>
  );
}
