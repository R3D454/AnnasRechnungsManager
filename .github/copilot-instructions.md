# Copilot Instructions — Annas Rechnungsmanager

German accounting & invoice management system for tax consultants (Steuerberater), built with React Router v7 (SSR), Prisma, MariaDB, and Tailwind CSS v4.

---

## Commands

```bash
npm run dev           # Dev server at http://localhost:5173
npm run build         # Production build
npm run typecheck     # react-router typegen + tsc (run before every commit)
npm run lint          # ESLint

npm run db:migrate    # prisma migrate dev (create + apply migration)
npm run db:seed       # Seed database with sample data
npm run db:studio     # Prisma Studio GUI

npm run setup-admin   # Create initial admin user
npm run reset-password
```

**Required `.env` variables:**
```env
DATABASE_URL="mysql://root:password@localhost:3306/annas_rechnungsmanager"
AUTH_SECRET="<random 32-byte hex>"   # NOT SESSION_SECRET
NODE_ENV="development"
```

---

## Architecture

### Route Layout

Routes are **explicitly configured** in `app/routes.ts` (not auto-discovered by file name). Two layout wrappers exist:
- `dashboard-layout.tsx` — wraps all authenticated company/user routes
- `admin-layout.tsx` — wraps `/admin/*` (requires ADMIN role)

**UI routes** (`app/routes/companies.*.tsx`, etc.) export `loader` + default component.  
**API routes** (`app/routes/api.*.ts`) export only `action` (no default export, no loader).

### Path Alias

`@/` resolves to `app/`. Use it everywhere: `import prisma from "@/lib/prisma.server"`.

### Data Flow Pattern

```
UI Route (loader/action)
  → app/lib/ (business logic + Prisma queries)
  → prisma.server.ts (single Prisma Client instance)
  → AuditLog (mandatory on every write)
```

Auth helpers live in `app/session.server.ts`:
- `requireUser(request)` — throws redirect to `/login` if not authenticated
- `requireAdmin(request)` — throws redirect to `/` if not ADMIN
- `getApiUser(request)` — returns user or null (for API routes)

---

## Key Conventions

### Input Validation

All Zod schemas live in `app/lib/schemas.ts`. Reusable validators (`currencySchema`, `taxRateSchema`, `ibanSchema`, `vatIdSchema`) are defined there — import and extend them, don't redefine.

API routes must `safeParse` the request body before any DB access:
```ts
const parsed = mySchema.safeParse(await request.json());
if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
```

### Tax Calculations (Never Trust the Client)

Always **recalculate amounts server-side** using `app/lib/tax.ts`:
- `calcItemAmounts(quantity, unitPrice, taxRate)` — standard MwSt.
- `calcItemAmountsKleinunternehmer(quantity, unitPrice)` — §19 UStG, no VAT
- `calcInvoiceTotals(items)` — sums net/tax/gross

Valid tax rates: `0`, `7`, `19` (enforced by `taxRateSchema`).

The `Company.kleinunternehmer` flag controls which calculation is used — always read it from the DB, not from the request body.

### Audit Logging (Mandatory on Every Write)

Every mutation must call `log()` from `app/lib/logger.server.ts`. The `action` parameter must use the `LogAction` union type defined in that file:
```ts
await log({ userId: user.id, action: "CREATE_INVOICE", entity: "Invoice", entityId: invoice.id, metadata: {...}, request });
```
Logging failures are swallowed intentionally — never let them break the main operation.

### Database Rules

- All Prisma queries belong in `app/lib/`, not in routes or components.
- Use `prisma.$transaction()` for multi-step operations (e.g., creating an invoice + a Buchung entry).
- Invoice amounts are stored as both net/tax/gross (`Decimal(10,2)`) — always persist all three.
- Soft-delete pattern: invoices use `deletedAt` field; companies use `archived`/`archivedAt`.
- When an invoice is marked PAID, a linked `Buchung` record is created automatically.

### Domain Vocabulary (German ↔ Code)

| German | Code / Table |
|--------|--------------|
| Mandant | `Company` model |
| Buchung | `Buchung` model (transaction/ledger entry) |
| Anlagegut | `Anlagegut` model (fixed asset) |
| Ausgabe | expense (type `ENTNAHME` in `Buchung`) |
| Einnahme | revenue (type `EINLAGE` in `Buchung`) |
| Kleinunternehmer | §19 UStG — no VAT on invoices |
| AFA | Absetzung für Abnutzung — depreciation, computed in `app/lib/afa.ts` |

### Sessions

Session cookie name: `__session`, expires after **4 hours**, stored via `createCookieSessionStorage`. Keys stored in session: `userId`, `userName`, `userRole`.

---

## High-Impact Files

Changes to these files have wide blast radius — check dependents carefully:

| File | Why it matters |
|------|----------------|
| `app/session.server.ts` | Auth used by every protected route |
| `app/lib/tax.ts` | Tax calculations used in invoices, reports, exports |
| `app/lib/afa.ts` | Depreciation logic used in reports and asset management |
| `prisma/schema.prisma` | Any change requires a migration |
| `app/routes.ts` | Route config — adding routes here is required, not automatic |
