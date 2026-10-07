-- Behavioural checks for migration 0001_init. Run against a database that already has the migration applied:
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/tests/migration-checks.sql
-- or paste the whole file into the Supabase SQL Editor and click Run: the result row says ALL MIGRATION CHECKS PASSED.
-- Everything happens inside one transaction that is rolled back, so nothing is left behind. Run it on the EMPTY database
-- right after applying the migration (before loading any real data), then confirm the tables are still empty. Each "expect_fail" must raise; each plain statement must succeed.
BEGIN;

CREATE FUNCTION pg_temp.expect_fail(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok   (rejected) %', label;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL: % was accepted but must be rejected', label;
END $$;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'ok   %', label;
END $$;

-- ------------- catalogue -------------
INSERT INTO "Category" ("id","slug","name","updatedAt") VALUES ('c1','pens','Pens',now());
INSERT INTO "Brand" ("id","slug","name","updatedAt") VALUES ('b1','doms','DOMS',now());
INSERT INTO "Product" ("id","slug","name","categoryId","updatedAt") VALUES ('p1','glue-guns','Glue Guns','c1',now());
SELECT pg_temp.expect('a new product is a DRAFT with every business value empty',
  (SELECT "status" = 'DRAFT' AND "sku" IS NULL AND "purchasePrice" IS NULL AND "wholesalePrice" IS NULL AND "retailPrice" IS NULL
          AND "hsnCode" IS NULL AND "gstRatePercent" IS NULL AND "stockQuantity" IS NULL AND "minOrderQuantity" IS NULL AND "brandId" IS NULL
     FROM "Product" WHERE "id" = 'p1'));
SELECT pg_temp.expect_fail('duplicate brand name differing only in case', $$INSERT INTO "Brand" ("id","slug","name","updatedAt") VALUES ('b2','doms-2','doms',now())$$);
SELECT pg_temp.expect_fail('duplicate category name differing only in case', $$INSERT INTO "Category" ("id","slug","name","updatedAt") VALUES ('c2','pens-2','PENS',now())$$);
SELECT pg_temp.expect_fail('slug with capitals', $$INSERT INTO "Product" ("id","slug","name","categoryId","updatedAt") VALUES ('p2','Glue Gun','x','c1',now())$$);
SELECT pg_temp.expect_fail('negative price', $$UPDATE "Product" SET "wholesalePrice" = -1 WHERE "id" = 'p1'$$);
SELECT pg_temp.expect_fail('negative stock', $$UPDATE "Product" SET "stockQuantity" = -5 WHERE "id" = 'p1'$$);
SELECT pg_temp.expect_fail('GST rate above 100', $$UPDATE "Product" SET "gstRatePercent" = 150 WHERE "id" = 'p1'$$);
SELECT pg_temp.expect_fail('minimum order quantity of 0', $$UPDATE "Product" SET "minOrderQuantity" = 0 WHERE "id" = 'p1'$$);
UPDATE "Product" SET "stockQuantity" = 0 WHERE "id" = 'p1';
SELECT pg_temp.expect('stock 0 (tracked, none left) is allowed and distinct from NULL', (SELECT "stockQuantity" = 0 FROM "Product" WHERE "id" = 'p1'));
SELECT pg_temp.expect_fail('deleting a category that has products', $$DELETE FROM "Category" WHERE "id" = 'c1'$$);
UPDATE "Product" SET "brandId" = 'b1' WHERE "id" = 'p1';
SELECT pg_temp.expect_fail('deleting a brand that has products', $$DELETE FROM "Brand" WHERE "id" = 'b1'$$);
SELECT pg_temp.expect_fail('two products with the same SKU', $$UPDATE "Product" SET "sku" = 'X1' WHERE "id" = 'p1'; INSERT INTO "Product" ("id","slug","name","categoryId","sku","updatedAt") VALUES ('p3','other','o','c1','X1',now())$$);

-- ------------- people -------------
INSERT INTO "AdminUser" ("id","email","name","role","updatedAt") VALUES ('u_owner','owner@example.test','Owner','OWNER',now()),('u_staff','staff@example.test','Staff','STAFF',now());
SELECT pg_temp.expect_fail('admin e-mail with capitals', $$INSERT INTO "AdminUser" ("id","email","name","updatedAt") VALUES ('u3','Boss@Example.test','B',now())$$);
SELECT pg_temp.expect_fail('lead phone not in +91... form', $$INSERT INTO "Lead" ("id","name","phone","updatedAt") VALUES ('l0','x','98765',now())$$);
INSERT INTO "Customer" ("id","organizationName","contactName","phone","updatedAt") VALUES ('cu1','School','Asha','+919876543210',now());
INSERT INTO "Customer" ("id","organizationName","contactName","phone","updatedAt") VALUES ('cu2','Other','Ravi','+919876543211',now());
SELECT pg_temp.expect_fail('malformed customer GSTIN', $$UPDATE "Customer" SET "gstin" = '123' WHERE "id" = 'cu1'$$);
INSERT INTO "Lead" ("id","name","phone","updatedAt") VALUES ('l1','Asha','+919876543210',now());
INSERT INTO "Enquiry" ("id","reference","source","productsRequired","leadId","updatedAt") VALUES ('e1','ENQ-20261007-AAAA','QUOTE_FORM','glue guns','l1',now());
SELECT pg_temp.expect_fail('deleting a lead that has an enquiry', $$DELETE FROM "Lead" WHERE "id" = 'l1'$$);

-- ------------- quotations -------------
INSERT INTO "Quotation" ("id","number","createdBy","customerId","enquiryId","updatedAt") VALUES ('q1','QT-2026-0001','ADMIN','cu1','e1',now());
SELECT pg_temp.expect_fail('sending a quotation that has no lines', $$UPDATE "Quotation" SET "status" = 'SENT', "subtotal"=1, "taxTotal"=0, "total"=1 WHERE "id" = 'q1'$$);
INSERT INTO "QuotationItem" ("id","description","quantity","quotationId","productId") VALUES ('qi1','Glue Guns',10,'q1','p1');
SELECT pg_temp.expect('an unpriced line is allowed on a draft', (SELECT "unitPrice" IS NULL FROM "QuotationItem" WHERE "id" = 'qi1'));
SELECT pg_temp.expect_fail('sending a quotation with an unpriced line', $$UPDATE "Quotation" SET "status" = 'SENT', "subtotal"=1, "taxTotal"=0, "total"=1 WHERE "id" = 'q1'$$);
SELECT pg_temp.expect_fail('a price with no record of who set it', $$UPDATE "QuotationItem" SET "unitPrice" = 5 WHERE "id" = 'qi1'$$);
SELECT pg_temp.expect_fail('an AI-agent price with no approval', $$UPDATE "QuotationItem" SET "unitPrice" = 5, "lineTotal" = 50, "gstRatePercent" = 0, "priceSetBy" = 'AI_AGENT' WHERE "id" = 'qi1'$$);

-- approval flow
INSERT INTO "ApprovalRequest" ("id","action","requestedBy","summary","payload","payloadHash","expiresAt","quotationId","updatedAt")
  VALUES ('ap1','PROPOSE_PRICE','AI_AGENT','Price glue guns','{"unitPrice":"5.00"}', repeat('a',64), now() + interval '2 days', 'q1', now());
SELECT pg_temp.expect_fail('a second open request for the same action and target', $$INSERT INTO "ApprovalRequest" ("id","action","requestedBy","summary","payload","payloadHash","expiresAt","quotationId","updatedAt") VALUES ('ap1b','PROPOSE_PRICE','AI_AGENT','dup','{}', repeat('a',64), now() + interval '1 day','q1',now())$$);
SELECT pg_temp.expect_fail('an approval aimed at two records', $$INSERT INTO "ApprovalRequest" ("id","action","requestedBy","summary","payload","payloadHash","expiresAt","quotationId","customerId","updatedAt") VALUES ('apx','SEND_QUOTATION','AI_AGENT','x','{}', repeat('a',64), now(),'q1','cu1',now())$$);
SELECT pg_temp.expect_fail('an approval with a malformed payload hash', $$INSERT INTO "ApprovalRequest" ("id","action","requestedBy","summary","payload","payloadHash","expiresAt","leadId","updatedAt") VALUES ('apy','SEND_CUSTOMER_MESSAGE','AI_AGENT','x','{}','nothex',now(),'l1',now())$$);
SELECT pg_temp.expect_fail('approving with no approver recorded', $$UPDATE "ApprovalRequest" SET "status" = 'APPROVED', "decidedAt" = now() WHERE "id" = 'ap1'$$);
SELECT pg_temp.expect_fail('approving as STAFF', $$UPDATE "ApprovalRequest" SET "status"='APPROVED', "decidedAt"=now(), "decidedById"='u_staff', "decidedByRole"='STAFF' WHERE "id"='ap1'$$);
SELECT pg_temp.expect_fail('marking executed while still pending', $$UPDATE "ApprovalRequest" SET "executedAt" = now() WHERE "id" = 'ap1'$$);
UPDATE "ApprovalRequest" SET "status"='APPROVED', "decidedAt"=now(), "decidedById"='u_owner', "decidedByRole"='OWNER' WHERE "id"='ap1';
SELECT pg_temp.expect('the owner can approve', (SELECT "status" = 'APPROVED' FROM "ApprovalRequest" WHERE "id" = 'ap1'));
SELECT pg_temp.expect_fail('editing the payload after approval', $$UPDATE "ApprovalRequest" SET "payload" = '{"unitPrice":"1.00"}' WHERE "id" = 'ap1'$$);
SELECT pg_temp.expect_fail('editing the payload hash after approval', $$UPDATE "ApprovalRequest" SET "payloadHash" = repeat('b',64) WHERE "id" = 'ap1'$$);
SELECT pg_temp.expect_fail('extending the expiry after approval', $$UPDATE "ApprovalRequest" SET "expiresAt" = now() + interval '90 days' WHERE "id" = 'ap1'$$);
SELECT pg_temp.expect_fail('re-pointing an approval at another record', $$UPDATE "ApprovalRequest" SET "quotationId" = NULL, "customerId" = 'cu1' WHERE "id" = 'ap1'$$);
SELECT pg_temp.expect_fail('rejecting an approved request later', $$UPDATE "ApprovalRequest" SET "status" = 'REJECTED' WHERE "id" = 'ap1'$$);
SELECT pg_temp.expect_fail('deleting an approval', $$DELETE FROM "ApprovalRequest" WHERE "id" = 'ap1'$$);
-- now an AI price backed by that approval is allowed
UPDATE "QuotationItem" SET "unitPrice"=5, "lineTotal"=50, "gstRatePercent"=0, "priceSetBy"='AI_AGENT', "priceApprovalId"='ap1' WHERE "id"='qi1';
SELECT pg_temp.expect('an AI price backed by an approved PROPOSE_PRICE is accepted', (SELECT "unitPrice" = 5 FROM "QuotationItem" WHERE "id" = 'qi1'));
SELECT pg_temp.expect_fail('deleting the approval that backs a price', $$DELETE FROM "ApprovalRequest" WHERE "id" = 'ap1'$$);
UPDATE "ApprovalRequest" SET "executedAt" = now() WHERE "id" = 'ap1';
SELECT pg_temp.expect_fail('using an approval a second time (changing executedAt)', $$UPDATE "ApprovalRequest" SET "executedAt" = now() + interval '1 minute' WHERE "id" = 'ap1'$$);
SELECT pg_temp.expect_fail('expiring an approval that was already executed', $$UPDATE "ApprovalRequest" SET "status" = 'EXPIRED' WHERE "id" = 'ap1'$$);

-- a quotation can now be completed and sent, then it is frozen
UPDATE "Quotation" SET "status"='SENT', "subtotal"=50, "taxTotal"=0, "total"=50, "sentAt"=now() WHERE "id"='q1';
SELECT pg_temp.expect('a complete quotation can be sent', (SELECT "status" = 'SENT' FROM "Quotation" WHERE "id" = 'q1'));
SELECT pg_temp.expect_fail('changing a line of a sent quotation', $$UPDATE "QuotationItem" SET "unitPrice" = 1, "priceSetBy" = 'ADMIN', "priceApprovalId" = NULL WHERE "id" = 'qi1'$$);
SELECT pg_temp.expect_fail('adding a line to a sent quotation', $$INSERT INTO "QuotationItem" ("id","description","quantity","quotationId") VALUES ('qi2','x',1,'q1')$$);
SELECT pg_temp.expect_fail('deleting a quotation', $$DELETE FROM "Quotation" WHERE "id" = 'q1'$$);

-- ------------- orders, invoices, payments -------------
SELECT pg_temp.expect_fail('an order for a different customer than its quotation', $$INSERT INTO "Order" ("id","number","createdBy","customerId","quotationId","updatedAt") VALUES ('o_bad','ORD-1','ADMIN','cu2','q1',now())$$);
INSERT INTO "Order" ("id","number","createdBy","customerId","quotationId","updatedAt") VALUES ('o1','ORD-2026-0001','ADMIN','cu1','q1',now());
SELECT pg_temp.expect_fail('deleting an order', $$DELETE FROM "Order" WHERE "id" = 'o1'$$);
SELECT pg_temp.expect_fail('an invoice for a different customer than its order', $$INSERT INTO "Invoice" ("id","createdBy","orderId","customerId","updatedAt") VALUES ('i_bad','ADMIN','o1','cu2',now())$$);
INSERT INTO "Invoice" ("id","createdBy","orderId","customerId","updatedAt") VALUES ('i1','ADMIN','o1','cu1',now());
SELECT pg_temp.expect('a draft invoice has no number', (SELECT "number" IS NULL FROM "Invoice" WHERE "id" = 'i1'));
INSERT INTO "InvoiceItem" ("id","description","quantity","unitPrice","gstRatePercent","lineTotal","invoiceId") VALUES ('ii1','Glue Guns',10,5,0,50,'i1');
SELECT pg_temp.expect_fail('issuing an invoice without a number', $$UPDATE "Invoice" SET "status" = 'ISSUED' WHERE "id" = 'i1'$$);
UPDATE "Invoice" SET "status"='ISSUED', "number"='INV/26-27/0001', "financialYear"='2026-27', "sequence"=1, "issueDate"=now(), "subtotal"=50, "total"=50 WHERE "id"='i1';
SELECT pg_temp.expect('an invoice with a full serial number can be issued', (SELECT "status" = 'ISSUED' FROM "Invoice" WHERE "id" = 'i1'));
SELECT pg_temp.expect_fail('re-using the same financial year and serial number', $$INSERT INTO "Invoice" ("id","createdBy","orderId","customerId","status","number","financialYear","sequence","issueDate","updatedAt") VALUES ('i2','ADMIN','o1','cu1','ISSUED','INV/26-27/0002','2026-27',1,now(),now())$$);
SELECT pg_temp.expect_fail('changing the total of an issued invoice', $$UPDATE "Invoice" SET "total" = 1 WHERE "id" = 'i1'$$);
SELECT pg_temp.expect_fail('changing the number of an issued invoice', $$UPDATE "Invoice" SET "number" = 'INV/26-27/9999' WHERE "id" = 'i1'$$);
SELECT pg_temp.expect_fail('adding a line to an issued invoice', $$INSERT INTO "InvoiceItem" ("id","description","quantity","unitPrice","gstRatePercent","lineTotal","invoiceId") VALUES ('ii2','x',1,1,0,1,'i1')$$);
SELECT pg_temp.expect_fail('editing a line of an issued invoice', $$UPDATE "InvoiceItem" SET "unitPrice" = 1 WHERE "id" = 'ii1'$$);
SELECT pg_temp.expect_fail('deleting a line of an issued invoice', $$DELETE FROM "InvoiceItem" WHERE "id" = 'ii1'$$);
SELECT pg_temp.expect_fail('deleting an invoice', $$DELETE FROM "Invoice" WHERE "id" = 'i1'$$);
UPDATE "Invoice" SET "irn" = 'IRN-TEST' WHERE "id" = 'i1';
UPDATE "Invoice" SET "status" = 'PAID' WHERE "id" = 'i1';
SELECT pg_temp.expect('an issued invoice can still get its e-invoice reference and change status', (SELECT "status" = 'PAID' AND "irn" = 'IRN-TEST' FROM "Invoice" WHERE "id" = 'i1'));
INSERT INTO "Payment" ("id","amount","method","invoiceId","recordedById","updatedAt") VALUES ('pay1',50,'UPI','i1','u_owner',now());
SELECT pg_temp.expect_fail('a payment of zero', $$INSERT INTO "Payment" ("id","amount","method","invoiceId","updatedAt") VALUES ('pay0',0,'UPI','i1',now())$$);
SELECT pg_temp.expect_fail('deleting a payment', $$DELETE FROM "Payment" WHERE "id" = 'pay1'$$);
SELECT pg_temp.expect_fail('deleting the admin who recorded a payment', $$DELETE FROM "AdminUser" WHERE "id" = 'u_owner'$$);

-- follow-ups, sessions, timestamps
INSERT INTO "FollowUp" ("id","type","dueAt","createdBy","leadId","updatedAt") VALUES ('f1','CALL',now(),'ADMIN','l1',now());
SELECT pg_temp.expect_fail('deleting a follow-up', $$DELETE FROM "FollowUp" WHERE "id" = 'f1'$$);
INSERT INTO "AdminSession" ("id","tokenHash","expiresAt","adminUserId") VALUES ('s1', repeat('c',64), now() + interval '1 day', 'u_staff');
DELETE FROM "AdminUser" WHERE "id" = 'u_staff';
SELECT pg_temp.expect('deleting an admin user signs them out (their sessions go with them)', NOT EXISTS (SELECT 1 FROM "AdminSession" WHERE "id" = 's1'));
UPDATE "Product" SET "updatedAt" = '2000-01-01' WHERE "id" = 'p1';
SELECT pg_temp.expect('updatedAt is maintained by the database', (SELECT "updatedAt" > now() - interval '1 minute' FROM "Product" WHERE "id" = 'p1'));

-- ------------- row level security -------------
SELECT pg_temp.expect('RLS is enabled on EVERY table in public',
  NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity));
