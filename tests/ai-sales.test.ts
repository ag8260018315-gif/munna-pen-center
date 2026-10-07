import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hashPayload } from "@/lib/ai-sales/payload-hash";
import {
  ACTION_TARGET_TYPES,
  AGENT_ACTION_POLICY,
  canExecute,
  isKnownAction,
  policyFor,
  type AgentAction,
  type ApprovalRef,
  type ProposedAction,
} from "@/lib/ai-sales/policy";
import { SALES_STAGES, canTransition, getStage, nextStages, transitionRequiresOwnerApproval } from "@/lib/ai-sales/workflow";

const NOW = new Date("2026-10-06T12:00:00Z");
const QUOTE_A = { type: "QUOTATION", id: "qt_A" } as const;
const PAYLOAD = { quotationId: "qt_A", lines: [{ product: "ball-pens", qty: 100, unitPrice: "10.00" }], total: "1000.00" };
const HASH = hashPayload(PAYLOAD);

const proposal = (over: Partial<ProposedAction> = {}): ProposedAction => ({ action: "SEND_QUOTATION", target: QUOTE_A, payloadHash: HASH, ...over });
const approval = (over: Partial<ApprovalRef> = {}): ApprovalRef => ({
  id: "ap_1",
  action: "SEND_QUOTATION",
  status: "APPROVED",
  target: QUOTE_A,
  payloadHash: HASH,
  decidedByRole: "OWNER",
  expiresAt: "2026-10-07T12:00:00Z",
  executedAt: null,
  ...over,
});

const approvalActions = Object.entries(AGENT_ACTION_POLICY)
  .filter(([, policy]) => policy === "OWNER_APPROVAL")
  .map(([action]) => action as AgentAction);

/** A fully valid proposal + approval pair for any owner-approval action. */
function validPair(action: AgentAction) {
  const type = ACTION_TARGET_TYPES[action as keyof typeof ACTION_TARGET_TYPES]![0]!;
  const target = { type, id: "t_1" };
  return { proposed: proposal({ action, target }), approved: approval({ action, target }) };
}

describe("agent action policy: default deny", () => {
  it("denies unknown actions, including spelling variants and prototype keys", () => {
    for (const action of ["DELETE_EVERYTHING", "send_quotation", " SEND_QUOTATION", "SEND_QUOTATION ", "SEND_QUOTATION\u0000", "toString", "constructor", "__proto__", ""]) {
      expect(policyFor(action), JSON.stringify(action)).toBe("FORBIDDEN");
      expect(isKnownAction(action), JSON.stringify(action)).toBe(false);
      // Even a perfectly formed approval cannot authorise an action the policy does not know.
      expect(canExecute({ action, target: QUOTE_A, payloadHash: HASH }, approval({ action })), JSON.stringify(action)).toBe(false);
    }
  });

  it("lets the agent read and DRAFT on its own — including drafting a message — but not send one", () => {
    for (const action of ["SEARCH_CATALOGUE", "RECORD_REQUIREMENT", "CREATE_QUOTATION_DRAFT", "DRAFT_CUSTOMER_MESSAGE", "SUMMARISE_LEAD"]) {
      expect(policyFor(action)).toBe("AUTONOMOUS");
      expect(canExecute({ action })).toBe(true);
    }
    expect(policyFor("SEND_CUSTOMER_MESSAGE")).toBe("OWNER_APPROVAL");
    // The old autonomous "ask the customer a question" tool let free text reach a customer with no approval.
    expect(isKnownAction("ASK_CUSTOMER_CLARIFYING_QUESTION")).toBe(false);
    expect(canExecute({ action: "ASK_CUSTOMER_CLARIFYING_QUESTION" })).toBe(false);
  });

  it("never lets the agent move money, even with a fully valid-looking approval", () => {
    for (const action of ["MOVE_MONEY", "REFUND_PAYMENT", "CHANGE_PAYMENT_DETAILS", "EDIT_ADMIN_USERS"]) {
      expect(policyFor(action)).toBe("FORBIDDEN");
      expect(canExecute({ action, target: QUOTE_A, payloadHash: HASH }, approval({ action }))).toBe(false);
    }
  });
});

