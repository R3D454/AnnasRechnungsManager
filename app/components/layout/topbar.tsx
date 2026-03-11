import { useMatches, Link } from "react-router";
import { ChevronRight } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface BreadcrumbHandle {
  breadcrumbs: (data: unknown) => Breadcrumb[];
}

function isBreadcrumbHandle(handle: unknown): handle is BreadcrumbHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    "breadcrumbs" in handle &&
    typeof (handle as BreadcrumbHandle).breadcrumbs === "function"
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function Topbar({ userName }: { userName?: string | null }) {
  const matches = useMatches();

  const activeMatch = [...matches].reverse().find((m) => isBreadcrumbHandle(m.handle));
  const breadcrumbs: Breadcrumb[] =
    activeMatch && isBreadcrumbHandle(activeMatch.handle)
      ? activeMatch.handle.breadcrumbs(activeMatch.data)
      : [];

  return (
    <header
      className="sticky top-0 z-10 shrink-0"
      style={{
        height: "3.5rem",
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
      }}
    >
      {/* Breadcrumbs */}
      <nav style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.875rem", minWidth: 0 }}>
        {breadcrumbs.length === 0 ? (
          <span style={{ color: "#94a3b8" }}>Rechnungsmanager</span>
        ) : (
          breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.25rem", minWidth: 0 }}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5" style={{ color: "#cbd5e1", flexShrink: 0 }} />}
                {isLast || !crumb.href ? (
                  <span
                    style={{
                      fontWeight: isLast ? 500 : 400,
                      color: isLast ? "#0f172a" : "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.href}
                    style={{ color: "#64748b", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            );
          })
        )}
      </nav>

      {/* User */}
      {userName && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginLeft: "1rem", flexShrink: 0 }}>
          <span style={{ fontSize: "0.875rem", color: "#64748b" }}>{userName}</span>
          <div
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "9999px",
              background: "linear-gradient(135deg, #818cf8, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            {getInitials(userName)}
          </div>
        </div>
      )}
    </header>
  );
}
