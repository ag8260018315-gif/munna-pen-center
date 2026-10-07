# Munna Pen Center — wholesale stationery website

Website for **Munna Pen Center**, a wholesale stationery and office-supply supplier in **Dhanbad, Jharkhand**, serving customers across India.

It is built as **Version 1 of a B2B sales platform**: a fast, accessible, SEO-ready marketing and enquiry site today, structured so that a real database, quotations, GST invoices, payments, a CRM and an **owner-controlled AI sales agent** can be added without rewriting it.

> **Nothing on the site is invented.** No prices, stock, customer reviews, statistics, certifications, brands, founding year or street address. Anything the business has not supplied yet is a clearly marked placeholder — see [`docs/CONTENT_CHECKLIST.md`](docs/CONTENT_CHECKLIST.md) for what to confirm before launch.

---

## Quick start

Requires **Node.js 22.12+** (the version in `.nvmrc`; the test and database tools need it, not only Next.js).

```bash
npm install
cp .env.example .env.local      # nothing is required for local development
npm run dev                     # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run check` | Typecheck + lint + unit tests (run before every commit) |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck`, `npm run lint` | TypeScript and ESLint |
| `npm run smoke` | Fetches every route of a **running** site and checks status, title, one `<h1>`, alt text, 404s, admin closed. `npm run smoke -- http://localhost:3100`, or `-- --dev` against `next dev` |
| `npm run enquiries` | Prints enquiries saved by the website (`-- --json` for raw JSON, `-- 5` for the latest 5) |
| `npm run db:validate` | Validates `prisma/schema.prisma` (works offline) |
| `npm run db:seed-sql` | Rewrites `prisma/seed/catalogue.sql` (the paste-able seed) from `data/`; a test fails if it is out of date |
| `npm run db:seed` | Loads the owner-supplied categories, brands and five products into the database. **Dry run by default**; `-- --apply` writes, and only rows that are missing (never overwrites). Uses `DIRECT_URL` / `DATABASE_URL` from your shell or `.env.local` |
| `npm run db:test-migration` | Runs `prisma/tests/migration-checks.sql` against the throwaway database in `TEST_DATABASE_URL` (never production). CI does this on every push |

## What Version 1 includes

