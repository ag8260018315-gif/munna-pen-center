import { describe, expect, it } from "vitest";
import { AGENT_ACTION_POLICY, canExecute, isKnownAction, policyFor } from "@/lib/ai-sales/policy";
import { SALES_STAGES, canTransition, nextStages, transitionRequiresOwnerApproval } from "@/lib/ai-sales/workflow";

describe("agent action policy", () => {
  it("denies unknown actions by default", () => {
    expect(policyFor("DELETE_EVERYTHING")).toBe("FORBIDDEN");
    expect(isKnownAction("toString")).toBe(false);
    expect(isKnownAction("constructor")).toBe(false);
    expect(canExecute("DELETE_EVERYTHING")).toBe(false);
  });

  it("lets the agent read and draft on its own", () => {
    for (const action of ["SEARCH_CATALOGUE", "CREATE_QUOTATION_DRAFT", "RECORD_REQUIREMENT"]) {
      expect(canExecute(action)).toBe(true);
    }
  });

  it("requires owner approval for every commercial commitment", () => {
    const commercial = ["PROPOSE_PRICE", "APPLY_DISCOUNT", "SEND_QUOTATION", "CONFIRM_ORDER", "ISSUE_INVOICE", "REQUEST_PAYMENT", "SCHEDULE_DELIVERY"];
    for (const action of commercial) {
      expect(policyFor(action)).toBe("OWNER_APPROVAL");
      expect(canExecute(action)).toBe(false);
      expect(canExecute(action, { action, status: "PENDING" })).toBe(false);
      expect(canExecute(action, { action, status: "REJECTED" })).toBe(false);
      expect(canExecute(action, { action, status: "APPROVED" })).toBe(true);
    }
  });

  it("does not let an approval for one action authorise another", () => {
    expect(canExecute("CONFIRM_ORDER", { action: "SEND_QUOTATION", status: "APPROVED" })).toBe(false);
  });

  it("ignores expired approvals", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    expect(canExecute("SEND_QUOTATION", { action: "SEND_QUOTATION", status: "APPROVED", expiresAt: "2026-10-06T11:00:00Z" }, now)).toBe(false);
    expect(canExecute("SEND_QUOTATION", { action: "SEND_QUOTATION", status: "APPROVED", expiresAt: "2026-10-06T13:00:00Z" }, now)).toBe(true);
  });

  it("never lets the agent move money, even with an 'approval'", () => {
    for (const action of ["MOVE_MONEY", "REFUND_PAYMENT", "CHANGE_PAYMENT_DETAILS", "EDIT_ADMIN_USERS"]) {
      expect(policyFor(action)).toBe("FORBIDDEN");
      expect(canExecute(action, { action, status: "APPROVED" })).toBe(false);
    }
  });

  it("keeps the Prisma ApprovalAction enum in sync with the OWNER_APPROVAL policies", async () => {
    const { readFile } = await import("node:fs/promises");
    const schema = await readFile("prisma/schema.prisma", "utf8");
    const block = /enum ApprovalAction \{([^}]*)\}/.exec(schema)?.[1] ?? "";
    const inSchema = block.split("\n").map((line) => line.trim()).filter(Boolean).sort();
    const inPolicy = Object.entries(AGENT_ACTION_POLICY)
      .filter(([, policy]) => policy === "OWNER_APPROVAL")
      .map(([action]) => action)
      .sort();
    expect(inSchema).toEqual(inPolicy);
  });
});

describe("sales workflow", () => {
  it("follows the agreed pipeline order", () => {
    expect(SALES_STAGES.map((stage) => stage.id)).toEqual([
      "ENQUIRY_RECEIVED",
      "REQUIREMENT_UNDERSTOOD",
      "CATALOGUE_CHECKED",
      "QUANTITY_COLLECTED",
      "QUOTE_DRAFTED",
      "OWNER_APPROVED",
      "ORDER_CONFIRMED",
      "INVOICED",
      "PAYMENT_RECEIVED",
      "DELIVERED",
      "FOLLOW_UP",
    ]);
  });

  it("only implements the enquiry stage in V1", () => {
    expect(SALES_STAGES.filter((stage) => stage.implemented).map((stage) => stage.id)).toEqual(["ENQUIRY_RECEIVED"]);
  });

  it("cannot skip stages — in particular the quote cannot be sent without owner approval", () => {
    expect(canTransition("QUOTE_DRAFTED", "ORDER_CONFIRMED")).toBe(false);
    expect(canTransition("QUOTE_DRAFTED", "OWNER_APPROVED")).toBe(true);
    expect(canTransition("ENQUIRY_RECEIVED", "INVOICED")).toBe(false);
    expect(nextStages("OWNER_APPROVED")).toEqual(["ORDER_CONFIRMED", "QUOTE_DRAFTED"]);
  });

  it("gates every commercial commitment on the owner", () => {
    for (const id of ["OWNER_APPROVED", "ORDER_CONFIRMED", "INVOICED", "DELIVERED", "FOLLOW_UP"] as const) {
      expect(transitionRequiresOwnerApproval(id)).toBe(true);
    }
    expect(transitionRequiresOwnerApproval("QUOTE_DRAFTED")).toBe(false);
  });

  it("supports the repeat-order loop", () => {
    expect(canTransition("FOLLOW_UP", "ENQUIRY_RECEIVED")).toBe(true);
  });
});