describe("owner-approval actions", () => {
  it.each(approvalActions)("%s needs an approved record — and succeeds with a complete, matching one", (action) => {
    const { proposed, approved } = validPair(action);
    expect(canExecute(proposed, undefined, NOW)).toBe(false);
    expect(canExecute(proposed, null, NOW)).toBe(false);
    for (const status of ["PENDING", "REJECTED", "EXPIRED"] as const) {
      expect(canExecute(proposed, { ...approved, status }, NOW), status).toBe(false);
    }
    expect(canExecute(proposed, approved, NOW)).toBe(true);
  });

  it("is bound to the action: an approval for one action never authorises another", () => {
    expect(canExecute(proposal({ action: "CONFIRM_ORDER", target: { type: "ORDER", id: "ord_1" } }), approval(), NOW)).toBe(false);
  });

  it("is bound to the target: approval for quotation A does not cover quotation B, or another record type", () => {
    expect(canExecute(proposal({ target: { type: "QUOTATION", id: "qt_B" } }), approval(), NOW)).toBe(false);
    expect(canExecute(proposal({ target: { type: "ORDER", id: "qt_A" } }), approval(), NOW)).toBe(false);
  });

  it("is bound to the exact payload: changing a price after approval invalidates it", () => {
    const revised = hashPayload({ ...PAYLOAD, total: "900.00" });
    expect(canExecute(proposal({ payloadHash: revised }), approval(), NOW)).toBe(false);
  });

  it("refuses a proposal that does not say what it targets or what it will do", () => {
    expect(canExecute({ action: "SEND_QUOTATION" }, approval(), NOW)).toBe(false);
    expect(canExecute({ action: "SEND_QUOTATION", target: QUOTE_A }, approval(), NOW)).toBe(false);
    expect(canExecute({ action: "SEND_QUOTATION", payloadHash: HASH }, approval(), NOW)).toBe(false);
  });

  it("refuses a target type that makes no sense for the action", () => {
    const wrong = { type: "INVOICE", id: "inv_1" } as const;
    expect(canExecute(proposal({ target: wrong }), approval({ target: wrong }), NOW)).toBe(false);
  });

  it("only counts approvals decided by the OWNER", () => {
    for (const decidedByRole of ["STAFF", null, undefined, "owner", ""] as const) {
      expect(canExecute(proposal(), approval({ decidedByRole: decidedByRole as ApprovalRef["decidedByRole"] }), NOW), String(decidedByRole)).toBe(false);
    }
  });

  it("is single-use: once executed, the same approval cannot be replayed", () => {
    expect(canExecute(proposal(), approval({ executedAt: "2026-10-06T11:00:00Z" }), NOW)).toBe(false);
    expect(canExecute(proposal(), approval({ executedAt: null }), NOW)).toBe(true);
  });
});

describe("approval expiry fails closed", () => {
  it("honours a valid future expiry and rejects expired ones", () => {
    expect(canExecute(proposal(), approval({ expiresAt: "2026-10-06T13:00:00Z" }), NOW)).toBe(true);
    expect(canExecute(proposal(), approval({ expiresAt: "2026-10-06T11:00:00Z" }), NOW)).toBe(false);
    expect(canExecute(proposal(), approval({ expiresAt: "2026-10-06T12:00:00Z" }), NOW)).toBe(false); // exactly now
  });

  it.each([
    ["garbage", "not-a-date"],
    ["empty string", ""],
    ["whitespace", "   "],
    ["Indian DD/MM/YYYY", "25/09/2026"],
    ["no time zone (ambiguous)", "2026-10-07T12:00:00"],
    ["date only", "2026-10-07"],
    ["null", null],
    ["undefined", undefined],
  ])("treats %s as NOT valid — an approval without a clear expiry authorises nothing", (_label, expiresAt) => {
    expect(canExecute(proposal(), approval({ expiresAt: expiresAt as string | null | undefined }), NOW)).toBe(false);
  });

  it("denies when the clock itself is invalid", () => {
    expect(canExecute(proposal(), approval(), new Date("nonsense"))).toBe(false);
  });
});

