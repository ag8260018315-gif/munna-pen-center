import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Gap-free serial numbers. The counter row is incremented INSIDE the caller's transaction, so a number is used only if
 * the document that carries it is saved, and two requests at the same moment can never get the same value.
 * `scope` is the series ("QT" quotations, "ORD" orders, "INV" tax invoices); each series restarts every financial year.
 *
 * One SQL statement does both "create the year's counter" and "add one": two first-of-the-year requests can not collide, and
 * the counter row stays locked until the caller's transaction ends, which also serialises everyone using that series.
 */
export async function allocateSequence(tx: Prisma.TransactionClient, scope: string, financialYear: string): Promise<number> {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "NumberSequence" ("id", "scope", "financialYear", "lastValue", "updatedAt")
    VALUES (${randomUUID()}, ${scope}, ${financialYear}, 1, now())
    ON CONFLICT ("scope", "financialYear") DO UPDATE SET "lastValue" = "NumberSequence"."lastValue" + 1, "updatedAt" = now()
    RETURNING "lastValue"`;
  const value = rows[0]?.lastValue;
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error("allocateSequence: no value returned");
  return value as number;
}
