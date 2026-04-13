# Copilot Instructions for Annas Rechnungsmanager

**Project**: German accounting & invoice management system for tax consultants  
**Tech Stack**: React Router v7, TypeScript, Prisma, MariaDB, Tailwind CSS v4, Docker  
**Language**: English for code/comments, German for business logic and docs

---

## Quick Start for Copilot

### 1. Setup & Environment
Before making any changes, ensure the environment is ready:

```bash
npm install                    # Install dependencies
cp .env.example .env           # Create .env from example
npx prisma migrate deploy      # Apply database migrations
npm run db:seed               # Seed initial data (optional)
npm run dev                   # Start dev server on http://localhost:5173
```

**Database**: Requires MariaDB 10.5+ (or MySQL 8.0+). Can run via Docker:
```bash
docker-compose up -d          # Starts MariaDB, Redis (if configured)
```

### 2. Codebase Map
- **`app/`** — React Router v7 (file-based routing, SSR)
  - `routes/` — Page routes + API endpoints (REST)
  - `components/` — Shared UI (shadcn/ui + Tailwind)
  - `lib/` — Business logic, DB queries, utils
  - `session.server.ts` — Auth & cookie sessions
- **`prisma/`** — Database schema, migrations, seed script
- **`scripts/`** — CLI helpers (setup-admin, reset-password)
- **`public/`** — Static assets (SVGs, images)
- **`graphify-out/`** — Knowledge graph (visual map of code - see GRAPH_REPORT.md)

### 3. Key Files to Know
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Data model (Users, Companies, Invoices, Customers, etc.) |
| `app/root.tsx` | Root layout, error boundaries, global styles |
| `app/entry.server.tsx` | Server-side rendering entry |
| `app/session.server.ts` | Auth logic, session management |
| `app/lib/tax.ts` | German tax calculations (USt, AFA) |
| `app/lib/prisma.server.ts` | DB client initialization |

---

## Development Workflows

### Adding a New Feature
1. **Understand the domain**: Read `CLAUDE.md` section 1 (project overview)
2. **Find the god node**: Check `graphify-out/GRAPH_REPORT.md` for related files
3. **Implement in layers**:
   - Add schema to `prisma/schema.prisma` → `npx prisma migrate dev`
   - Create API endpoint in `app/routes/api.*`
   - Create UI route in `app/routes/`
   - Add business logic to `app/lib/`
4. **Test**: `npm run typecheck && npm run lint && npm run test` (if tests exist)
5. **Verify in dev**: `npm run dev` → test manually in browser

### Editing Existing Routes/Components
- Routes use **file-based routing**: `app/routes/companies.$id.tsx` → `/companies/123`
- Nested routes: `app/routes/companies.$id.invoices.tsx` → `/companies/123/invoices`
- API routes: `app/routes/api.invoices.ts` → `POST /api/invoices`
- Use `loader` for GET data, `action` for POST/PUT/DELETE (Remix/React Router pattern)

### Database Changes
```bash
# Make changes to prisma/schema.prisma, then:
npx prisma migrate dev --name description  # Creates migration + applies it
npx prisma studio                          # GUI browser for data
```

### Authentication
- Sessions stored in browser cookies (signed, httpOnly)
- Check `app/session.server.ts` for session helpers
- Protect routes with `requireAuth()` or check `session` in loader
- Passwords hashed with bcryptjs

---

## Code Style & Conventions

### TypeScript
- **Strict mode enabled** (`strict: true` in tsconfig.json)
- Use `unknown` for external data, then guard with type checks
- Don't use `any` — use `unknown` + assertion if needed
- Nullable types: prefer explicit `| null` over optional `?`

### React Router v7
- Use **loaders** for data fetching (server-side)
- Use **actions** for mutations
- **Return** `redirect()`, `json()`, or React components from loaders
- Use `<Form>` instead of `<form>` for proper handling

### Database Queries
- Use Prisma (never raw SQL in business code)
- Keep queries in `app/lib/` (not in components or routes)
- Example: `app/lib/invoices.ts` exports `getInvoiceById()`, `createInvoice()`, etc.

### UI Components
- Use **shadcn/ui** components (in `app/components/ui/`)
- Style with **Tailwind CSS v4** utility classes
- Keep components small, prefer composition over props drilling
- Use `<Card>`, `<Button>`, `<Dialog>`, `<Select>`, `<Input>` from shadcn

### Naming
- Components: PascalCase (`InvoiceForm.tsx`)
- Utilities/functions: camelCase (`calculateTax()`)
- Constants: UPPER_SNAKE_CASE (`INVOICE_STATUSES`)
- CSS classes: kebab-case (Tailwind default)
- Database tables: singular, lowercase (`user`, `invoice`, `company`)

---

## Business Logic (Important!)

