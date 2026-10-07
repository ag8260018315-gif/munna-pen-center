/**
 * Agent action policy — what an AI sales agent may do on its own, and what needs the owner.
 *
 * Principles
 *  1. DEFAULT DENY: an action that is not listed here is forbidden (spelling variants included).
 *  2. The agent may READ and DRAFT freely: search the catalogue, record a requirement, prepare a quotation
 *     draft, DRAFT a message. Nothing it does autonomously leaves the building or commits the business.
 *  3. Anything that commits the business, or sends words to a customer — setting a price or discount, sending
 *     a quotation, confirming an order, issuing an invoice, requesting payment, scheduling delivery, ANY
 *     message to a customer — requires an approval from the owner that is BOUND to that exact action, record
 *     and content (see `canExecute`).
 *  4. The agent can never move money or change payment details. Those are forbidden outright.
 *
 * The runtime that executes agent actions MUST call `canExecute` and refuse when it returns false, and it
 * MUST mark the approval as executed (`executedAt`) in the same database transaction as the action itself
 * (compare-and-set), so an approval can never be used twice.
 *
 * Phase 3 may add a narrow, explicit tier — for example owner-approved message TEMPLATES for routine
 * clarifying questions — as its own named policy. It must not be smuggled in by making a free-text send
 * autonomous: the gate only sees the action's name, not what the words say.
 */

export type ActionPolicy = "AUTONOMOUS" | "OWNER_APPROVAL" | "FORBIDDEN";

export const AGENT_ACTION_POLICY = {
  // Read / draft — nothing leaves the system and nothing is committed.
  SEARCH_CATALOGUE: "AUTONOMOUS",
  RECORD_REQUIREMENT: "AUTONOMOUS",
  CREATE_QUOTATION_DRAFT: "AUTONOMOUS",
  DRAFT_CUSTOMER_MESSAGE: "AUTONOMOUS",
  SUMMARISE_LEAD: "AUTONOMOUS",

  // Commercial commitments and anything sent to a customer — the owner must approve each one.
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

/** The kinds of record an approval can be about. Each has a foreign key on the Prisma `ApprovalRequest` model. */
export type ApprovalTargetType = "QUOTATION" | "ORDER" | "INVOICE" | "LEAD" | "CUSTOMER";

export interface ApprovalTarget {
  type: ApprovalTargetType;
  id: string;
}

/** Which record types each owner-approval action may apply to. An approval for the wrong kind of record is void. */
export const ACTION_TARGET_TYPES = {
  PROPOSE_PRICE: ["QUOTATION"],
  APPLY_DISCOUNT: ["QUOTATION"],
  SEND_QUOTATION: ["QUOTATION"],
  CONFIRM_ORDER: ["ORDER"],
  ISSUE_INVOICE: ["INVOICE"],
  REQUEST_PAYMENT: ["INVOICE"],
  SCHEDULE_DELIVERY: ["ORDER"],
  CANCEL_ORDER: ["ORDER"],
  SEND_CUSTOMER_MESSAGE: ["LEAD", "CUSTOMER"],
} as const satisfies Record<string, readonly ApprovalTargetType[]>;

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

/** The slice of an `ApprovalRequest` row that the policy needs to see. */
export interface ApprovalRef {
  id: string;
  action: string;
  status: ApprovalStatus;
  /** The record the owner approved the action FOR. */
  target: ApprovalTarget;
  /** `hashPayload()` of the exact change the owner reviewed. */
  payloadHash: string;
  /** Role of the admin who decided. Only OWNER decisions count. */
  decidedByRole: "OWNER" | "STAFF" | null | undefined;
  /** ISO 8601 with an explicit offset (e.g. 2026-10-07T12:00:00Z). Mandatory: no valid expiry, no authority. */
  expiresAt: string | null | undefined;
  /** Set once the approved action has been carried out. An approval authorises ONE execution. */
  executedAt?: string | null;
}

/** What the agent is about to do. */
export interface ProposedAction {
  action: string;
  /** Required for owner-approval actions. */
  target?: ApprovalTarget;
  /** Required for owner-approval actions: `hashPayload()` of the exact change about to be made. */
  payloadHash?: string;
}

/** ISO 8601 date-time WITH an explicit offset. Anything ambiguous (no zone, date only, DD/MM/YYYY) is rejected. */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isTargetAllowed(action: string, type: ApprovalTargetType): boolean {
  const allowed: readonly string[] | undefined = Object.hasOwn(ACTION_TARGET_TYPES, action)
    ? ACTION_TARGET_TYPES[action as keyof typeof ACTION_TARGET_TYPES]
    : undefined;
  return allowed?.includes(type) ?? false;
}

/**
 * May the agent execute `proposed` right now?
 *
 *  - AUTONOMOUS     → yes (read / draft only).
 *  - FORBIDDEN      → never, whatever approval is presented. Unknown actions are FORBIDDEN.
 *  - OWNER_APPROVAL → only if ALL of these hold; any doubt means no:
 *      • the proposal names its target record and the hash of its exact content,
 *      • the approval is APPROVED, for the same action, the same record, and the same content hash
 *        (so changing a price or the wording after approval voids it),
 *      • the record type is valid for that action,
 *      • it was decided by the OWNER (not staff, not the agent),
 *      • it has NOT already been executed (single use),
 *      • it has a valid, explicit expiry that is still in the future.
 */
export function canExecute(proposed: ProposedAction, approval?: ApprovalRef | null, now: Date = new Date()): boolean {
  const policy = policyFor(proposed.action);
  if (policy === "AUTONOMOUS") return true;
  if (policy === "FORBIDDEN") return false;

  const { action, target, payloadHash } = proposed;
  if (!target || !payloadHash || !isTargetAllowed(action, target.type)) return false;

  if (!approval || approval.status !== "APPROVED" || approval.action !== action) return false;
  if (approval.target?.type !== target.type || approval.target?.id !== target.id) return false;
  if (approval.payloadHash !== payloadHash) return false;
  if (approval.decidedByRole !== "OWNER") return false;
  if (approval.executedAt) return false;

  const expiresAt = typeof approval.expiresAt === "string" ? approval.expiresAt.trim() : "";
  const expires = ISO_WITH_OFFSET.test(expiresAt) ? Date.parse(expiresAt) : Number.NaN;
  const current = now.getTime();
  return Number.isFinite(expires) && Number.isFinite(current) && expires > current;
}
