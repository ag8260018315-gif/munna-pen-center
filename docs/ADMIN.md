# The admin — what it does and how to start it

Address: `https://<your-site>/admin`. It only works once the database is connected (`DATABASE_URL` in Vercel, see [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)). Without a database, `/admin` is a 404 on the live site.

## What you can do today

| Screen | What |
| --- | --- |
| Dashboard | New and total enquiries, orders to confirm and in progress, draft and unpaid invoices, active and draft products, out-of-stock count, brands, categories |
| Products | Search and filter; add; edit; **Deactivate / Publish**. Fields: name, category, brand, descriptions, SKU, unit, pack size, minimum order quantity, stock, purchase / wholesale / retail price, GST %, HSN, tags, status, featured |
| Brands | Add, edit, deactivate; choose whether a brand is shown on the website |
| Categories | Add, edit, deactivate; summary, description, order |
| Users (owner only) | Add staff accounts, set a new password for someone who forgot theirs, deactivate / reactivate, unlock |
| My account (everyone) | Change your own password; sign out on other devices |
| Import products (spreadsheet) | *Products → Import from spreadsheet*: add up to 300 products at once from a CSV file; checked first, all-or-nothing |
| Add many pictures | *Products → Add many pictures*: choose many picture files at once; each goes to the product named like the file |
| Product pictures | On a product's page: upload, replace or remove one picture (needs the one-time setup in [`PHOTOS.md`](PHOTOS.md)) |
| Inventory | Type a stock number per product and press Save. Empty = "not tracked", 0 = out of stock |
| Enquiries | Read every website enquiry (newest first), filter by status, call or e-mail the sender, and **Create quotation** from it |
| Customers | Organisations you quote. Created automatically from an enquiry, or added by hand (contact, phone, GSTIN, billing address) |
| Quotations | Draft, price, mark as sent, accept / decline / cancel; print view; WhatsApp message prepared for you to send |
| Orders | **Create order** from an accepted quotation; the owner confirms it; then processing → dispatched (transporter, LR number) → delivered |
| Invoices | GST **tax invoices** made from confirmed orders. Staff prepare the draft; **only the owner issues it**; print Original / Duplicate / Triplicate |
| Payments | Record money received against an invoice (UPI, bank transfer, cheque, cash, card, other); see who still owes what |

Still marked **Soon**: leads, follow-ups, AI sales agent, settings.

## Quotations — how they work

1. Open an enquiry and press **Create quotation** (or *Quotations → New quotation* for a customer you already have). The draft has the customer and the items they asked for, and **no prices**. Quantities are read from what they wrote where possible, otherwise set to 1 — check each one.
2. For every item set the **price per unit (ex-GST)** and the **GST rate**. When you add an item by choosing a product, its wholesale price, GST rate and HSN are filled in for you (owner only) — change them if this customer gets a different deal. Nothing else is filled in.
3. Totals are exact: line amount = quantity × price; GST is worked out per line and rounded to the paisa; there is **no total** until every item has a price and a GST rate.
4. Set *Valid until* and *Terms* if you want them (optional; nothing is pre-written).
5. **Print view** gives a clean page to print or save as PDF. **Open in WhatsApp** prepares the message in *your* WhatsApp for the customer's number — you read it and press send.
6. **Mark as sent** records that *you* shared it. After that the items are frozen (the database enforces this too). Then record the outcome: *Customer accepted*, *declined*, *expired* or *cancelled*. Accepting marks the enquiry as won.
7. Quotations are never deleted — cancel them. Numbers look like `QT-2026-27-0001`, restart each April 1, and have no gaps.

Only the **owner** can enter prices, GST and HSN, and can mark a quotation sent, accepted, declined, expired or cancelled. A staff account can create drafts and edit descriptions, quantities and units. This system sends nothing to a customer by itself; the AI sales assistant, when it arrives, can only *propose* prices that you approve.

The quotation print view shows "GST Registered" and your address and phone, like the website. It does **not** print your GSTIN — only a tax invoice does (see below).

## Orders — how they work

1. When the customer accepts a quotation, open it and press **Create order** (or use the list on *Orders*). The items, prices, GST rates and totals are **copied once**; after that they are read-only. To change a price or quantity, make a new quotation. A quotation can have only one order — pressing the button again opens the existing one.
2. The delivery address is the customer's shipping address if they have one, otherwise their billing address. Staff can correct it (and add notes) until the goods leave.
3. The **owner confirms** the order. Then anyone can press *Start processing*, fill in the transporter and LR / tracking reference and press *Mark as dispatched*, and later *Mark as delivered*.
4. Only the owner can **cancel**, and only before dispatch. An order whose invoice has been issued cannot be cancelled until that invoice is voided.
5. Changing an order's status never sends anything to the customer and never changes stock. Orders are never deleted. Numbers look like `ORD-2026-27-0001`.
6. The order page has a **History** list (confirmed, processing, dispatched, delivered, cancelled, invoice issued or voided — who and when). The system writes it and nobody can edit or remove it; the "Internal notes" box above it is for staff.
7. Once an invoice is issued, the **delivery address is locked** (the invoice rests on it); void the invoice first if the address was wrong. Notes stay editable.

