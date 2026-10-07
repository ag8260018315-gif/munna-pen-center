/**
 * Loads the owner-supplied categories, brands and the five identified products into the database.
 *
 *   npm run db:seed              → DRY RUN: prints what would be created, touches nothing
 *   npm run db:seed -- --apply   → writes (only rows whose slug is missing; never overwrites)
 *
 * Reads the connection string from DIRECT_URL (preferred) or DATABASE_URL in your shell / .env.local — never hardcode it.
 */
import { loadEnvConfig } from "./load-env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { seedCatalogue, seedPlan } from "@/lib/db/seed-catalogue";

async function main() {
  loadEnvConfig();
  const apply = process.argv.includes("--apply");
  const plan = seedPlan();
  console.log(`Owner-supplied catalogue: ${plan.categories} categories, ${plan.brands} brands, ${plan.products} products (no SKUs, prices, GST, HSN or stock).`);

  if (!apply) {
    console.log("DRY RUN — nothing written. Re-run with --apply to load it.");
    return;
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Set DIRECT_URL or DATABASE_URL first.");
    process.exitCode = 1;
    return;
  }
  const host = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return "(unparseable)";
    }
  })();
  console.log(`Target database host: ${host}`);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });
  try {
    const result = await seedCatalogue(db);
    console.log(`Created: ${result.created.categories} categories, ${result.created.brands} brands, ${result.created.products} products (existing rows left untouched).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
