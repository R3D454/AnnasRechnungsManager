# Annas Rechnungsmanager

Buchhaltungs- und Rechnungsverwaltungssystem für Mandanten.

## Features

- **Mandantenverwaltung** — Mehrere Unternehmen verwalten
- **Rechnungen** — Erstellen, verwalten, als PDF exportieren (§14 UStG konform)
- **Kundenverwaltung** — Kundenstammdaten pro Mandant
- **Steuerberichte** — USt-Voranmeldung, monatliche & quartalsweise Auswertungen

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **MySQL / MariaDB** via Prisma ORM
- **NextAuth.js v5** (Email/Passwort-Login)
- **Tailwind CSS** + shadcn/ui
- **@react-pdf/renderer** für PDF-Generierung

## Setup

### 1. Voraussetzungen

- Node.js 18+
- MySQL oder MariaDB

### 2. Installation

```bash
npm install
```

### 3. Datenbank konfigurieren

```bash
cp .env.example .env
# DATABASE_URL in .env anpassen
```

### 4. Datenbank einrichten

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

**Demo-Zugangsdaten:** `anna@example.de` / `demo123`

### 5. Entwicklungsserver starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000)

## Datenbank-Kommandos

```bash
npm run db:migrate   # Migrationen ausführen
npm run db:seed      # Demo-Daten einspielen
npm run db:studio    # Prisma Studio öffnen
```

## Rechnungs-Compliance (§14 UStG)

Alle PDFs enthalten die gesetzlich vorgeschriebenen Pflichtangaben:
- Name & Anschrift Rechnungssteller und -empfänger
- Steuernummer / USt-IdNr. des Ausstellers
- Rechnungsdatum & Rechnungsnummer (fortlaufend)
- Leistungsdatum / Lieferdatum
- Leistungsbeschreibung
- Nettobetrag, USt-Satz, USt-Betrag, Bruttobetrag