## GST tax invoices — how they work

1. On a confirmed (or later) order press **Create invoice (draft)**. The items are copied from the order. There can be only one live invoice per order.
2. **Place of supply.** For goods this is the state they are delivered to. It is pre-selected from the order's delivery state (else the customer's billing state, else the state in their GSTIN) — **check it**; the draft shows the order's delivery address beside it and warns if they disagree. State names are understood in full, as postal abbreviations (WB, UP, JH…) and with common misspellings; a state that is written but not recognised is **not guessed** — you are asked to choose. Same state as your GSTIN → **CGST + SGST**; any other state → **IGST**. Optionally set a payment due date; nothing is pre-filled.
3. **HSN codes.** The owner can enter or correct an HSN code on a draft line. A line without one only gets a warning: ask your accountant whether HSN is required on your invoices.
4. **Only the owner issues** an invoice, after ticking *I have checked it*. If anyone changed the draft, the customer's record or an HSN code after the owner opened the page, nothing is issued and the owner is asked to look again. Issuing also checks both GSTINs: each must pass its check character (a mistyped digit is caught) and your GSTIN's state must match your business address; an invoice with a zero total is refused. Issuing, in one step, gives it the **next number** (`INV/26-27/0001` — restarts each 1 April, no gaps, at most 16 characters), works out the tax, and **freezes** your details (name, address, GSTIN) and the customer's name, billing address and GSTIN on it. After that nothing on it can change — the database enforces this — except its status.
5. **Print** the Original (for the buyer), Duplicate (transporter) or Triplicate (you) from the invoice page and send it yourself: this system sends nothing. A "Ship to" line is printed when the delivery address differs from the billing address. The amount in words puts the paise after the word "Paise" (`Rupees One Thousand and Paise Fifty Only` is 1,000.50).
6. A wrong invoice can be **voided** by the owner, only before any payment. It keeps its number (shown as void; numbers are never reused) and the order can then be invoiced again. The reason goes into the order's notes. A **draft** is simply left unissued and never uses a number.

How the tax is worked out: line amount = quantity × price (prices exclude GST); GST is calculated **per line**, rounded half-up to the paisa. For a same-state sale the CGST and SGST are each half the rate, rounded separately (so they are always equal). That can make an invoice total differ from the quotation and order total — up to a paisa on each line — and the page tells you when it does. (For a sale to another state, IGST, the figures match exactly.)

**Your GSTIN** is read from the server-only `BUSINESS_GSTIN` setting in Vercel (never typed into the website or the code). Until it is set, drafts can be prepared but **nothing can be issued**. If your registered (legal) name differs from "Munna Pen Center", also set `BUSINESS_LEGAL_NAME`; otherwise the trading name is printed. After changing either setting, redeploy.

**Assumptions made for you (change later if needed):** invoice numbers look like `INV/26-27/0001`; every issued invoice is a tax invoice, and you decide per order whether to create one; the payment methods are UPI, bank transfer, cheque, cash, card and other; one invoice covers a whole order (no part-shipment invoicing); the printed invoice says "Tax payable on reverse charge: No".

**Not handled — do these outside the system or ask your accountant:** reverse charge, exports / SEZ, composition scheme, cess, TCS / TDS, UTGST (a seller inside a Union Territory without a legislature selling inside it — the system refuses to issue those), credit / debit notes, e-way bills, and **e-invoicing (IRN)**. Whether e-invoicing applies to your turnover is for your accountant to confirm; the system does not generate an IRN or QR code.

## Payments — how they work

1. Open an issued invoice and use **Record a payment**: amount, how it was paid, the date the money arrived (not in the future), and optionally a UTR / cheque number. Record only money that **has already arrived**; this system never asks anyone for money or moves any.
2. A payment can never be more than what is still owed. The invoice goes ISSUED → PARTIALLY PAID → PAID by itself. Staff can record payments.
3. A payment entered by mistake, or a bounced cheque, is **reversed by the owner**, with a reason. The row stays (marked FAILED, reason in its note) and the invoice goes back to the status the remaining payments give it. Payments are never deleted.
4. *Payments* lists who still owes what (with an Overdue flag once a due date has passed) and every payment recorded.

## Rules the admin follows

- **Nothing is filled in for you.** A blank price, SKU, GST, HSN or stock box is saved as "not entered", never as 0.
- **The website never shows prices, stock, SKU, GST or HSN.** They are for you only.
- **Prices, GST and HSN can be changed by the OWNER only.** A staff account can add and edit products and update stock.
- **Nothing is deleted.** Deactivating hides a product from the website but keeps it for old quotations and invoices.
- **Only Active products appear on the website.** Draft = being prepared; Inactive = hidden. The site shows a change within seconds; in rare timing a single product page can lag for up to 5 minutes.
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

