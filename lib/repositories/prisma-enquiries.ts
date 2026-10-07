import "server-only";
import type { Enquiry, EnquirySource, NewEnquiry } from "@/lib/domain/types";
import { generateEnquiryIdentity } from "@/lib/domain/identifiers";
import { getDb } from "@/lib/db/client";
import { StorageUnavailableError, type EnquiryRepository } from "@/lib/repositories/types";
import type { LeadSource } from "@/generated/prisma/enums";

/**
 * Enquiries in the database: every submission becomes a Lead (the person/organisation) plus an Enquiry with its lines,
 * written in ONE transaction, so a lead can never exist without its enquiry or the reverse.
 *
 * A returning visitor is matched to their existing Lead by phone number AND name (case-insensitive). Name is part of
 * the match on purpose: a school office phone shared by several people must not merge them, and nobody can overwrite
 * an existing lead's details by submitting the same number — an existing Lead is never modified here.
 */

const LEAD_SOURCE: Record<EnquirySource, LeadSource> = {
  BULK_ORDER_FORM: "WEBSITE",
  QUOTE_FORM: "WEBSITE",
  CONTACT_FORM: "WEBSITE",
  WHATSAPP: "WHATSAPP",
  PHONE: "PHONE",
  AI_AGENT: "AI_AGENT",
};

const MAX_REFERENCE_ATTEMPTS = 4;

function isUniqueViolation(error: unknown, field: string): boolean {
  // With the pg driver adapter the violated index is named inside `meta` (e.g. "Enquiry_reference_key"), not in `meta.target`.
  const e = error as { code?: string; meta?: unknown } | null;
  return e?.code === "P2002" && JSON.stringify(e.meta ?? "").includes(field);
}

export class PrismaEnquiryRepository implements EnquiryRepository {
  async create(input: NewEnquiry): Promise<Enquiry> {
    try {
      for (let attempt = 1; ; attempt++) {
        const { reference } = generateEnquiryIdentity();
        try {
          return await this.insert(input, reference);
        } catch (error) {
          // A 1-in-a-billion reference collision: try another reference rather than failing the visitor.
          if (isUniqueViolation(error, "reference") && attempt < MAX_REFERENCE_ATTEMPTS) continue;
          throw error;
        }
      }
    } catch (cause) {
      throw new StorageUnavailableError("Could not save the enquiry to the database", { cause });
    }
  }

  private async insert(input: NewEnquiry, reference: string): Promise<Enquiry> {
    const db = getDb();
    return db.$transaction(async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { phone: input.phone, name: { equals: input.name, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
      });
      const lead =
        existing ??
        (await tx.lead.create({
          data: {
            name: input.name,
            organizationName: input.organization ?? null,
            phone: input.phone,
            email: input.email ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            source: LEAD_SOURCE[input.source],
          },
        }));

      // Items may carry ids from another catalogue (e.g. the built-in list while the database has no products yet), so
      // only link products that really exist here; the product NAME is always kept.
      const ids = input.items.flatMap((item) => (item.productId ? [item.productId] : []));
      const known = new Set((ids.length ? await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true } }) : []).map((p) => p.id));

      const enquiry = await tx.enquiry.create({
        data: {
          reference,
          source: input.source,
          productsRequired: input.productsRequired,
          approximateQuantity: input.approximateQuantity ?? null,
          additionalRequirements: input.additionalRequirements ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          leadId: lead.id,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId && known.has(item.productId) ? item.productId : null,
              productName: item.productName,
              quantityNote: item.quantityNote ?? null,
            })),
          },
        },
        include: { items: true },
      });

      return {
        id: enquiry.id,
        reference: enquiry.reference,
        source: input.source,
        status: enquiry.status,
        name: lead.name,
        organization: lead.organizationName ?? undefined,
        phone: lead.phone,
        email: lead.email ?? undefined,
        city: enquiry.city ?? undefined,
        state: enquiry.state ?? undefined,
        productsRequired: enquiry.productsRequired,
        approximateQuantity: enquiry.approximateQuantity ?? undefined,
        additionalRequirements: enquiry.additionalRequirements ?? undefined,
        items: input.items,
        createdAt: enquiry.createdAt.toISOString(),
      } satisfies Enquiry;
    });
  }

  async list({ limit = 100 }: { limit?: number } = {}): Promise<Enquiry[]> {
    try {
      const rows = await getDb().enquiry.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, Math.floor(limit)), 500),
        include: { lead: true, items: { orderBy: { id: "asc" } } },
      });
      return rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        source: row.source,
        status: row.status,
        name: row.lead.name,
        organization: row.lead.organizationName ?? undefined,
        phone: row.lead.phone,
        email: row.lead.email ?? undefined,
        city: row.city ?? undefined,
        state: row.state ?? undefined,
        productsRequired: row.productsRequired,
        approximateQuantity: row.approximateQuantity ?? undefined,
        additionalRequirements: row.additionalRequirements ?? undefined,
        items: row.items.map((item) => ({ productId: item.productId, productName: item.productName, quantityNote: item.quantityNote ?? undefined })),
        createdAt: row.createdAt.toISOString(),
      }));
    } catch (cause) {
      throw new StorageUnavailableError("Could not read enquiries from the database", { cause });
    }
  }
}