### German Tax (Umsatzsteuer)
- **§14 UStG**: Invoice compliance required for VAT
- Tax calculations in `app/lib/tax.ts`
- Net/Gross amounts: always track both
- Tax rates: 19% (standard), 7% (reduced), 0% (exports)

### Invoice Numbering
- Must be sequential and unique per company
- Logic in `app/lib/invoice-number.server.ts`
- Stored in database to prevent duplicates

### Expense/Income Categories
- Stored in database (user-configurable per company)
- Used for reports and tax deductions
- Budget constraints apply (see schema)

### Audit Logging
- Every write operation must log to audit table
- Include user ID, IP, timestamp, action type
- Check `app/lib/logger.server.ts`

---

## Testing & Validation

### Type Checking
```bash
npm run typecheck  # Runs tsc --noEmit (catches type errors)
```
**Always run before committing.** This is non-negotiable.

### Linting (if configured)
```bash
npm run lint       # Runs eslint
npm run lint:fix   # Auto-fixes style issues
```

### Manual Testing
```bash
npm run dev
# Test in browser at http://localhost:5173
# Try happy path + error cases
```

### Database Validation
- Prisma will catch schema errors on migration
- Use `prisma studio` to verify data after changes
- Test with sample data (seed script)

---

## Common Gotchas & Constraints

### ❌ Don't
- **Don't import from routes into components** — causes circular deps
- **Don't fetch data in components** — use loaders instead
- **Don't store sensitive data in cookies** (sessions are signed, but still)
- **Don't modify `prisma/schema.prisma` without a migration**
- **Don't skip `npm run typecheck`** — type errors hide bugs
- **Don't commit with unresolved TypeScript errors**

### ✅ Do
- **Use server-side rendering** for auth, tax calculations, sensitive data
- **Keep server logic in `app/lib/`**, not in routes
- **Use Prisma transactions** for multi-step operations (invoices + payments)
- **Validate user input** on both client (UX) and server (security)
- **Log important actions** (invoice created, payment received, user deleted)
- **Test edge cases** (negative amounts, invalid dates, permission checks)

### Session Management
- Sessions expire after inactivity (see `.env` for timeout)
- Check `session` in every protected route's loader
- Use `destroySession()` on logout
- Set `secure: true` for HTTPS (production only)

### Deployment
- Docker image builds from `Dockerfile`
- `docker-compose.yml` for local dev (MariaDB + app)
- **Never commit `.env` or secrets** — use `.env.example` as template
- Migrations run automatically on container start (see `Dockerfile`)

---

## How to Ask Copilot for Help

### Effective Requests
**✅ Good:**
- "Add a new invoice status 'draft' to the system. Update schema, create API endpoint, update UI."
- "The tax calculation is wrong for exports (0% VAT). Where is this logic?"
- "Refactor InvoiceForm to use Zod validation."

**❌ Vague:**
- "Make it work better"
- "Fix the database"
- "Add a feature"

### Before Asking
1. **Read CLAUDE.md** — covers project context, architecture, key files
2. **Check the graph** — `graphify-out/GRAPH_REPORT.md` shows component relationships
3. **Look at similar code** — find a similar feature and adapt
4. **Run typecheck** — make sure your environment is valid

### When Stuck
1. Describe the feature + why you're stuck
2. Paste error messages (full stack trace)
3. Mention which file/function you're working in
4. Explain what you tried

---

## Environment Setup

### Required
- **Node.js 22+** — check with `node --version`
- **npm 10+** — check with `npm --version`
- **MariaDB 10.5+** (local or Docker) — check with `mysql --version`

### Optional
- **Docker** — for containerized MariaDB + app
- **Prisma Studio** — GUI for database: `npx prisma studio`
- **VS Code + TypeScript extension** — for type hints while coding

### .env Template
```env
DATABASE_URL="mysql://root:password@localhost:3306/annas_rechnungsmanager"
NODE_ENV="development"
ADMIN_PASSWORD="admin"  # Initial admin password
SESSION_SECRET="your-secret-key-here"  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run typecheck` | Type-check without building |
| `npm run lint` | Run ESLint |
| `npm run build` | Build for production |
| `npm run db:seed` | Seed database with sample data |
| `npx prisma studio` | GUI for database |
| `npx prisma migrate dev` | Create + apply migration |
| `npx prisma migrate reset` | ⚠️ Wipe DB + re-seed (dev only!) |
| `npm run setup-admin` | Create admin user (or use Docker env var) |

---

## Knowledge Graph & Architecture Visualization

A comprehensive visual map of this codebase exists in `graphify-out/`. This is your **architectural compass** — use it before diving into features.

### Files Generated
- **graph.html** — Interactive D3.js visualization (275 nodes, 590 edges, 100 communities)
- **graph.json** — Raw graph data (importable into Neo4j, Obsidian, etc.)
- **GRAPH_REPORT.md** — Analysis report with hub nodes and surprising connections

