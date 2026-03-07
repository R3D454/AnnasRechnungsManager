import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Annas Rechnungsmanager",
  description: "Buchhaltung & Rechnungsverwaltung für Mandanten",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