- **Pages:** Home · Products (search, category filter, pagination) · Product detail · 23 category pages · Bulk Orders · Request Quote · About · Contact — all with clean URLs.
- **Header** with *Request Bulk Quote* and *WhatsApp Us*, and a **sticky Call / WhatsApp / Get Quote bar on mobile**.
- **Catalogue** — the 23 categories and 20 brands the owner listed, and the five products identified so far (glue guns, glue sticks, cello tape, adhesive tape, calculators); more are added by the owner later (see below). Cards show image, name, category, description and **“Get Wholesale Price” / “Request Quote”** — never a price. A category with nothing listed yet says so, offers a quote request, and is kept out of search results.
- **Enquiry list** — visitors tap **Add to Enquiry** on products; the list (with optional quantities) becomes the product lines of the quote request.
- **Forms** — bulk enquiry, quote request, contact. Server-side validation, inline errors, loading / success / error states, spam honeypot, a reference number on success, and a **pre-filled WhatsApp fallback** so a lead is never lost.
- **WhatsApp** — click-to-chat links in the correct international format (`https://wa.me/917979025165`) with the pre-filled messages from the brief. The main number (79790 25165) is used for every WhatsApp link; a second number (80513 88653) is shown for calling only. Both live in `lib/config/site.ts`.
- **SEO** — per-page titles & descriptions, canonical URLs, Open Graph / Twitter tags + generated share image, JSON-LD (Organization, WebSite, Breadcrumbs, FAQ), `sitemap.xml`, `robots.txt`, semantic headings, alt text, search-result pages kept out of the index.
- **Performance & accessibility** — static pages where possible, self-hosted fonts, ~9 KB CSS, no UI library, JS limited to what interactivity needs (zod is server-only). Audited with axe-core against WCAG 2.2 AA: **0 violations** on every page at desktop and mobile widths.
- **Architecture for what comes next** — repository interfaces, a Prisma schema for every business entity, an admin with its own sign-in (closed in production until a database is connected), and an AI-agent action policy that makes owner approval a hard rule. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/AI_SALES_AGENT.md`](docs/AI_SALES_AGENT.md).

### What Version 1 deliberately does *not* include

No AI agent, no WhatsApp Business API, no payments, no invoices, no online prices or stock. The admin can sign in and manage products, brands, categories, stock and enquiries ([`docs/ADMIN.md`](docs/ADMIN.md)); quotations, orders, invoices and payments are still “Soon”, and the admin **returns 404 in production** until a database is connected. These are the next phases — the code is structured for them but none of it is faked.

---

## How enquiries work in Version 1 (read this before launching)

1. A visitor submits a form → a **server action** validates it (zod) → saves it through the `EnquiryRepository`.
2. V1 stores enquiries as one JSON object per line in **`.data/enquiries.jsonl`** (override with `ENQUIRY_DATA_DIR`). Read them with `npm run enquiries`.
3. If saving fails — or the store does not answer within 8 seconds — the visitor is **never told it worked**: they see an error and a one-tap **WhatsApp** button with their enquiry already written out.

**With a database (`DATABASE_URL` set):** enquiries are saved to Supabase instead of the file — each becomes a *Lead* plus an *Enquiry* with its product lines, in one transaction (a returning visitor with the same phone and name reuses their lead; an existing lead is never edited). Until the admin dashboard exists, read them in the Supabase Table Editor (`Enquiry`, `Lead`). `npm run enquiries` reads only the file store. The public catalogue stays on the built-in lists until you set `CATALOGUE_SOURCE=database` (do that after loading real products, so the site never looks empty).

⚠ **Hosting matters — and the plan is Vercel + Supabase.** The file store needs a server with a **persistent disk**. **Vercel's filesystem is read-only/ephemeral**, so on Vercel *every submission would fall back to WhatsApp*. Before launching on Vercel, do Phase 2: connect Supabase PostgreSQL behind the repository interfaces (`PrismaEnquiryRepository`) — that is exactly what the repository layer is for. Until then use a host with a persistent disk, or accept WhatsApp-only enquiries.

## Deploying

Vercel step by step, including which environment variables to set and how to read a failed build: [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md). Setting up the Supabase database, click by click and without sharing any password: [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

0. On Vercel set the environment variables from `.env.example` for Production (at least `NEXT_PUBLIC_SITE_URL`; later `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*`, `AUTH_SECRET`). Only `NEXT_PUBLIC_SITE_URL` is public; everything else stays server-side.
1. Set **`NEXT_PUBLIC_SITE_URL`** to your real domain **at build time** (e.g. `https://www.yourdomain.in`). It feeds canonical URLs, the sitemap and social tags; `npm run build` warns if it is missing.
2. `npm run build && npm start` on a Node.js 22.12+ host with a persistent disk (or after connecting a database).
3. Run `npm run smoke -- https://your-domain` against the live site.
4. Add the domain to **Google Search Console**, submit `/sitemap.xml`, and create/claim the **Google Business Profile** for Munna Pen Center in Dhanbad — that, more than markup, drives “wholesale stationery Dhanbad” local search.