### How to Use It

#### 1. **Open the Visualization**
```bash
open graphify-out/graph.html
# Or on Linux: xdg-open graphify-out/graph.html
```
- **Drag nodes** to explore relationships
- **Hover** to highlight connections
- **Sidebar shows**: god nodes, key insights, legend by file type

#### 2. **Read the Report**
```bash
cat graphify-out/GRAPH_REPORT.md
```
Contains:
- **God Nodes** — Most connected files (hub architecture)
  - `companies.$id.invoices.$invoiceId.tsx` (8 connections) — Invoice editing is central
  - `session.server.ts` (7 connections) — Auth touches everything
  - `afa.ts` (6 connections) — Tax/depreciation widely used
- **Surprising Connections** — Cross-file bridges you didn't expect
- **Suggested Questions** — Pre-built exploration angles

#### 3. **Answer Specific Questions**
Before implementing a feature, ask the graph:

**"How do invoice routes connect to pricing?"**
```bash
graphify query "invoice routes pricing"
# Returns: node paths, edge types, confidence scores
```

**"What's the shortest path from InvoiceForm to TaxCalculation?"**
```bash
graphify path "InvoiceForm" "TaxCalculation"
# Returns: dependency chain with edge types (imports, calls, etc.)
```

**"Tell me everything about session.server.ts"**
```bash
graphify explain "session.server.ts"
# Returns: node info, all connections (incoming/outgoing), file location
```

### Common Use Cases

#### 🔍 **Understanding a New Area**
1. Open `graph.html`
2. Search the visualization for relevant keywords (invoice, tax, payment)
3. Click god nodes to see what's connected
4. Run `/graphify query` on a concept you don't understand

#### ✨ **Finding Related Code**
Before editing a file, check what it connects to:
```bash
graphify explain "companies.$id.invoices.tsx"
# See: what imports it, what it imports, data flow
```

#### 🚨 **Impact Analysis Before Changes**
Need to modify `session.server.ts`?
```bash
graphify query "session authentication routes"
# See all places that depend on auth logic
# Helps avoid breaking changes
```

#### 🏗️ **Refactoring with Confidence**
When consolidating duplicate code:
```bash
graphify path "ExpenseCategory" "IncomeCategory"
# Find if they share logic or should be unified
```

### Graph Legend

| Symbol/Color | Meaning |
|--------------|---------|
| 🔵 Blue node | Code file (.ts, .tsx, .js) |
| 🟢 Green node | Document (.md) |
| 🟠 Orange node | Image/Asset (.svg, .png) |
| Solid edge | Direct relationship (import, call, cite) |
| Dashed edge | Inferred relationship (similar concepts) |
| Edge thickness | Confidence score (thicker = more confident) |

### God Nodes (Hub Architecture)

These 5 files are the system's backbone:

| File | Connections | Why It Matters |
|------|-------------|-----------------|
| `companies.$id.invoices.$invoiceId.tsx` | 8 | Invoice editing is core — touches pricing, payments, customers |
| `session.server.ts` | 7 | Authentication is pervasive — protects all private routes |
| `companies.$id.anlagevermoegen.tsx` | 7 | Asset management — deep dependency on tax logic |
| `afa.ts` | 6 | Depreciation calculations — used in reports, invoices, exports |
| `companies.$id.ausgaben.tsx` | 6 | Expense tracking — feeds into tax reports, budgets |

**Implication**: Changes to these files have wide impact. Test thoroughly and check the graph for dependents.

### Updating the Graph

When you add new files or features:
```bash
graphify --update
# Re-scans repo, only re-extracts changed files
# Merges with existing graph.json
# Updates GRAPH_REPORT.md automatically
```

Or full rebuild (slow, but thorough):
```bash
rm -rf graphify-out/*.json
graphify .
```

### Integration with Development

1. **Before a sprint**: Open the graph, understand the domain
2. **Before editing a file**: Run `graphify explain` on it
3. **Before refactoring**: Check `graphify query` for impact
4. **After big changes**: Run `graphify --update` to keep it fresh
5. **In code review**: Reference the graph to explain architecture

---

## Key Resources

- **CLAUDE.md** — Project onboarding (read this first!)
- **README.md** — User-facing project description
- **prisma/schema.prisma** — Data model
- **graphify-out/** — Knowledge graph + visual architecture
- **Prisma docs**: https://www.prisma.io/docs/
- **React Router v7 docs**: https://reactrouter.com/
- **Tailwind CSS v4**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com/

---

## Questions?

If something is unclear:
1. Check CLAUDE.md first
2. Look at the knowledge graph
3. Find similar code in the codebase
4. Ask Copilot with as much context as possible

Good luck! 🚀
