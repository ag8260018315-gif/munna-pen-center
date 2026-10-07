@AGENTS.md

# Munna Pen Center — working notes for AI assistants

Wholesale stationery supplier, Dhanbad, Jharkhand → all India. Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · zod · Prisma schema (not yet connected). Target hosting: Vercel (app) + Supabase (PostgreSQL + Storage); a separate backend (e.g. Render) only if one becomes necessary. Read `README.md`, `docs/ARCHITECTURE.md` and `docs/AI_SALES_AGENT.md` before large changes.

## Non-negotiable rules

1. **Never invent business facts.** No prices, stock, SKUs, HSN codes, GST rates, brands the owner did not list, customers, reviews, statistics, certifications, founding year, delivery times, PIN code. Unknown = `null` in `lib/config/site.ts` / an empty column, and omitted from the UI. The owner-supplied facts (address, email, phone, brand list, categories, the five identified products) are in `lib/config/site.ts` and `data/`. **The GSTIN is never written into source** — only the server-only `BUSINESS_GSTIN` env var (`lib/business.ts`); a test scans the repo for GSTIN-shaped strings. `tests/content-integrity.test.ts` enforces the rest.
2. **No prices on the public site.** Use “Get Wholesale Price” / “Request Quote”. The public `Product` type (`lib/domain/types.ts`) has no price, SKU, stock or tax field on purpose. The database `Product` table does hold INTERNAL purchase / wholesale / retail prices, stock, SKU, GST and HSN for the admin — the public catalogue repository must never select or return them (a test guards the type).
3. **The owner approves every commercial commitment.** `lib/ai-sales/policy.ts` is default-deny; AI may read and draft only. Never let an agent set prices, send quotations, confirm orders, issue invoices, request payment, send ANY message to a customer, or move money without an approved `ApprovalRequest` bound to that action, record and content (`canExecute` checks all of it); the agent may only *draft* messages. Never make money movement possible for the agent.
4. **No secrets in client code.** New env vars go in `lib/env.ts` **and** `.env.example` (a test checks they match). Only `NEXT_PUBLIC_SITE_URL` is public.
5. **Admin is closed to anyone not signed in** (`proxy.ts` is only a first filter; `requireAdmin()` / `requireOwner()` in `lib/auth/guard.ts` are the authority). Every admin data function AND server action must call it itself (`tests/admin-catalogue.test.ts` checks `lib/admin/*.ts`). Without a database the admin is a 404 in production. Prices, GST and HSN are owner-only; never store a default for a business field (blank = NULL); deactivate, never delete. Session tokens are stored only as hashes; the setup key is the `ADMIN_SETUP_TOKEN` env var, never in source.

## Conventions

- Pages/actions depend on **repository interfaces** (`lib/repositories/types.ts`), never on a data store. The only composition root is `lib/repositories/index.ts`.
- Forms are server actions (`app/actions/enquiry.ts`) validated by `lib/validation/enquiry.ts`. Client components must not import that file (it pulls zod into the bundle) — shared constants live in `lib/validation/limits.ts`.
- A **Server Component cannot read plain values exported from a `"use client"` file** (it gets an opaque reference). Put shared maps/constants in a separate non-client module.
- WhatsApp numbers: build links only via `lib/whatsapp.ts` (`wa.me/91…`, no `+`).
- Editable copy lives in `content/`, facts in `lib/config/site.ts`, catalogue in `data/`.
- Accessibility is a requirement: labelled fields, `aria-invalid`/`aria-describedby`, one `<h1>` per page, heading levels that don’t skip, `alt` on images, contrast ≥ 4.5:1. Re-run an axe audit after UI changes.
- Keep JavaScript minimal: prefer Server Components; add `"use client"` only for real interactivity.

## Commands

`npm run check` (typecheck + lint + unit tests) before every commit. After a production build, `npm start` and `npm run smoke` — request-time routes can fail without failing the build. `npm run db:validate` after editing `prisma/schema.prisma`.
