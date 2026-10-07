import "server-only";
import path from "node:path";
import { getServerEnv } from "@/lib/env";
import { FileEnquiryRepository } from "@/lib/repositories/file-enquiries";
import { PrismaCatalogueRepository } from "@/lib/repositories/prisma-catalogue";
import { PrismaEnquiryRepository } from "@/lib/repositories/prisma-enquiries";
import { StaticCatalogueRepository } from "@/lib/repositories/static-catalogue";
import type { CatalogueRepository, EnquiryRepository } from "@/lib/repositories/types";

/**
 * Repository composition root. This is the ONE place that decides which data
 * store backs the app.
 *  - Enquiries: the database whenever DATABASE_URL is set (required on Vercel, where the disk is read-only);
 *    otherwise the JSONL file for local development and servers with a persistent disk.
 *  - Catalogue: the database only when CATALOGUE_SOURCE=database; otherwise the built-in lists. Kept separate so the
 *    site never goes empty just because the database exists but has no products yet.
 */

let catalogue: CatalogueRepository | undefined;
let enquiries: EnquiryRepository | undefined;

export function getCatalogue(): CatalogueRepository {
  catalogue ??= getServerEnv().CATALOGUE_SOURCE === "database" ? new PrismaCatalogueRepository() : new StaticCatalogueRepository();
  return catalogue;
}

export function getEnquiryRepository(): EnquiryRepository {
  if (!enquiries) {
    if (getServerEnv().DATABASE_URL) {
      enquiries = new PrismaEnquiryRepository();
      return enquiries;
    }
    const directory = getServerEnv().ENQUIRY_DATA_DIR ?? path.join(process.cwd(), ".data");
    enquiries = new FileEnquiryRepository(directory);
  }
  return enquiries;
}
