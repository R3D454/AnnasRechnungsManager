# Annas Rechnungsmanager

Buchhaltungs- und Rechnungsverwaltungssystem für Mandanten.

## Features

- **Mandantenverwaltung** — Mehrere Unternehmen verwalten
- **Rechnungen** — Erstellen, verwalten, als PDF exportieren (§14 UStG konform)
- **Kundenverwaltung** — Kundenstammdaten pro Mandant
- **Steuerberichte** — USt-Voranmeldung, monatliche & quartalsweise Auswertungen

## Tech Stack

- **React Router v7** (Framework Mode, SSR) + TypeScript
- **MariaDB** via Prisma ORM
- **Cookie-Session-Auth** (bcryptjs)
- **Tailwind CSS v4** + shadcn/ui
- **@react-pdf/renderer** für PDF-Generierung
- **Docker** für die Datenbank

## Lokale Entwicklung

### Voraussetzungen

- Node.js 22+
- Docker + Docker Compose

### Installation

```bash
npm install
```

### Umgebungsvariablen

`.env` im Projektstamm anlegen:

```env
DATABASE_URL="mysql://annas_user:annas_password@localhost:3306/annas_rechnungen"
AUTH_SECRET="dein-zufaelliger-secret-string"
```

### Datenbank einrichten

```bash
npm run db:migrate   # Migrationen ausführen
npm run db:seed      # Demo-Daten einspielen
```

**Demo-Zugangsdaten:** `anna@example.de` / `demo123`

### Entwicklungsserver starten

```bash
npm run dev
```

Startet automatisch MariaDB via Docker und den Vite-Dev-Server auf `http://localhost:5173`.

## Scripts

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | DB starten + Dev-Server |
| `npm run build` | Produktions-Build |
| `npm run start` | Produktions-Server starten |
| `npm run typecheck` | TypeScript prüfen |
| `npm run db:migrate` | Prisma Migrationen ausführen |
| `npm run db:seed` | Demo-Daten einspielen |
| `npm run db:studio` | Prisma Studio öffnen |

## Deployment

### Docker Compose

Startet App + MariaDB als komplettes Setup:

```bash
docker compose up -d
```

Die App läuft auf `http://localhost:3000`. Migrationen werden automatisch beim Start ausgeführt.

> `AUTH_SECRET` muss als Umgebungsvariable gesetzt sein.

### Kubernetes

```bash
# Secret-Werte in k8s.yml anpassen (auth-secret, ggf. Passwörter), dann:
kubectl apply -f k8s.yml
```

Das Manifest (`k8s.yml`) enthält: Namespace, Secret, MariaDB (PVC + Deployment + Service), App (Deployment mit Init-Container für Migrationen + Service + Ingress).

## Projektstruktur

```
app/
  components/         UI-Komponenten (ui/, layout/, company/, invoice/)
  lib/                Hilfsfunktionen (prisma, tax, utils, invoice-number)
  routes/             Route-Dateien (React Router v7, file-based)
  session.server.ts   Auth (Login, Logout, Session)
  types/              Gemeinsame TypeScript-Typen
db/
  docker-compose.yml  MariaDB + phpMyAdmin für lokale Entwicklung
prisma/
  schema.prisma       Datenbankschema
  migrations/         Migrationsverlauf
```

## Rechnungs-Compliance (§14 UStG)

Alle PDFs enthalten die gesetzlich vorgeschriebenen Pflichtangaben:
- Name & Anschrift Rechnungssteller und -empfänger
- Steuernummer / USt-IdNr. des Ausstellers
- Rechnungsdatum & Rechnungsnummer (fortlaufend)
- Leistungsdatum / Lieferdatum
- Leistungsbeschreibung
- Nettobetrag, USt-Satz, USt-Betrag, Bruttobetrag
