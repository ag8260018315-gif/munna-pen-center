import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialFormState } from "@/lib/validation/form-state";

function bulkForm(overrides: Record<string, string> = {}, items: [string, string][] = []) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    kind: "bulk-order",
    name: "Asha Kumari",
    organization: "Sunrise Public School",
    phone: "98765 43210",
    email: "asha@example.com",
    city: "Ranchi",
    state: "Jharkhand",
    productsRequired: "Registers for the new session",
    approximateQuantity: "500",
    additionalRequirements: "",
    website: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  for (const [slug, quantity] of items) {
    fd.append("itemSlug", slug);
    fd.append("itemQuantity", quantity);
  }
  return fd;
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "mpc-enquiries-"));
  vi.stubEnv("ENQUIRY_DATA_DIR", dir);
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.useRealTimers();
  vi.doUnmock("@/lib/whatsapp");
  vi.doUnmock("@/lib/repositories");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("submitBulkEnquiryAction", () => {
  it("stores a valid enquiry, resolves list items, and returns a reference + WhatsApp link", async () => {
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, bulkForm({}, [["glue-guns", "10 boxes"], ["not-a-product", "1"]]));

    expect(state.status).toBe("success");
    if (state.status !== "success") return;
    expect(state.reference).toMatch(/^ENQ-\d{8}-[A-Z2-9]{4}$/);
    expect(state.whatsappUrl).toContain("https://wa.me/917979025165?text=");

    const lines = (await readFile(path.join(dir, "enquiries.jsonl"), "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    const saved = JSON.parse(lines[0]!);
    expect(saved).toMatchObject({
      source: "BULK_ORDER_FORM",
      status: "NEW",
      phone: "+919876543210",
      city: "Ranchi",
      state: "Jharkhand",
      reference: state.reference,
    });
    expect(saved.items).toEqual([{ productId: "glue-guns", productName: "Glue Guns", quantityNote: "10 boxes" }]);
    expect(saved.productsRequired).toContain("Glue Guns (10 boxes)");
    expect(saved.productsRequired).toContain("Registers for the new session");
  });

  it("returns field errors and the submitted values when validation fails, storing nothing", async () => {
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, bulkForm({ phone: "123", city: "" }));

    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.fieldErrors).toMatchObject({ phone: expect.any(String), city: expect.any(String) });
    expect(state.values).toMatchObject({ name: "Asha Kumari", phone: "123" });
    await expect(readFile(path.join(dir, "enquiries.jsonl"), "utf8")).rejects.toThrow();
  });

  it("silently drops honeypot submissions without storing them", async () => {
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, bulkForm({ website: "http://spam.example" }));
    expect(state.status).toBe("success");
    await expect(readFile(path.join(dir, "enquiries.jsonl"), "utf8")).rejects.toThrow();
  });

  it("rejects a list made only of unknown products when nothing else was typed", async () => {
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, bulkForm({ productsRequired: "" }, [["ghost", ""]]));
    expect(state.status).toBe("error");
    if (state.status === "error") expect(state.fieldErrors?.productsRequired).toBeDefined();
  });

  it("falls back to WhatsApp — and never reports success — when storage is unavailable", async () => {
    // A path *under a regular file* can never be created.
    const blocker = path.join(dir, "blocker");
    await writeFile(blocker, "x");
    vi.stubEnv("ENQUIRY_DATA_DIR", path.join(blocker, "nested"));
    vi.resetModules();

    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, bulkForm());

    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.message).toMatch(/WhatsApp/);
    expect(state.whatsappUrl).toContain("wa.me/917979025165");
    expect(decodeURIComponent(state.whatsappUrl ?? "")).toContain("Sunrise Public School");
    expect(state.values?.name).toBe("Asha Kumari");
  });
});

describe("things that go wrong around the save", () => {
  it("still tells the visitor their enquiry was received when building the WhatsApp link fails AFTER it was saved", async () => {
    vi.doMock("@/lib/whatsapp", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/whatsapp")>();
      return {
        ...actual,
        buildEnquiryWhatsAppMessage: () => {
          throw new Error("could not build message");
        },
      };
    });
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, bulkForm());

    expect(state.status).toBe("success");
    if (state.status === "success") expect(state.whatsappUrl).toContain("https://wa.me/917979025165");
    const lines = (await readFile(path.join(dir, "enquiries.jsonl"), "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
  });

  it("stops waiting for a store that never answers and offers the WhatsApp fallback instead of an endless spinner", async () => {
    vi.useFakeTimers();
    vi.doMock("@/lib/repositories", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/repositories")>();
      return { ...actual, getEnquiryRepository: () => ({ create: () => new Promise(() => {}) }) as unknown as ReturnType<typeof actual.getEnquiryRepository> };
    });
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");

    const pending = submitBulkEnquiryAction(initialFormState, bulkForm());
    await vi.advanceTimersByTimeAsync(8_500);
    const state = await pending;

    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.message).toMatch(/WhatsApp/);
    expect(state.whatsappUrl).toContain("wa.me/917979025165");
  });
});

describe("submitContactAction", () => {
  it("stores a contact message as a CONTACT_FORM enquiry", async () => {
    const { submitContactAction } = await import("@/app/actions/enquiry");
    const fd = new FormData();
    for (const [k, v] of Object.entries({ kind: "contact", name: "Ravi", phone: "9876543210", email: "", message: "Please call me about registers.", website: "" })) fd.append(k, v);

    const state = await submitContactAction(initialFormState, fd);
    expect(state.status).toBe("success");
    const saved = JSON.parse((await readFile(path.join(dir, "enquiries.jsonl"), "utf8")).trim());
    expect(saved).toMatchObject({ source: "CONTACT_FORM", additionalRequirements: "Please call me about registers." });
  });
});
