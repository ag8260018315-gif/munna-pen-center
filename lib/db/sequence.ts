import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Gap-free serial numbers. The counter row is incremented INSIDE the caller's transaction, so a number is used only if
 * the document that carries it is saved, and two requests at the same moment can never get the same value.
 * `scope` is the series ("QT" quotations, "ORD" orders, "INV" tax invoices); each series restarts every financial year.
 */
export async function allocateSequence(tx: Prisma.TransactionClient, scope: string, financialYear: string): Promise<number> {
  for (let attempt = 0; ; attempt++) {
    try {
      const row = await tx.numberSequence.upsert({
        where: { scope_financialYear: { scope, financialYear } },
        create: { scope, financialYear, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
        select: { lastValue: true },
      });
      return row.lastValue;
    } catch (error) {
      // Two first-of-the-year requests can race on the insert: the loser simply retries as an update.
      if ((error as { code?: string } | null)?.code === "P2002" && attempt < 3) continue;
      throw error;
    }
  }
}
