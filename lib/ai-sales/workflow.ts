/**
 * The B2B sales pipeline the AI sales agent will eventually help run.
 *
 *   Customer enquiry → AI understands requirement → checks catalogue → collects quantity
 *   → creates quotation DRAFT → OWNER APPROVAL → order confirmation → invoice → payment
 *   → delivery → follow-up / repeat order
 *
 * This is plain data + pure functions, so the pipeline and its approval gates are
 * explicit, testable and shared by the admin dashboard, the agent and the docs.
 * V1 implements only the first stage (the web enquiry forms).
 */

import type { AgentAction } from "@/lib/ai-sales/policy";

export type Actor = "CUSTOMER" | "AI_AGENT" | "OWNER" | "SYSTEM";

export type SalesStageId =
  | "ENQUIRY_RECEIVED"
  | "REQUIREMENT_UNDERSTOOD"
  | "CATALOGUE_CHECKED"
  | "QUANTITY_COLLECTED"
  | "QUOTE_DRAFTED"
  | "OWNER_APPROVED"
  | "ORDER_CONFIRMED"
  | "INVOICED"
  | "PAYMENT_RECEIVED"
  | "DELIVERED"
  | "FOLLOW_UP"
  /** Terminal: the deal is not going ahead. Reachable only before an order exists. */
  | "CLOSED_LOST";

export interface SalesStage {
  id: SalesStageId;
  label: string;
  /** Who performs the work in this stage. */
  actor: Actor;
  /** Entering this stage is a commercial commitment: the owner must approve it first. */
  requiresOwnerApproval: boolean;
  /** The policy action an owner approval for entering this stage authorises (present iff `requiresOwnerApproval`). */
  approvalAction?: AgentAction;
  /** Whether this stage exists in the current version of the product. */
  implemented: boolean;
  /** Where the work is recorded (see prisma/schema.prisma). */
  entity: string;
}

export const SALES_STAGES: readonly SalesStage[] = [
  { id: "ENQUIRY_RECEIVED", label: "Customer enquiry", actor: "CUSTOMER", requiresOwnerApproval: false, implemented: true, entity: "Lead + Enquiry" },
  { id: "REQUIREMENT_UNDERSTOOD", label: "AI understands requirement", actor: "AI_AGENT", requiresOwnerApproval: false, implemented: false, entity: "Enquiry + EnquiryItem" },
  { id: "CATALOGUE_CHECKED", label: "Checks product catalogue", actor: "AI_AGENT", requiresOwnerApproval: false, implemented: false, entity: "Product" },
  { id: "QUANTITY_COLLECTED", label: "Collects quantity", actor: "AI_AGENT", requiresOwnerApproval: false, implemented: false, entity: "EnquiryItem" },
  { id: "QUOTE_DRAFTED", label: "Creates quotation draft", actor: "AI_AGENT", requiresOwnerApproval: false, implemented: false, entity: "Quotation (DRAFT)" },
  { id: "OWNER_APPROVED", label: "Owner approval", actor: "OWNER", requiresOwnerApproval: true, approvalAction: "SEND_QUOTATION", implemented: false, entity: "ApprovalRequest" },
  { id: "ORDER_CONFIRMED", label: "Order confirmation", actor: "OWNER", requiresOwnerApproval: true, approvalAction: "CONFIRM_ORDER", implemented: false, entity: "Order" },
  { id: "INVOICED", label: "Invoice", actor: "OWNER", requiresOwnerApproval: true, approvalAction: "ISSUE_INVOICE", implemented: false, entity: "Invoice" },
  { id: "PAYMENT_RECEIVED", label: "Payment", actor: "SYSTEM", requiresOwnerApproval: false, implemented: false, entity: "Payment" },
  { id: "DELIVERED", label: "Delivery", actor: "OWNER", requiresOwnerApproval: true, approvalAction: "SCHEDULE_DELIVERY", implemented: false, entity: "Order" },
  { id: "FOLLOW_UP", label: "Follow-up / repeat order", actor: "AI_AGENT", requiresOwnerApproval: true, approvalAction: "SEND_CUSTOMER_MESSAGE", implemented: false, entity: "FollowUp" },
];

/** Terminal stage, kept out of SALES_STAGES (the happy path) so the dashboard pipeline stays the agreed 11 steps. */
const CLOSED_STAGE: SalesStage = {
  id: "CLOSED_LOST",
  label: "Closed — not proceeding",
  actor: "OWNER",
  requiresOwnerApproval: false,
  implemented: false,
  entity: "Lead / Enquiry status",
};

const STAGE_BY_ID = new Map<SalesStageId, SalesStage>([...SALES_STAGES, CLOSED_STAGE].map((stage) => [stage.id, stage]));

/**
 * Allowed moves between stages. Mostly linear, with deliberate exceptions:
 *  - a draft can be revised (QUOTE_DRAFTED → QUOTE_DRAFTED) and the owner can send it back for revision,
 *  - a deal can be closed as lost any time up to the owner's approval of the quotation,
 *  - once an order exists it cannot be "closed" by a stage move — cancelling an order is the owner-approved
 *    CANCEL_ORDER action, not a pipeline shortcut,
 *  - a follow-up can start a new enquiry (repeat order).
 * Anything not listed is not allowed.
 *
 * OWNER_APPROVED stands for "the owner approved sending this quotation": the quotation's own status
 * (SENT → ACCEPTED) tracks the customer's reply before ORDER_CONFIRMED.
 */
const TRANSITIONS: Record<SalesStageId, readonly SalesStageId[]> = {
  ENQUIRY_RECEIVED: ["REQUIREMENT_UNDERSTOOD", "CLOSED_LOST"],
  REQUIREMENT_UNDERSTOOD: ["CATALOGUE_CHECKED", "CLOSED_LOST"],
  CATALOGUE_CHECKED: ["QUANTITY_COLLECTED", "REQUIREMENT_UNDERSTOOD", "CLOSED_LOST"],
  QUANTITY_COLLECTED: ["QUOTE_DRAFTED", "CLOSED_LOST"],
  QUOTE_DRAFTED: ["OWNER_APPROVED", "QUOTE_DRAFTED", "CLOSED_LOST"],
  OWNER_APPROVED: ["ORDER_CONFIRMED", "QUOTE_DRAFTED", "CLOSED_LOST"],
  ORDER_CONFIRMED: ["INVOICED"],
  INVOICED: ["PAYMENT_RECEIVED"],
  PAYMENT_RECEIVED: ["DELIVERED"],
  DELIVERED: ["FOLLOW_UP"],
  FOLLOW_UP: ["ENQUIRY_RECEIVED"],
  CLOSED_LOST: [],
};

export function getStage(id: SalesStageId): SalesStage {
  const stage = STAGE_BY_ID.get(id);
  if (!stage) throw new Error(`Unknown sales stage: ${id}`);
  return stage;
}

export function nextStages(from: SalesStageId): readonly SalesStageId[] {
  return TRANSITIONS[from];
}

export function canTransition(from: SalesStageId, to: SalesStageId): boolean {
  return TRANSITIONS[from].includes(to);
}

/** True when moving INTO `to` needs an approved ApprovalRequest from the owner. */
export function transitionRequiresOwnerApproval(to: SalesStageId): boolean {
  return getStage(to).requiresOwnerApproval;
}
