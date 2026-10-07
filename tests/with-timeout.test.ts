import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageUnavailableError } from "@/lib/repositories/types";
import { withTimeout } from "@/lib/repositories/with-timeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("passes through a result that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve("saved"), 1000)).resolves.toBe("saved");
  });

  it("passes through the original error", async () => {
    await expect(withTimeout(Promise.reject(new Error("disk full")), 1000)).rejects.toThrow("disk full");
  });

  it("turns a hung store into StorageUnavailableError so the customer gets the WhatsApp fallback", async () => {
    const hung = new Promise<never>(() => {});
    const result = withTimeout(hung, 8000);
    const assertion = expect(result).rejects.toBeInstanceOf(StorageUnavailableError);
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
  });

  it("does not leave a timer running after success", async () => {
    await withTimeout(Promise.resolve(1), 1000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