SELECT pg_temp.expect('every table has the deny-all policy for API roles (only checked where the roles exist)',
  NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
  OR NOT EXISTS (SELECT 1 FROM pg_tables t WHERE t.schemaname = 'public' AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.tablename AND p.policyname = 'deny_api_access' AND p.permissive = 'RESTRICTIVE')));
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    SET LOCAL ROLE anon;
    BEGIN PERFORM count(*) FROM "Product"; RAISE EXCEPTION 'FAIL: anon could read Product'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok   anon cannot read Product (prices stay private)'; END;
    BEGIN PERFORM count(*) FROM "Lead";    RAISE EXCEPTION 'FAIL: anon could read Lead';    EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok   anon cannot read Lead'; END;
    BEGIN INSERT INTO "Brand" ("id","slug","name","updatedAt") VALUES ('bx','bx','bx',now()); RAISE EXCEPTION 'FAIL: anon could write Brand'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok   anon cannot write'; END;
    RESET ROLE;
    -- Belt and braces: even if someone granted privileges back, the RESTRICTIVE policy still shows no rows.
    GRANT SELECT ON "Product" TO anon;
    SET LOCAL ROLE anon;
    IF (SELECT count(*) FROM "Product") <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw Product rows after a GRANT'; END IF;
    RAISE NOTICE 'ok   even with SELECT re-granted, anon sees zero Product rows (deny policy)';
    RESET ROLE;
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM count(*) FROM "Customer"; RAISE EXCEPTION 'FAIL: authenticated could read Customer'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok   a logged-in Supabase user cannot read Customer either'; END;
    RESET ROLE;
  END IF;
END $$;

-- Reaching this line means every check above passed (a failed check raises an error and stops the script).
SELECT 'ALL MIGRATION CHECKS PASSED' AS result;

ROLLBACK;
