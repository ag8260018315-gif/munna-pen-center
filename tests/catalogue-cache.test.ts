import { describe, expect, it, vi } from "vitest";

describe("catalogue snapshot invalidation", () => {
  it("is shared by every copy of the module (route handlers, server actions and pages can each get their own)", async () => {
    const key = "__munnaCatalogueGeneration";
    const g = globalThis as unknown as Record<string, number | undefined>;
    const before = g[key] ?? 0;
    const a = await import("@/lib/repositories/prisma-catalogue");
    vi.resetModules();
    const b = await import("@/lib/repositories/prisma-catalogue");
    expect(a).not.toBe(b); // two separate copies, as in a server bundle
    a.invalidateCatalogueSnapshot();
    expect(g[key]).toBe(before + 1);
    b.invalidateCatalogueSnapshot();
    expect(g[key]).toBe(before + 2); // a counter kept in a module variable would have restarted at 1
  });
});
