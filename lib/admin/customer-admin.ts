import "server-only";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { customerSchema } from "@/lib/validation/admin-sales";
import { fieldErrors } from "@/lib/validation/admin-catalogue";
import type { Prisma } from "@/generated/prisma/client";

/** Admin data functions for customers. Every exported function calls requireAdmin() first (a test checks this). */

export type CustomerResult = { ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const PAGE_SIZE = 25;

export async function listCustomers(params: { q?: string; page?: number }) {
  await requireAdmin();
  const where: Prisma.CustomerWhereInput = {};
  const q = params.q?.trim().slice(0, 80);
  if (q) where.OR = [{ organizationName: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/[\s-]/g, "") } }];
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const db = getDb();
  const [total, items] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({ where, orderBy: [{ organizationName: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { _count: { select: { quotations: true } } } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getCustomer(id: string) {
  await requireAdmin();
  return getDb().customer.findUnique({ where: { id } });
}

export async function listCustomerOptions() {
  await requireAdmin();
  return getDb().customer.findMany({ orderBy: { organizationName: "asc" }, select: { id: true, organizationName: true, contactName: true }, take: 500 });
}

export async function saveCustomer(id: string | null, raw: Record<string, string>): Promise<CustomerResult> {
  await requireAdmin();
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    const customer = id ? await db.customer.update({ where: { id }, data: parsed.data }) : await db.customer.create({ data: parsed.data });
    return { ok: true, id: customer.id };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2025") return { ok: false, message: "That customer no longer exists." };
    console.error("[admin] saveCustomer failed:", error instanceof Error ? error.message : "unknown");
    return { ok: false, message: "Could not save. Please try again." };
  }
}
