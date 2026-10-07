# AI sales agent — design

**Status: not implemented.** Version 1 contains only the foundations: the pipeline definition, the action policy, the approval table in the schema, and the repository/service seams the agent will call. This document is the plan for building on them.

## 1. The pipeline

```
Customer enquiry
      ↓
AI understands requirement          ← AI may do
      ↓
Checks product catalogue            ← AI may do
      ↓
Collects quantity                   ← AI may do
      ↓
Creates quotation DRAFT             ← AI may do
      ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  OWNER APPROVAL               ┃   ← the owner decides; nothing leaves the building without it
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
      ↓
Order confirmation        (owner approval)
      ↓
Invoice                   (owner approval)
      ↓
Payment                   (recorded by staff / payment provider — never the agent)
      ↓
Delivery                  (owner approval for commitments)
      ↓
Follow-up / repeat order  (AI drafts; owner approves sending)
```

Defined as data in `lib/ai-sales/workflow.ts` (stages, who acts, which need approval, which exist today) with `canTransition()` so stages can’t be skipped — e.g. a quotation cannot go from `QUOTE_DRAFTED` straight to `ORDER_CONFIRMED`. A draft can be revised (`QUOTE_DRAFTED → QUOTE_DRAFTED`), a deal can be closed as lost any time before an order exists (`CLOSED_LOST` — including after a quotation went out and the customer declined; it is final, and a customer who comes back raises a new enquiry), and a follow-up can restart the loop for a repeat order. Once an order exists it cannot be “closed” by a stage move: cancelling it is the owner-approved `CANCEL_ORDER` action. Every stage that needs the owner names the policy action its approval authorises (`approvalAction`). `canTransition(from, to, actor)` also stops the AI agent entering a stage that is not its own work — it cannot record a payment, take the owner’s decisions or close a deal. Entering a gated stage records the owner’s decision; the gated action itself (sending the quotation, confirming the order…) is what consumes the approval. Today only `ENQUIRY_RECEIVED` is implemented (the web forms).

## 2. What the agent may and may not do

`lib/ai-sales/policy.ts` is the single source of truth.

| Policy | Actions | Meaning |
| --- | --- | --- |
| **AUTONOMOUS** | search catalogue · record requirement · create quotation **draft** · **draft** a message to a customer · summarise a lead | Read and draft only. Nothing leaves the system and nothing is committed. |
| **OWNER_APPROVAL** | propose price · apply discount · send quotation · confirm order · issue invoice · request payment · schedule delivery · cancel order · **send any message to a customer** | Every one needs an approval that is bound to that exact action, record and content (see below). |
| **FORBIDDEN** | move money · refund · change payment details · record a payment · edit admin users | Never, with or without “approval”. Payments are recorded by staff or reconciled from the payment provider. |
| *(anything unlisted)* | — | **Denied by default.** |

> **Why drafting is autonomous but sending is not.** The gate sees only an action's *name*, not what the words say. A "clarifying question" tool that sends free text could carry a price or a delivery promise with no approval. So the agent drafts customer messages (`DRAFT_CUSTOMER_MESSAGE`) and sending any of them (`SEND_CUSTOMER_MESSAGE`) is the owner's call. Once the owner has seen real conversations, Phase 3 may add a narrow, explicit tier — e.g. owner-approved message *templates* for routine questions — as its own named policy; it must not be added by making free-text sending autonomous.

`canExecute(proposed, approval?, now?)` is the gate. The agent runtime must call it before running any tool and refuse on `false`. For an owner-approval action it returns `true` only if **all** of these hold, and any doubt means no:

1. the proposal names its **target record** (quotation / order / invoice / lead / customer — and that type is valid for the action) and the **hash of its exact content** (`hashPayload()` — recipient, lines, prices, totals, dates, message text). The executor computes that hash itself from the payload stored on the `ApprovalRequest` (`payloadMatchesHash`), never from a value the model supplies; `canExecute` compares hashes and cannot tell whether a caller computed its own honestly. `hashPayload` refuses anything it could silently flatten (a `Map`, a class instance, `undefined`, `NaN`, an invalid date) and hashes dates and decimals by their JSON text, so two different payloads can never share a hash;
2. the approval is `APPROVED`, for the **same action**, the **same record** and the **same content hash** — so an approval for quotation A does not cover quotation B, and changing a price or a word after approval voids it;
3. it was decided by the **owner** (not staff, not the agent) — judged by the role **recorded at the moment of decision** (`decidedByRole`), not the person’s role today;
4. it has **not already been executed**: `executedAt` must be exactly `null` (a missing, empty or mistyped field is “unknown”, which is no) — one approval, one execution. The executor must set `executedAt` in the same database transaction as the action itself, so a retry or a replay cannot use it twice;
5. it carries a **valid, explicit expiry** (ISO 8601 with a time-zone offset, naming a date that exists — `2027-02-30` is refused, not rolled to 2 March) that is still in the future **and no more than 30 days away**, so a request filed with `9999-12-31` is not a permanent licence. A missing, empty, garbled or ambiguous expiry (`"25/09/2026"`, no zone, date only) authorises nothing — the gate fails closed. Set `expiresAt` on the server when the request is created, never from agent input.

