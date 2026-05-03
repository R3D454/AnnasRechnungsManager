import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from "react-router";
import "./app.css";
import { DebugPanel } from "./components/debug-panel";

export function ErrorBoundary() {
  const error = useRouteError();
  
  // Get error details
  const isResponse = isRouteErrorResponse(error);
  const status = isResponse ? error.status : 500;
  const statusText = isResponse ? error.statusText : "Internal Server Error";
  const message = isResponse
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
    ? error.message
    : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Log error details for debugging
  if (typeof console !== "undefined") {
    console.error("\n" + "=".repeat(80));
    console.error("[ERROR_BOUNDARY]", new Date().toISOString());
    console.error(`Status: ${status} ${statusText}`);
    console.error(`Message: ${message}`);
    if (stack) console.error("Stack:\n" + stack);
    if (error && typeof error === "object") {
      console.error("Full Error Object:", error);
    }
    console.error("=".repeat(80) + "\n");
  }

  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body style={{ fontFamily: "monospace", padding: "2rem", background: "#fff1f2", color: "#9f1239" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
          {status} Fehler
        </h1>
        <p style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          {statusText}
        </p>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#ffe4e6", padding: "1rem", borderRadius: "0.5rem" }}>
          {message}
        </pre>
        {import.meta.env.DEV && stack && (
          <details style={{ marginTop: "1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "#64748b" }}>
              Stack Trace (Dev Only)
            </summary>
            <pre style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#64748b", whiteSpace: "pre-wrap", background: "#f1f5f9", padding: "1rem", borderRadius: "0.5rem" }}>
              {stack}
            </pre>
          </details>
        )}
        <Scripts />
      </body>
    </html>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Annas Rechnungsmanager</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <Outlet />
      <DebugPanel />
    </>
  );
}
