@AGENTS.md

# Munna Pen Center — working notes for AI assistants

Wholesale stationery supplier, Dhanbad, Jharkhand → all India. Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · zod · Prisma schema (not yet connected). Read `README.md`, `docs/ARCHITECTURE.md` and `docs/AI_SALES_AGENT.md` before large changes.

## Non-negotiable rules

1. **Never invent business facts.** No prices, stock, brands, customers, reviews, statistics, certifications, founding year, GSTIN, street address, delivery times. Unknown = `null` in `lib/config/site.ts` and omitted from the UI. `tests/content-integrity.test.ts` enforces this.
2. **No prices on the public site.** Use “Get Wholesale Price” / “Request Quote”. `Product` has no price field on purpose.
3. **The owner approves every commercial commitment.** `lib/ai-sales/policy.ts` is default-deny; AI may read and draft only. Never let an agent set prices, send quotations, confirm orders, issue invoices, request payment or move money without an approved `ApprovalRequest` (`canExecute`). Never make money movement possible for the agent.
4. **No secrets in client code.** New env vars go in `lib/env.ts` **and** `.env.example` (a test checks they match). Only `NEXT_PUBLIC_SITE_URL` is public.
5. **Admin stays closed in production** until real authentication exists (`proxy.ts` + `requireAdmin()`); every admin data function must call `requireAdmin()` itself.

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