`FORBIDDEN` and unknown actions are denied whatever approval is presented. Inputs that are not what they claim to be (an array standing in for an action name, an empty record id, a look-alike object for the clock) are denied rather than coerced, and the policy tables are frozen at runtime. This is covered by tests that attack each rule (wrong record, changed price or date, staff approval, replay, bad expiry, spelling variants such as `send_quotation`).

### Pricing

The agent **never decides a price**. Prices come only from (a) an owner-maintained price list entered in the admin, or (b) the owner typing/approving a figure. A quotation draft with missing prices stays a draft and raises an `ApprovalRequest` (`PROPOSE_PRICE`) rather than guessing — which is why `QuotationItem.unitPrice`, `gstRatePercent` and `lineTotal` (and the quotation totals) are **nullable** in the schema: “not priced yet” must be representable without writing `0` (which would look like “free”) or inventing a GST rate. A quotation cannot leave `DRAFT` while any line is unpriced (a database trigger in the first migration — a plain `CHECK` cannot look across tables). Because `CREATE_QUOTATION_DRAFT` is autonomous and the gate sees only an action’s name, each line records **who set its price** (`priceSetBy`) and, for a price the agent filled in, the approved `PROPOSE_PRICE` request that covers it (`priceApprovalId`); an agent-set price without that approval is only a proposal. Discounts, special rates and credit terms are always owner decisions.

## 3. Proposed runtime

```
WhatsApp customer ──▶ Meta webhook ──▶ app/api/whatsapp/route.ts   (verifies signature + WHATSAPP_WEBHOOK_VERIFY_TOKEN)
Website chat / voice ─────────────────▶ conversation service
                                              │
                                              ▼
                              Agent loop (LLM, key = AI_API_KEY, server-side only)
                                              │ tool calls
                  ┌───────────────┬───────────┴────────────┬──────────────────┐
                  ▼               ▼                        ▼                  ▼
          search_catalogue   record_requirement   create_quotation_draft   request_approval
          (CatalogueRepo)    (enquiry service)    (quotation service)      (ApprovalRequest, PENDING)
                  │               │                        │                  │
                  └───────────────┴──────── every call passes canExecute() ───┘
                                              │
                                              ▼
                            Owner approves in the admin “AI Sales Agent” queue (a WhatsApp reply counts
                            only if it names the approval id and what it covers) ──▶ executor performs the approved action
                                              │
                                              ▼
                                  audit log (who/what/when/why)
```

### Guardrails to build in

1. **Default deny** and the policy gate above, enforced in code — not in the prompt.
2. **Customer text is data, not instructions.** Messages are passed to the model as untrusted content; tools take typed, validated arguments (zod), and tool results never contain secrets.
3. **Approval is bound to a payload.** `ApprovalRequest.payload` (mandatory) stores exactly what will run; the executor re-hashes *that* and runs *that*, not whatever the model says afterwards. The owner’s approval screen is rendered from the payload (or its `summary` is generated from it on the server) — a summary written by the agent is not evidence of what will run. A bare “yes” is ambiguous while several requests are pending, so a chat reply approves only a request it names. Approvals expire, and are used once.
4. **Idempotency & rate limits** per conversation and per customer, so a loop or a hostile user cannot spam quotes or messages.
5. **Full audit trail** — add an `AgentRun` / `AgentAction` log table in Phase 3 recording the prompt version, tool calls, results and the approval used.
6. **Human takeover** — the owner can pause the agent on any conversation; low confidence, complaints, large values and anything off-catalogue escalate instead of improvising.
7. **Shadow → draft-only → assisted rollout.** Run the agent invisibly first, compare with what the owner would have done, then let it draft for review, and only then let it message customers (with approval on commercial content).
8. **Data minimisation** — only what the task needs goes to the model provider; no payment or bank details, ever.

## 4. What the agent needs that doesn’t exist yet

| Needed | Why | Phase |
| --- | --- | --- |
| Database + admin sign-in | Persist conversations, drafts, approvals | 2 |
| Confirmed product list, brands, pack sizes | The catalogue the agent checks | 2 (owner input) |
| Owner price list / pricing rules | Source of prices | 3 (owner input) |
| WhatsApp Business Platform account + approved templates | Two-way automated messaging | 3 |
| LLM provider key | `AI_API_KEY` | 3 |
| GSTIN, invoice series, tax rates | Invoices | 4 (owner input) |
| Payment method decisions | Payment links / reconciliation | 4 |

## 5. Voice receptionist (later)

Same agent, different channel: the telephony provider streams speech-to-text into the conversation service and speaks the replies. The policy is identical — a voice call can collect a requirement and create a draft, but cannot confirm prices, orders or payments without the owner.