describe("hashPayload", () => {
  it("is a stable 64-character hex digest regardless of key order", () => {
    expect(HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPayload({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(hashPayload({ b: { d: [1, 2], c: 2 }, a: 1 }));
  });

  it("changes when any value, or the order of a list, changes", () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    expect(hashPayload({ list: [1, 2] })).not.toBe(hashPayload({ list: [2, 1] }));
    expect(hashPayload({ price: "10.00" })).not.toBe(hashPayload({ price: "10.0" }));
  });
});

describe("policy and Prisma schema stay in step", () => {
  it("ApprovalAction enum equals the OWNER_APPROVAL policies", async () => {
    const schema = await readFile("prisma/schema.prisma", "utf8");
    const block = /enum ApprovalAction \{([^}]*)\}/.exec(schema)?.[1] ?? "";
    const inSchema = block.split("\n").map((line) => line.trim()).filter(Boolean).sort();
    expect(inSchema).toEqual([...approvalActions].sort());
  });

  it("ApprovalRequest stores what canExecute checks: payload hash, a mandatory expiry, an execution marker, and a relation per target type", async () => {
    const schema = await readFile("prisma/schema.prisma", "utf8");
    const model = /model ApprovalRequest \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(model).toMatch(/\n\s*payloadHash\s+String\s*(\n|\/\/)/); // required
    expect(model).toMatch(/\n\s*expiresAt\s+DateTime\s*(\n|\/\/)/); // required: not `DateTime?`
    expect(model).toMatch(/\n\s*executedAt\s+DateTime\?/);
    for (const field of ["quotationId", "orderId", "invoiceId", "leadId", "customerId"]) expect(model, field).toMatch(new RegExp(`\\n\\s*${field}\\s+String\\?`));
  });

  it("every action's target types are ones the schema can express", () => {
    const expressible = new Set(["QUOTATION", "ORDER", "INVOICE", "LEAD", "CUSTOMER"]);
    for (const [action, types] of Object.entries(ACTION_TARGET_TYPES)) {
      expect(types.length, action).toBeGreaterThan(0);
      for (const type of types) expect(expressible.has(type), `${action} → ${type}`).toBe(true);
    }
    // ...and every owner-approval action has a target rule.
    expect(Object.keys(ACTION_TARGET_TYPES).sort()).toEqual([...approvalActions].sort());
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

  it("cannot skip stages — the quote cannot become an order without owner approval", () => {
    expect(canTransition("QUOTE_DRAFTED", "ORDER_CONFIRMED")).toBe(false);
    expect(canTransition("QUOTE_DRAFTED", "OWNER_APPROVED")).toBe(true);
    expect(canTransition("ENQUIRY_RECEIVED", "INVOICED")).toBe(false);
  });

  it("lets a draft be revised and sent back, and the repeat-order loop restart", () => {
    expect(canTransition("QUOTE_DRAFTED", "QUOTE_DRAFTED")).toBe(true);
    expect(canTransition("OWNER_APPROVED", "QUOTE_DRAFTED")).toBe(true);
    expect(canTransition("FOLLOW_UP", "ENQUIRY_RECEIVED")).toBe(true);
    expect(nextStages("OWNER_APPROVED")).toEqual(["ORDER_CONFIRMED", "QUOTE_DRAFTED", "CLOSED_LOST"]);
  });

  it("lets a deal be closed as lost up to the owner's approval, but not after an order exists (that needs CANCEL_ORDER approval)", () => {
    for (const id of ["ENQUIRY_RECEIVED", "REQUIREMENT_UNDERSTOOD", "CATALOGUE_CHECKED", "QUANTITY_COLLECTED", "QUOTE_DRAFTED", "OWNER_APPROVED"] as const) {
      expect(canTransition(id, "CLOSED_LOST"), id).toBe(true);
    }
    for (const id of ["ORDER_CONFIRMED", "INVOICED", "PAYMENT_RECEIVED", "DELIVERED", "FOLLOW_UP"] as const) {
      expect(canTransition(id, "CLOSED_LOST"), id).toBe(false);
    }
    expect(nextStages("CLOSED_LOST")).toEqual([]);
    expect(getStage("CLOSED_LOST").requiresOwnerApproval).toBe(false);
  });

  it("names, for every stage that needs the owner, the policy action that approval authorises", () => {
    const expected: Record<string, AgentAction> = {
      OWNER_APPROVED: "SEND_QUOTATION",
      ORDER_CONFIRMED: "CONFIRM_ORDER",
      INVOICED: "ISSUE_INVOICE",
      DELIVERED: "SCHEDULE_DELIVERY",
      FOLLOW_UP: "SEND_CUSTOMER_MESSAGE",
    };
    for (const stage of SALES_STAGES) {
      if (stage.requiresOwnerApproval) {
        expect(stage.approvalAction, stage.id).toBe(expected[stage.id]);
        expect(policyFor(stage.approvalAction!), stage.id).toBe("OWNER_APPROVAL");
        expect(transitionRequiresOwnerApproval(stage.id), stage.id).toBe(true);
      } else {
        expect(stage.approvalAction, stage.id).toBeUndefined();
        expect(transitionRequiresOwnerApproval(stage.id), stage.id).toBe(false);
      }
    }
  });
});
