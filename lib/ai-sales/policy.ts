/**
 * Agent action policy — what an AI sales agent may do on its own, and what needs the owner.
 *
 * Principles
 *  1. DEFAULT DENY: an action that is not listed here is forbidden.
 *  2. The agent may READ and DRAFT freely (search the catalogue, ask questions, prepare a quotation draft).
 *  3. Anything that commits the business — setting a price or discount, sending a quotation, confirming an
 *     order, issuing an invoice, requesting payment, scheduling delivery, messaging a customer about
 *     commercial terms — requires an approved ApprovalRequest from the owner.
 *  4. The agent can never move money or change payment details. Those are forbidden outright.
 *
 * The runtime that executes agent actions MUST call `canExecute` and refuse when it returns false.
 */

export type ActionPolicy = "AUTONOMOUS" | "OWNER_APPROVAL" | "FORBIDDEN";

export const AGENT_ACTION_POLICY = {
  // Read / draft — no commercial effect.
  SEARCH_CATALOGUE: "AUTONOMOUS",
  ASK_CUSTOMER_CLARIFYING_QUESTION: "AUTONOMOUS",
  RECORD_REQUIREMENT: "AUTONOMOUS",
  CREATE_QUOTATION_DRAFT: "AUTONOMOUS",
  DRAFT_FOLLOW_UP_MESSAGE: "AUTONOMOUS",
  SUMMARISE_LEAD: "AUTONOMOUS",

  // Commercial commitments — the owner must approve each one.
  PROPOSE_PRICE: "OWNER_APPROVAL",
  APPLY_DISCOUNT: "OWNER_APPROVAL",
  SEND_QUOTATION: "OWNER_APPROVAL",
  CONFIRM_ORDER: "OWNER_APPROVAL",
  ISSUE_INVOICE: "OWNER_APPROVAL",
  REQUEST_PAYMENT: "OWNER_APPROVAL",
  SCHEDULE_DELIVERY: "OWNER_APPROVAL",
  CANCEL_ORDER: "OWNER_APPROVAL",
  SEND_CUSTOMER_MESSAGE: "OWNER_APPROVAL",

  // Never autonomous, never delegable to the agent.
  MOVE_MONEY: "FORBIDDEN",
  REFUND_PAYMENT: "FORBIDDEN",
  CHANGE_PAYMENT_DETAILS: "FORBIDDEN",
  EDIT_ADMIN_USERS: "FORBIDDEN",
} as const satisfies Record<string, ActionPolicy>;

export type AgentAction = keyof typeof AGENT_ACTION_POLICY;

export function isKnownAction(action: string): action is AgentAction {
  return Object.hasOwn(AGENT_ACTION_POLICY, action);
}

/** Policy for an action name. Unknown actions are FORBIDDEN (default deny). */
export function policyFor(action: string): ActionPolicy {
  return isKnownAction(action) ? AGENT_ACTION_POLICY[action] : "FORBIDDEN";
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

/** The slice of an ApprovalRequest the policy needs to see. */
export interface ApprovalRef {
  action: string;
  status: ApprovalStatus;
  /** ISO timestamp after which the approval no longer counts. */
  expiresAt?: string | null;
}

/**
 * May the agent execute `action` right now?
 *  - AUTONOMOUS    → yes.
 *  - OWNER_APPROVAL→ only with an APPROVED, unexpired approval for that exact action.
 *  - FORBIDDEN     → never.
 */
export function canExecute(action: string, approval?: ApprovalRef | null, now: Date = new Date()): boolean {
  const policy = policyFor(action);
  if (policy === "AUTONOMOUS") return true;
  if (policy === "FORBIDDEN") return false;

  if (!approval || approval.action !== action || approval.status !== "APPROVED") return false;
  if (approval.expiresAt && new Date(approval.expiresAt).getTime() <= now.getTime()) return false;
  return true;
}
