import "server-only";
import { joinNotes, splitNotes } from "@/lib/domain/order-log";
import type { Prisma } from "@/generated/prisma/client";

/** Adds a log line to an order's notes. The caller holds the order's row lock, so the read-then-write can not lose a concurrent line. */
export async function appendOrderLog(tx: Prisma.TransactionClient, orderId: string, line: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { notes: true } });
  const { text, log } = splitNotes(order?.notes);
  await tx.order.update({ where: { id: orderId }, data: { notes: joinNotes(text, [...log, line].slice(-40)) } });
}
