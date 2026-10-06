import "server-only";
import path from "node:path";
import { getServerEnv } from "@/lib/env";
import { FileEnquiryRepository } from "@/lib/repositories/file-enquiries";
import { StaticCatalogueRepository } from "@/lib/repositories/static-catalogue";
import type { CatalogueRepository, EnquiryRepository } from "@/lib/repositories/types";

/**
 * Repository composition root. This is the ONE place that decides which data
 * store backs the app. Phase 2: when DATABASE_URL is set, return the Prisma
 * implementations here instead.
 */

let catalogue: CatalogueRepository | undefined;
let enquiries: EnquiryRepository | undefined;

export function getCatalogue(): CatalogueRepository {
  catalogue ??= new StaticCatalogueRepository();
  return catalogue;
}

export function getEnquiryRepository(): EnquiryRepository {
  if (!enquiries) {
    const directory = getServerEnv().ENQUIRY_DATA_DIR ?? path.join(process.cwd(), ".data");
    enquiries = new FileEnquiryRepository(directory);
  }
  return enquiries;
}
