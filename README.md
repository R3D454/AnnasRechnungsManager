# Annas Rechnungsmanager

Buchhaltungs- und Rechnungsverwaltungssystem für Steuerberater und Buchhalter mit Mandantenverwaltung.

## Features

- **Mandantenverwaltung** — Mehrere Unternehmen verwalten, archivieren und wiederherstellen
- **Rechnungen** — Erstellen, versenden, bezahlen, als PDF exportieren (§14 UStG konform)
- **Kundenverwaltung** — Kundenstammdaten pro Mandant
- **Steuerberichte** — USt-Voranmeldung, monatliche & quartalsweise Auswertungen
- **Benutzerverwaltung** — Mehrere Benutzer mit Rollen (USER / ADMIN)
- **Audit-Log** — Protokollierung aller relevanten Aktionen mit Benutzer und IP
- **Archiv** — Archivierte Mandanten mit vollständiger Historie einsehbar
- **Papierkorb** — Gelöschte Rechnungen wiederherstellbar

## Tech Stack

- **React Router v7** (Framework Mode, SSR) + TypeScript
- **MariaDB** via Prisma ORM
- **Cookie-Session-Auth** (bcryptjs)
- **Tailwind CSS v4** + shadcn/ui
- **@react-pdf/renderer** für PDF-Generierung
- **Docker** für Datenbank und Deployment

---

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
AUTH_SECRET="dein-zufaelliger-geheimer-string"
```

### Datenbank einrichten

```bash
npx prisma migrate deploy   # Migrationen ausführen
npm run db:seed             # Demo-Daten einspielen (optional)
```

### Dev-Server starten

```bash
npm run dev
```

Startet den Vite-Dev-Server auf `http://localhost:5173`.

---

## Deployment

### Erstes Deployment

**1. Image bauen:**

```bash
docker build -t annasrechnungsmanager:latest .
```

**2. Secrets setzen** (Shell-Exports oder `.env`-Datei):

```bash
export AUTH_SECRET="langer-zufaelliger-string"
export ADMIN_PASSWORD="sicheres-startpasswort"   # nur beim ersten Start
```

**3. Stack starten:**

```bash
docker compose up -d
```

Beim ersten Start mit gesetztem `ADMIN_PASSWORD`:
- Prisma-Migrationen werden automatisch ausgeführt
- Admin-Benutzer (`username: admin`) wird angelegt oder aktualisiert

**4. `ADMIN_PASSWORD` entfernen** (nach erfolgreichem Login und eigenem Passwort setzen).

> Die App läuft auf `http://localhost:3000`.

### Folge-Deployments

```bash
docker build -t annasrechnungsmanager:latest .
docker compose up -d --no-deps app
```

Migrationen werden beim Start automatisch angewendet. `ADMIN_PASSWORD` ist nicht erneut nötig.

---

## CI/CD (Gitea Actions)

Die Pipeline liegt in `.gitea/workflows/build.yml` und baut/pusht bei jedem Push auf `main` ein Docker-Image.

### Voraussetzungen

- Secret `REGISTRY_TOKEN` ist im Repository gesetzt
- Der Token hat Berechtigung zum Push in die Gitea Container Registry
- Der Registry-Host ist vom Runner aus erreichbar

### Aktuelle Registry-Konfiguration

Die Pipeline nutzt aktuell:

- `REGISTRY=git.henryathome.home64.de`
- Image-Name aus `${{ gitea.repository }}`
- Tags: kurzer Commit-SHA + `latest` (auf Default-Branch)

### Häufiger Fehler: `i/o timeout` beim Push

Fehlerbild (vereinfacht):

`failed to push ... Head "https://.../v2/.../blobs/...": dial tcp ...:443: i/o timeout`

Typische Ursache:

- Die Registry-Adresse ist intern (z. B. `*.svc.cluster.local`) und vom CI-Runner nicht erreichbar.

Lösung:

