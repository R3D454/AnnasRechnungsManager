import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from "react-router";
import "./app.css";

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
    ? error.message
    : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return (
    <html lang="de">
      <head><meta charSet="utf-8" /><Meta /><Links /></head>
      <body style={{ fontFamily: "monospace", padding: "2rem", background: "#fff1f2", color: "#9f1239" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Fehler</h1>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#ffe4e6", padding: "1rem", borderRadius: "0.5rem" }}>{message}</pre>
        {stack && <pre style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#64748b", whiteSpace: "pre-wrap" }}>{stack}</pre>}
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
  return <Outlet />;
}