## Adding many products at once

1. *Products → Import from spreadsheet*, then **Download the template** (just the header row, no example product).
2. Open it in Excel or Google Sheets. One product per row. Required: `name` and `category` (the category must already exist; copy its name from the list on the page). Everything else is optional: an empty cell stays "not entered", never 0.
3. Save as **CSV (comma separated, UTF-8)**.
4. Choose the file and press **Check the file**. It lists every problem with its spreadsheet row number (unknown category or brand, a price that is not a number, a SKU or web address already used, …). **Nothing is saved by the check.**
5. When it says the file is fine, press **Import**. It is **all-or-nothing**: if anything is wrong, nothing is imported, so you never end up with half a file.

Good to know:
- `status` is `DRAFT` unless you write `ACTIVE`. Draft products are hidden from the website, so you can import first and publish later.
- Only the **owner** can fill the price, GST and HSN columns (`purchase_price`, `wholesale_price`, `retail_price`, `gst_percent`, `hsn_code`); a staff import with those cells filled is refused.
- It only **adds** products. It never changes or deletes an existing one; to change a product, edit it. A SKU or web address that already exists is an error.
- A product with no `slug` gets a web address made from its name (`blue-pen`, and `blue-pen-2` if that is taken).
- A column name the page does not know is refused, so a typo like `wholesale_prise` can never silently drop your prices.
- At most 300 products and 1 MB per file; split bigger files.

## Adding many pictures at once

1. Name each picture file after its product: the product's web address (slug) or its SKU. `blue-pen.jpg` goes to the product `blue-pen`. Spaces and capitals are fine (`Blue Pen.JPG`).
2. *Products → Add many pictures*, choose all the files (up to 100). The page shows which product each file matches, and flags files with no match or the wrong type before anything is uploaded.
3. Products that already have a picture are skipped unless you tick **Replace existing pictures**.
4. Tick **These are generic or AI-made pictures** if they are not photos of your own stock: each description then starts with "Representative image:". Leave it unticked for real photos.
5. Press **Upload**. Pictures go one at a time, each through the same safety checks and re-encoding as a single upload, and the list shows the result per file. The product's name becomes its description.

## Staff accounts

1. *Users → Add staff account*: name, e-mail, a starting password (12+ characters). Tell them the password **in person** and ask them to change it under **My account**. New accounts are always **Staff**; a second owner can only be added directly in the database.
2. Staff can work with products, brands, categories, stock, pictures, customers, enquiries and **draft** quotations. They can **not** enter prices, GST or HSN, send or close quotations, or see the Users screens.
3. Forgot a password? Open the person under *Users* → **Set a new password**. They are signed out everywhere and any lock is lifted.
4. **Deactivate** signs someone out at once and stops them signing in. Accounts are never deleted. You can not deactivate yourself or the last active owner.
5. Changing your own password (My account) needs the current password, keeps you signed in here and signs out every other device. A wrong current password counts towards the same 15-minute lock as a wrong sign-in.

## If the owner forgets their password

There is no e-mail reset (the system has no e-mail service). Instead, whoever controls your Vercel settings can recover the account:

1. In Vercel add `ADMIN_SETUP_TOKEN` = a long random key (**at least 16 characters**, 24+ is better; Sensitive on), then redeploy.
2. Open `/admin/reset` (the sign-in page also shows a link while the key exists). Enter the key, the account's e-mail and a new password.
3. Everyone on that account is signed out; sign in with the new password.
4. **Delete `ADMIN_SETUP_TOKEN` in Vercel and redeploy.** Anyone who learns that key can reset any password.

## Known limits (honest list)

- **No password reset by e-mail**, and no forced password change on first sign-in: ask new staff to change the starting password themselves.
- **No activity log yet** (who changed what). Payments record who entered them; a voided invoice's or reversed payment's reason is written to the order / payment notes.
- **The database does not yet enforce every invoice rule by itself.** The app never does these, but a person with direct database access could: move an issued invoice back to draft, move a line to another invoice, or record a payment above the amount owed. A follow-up "hardening" migration can close these; until then, do not edit invoice or payment rows by hand.
- **A draft invoice cannot be deleted or voided** (it has no number). If its order is cancelled it simply stays, marked as not issuable, and is not counted on the dashboard.
- **Tax invoices are limited to ordinary domestic sales** — see the "Not handled" list above. Have your accountant look at the first few invoices before you rely on them.
- **No two-factor sign-in yet.** Use a strong, unique password.
- **Product pictures** need a one-time Supabase Storage setup: see [`PHOTOS.md`](PHOTOS.md).
- The login lock is per account, not per internet address; add rate limiting at Vercel before launch if the admin address becomes widely known.
- The app still connects to the database as the owner role (see `MIGRATION_0001_REVIEW.md`, risk 1): create a least-privilege database user before launch.
