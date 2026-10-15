import { vi } from "vitest";

/**
 * Shared set-up for the orders / invoices / payments tests, which run against a real (throwaway) PostgreSQL:
 * mocks the sign-in guard and the cache, hands back the data modules, and removes only the rows these tests create.
 *
 * Test-only. The GSTINs used with it are made-up values, never the business's.
 */
export const TEST_ORG = "STest ";
export const TEST_SUPPLIER_GSTIN = "20ABCDE1234F1Z5"; // made up; state code 20 = Jharkhand

export interface SalesTestState {
  role: "OWNER" | "STAFF";
  signedIn: boolean;
  userId: string;
  businessGstin: string | null;
}

export async function setupSalesDb(url: string) {
  const state: SalesTestState = { role: "OWNER", signedIn: true, userId: "u", businessGstin: TEST_SUPPLIER_GSTIN };
  vi.stubEnv("DATABASE_URL", url);
  vi.resetModules();
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
  const session = () => ({ userId: state.userId, email: "t@example.test", name: "T", role: state.role, isPreview: false });
  vi.doMock("@/lib/auth/guard", () => ({
    requireAdmin: async () => {
      if (!state.signedIn) throw new Error("NEXT_REDIRECT:/admin/login");
      return session();
    },
    requireOwner: async () => {
      if (!state.signedIn) throw new Error("NEXT_REDIRECT:/admin/login");
      if (state.role !== "OWNER") throw new Error("NEXT_NOT_FOUND");
      return session();
    },
  }));
  vi.doMock("@/lib/business", () => ({ getBusinessGstin: () => state.businessGstin }));

  const db = (await import("@/lib/db/client")).getDb();
  const quotes = await import("@/lib/admin/quotation-admin");
  const orders = await import("@/lib/admin/order-admin");

  async function cleanup() {
    // Orders, invoices and payments can not be deleted by design (database triggers), so the tests' own rows are removed
    // inside one transaction that switches the triggers off. That is only possible on a throwaway database.
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
      const customers = `(SELECT "id" FROM "Customer" WHERE "organizationName" LIKE '${TEST_ORG}%')`;
      await tx.$executeRawUnsafe(`DELETE FROM "Payment" WHERE "invoiceId" IN (SELECT "id" FROM "Invoice" WHERE "customerId" IN ${customers})`);
      await tx.$executeRawUnsafe(`DELETE FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT "id" FROM "Invoice" WHERE "customerId" IN ${customers})`);
      await tx.$executeRawUnsafe(`DELETE FROM "Invoice" WHERE "customerId" IN ${customers}`);
      await tx.$executeRawUnsafe(`DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "customerId" IN ${customers})`);
      await tx.$executeRawUnsafe(`DELETE FROM "Order" WHERE "customerId" IN ${customers}`);
      await tx.$executeRawUnsafe(`DELETE FROM "QuotationItem" WHERE "quotationId" IN (SELECT "id" FROM "Quotation" WHERE "customerId" IN ${customers})`);
      await tx.$executeRawUnsafe(`DELETE FROM "Quotation" WHERE "customerId" IN ${customers}`);
      await tx.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "organizationName" LIKE '${TEST_ORG}%'`);
      await tx.$executeRawUnsafe(`DELETE FROM "NumberSequence" WHERE "scope" IN ('ORD', 'INV')`);
      await tx.$executeRawUnsafe(`DELETE FROM "AdminUser" WHERE "email" LIKE 'stest-%@example.test'`);
    });
  }

  async function newCustomer(extra: Record<string, string | null> = {}) {
    return db.customer.create({
      data: { organizationName: `${TEST_ORG}${Math.random().toString(36).slice(2, 8)}`, contactName: "Asha", phone: "+917979000001", billingLine1: "12 Main Road", billingCity: "Dhanbad", billingState: "Jharkhand", billingPincode: "826001", ...extra },
    });
  }

  type LineSpec = { description?: string; quantity?: string; unit?: string; unitPrice?: string; gstRatePercent?: string; hsnCode?: string };
  /** Builds a quotation with these lines, marks it sent and accepted (as the owner), and returns its id. */
  async function acceptedQuote(customerId: string, lines: LineSpec[] = [{}], keepRole = true) {
    const before = state.role;
    state.role = "OWNER";
    try {
      const created = await quotes.createQuotationForCustomer(customerId);
      if (!created.ok) throw new Error(`setup: ${created.message}`);
      for (const spec of lines) {
        const added = await quotes.addQuotationLine(created.id, { description: "Blue pen", quantity: "10", unit: "box", unitPrice: "100.00", gstRatePercent: "18", hsnCode: "9608", ...spec });
        if (!added.ok) throw new Error(`setup: ${added.message}`);
      }
      for (const action of ["SENT", "ACCEPTED"]) {
        const moved = await quotes.setQuotationStatus(created.id, action);
        if (!moved.ok) throw new Error(`setup: ${moved.message}`);
      }
      return created.id;
    } finally {
      if (keepRole) state.role = before;
    }
  }

  /** An order that is already CONFIRMED (the point from which an invoice can be made). */
  async function confirmedOrder(customerId: string, lines?: LineSpec[]) {
    const quoteId = await acceptedQuote(customerId, lines);
    const before = state.role;
    state.role = "OWNER";
    try {
      const made = await orders.createOrderFromQuotation(quoteId);
      if (!made.ok) throw new Error(`setup: ${made.message}`);
      const confirmed = await orders.setOrderStatus(made.id, "CONFIRM");
      if (!confirmed.ok) throw new Error(`setup: ${confirmed.message}`);
      return made.id;
    } finally {
      state.role = before;
    }
  }

  // A real user row, because a recorded payment points at the person who recorded it.
  await cleanup();
  const user = await db.adminUser.create({ data: { email: "stest-owner@example.test", name: "STest Owner", role: "OWNER" } });
  state.userId = user.id;

  return { state, db, quotes, orders, cleanup, newCustomer, acceptedQuote, confirmedOrder };
}
