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
| Enquiries | Read every website enquiry (newest first), filter by status, call or e-mail the sender |

Still marked **Soon**: customers, leads, quotes, orders, invoices, payments, follow-ups, AI sales agent, settings.

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
