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

export const AGENT_ACTION_POLICY = Object.freeze({
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
  /** Payments are recorded by staff or reconciled from the payment provider — never by the agent. */
  RECORD_PAYMENT: "FORBIDDEN",
} as const satisfies Record<string, ActionPolicy>);

export type AgentAction = keyof typeof AGENT_ACTION_POLICY;

export function isKnownAction(action: string): action is AgentAction {
  // typeof first: Object.hasOwn would coerce an array or object with toString() into a key.
  return typeof action === "string" && Object.hasOwn(AGENT_ACTION_POLICY, action);
}

/** Policy for an action name. Unknown actions are FORBIDDEN (default deny). */
export function policyFor(action: string): ActionPolicy {
  return isKnownAction(action) ? AGENT_ACTION_POLICY[action] : "FORBIDDEN";
}

/**
 * The kinds of record an approval can be about. Each has a foreign key on the Prisma `ApprovalRequest` model
 * (quotationId, orderId, …); a test reads the schema and fails if the two lists drift apart.
 */
export const APPROVAL_TARGET_TYPES = ["QUOTATION", "ORDER", "INVOICE", "LEAD", "CUSTOMER"] as const;
export type ApprovalTargetType = (typeof APPROVAL_TARGET_TYPES)[number];

export interface ApprovalTarget {
  type: ApprovalTargetType;
  id: string;
}

/** Which record types each owner-approval action may apply to. An approval for the wrong kind of record is void. */
export const ACTION_TARGET_TYPES = Object.freeze({
  PROPOSE_PRICE: ["QUOTATION"],
  APPLY_DISCOUNT: ["QUOTATION"],
  SEND_QUOTATION: ["QUOTATION"],
  CONFIRM_ORDER: ["ORDER"],
  ISSUE_INVOICE: ["INVOICE"],
  REQUEST_PAYMENT: ["INVOICE"],
  SCHEDULE_DELIVERY: ["ORDER"],
  CANCEL_ORDER: ["ORDER"],
  SEND_CUSTOMER_MESSAGE: ["LEAD", "CUSTOMER"],
} as const satisfies Record<string, readonly ApprovalTargetType[]>);
for (const types of Object.values(ACTION_TARGET_TYPES)) Object.freeze(types);

/** Mirrors the Prisma `ApprovalStatus` enum (checked by a test). */
export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Mirrors the Prisma `AdminRole` enum (checked by a test). Only an OWNER decision authorises anything. */
export const APPROVER_ROLES = ["OWNER", "STAFF"] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];

/** The slice of an `ApprovalRequest` row that the policy needs to see. */
export interface ApprovalRef {
  id: string;
  action: string;
  status: ApprovalStatus;
  /** The record the owner approved the action FOR. */
  target: ApprovalTarget;
  /** `hashPayload()` of the exact change the owner reviewed. */
  payloadHash: string;
  /**
   * The decider's role AT THE TIME OF THE DECISION (snapshotted on the row, not read from the user's current role —
   * promoting a staff member later must not turn their old decisions into owner decisions). Only OWNER counts.
   */
  decidedByRole: ApproverRole | null | undefined;
  /** ISO 8601 with an explicit offset (e.g. 2026-10-07T12:00:00Z). Mandatory: no valid expiry, no authority. */
  expiresAt: string | null | undefined;
  /**
   * When the approved action was carried out; `null` ONLY if it has not been. An approval authorises ONE execution.
   * Required on purpose: a mapper that forgets the field must not look like "never used".
   */
  executedAt: string | null;
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

/**
 * How far ahead an approval's expiry may be. Approvals are meant to be acted on within days; without a ceiling a
 * request filed with `9999-12-31` would be a permanent licence. Set `expiresAt` on the server when the request is
 * created (never from agent input) and keep it inside this window.
 */
export const MAX_APPROVAL_WINDOW_DAYS = 30;
const MAX_APPROVAL_WINDOW_MS = MAX_APPROVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const SHA256_HEX = /^[0-9a-f]{64}$/;

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/**
 * Parses an ISO 8601 date-time with an explicit offset, or returns NaN. `Date.parse` accepts 2027-02-30 and rolls it
 * to 2 March, so the calendar date is checked by round-tripping it.
 */
function parseExpiry(text: string): number {
  if (!ISO_WITH_OFFSET.test(text)) return Number.NaN;
  const [year, month, day] = [Number(text.slice(0, 4)), Number(text.slice(5, 7)), Number(text.slice(8, 10))];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return Number.NaN;
  return Date.parse(text);
}

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
 *      • it has a valid, explicit expiry that is still in the future and not further away than
 *        MAX_APPROVAL_WINDOW_DAYS.
 *
 *  `payloadHash` must be the hash of the payload the executor is ABOUT to run, computed by the executor itself
 *  from the stored `ApprovalRequest.payload` (see `payloadMatchesHash`) — never a value supplied by the model.
 *  This function compares hashes; it cannot know whether the caller computed its hash honestly.
 */
export function canExecute(proposed: ProposedAction, approval?: ApprovalRef | null, now: Date = new Date()): boolean {
  if (typeof proposed?.action !== "string") return false;
  const policy = policyFor(proposed.action);
  if (policy === "AUTONOMOUS") return true;
  if (policy === "FORBIDDEN") return false;

  const { action, target, payloadHash } = proposed;
  if (!target || !isNonEmptyString(target.id) || !isNonEmptyString(target.type)) return false;
  if (!isNonEmptyString(payloadHash) || !SHA256_HEX.test(payloadHash)) return false;
  if (!isTargetAllowed(action, target.type)) return false;

  if (!approval || approval.status !== "APPROVED" || approval.action !== action) return false;
  if (approval.target?.type !== target.type || approval.target?.id !== target.id) return false;
  if (approval.payloadHash !== payloadHash) return false;
  if (approval.decidedByRole !== "OWNER") return false;
  // `null` is the only value that means "not executed yet"; undefined, "" or anything else = unknown = no.
  if (approval.executedAt !== null) return false;

  if (!(now instanceof Date)) return false;
  const current = now.getTime();
  const expires = typeof approval.expiresAt === "string" ? parseExpiry(approval.expiresAt.trim()) : Number.NaN;
  return Number.isFinite(expires) && Number.isFinite(current) && expires > current && expires - current <= MAX_APPROVAL_WINDOW_MS;
}
