import { existsSync } from "node:fs";

/** Loads .env.local then .env into process.env (without overriding variables already set in the shell). */
export function loadEnvConfig(): void {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
