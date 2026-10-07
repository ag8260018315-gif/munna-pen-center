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

## What Version 1 includes

- **Pages:** Home · Products (search, category filter, pagination) · Product detail · 10 category pages · Bulk Orders · Request Quote · About · Contact — all with clean URLs.
- **Header** with *Request Bulk Quote* and *WhatsApp Us*, and a **sticky Call / WhatsApp / Get Quote bar on mobile**.
- **Catalogue** — 10 categories and a placeholder set of generic product *types* (see below). Cards show image, name, category, description, pack/unit info and **“Get Wholesale Price” / “Request Quote”** — never a price.
- **Enquiry list** — visitors tap **Add to Enquiry** on products; the list (with optional quantities) becomes the product lines of the quote request.
- **Forms** — bulk enquiry, quote request, contact. Server-side validation, inline errors, loading / success / error states, spam honeypot, a reference number on success, and a **pre-filled WhatsApp fallback** so a lead is never lost.
- **WhatsApp** — click-to-chat links in the correct international format (`https://wa.me/917979025166`) with the pre-filled messages from the brief.
- **SEO** — per-page titles & descriptions, canonical URLs, Open Graph / Twitter tags + generated share image, JSON-LD (Organization, WebSite, Breadcrumbs, FAQ), `sitemap.xml`, `robots.txt`, semantic headings, alt text, search-result pages kept out of the index.
- **Performance & accessibility** — static pages where possible, self-hosted fonts, ~9 KB CSS, no UI library, JS limited to what interactivity needs (zod is server-only). Audited with axe-core against WCAG 2.2 AA: **0 violations** on every page at desktop and mobile widths.
- **Architecture for what comes next** — repository interfaces, a Prisma schema for every business entity, an admin shell that is closed in production, and an AI-agent action policy that makes owner approval a hard rule. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/AI_SALES_AGENT.md`](docs/AI_SALES_AGENT.md).

### What Version 1 deliberately does *not* include

No database connection, no admin sign-in, no AI agent, no WhatsApp Business API, no payments, no invoices, no online prices or stock. The admin dashboard is a foundation only (its sections say “Not built yet”) and **returns 404 in production**. These are the next phases — the code is structured for them but none of it is faked.

---

## How enquiries work in Version 1 (read this before launching)

1. A visitor submits a form → a **server action** validates it (zod) → saves it through the `EnquiryRepository`.
2. V1 stores enquiries as one JSON object per line in **`.data/enquiries.jsonl`** (override with `ENQUIRY_DATA_DIR`). Read them with `npm run enquiries`.
3. If saving fails — or the store does not answer within 8 seconds — the visitor is **never told it worked**: they see an error and a one-tap **WhatsApp** button with their enquiry already written out.

⚠ **Hosting matters.** The file store needs a server with a **persistent disk** (a VPS, Docker volume, or your own machine). On **serverless hosts such as Vercel the filesystem is read-only/ephemeral**, so every submission would fall back to WhatsApp. Either host V1 on a persistent server, or do Phase 2 (connect a database) first — that is exactly what the repository layer is for.

## Deploying

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

**About the product list:** `data/products.ts` ships *generic product types* (“Ball Pens”, “Registers & Ledgers”…) with **no brands, SKUs, prices, stock or pack sizes** — the cards say “Pack sizes on request”. It is a starting point for the owner to confirm, edit or replace, not an inventory.

**Logo:** a fountain-pen nib resting on an ink line, on an indigo tile. Outlined SVG lockups (no font dependency, safe for print) are in `public/brand/` (`logo.svg`, `logo-on-dark.svg`, `logo-mark.svg`).

## Project structure

```
app/                  Next.js routes
  (site)/             Public pages (header, footer, mobile action bar)
  admin/              Admin foundation — closed in production
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

`npm run check` (typecheck, ESLint, 177 unit tests) · production build · `npm run smoke` (78 routes) · 33-step browser run through search, enquiry list, validation errors, submissions, persistence, honeypot and the mobile bar · axe-core WCAG 2.2 AA on 10 pages × 2 viewports.
