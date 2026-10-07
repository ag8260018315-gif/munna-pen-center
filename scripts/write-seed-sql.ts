import { writeFileSync } from "node:fs";
import { renderSeedSql } from "./generate-seed-sql";

writeFileSync("prisma/seed/catalogue.sql", renderSeedSql());
console.log("Wrote prisma/seed/catalogue.sql");
