# Before you launch — things only the owner can confirm

The site never invents facts, so anything not supplied is either hidden or shown as a neutral placeholder. Work through this list; each item says where to change it.

## Must do

- [ ] **Domain name** — set `NEXT_PUBLIC_SITE_URL` (at build time) so canonical URLs, the sitemap and social previews are correct.
- [ ] **Hosting that keeps enquiries** — a server with a persistent disk, **or** connect the database first (see README → *How enquiries work*). On serverless hosting, form submissions can only fall back to WhatsApp.
- [x] **Categories, brands and first products** — supplied by the owner (23 categories, 20 brands, 5 products). Add real products (with SKU, brand, unit, pack size, prices, GST, HSN, stock, minimum order quantity) in the admin (`/admin/products`); photo upload comes later. Cello Tape and Adhesive Tape are product types (categories), not brands.
- [ ] **Where enquiries are read** — in the admin: `/admin/enquiries` (needs the database and your admin account, see [`ADMIN.md`](ADMIN.md)). Also keep an eye on WhatsApp. Decide who checks, and how often.

## Business details (`lib/config/site.ts`, `.env`)

- [x] **Phone / WhatsApp** — main number 79790 25165 (supplied). **Second number** 80513 88653, shown for calling only — tell us if it is also on WhatsApp and it can be used for chat links too. **Address** — Railway Cinema Road, Purana Bazar, Dhanbad, Jharkhand (supplied). **Email** — supplied.
- [x] **GSTIN** — the website says only “GST Registered” and never shows the number. The number is not in the code; when invoices are built, set the server-only `BUSINESS_GSTIN` environment variable (Vercel → Settings → Environment Variables).
- [ ] **PIN code** — not supplied yet, so it is not shown.
- [ ] **Business hours** — optional.
- [ ] **Social profiles** — optional.

## Content to review

- [ ] **About page** (`content/about.ts`) — add an optional `story` and `established` year *only if you want them shown*.
- [ ] **Home page wording** (`content/home.ts`) — especially “Why Munna Pen Center”; remove anything you can’t stand behind.
- [ ] **FAQ answers** on Bulk Orders (`app/(site)/bulk-orders/page.tsx`) — confirm each answer matches how you actually work.
- [ ] **Delivery wording** — the site promises no delivery times. When you have real logistics information (transporters, typical lead times, free-delivery thresholds), say so deliberately in `content/home.ts` and the FAQ.
- [ ] **Logo** — review the mark and lockups in `public/brand/`. If you commission a designer, replace the SVGs and `components/brand/logo.tsx`.

## Legal & trust

- [ ] **Privacy policy** and **terms** pages — the forms say “We use these details only to respond to your enquiry”; make sure that is true, and publish a proper privacy policy (India’s DPDP Act applies to personal data you collect). Have these written/reviewed by a professional.
- [ ] **Do not add** customer logos, testimonials, “years in business” or certifications unless they are real and you have permission. A test (`tests/content-integrity.test.ts`) fails the build if invented-sounding claims creep in.

## Search & marketing

- [ ] **Google Business Profile** for Munna Pen Center, Dhanbad — the biggest single lever for “wholesale stationery Dhanbad”.
- [ ] **Google Search Console** — verify the domain, submit `https://<your-domain>/sitemap.xml`.
- [ ] **WhatsApp Business app** on 79790 25165 — set a greeting and away message now; the website’s WhatsApp buttons open a chat with this number.
- [ ] Product **photographs** — real photos of what you stock beat any placeholder: `public/images/products/` + `imageUrl` / `imageAlt`.

## Later phases need from you

- Price list / pricing rules (for quotations and the AI agent)
- Invoice series, tax rates and HSN codes (for GST invoices)
- Payment methods you accept
- Which actions you are happy for an AI assistant to prepare, and which you always want to approve yourself (the defaults in `lib/ai-sales/policy.ts` are conservative)
