import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration (Prisma 7+).
 * The connection string comes from the environment — never hardcode it.
 * `prisma validate` / `prisma format` do not need a live database; the placeholder
 * below only exists so those offline commands work when DATABASE_URL is unset.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