**Abuse protection:** the forms have a honeypot and a 128 KB request cap, but no per-visitor rate limit — that belongs in front of the app. Add one at your reverse proxy or host (for example nginx `limit_req` on `POST`, or your CDN's rate-limit rule) before launch. The owner's `npm run enquiries` reads only the newest 32 MB of the store, so it keeps working even if someone floods it.

Security headers (HSTS in production, `nosniff`, frame denial, referrer and permissions policies) are set in `next.config.ts`. A strict Content-Security-Policy is a good Phase-2 hardening step (it needs per-request nonces).

## Editing content

| To change… | Edit |
| --- | --- |
| Phone number, GSTIN, email, address, hours, social links | `lib/config/site.ts` (anything left `null` is simply not shown) |
| Home-page wording | `content/home.ts` |
| About-page wording (and optional story / year) | `content/about.ts` |
| Categories, SEO titles & descriptions | `data/categories.ts` |
| Products | `data/products.ts` |
| A product photo | put the file in `public/images/products/` and set `imageUrl` + `imageAlt` on the product |
| WhatsApp messages | `lib/whatsapp.ts` |
| Which form fields are required, length limits | `lib/validation/enquiry.ts`, `lib/validation/limits.ts` |
| Colours, fonts, spacing | `app/globals.css` (`@theme`) |
| Logo | `components/brand/logo.tsx`, `public/brand/*.svg`, `app/icon.svg` |

**About the product list:** `data/products.ts` holds only the **five products the owner identified**; `data/categories.ts` the 23 categories and `data/brands.ts` the 20 brands (a separate list — brands are not products, nothing is attached to them). There are **no SKUs, prices, GST rates, HSN codes, stock or pack sizes** anywhere in the repo. The database schema has a place for all of them (`Product`: SKU, brand, category, unit, pack size, purchase / wholesale / retail price, GST rate, HSN, stock, minimum order quantity, image, active status) so the owner can add real products later from the admin. “Cello Tape” and “Adhesive Tape” are product types (categories), not brands.

**GSTIN:** the website only says “GST Registered” — it never prints the number. The number itself is deliberately *not* in the code; it will live in the server-only `BUSINESS_GSTIN` environment variable and is used for invoices later (it can be left unset for now).

**Logo:** a fountain-pen nib resting on an ink line, on an indigo tile. Outlined SVG lockups (no font dependency, safe for print) are in `public/brand/` (`logo.svg`, `logo-on-dark.svg`, `logo-mark.svg`).

## Project structure

```
app/                  Next.js routes
  (site)/             Public pages (header, footer, mobile action bar)
  admin/              Admin: (auth) sign-in + setup, (console) dashboard and catalogue screens
  actions/enquiry.ts  Server actions behind the forms
components/           UI: layout, home sections, products, forms, brand, illustrations, admin
content/              Editable page copy
data/                 Catalogue data (V1) — becomes database rows in Phase 2
lib/
  config/             Site facts + navigation
  domain/             Types, identifiers, India states
  repositories/       Data-access interfaces + V1 implementations  ← the database seam
  services/           Use-cases (enquiry preparation)
  validation/         zod schemas + shared limits
  ai-sales/           Sales workflow + AI action policy (owner approval rules)
  auth/guard.ts       Admin access control (closed until auth exists)
  env.ts              Validated server-only environment variables
prisma/schema.prisma  Target database schema (Phase 2)
proxy.ts              First gate in front of /admin
scripts/              smoke test, enquiry reader
tests/                Unit tests
docs/                 Architecture, AI sales agent, launch checklist
```

## Secrets & security

- **No secrets in the browser.** Only `NEXT_PUBLIC_SITE_URL` is public. Everything else (`DATABASE_URL`, `AI_API_KEY`, `WHATSAPP_API_*`, `AUTH_SECRET`, `GST_API_*`) is server-only, read through `lib/env.ts` (which is `server-only`, so a client import is a build error) and documented in `.env.example`. A test keeps `.env.example` and the schema in sync, and another checks that client code never reads a non-public variable.
- `.env*` files are git-ignored (except `.env.example`).
- Forms: server-side validation and length limits, honeypot, Origin-checked server actions, no HTML injection (React escapes; JSON-LD is escaped).
- Admin: closed in production by `proxy.ts` **and** `requireAdmin()`; `noindex`, `no-store`, and disallowed in `robots.txt`.
- The WhatsApp **click-to-chat** link needs no credentials. The WhatsApp Business **API** (Phase 3) is server-side only.

## Roadmap

| Phase | Adds |
| --- | --- |
| **1 — this release** | Marketing site, catalogue, enquiry & quote request, WhatsApp, SEO, admin foundation |
| **2** | Postgres + Prisma behind the repositories, admin sign-in, Products / Categories / Enquiries / Leads / Customers screens |
| **3** | Quotations with owner approval, WhatsApp Business API, AI sales agent (draft-only first) |
| **4** | Orders, GST invoices, payments, repeat-order follow-ups, voice receptionist |

## Verified before hand-off

`npm run check` (typecheck, ESLint, 268 unit tests (11 of them run against a throwaway PostgreSQL)) · production build · `npm run smoke` (41 routes) · 33-step browser run through search, enquiry list, validation errors, submissions, persistence, honeypot and the mobile bar · axe-core WCAG 2.2 AA on 10 pages × 2 viewports.