- In `.gitea/workflows/build.yml` einen extern erreichbaren Host bei `REGISTRY` eintragen.
- Sicherstellen, dass DNS, Firewall und Portfreigaben vom Runner zur Registry passen.
- Prüfen, ob HTTPS korrekt terminiert ist (Zertifikat/Reverse Proxy), da Buildx standardmäßig per HTTPS pusht.

---

## Admin-Benutzer & Recovery

### Admin-Passwort setzen (im laufenden Container)

```bash
docker exec -e ADMIN_PASSWORD=neuespasswort annas_app node scripts/setup-admin.js
```

Erstellt oder aktualisiert den Benutzer `admin` (idempotent). Mindestens 8 Zeichen.

### Passwort eines beliebigen Benutzers zurücksetzen

```bash
docker exec -it annas_app node scripts/reset-password.js --username anna --password neuespasswort
```

Zeigt alle vorhandenen Benutzer an, wenn der angegebene Username nicht existiert.

### Passwort im laufenden Betrieb ändern

Jeder eingeloggte Benutzer kann sein Passwort über das **Schlüssel-Icon** in der Topbar ändern (`/settings/password`).

---

## Benutzerverwaltung (Admin)

Erreichbar über den **Admin**-Button in der Topbar (nur für Benutzer mit Rolle `ADMIN`).

- Benutzer anlegen, bearbeiten, löschen
- Rollen vergeben: `USER` oder `ADMIN`
- Audit-Log einsehen (Aktion, Benutzer, IP-Adresse, Zeitstempel)

Login ist möglich mit **Benutzername** oder **E-Mail-Adresse**.

---

## Scripts

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Dev-Server starten |
| `npm run build` | Produktions-Build |
| `npm run start` | Produktions-Server starten |
| `npm run typecheck` | TypeScript prüfen |
| `npm run db:migrate` | Prisma Migrationen ausführen (Dev) |
| `npm run db:seed` | Demo-Daten einspielen |
| `npm run db:studio` | Prisma Studio öffnen |
| `npm run setup-admin` | Admin-Benutzer anlegen / Passwort setzen |
| `npm run reset-password` | Passwort eines Benutzers zurücksetzen |

**Beispiele (Entwicklung):**

```bash
# Admin-Passwort setzen
ADMIN_PASSWORD=geheim npm run setup-admin

# Passwort zurücksetzen
npm run reset-password -- --username anna --password neuespasswort
```

---

## Projektstruktur

```
app/
  components/         UI-Komponenten (ui/, layout/, company/, invoice/)
  lib/                Hilfsfunktionen (prisma, tax, utils, invoice-number, logger)
  routes/             Route-Dateien (React Router v7, file-based)
    admin.*           Admin-Bereich (Benutzerverwaltung, Audit-Log)
    api.*             REST-API-Routen (resource routes)
    settings.*        Benutzereinstellungen (Passwort ändern)
    archiv.tsx        Archiv-Übersicht (archivierte Mandanten)
  session.server.ts   Auth (Login via Username/E-Mail, Logout, Session)
  types/              Gemeinsame TypeScript-Typen
scripts/
  setup-admin.ts      Admin-Benutzer anlegen / Passwort setzen
  reset-password.ts   Recovery: Passwort eines Benutzers zurücksetzen
prisma/
  schema.prisma       Datenbankschema
  migrations/         Migrationsverlauf
  seed.ts             Demo-Daten
```

---

## Rechnungs-Compliance (§14 UStG)

Alle PDFs enthalten die gesetzlich vorgeschriebenen Pflichtangaben:

- Name & Anschrift Rechnungssteller und -empfänger
- Steuernummer / USt-IdNr. des Ausstellers
- Rechnungsdatum & fortlaufende Rechnungsnummer
- Leistungsdatum / Lieferdatum
- Leistungsbeschreibung
- Nettobetrag, USt-Satz, USt-Betrag, Bruttobetrag
