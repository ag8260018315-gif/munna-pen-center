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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("submitBulkEnquiryAction", () => {
  it("stores a valid enquiry, resolves list items, and returns a reference + WhatsApp link", async () => {
    const { submitBulkEnquiryAction } = await import("@/app/actions/enquiry");
    const state = await submitBulkEnquiryAction(initialFormState, bulkForm({}, [["ball-pens", "10 boxes"], ["not-a-product", "1"]]));

    expect(state.status).toBe("success");
    if (state.status !== "success") return;
    expect(state.reference).toMatch(/^ENQ-\d{8}-[A-Z2-9]{4}$/);
    expect(state.whatsappUrl).toContain("https://wa.me/917979025166?text=");

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
    expect(saved.items).toEqual([{ productId: "ball-pens", productName: "Ball Pens", quantityNote: "10 boxes" }]);
    expect(saved.productsRequired).toContain("Ball Pens (10 boxes)");
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
    expect(state.whatsappUrl).toContain("wa.me/917979025166");
    expect(decodeURIComponent(state.whatsappUrl ?? "")).toContain("Sunrise Public School");
    expect(state.values?.name).toBe("Asha Kumari");
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
