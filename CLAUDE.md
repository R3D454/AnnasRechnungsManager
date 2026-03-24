
# Annas Rechnungsmanager (CLAUDE onboarding)

## 1. Projektüberblick

Annas Rechnungsmanager ist ein Buchhaltungs- und Rechnungsverwaltungssystem für Steuerberater und Buchhalter mit Mandantenverwaltung. Funktionalitäten:
- Mandantenverwaltung (CRUD, Archiv, Papierkorb)
- Rechnungsverwaltung (Erstellen, PDF-/XML-Export, Zahlung eintragen)
- Kundenverwaltung (Stammdaten pro Mandant)
- Steuerberichte (USt-Voranmeldung, Monats-/Quartalsreport)
- Benutzerverwaltung mit Rollen (ADMIN, USER)
- Audit-Log (Aktionen + IP + Benutzer)

## 2. Tech Stack (Schlüsseltechnologien)

- `Node.js 22+`, `TypeScript`
- REMIX/React Router v7 (Server-/Client-CSS, SSR, file-based routing)
- `Prisma` + `MariaDB` (MySQL-kompatibel)
- Authentifizierung: cookie-basierte Sessions, `bcryptjs`
- UI: `Tailwind CSS v4`, `shadcn/ui`, Remix components
- PDF: `@react-pdf/renderer`
- Deployment: `Docker`, `docker-compose`, optional `k8s`

## 3. Repository-Architektur

- `app/` - Remiх/React-Router-Quellcode
  - `components/` - shared UI und Domain-Komponenten (`company`, `invoice`, `layout`, `ui`)
  - `lib/` - Datenbank, Logik, Helpers
  - `routes/` - Datei-Routing-Endpunkte und APIs
  - `session.server.ts` - Session/Auth-Handling
  - `types/index.ts` - globale Typen
- `prisma/` - Schema, Migrationen, Seeder
- `scripts/` - CLI-Hilfs-Skripte (`setup-admin`, `reset-password`)
- `docker-compose.yml`, `Dockerfile`, `k8s.yml` - Deployment & Infrastruktur

## 4. Schlüsseldateien

- `app/root.tsx` - Root-Layout und Fehlergrenzen
- `app/entry.server.tsx` - Server-Entry (SSR)
- `app/routes/index.tsx` (`home`, `dashboard`, `login`, `settings`)
- `app/routes/api.*` - REST-API-Endpunkte für CRUD (companies, invoices, etc.)
- `app/lib/prisma.server.ts` - Prisma-Client-Initialisierung
- `app/lib/logger.server.ts`, `rate-limiter.server.ts` - Infrastruktur
- `prisma/schema.prisma` - Datenmodell
- `package.json` und `tsconfig.json` - Build / Lint / Types

## 5. Konventionen & Code-Richtlinien

- FS-basierte React Router v7 Routen
- Server-Endpunkte in `app/routes/api.*` als Remix-Loaders/Actions
- Mutationen und Datenzugriffe in `app/lib` (Prisma, Tax, utils)
- Typescript-sicher und null-safe; bevorzugt `unknown`/`guard`-Checks für externe Daten
- UI-Toolkit: shadcn-Komponenten + Tailwind Utility-Klassen
- Error-Handling mit Remix `redirect`, `json`, `badRequest`

## 6. Häufige Aufgaben und Workflows

- Lokale Entwicklung: `npm install`, `.env` konfigurieren, `npx prisma migrate deploy`, `npm run dev`
- DB initialisieren/seeden: `npm run db:seed`; `npm run db:migrate`
- Admin einrichten: `npm run setup-admin` (oder via Docker-Env `ADMIN_PASSWORD` beim Start)
- Passwort reset: `npm run reset-password`
- Automatische Migration beim Containerstart (Production)

## 7. Spezielle Hinweise für Claude

- Bevorzuge präzise Änderungen in bestehendem Code (letzte Routen und Libs).
- Halte Backward-Kompatibilität: bestehende API-Contracts in `api.*` sollen intakt bleiben.
- Dokumentiere bei komplexen Änderungen Business-Logik (Steuern, Rechnungscodes, UStG §14).
- Vollständige Test: `npm run typecheck`, ggf. `npm run lint` (falls eingerichtet).

## 8. Agent-Persona (optional)

- Rolle: Full-stack Remix / TypeScript-Fachkraft für deutsche Rechnungssoftware
- Fokus: Feature-Implementierung im Domain-Kontext (Invoices, Reports, Clients)
- Toolpräferenzen: `read_file`, `grep_search`, `replace_string_in_file` und `run_in_terminal` für Verifikation
- Vermeide: ungetestete massive Refactorings ohne vorhandenen Abdeckungsstatus

## 9. Weiteres

- `CLAUDE.md` wird als Projekt-spezifisches Onboarding für ChatGPT/Claude-Agenten genutzt.
- Für Dev-Workflows und PR-Beschreibungen, bitte auf `README.md` und `package.json` verweisen.

