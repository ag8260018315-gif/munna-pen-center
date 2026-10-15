# The admin — what it does and how to start it

Address: `https://<your-site>/admin`. It only works once the database is connected (`DATABASE_URL` in Vercel, see [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)). Without a database, `/admin` is a 404 on the live site.

## What you can do today

| Screen | What |
| --- | --- |
| Dashboard | New and total enquiries, active and draft products, out-of-stock count, brands, categories |
| Products | Search and filter; add; edit; **Deactivate / Publish**. Fields: name, category, brand, descriptions, SKU, unit, pack size, minimum order quantity, stock, purchase / wholesale / retail price, GST %, HSN, tags, status, featured |
| Brands | Add, edit, deactivate; choose whether a brand is shown on the website |
| Categories | Add, edit, deactivate; summary, description, order |
| Inventory | Type a stock number per product and press Save. Empty = "not tracked", 0 = out of stock |
| Enquiries | Read every website enquiry (newest first), filter by status, call or e-mail the sender, and **Create quotation** from it |
| Customers | Organisations you quote. Created automatically from an enquiry, or added by hand (contact, phone, GSTIN, billing address) |
| Quotations | Draft, price, mark as sent, accept / decline / cancel; print view; WhatsApp message prepared for you to send |

Still marked **Soon**: leads, orders, invoices, payments, follow-ups, AI sales agent, settings.

## Quotations — how they work

1. Open an enquiry and press **Create quotation** (or *Quotations → New quotation* for a customer you already have). The draft has the customer and the items they asked for, and **no prices**. Quantities are read from what they wrote where possible, otherwise set to 1 — check each one.
2. For every item set the **price per unit (ex-GST)** and the **GST rate**. When you add an item by choosing a product, its wholesale price, GST rate and HSN are filled in for you (owner only) — change them if this customer gets a different deal. Nothing else is filled in.
3. Totals are exact: line amount = quantity × price; GST is worked out per line and rounded to the paisa; there is **no total** until every item has a price and a GST rate.
4. Set *Valid until* and *Terms* if you want them (optional; nothing is pre-written).
5. **Print view** gives a clean page to print or save as PDF. **Open in WhatsApp** prepares the message in *your* WhatsApp for the customer's number — you read it and press send.
6. **Mark as sent** records that *you* shared it. After that the items are frozen (the database enforces this too). Then record the outcome: *Customer accepted*, *declined*, *expired* or *cancelled*. Accepting marks the enquiry as won.
7. Quotations are never deleted — cancel them. Numbers look like `QT-2026-27-0001`, restart each April 1, and have no gaps.

Only the **owner** can enter prices, GST and HSN, and can mark a quotation sent, accepted, declined, expired or cancelled. A staff account can create drafts and edit descriptions, quantities and units. This system sends nothing to a customer by itself; the AI sales assistant, when it arrives, can only *propose* prices that you approve.

The quotation print view shows "GST Registered" and your address and phone, like the website. It does **not** print your GSTIN — that comes with invoices.

## Rules the admin follows

- **Nothing is filled in for you.** A blank price, SKU, GST, HSN or stock box is saved as "not entered", never as 0.
- **The website never shows prices, stock, SKU, GST or HSN.** They are for you only.
- **Prices, GST and HSN can be changed by the OWNER only.** A staff account can add and edit products and update stock.
- **Nothing is deleted.** Deactivating hides a product from the website but keeps it for old quotations and invoices.
- **Only Active products appear on the website.** Draft = being prepared; Inactive = hidden. The site shows a change at once (other servers within about 30 seconds).
- Brands and categories are separate things. Cello Tape and Adhesive Tape are categories, not brands.

## Creating the first owner account (one time)

1. Think of a long random **setup key** (about 24 characters). In Vercel → *Settings → Environment Variables* add `ADMIN_SETUP_TOKEN` = that key (Production, **Sensitive** on). Redeploy.
2. Open `https://<your-site>/admin/setup`. Enter the setup key, your name, e-mail and a password of **at least 12 characters** that you do not use anywhere else. Press *Create owner account*.
3. Sign in at `/admin/login`.
4. **Delete `ADMIN_SETUP_TOKEN` from Vercel and redeploy.** The setup page already disappears once an account exists, but there is no reason to keep the key.

Never send the setup key or the password to anyone — not even to me.

## How sign-in is protected

- Passwords are stored only as scrypt hashes. A forgotten password cannot be read back, only replaced.
- Five wrong passwords lock that account for 15 minutes. The message is always the same ("e-mail and password do not match, or the account is temporarily locked"), so nobody can find out which e-mails exist.
- The browser keeps only a random token in an HttpOnly, Secure, SameSite cookie; the database keeps only a hash of it. A session ends after 12 hours, after 2 hours of no use, on *Sign out*, or when the account is deactivated.
- Every admin page, form and data function checks the sign-in again by itself.

## Known limits (honest list)

- **No password reset or second staff account screen yet.** If you forget the password, the account must be fixed in the Supabase SQL Editor (ask me for the exact steps). Adding staff accounts is the next admin task.
- **No two-factor sign-in yet.** Use a strong, unique password.
- **Product photos** cannot be uploaded yet (Supabase Storage is not wired up).
- The login lock is per account, not per internet address; add rate limiting at Vercel before launch if the admin address becomes widely known.
- The app still connects to the database as the owner role (see `MIGRATION_0001_REVIEW.md`, risk 1): create a least-privilege database user before launch.
