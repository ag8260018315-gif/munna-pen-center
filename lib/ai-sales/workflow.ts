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
  | "FOLLOW_UP";

export interface SalesStage {
  id: SalesStageId;
  label: string;
  /** Who performs the work in this stage. */
  actor: Actor;
  /** Entering this stage is a commercial commitment: the owner must approve it first. */
  requiresOwnerApproval: boolean;
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
  { id: "OWNER_APPROVED", label: "Owner approval", actor: "OWNER", requiresOwnerApproval: true, implemented: false, entity: "ApprovalRequest" },
  { id: "ORDER_CONFIRMED", label: "Order confirmation", actor: "OWNER", requiresOwnerApproval: true, implemented: false, entity: "Order" },
  { id: "INVOICED", label: "Invoice", actor: "OWNER", requiresOwnerApproval: true, implemented: false, entity: "Invoice" },
  { id: "PAYMENT_RECEIVED", label: "Payment", actor: "SYSTEM", requiresOwnerApproval: false, implemented: false, entity: "Payment" },
  { id: "DELIVERED", label: "Delivery", actor: "OWNER", requiresOwnerApproval: true, implemented: false, entity: "Order" },
  { id: "FOLLOW_UP", label: "Follow-up / repeat order", actor: "AI_AGENT", requiresOwnerApproval: true, implemented: false, entity: "FollowUp" },
];

const STAGE_BY_ID = new Map(SALES_STAGES.map((stage) => [stage.id, stage]));

/**
 * Allowed moves between stages. Mostly linear, with two deliberate loops:
 *  - the owner can send a draft back for revision,
 *  - a follow-up can start a new enquiry (repeat order).
 * Anything not listed is not allowed.
 */
const TRANSITIONS: Record<SalesStageId, readonly SalesStageId[]> = {
  ENQUIRY_RECEIVED: ["REQUIREMENT_UNDERSTOOD"],
  REQUIREMENT_UNDERSTOOD: ["CATALOGUE_CHECKED"],
  CATALOGUE_CHECKED: ["QUANTITY_COLLECTED", "REQUIREMENT_UNDERSTOOD"],
  QUANTITY_COLLECTED: ["QUOTE_DRAFTED"],
  QUOTE_DRAFTED: ["OWNER_APPROVED"],
  OWNER_APPROVED: ["ORDER_CONFIRMED", "QUOTE_DRAFTED"],
  ORDER_CONFIRMED: ["INVOICED"],
  INVOICED: ["PAYMENT_RECEIVED"],
  PAYMENT_RECEIVED: ["DELIVERED"],
  DELIVERED: ["FOLLOW_UP"],
  FOLLOW_UP: ["ENQUIRY_RECEIVED"],
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
