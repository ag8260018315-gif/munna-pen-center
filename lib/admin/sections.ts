/**
 * The admin dashboard's information architecture — one entry per sidebar section.
 *
 * Nothing here is implemented in V1: it is the map for the next phases, so routes, navigation
 * and permissions are decided once. `phase` says which release is expected to deliver it.
 * (Phase 2 = database + authentication, Phase 3 = AI sales agent + WhatsApp, Phase 4 = invoicing + payments.)
 */

export type AdminIcon =
  | "dashboard"
  | "products"
  | "brands"
  | "categories"
  | "inventory"
  | "customers"
  | "leads"
  | "enquiries"
  | "quotes"
  | "orders"
  | "invoices"
  | "payments"
  | "follow-ups"
  | "ai"
  | "settings";

export interface AdminSection {
  /** URL segment under /admin. The dashboard is `/admin` itself. */
  slug: string;
  label: string;
  icon: AdminIcon;
  summary: string;
  /** Prisma models this section will read and write. */
  entities: readonly string[];
  phase: 2 | 3 | 4;
  /** True once the screens exist. */
  available: boolean;
  /** What must exist first. */
  requires: readonly string[];
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    slug: "dashboard",
    available: true,
    label: "Dashboard",
    icon: "dashboard",
    summary: "Today's enquiries, quotations awaiting approval, open follow-ups and orders in progress.",
    entities: ["Enquiry", "Quotation", "ApprovalRequest", "FollowUp", "Order"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "products",
    available: true,
    label: "Products",
    icon: "products",
    summary: "Add, edit, deactivate and publish products: SKU, brand, category, unit, pack size, purchase / wholesale / retail price, GST rate, HSN code, stock, minimum order quantity and image.",
    entities: ["Product"],
    phase: 2,
    requires: ["Database", "Admin sign-in", "Image storage"],
  },
  {
    slug: "brands",
    available: true,
    label: "Brands",
    icon: "brands",
    summary: "Add and edit the brands you supply (kept separate from products), and choose which are shown on the website.",
    entities: ["Brand"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "categories",
    available: true,
    label: "Categories",
    icon: "categories",
    summary: "Manage product categories, their order and their SEO titles and descriptions.",
    entities: ["Category"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "inventory",
    available: true,
    label: "Inventory",
    icon: "inventory",
    summary: "Update stock quantities per product. Leave a box blank if you do not track stock for that product. No stock is shown publicly.",
    entities: ["Product"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "customers",
    available: true,
    label: "Customers",
    icon: "customers",
    summary: "Organisations the business has quoted or sold to: contacts, GSTIN, addresses and history.",
    entities: ["Customer"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "leads",
    available: false,
    label: "Leads",
    icon: "leads",
    summary: "People who have enquired but not yet been quoted, with status, owner and notes.",
    entities: ["Lead"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "enquiries",
    available: true,
    label: "Enquiries",
    icon: "enquiries",
    summary: "Every bulk enquiry, quote request and contact message, from the website, WhatsApp, phone or the AI agent.",
    entities: ["Enquiry", "EnquiryItem"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "quotes",
    available: true,
    label: "Quotes",
    icon: "quotes",
    summary: "Draft, price, approve and send wholesale quotations. Prices are always entered or approved by the owner.",
    entities: ["Quotation", "QuotationItem", "ApprovalRequest"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "orders",
    available: false,
    label: "Orders",
    icon: "orders",
    summary: "Confirmed orders from accepted quotations: processing, dispatch, transport details and delivery.",
    entities: ["Order", "OrderItem"],
    phase: 4,
    requires: ["Quotations", "Owner approval workflow"],
  },
  {
    slug: "invoices",
    available: false,
    label: "Invoices",
    icon: "invoices",
    summary: "GST invoices generated from orders, issued only after owner approval.",
    entities: ["Invoice", "InvoiceItem"],
    phase: 4,
    requires: ["Orders", "GSTIN and invoice-series details from the business", "GST / e-invoice provider (optional)"],
  },
  {
    slug: "payments",
    available: false,
    label: "Payments",
    icon: "payments",
    summary: "Record and reconcile payments against invoices. The AI agent never records or moves money.",
    entities: ["Payment"],
    phase: 4,
    requires: ["Invoices", "Payment method decisions"],
  },
  {
    slug: "follow-ups",
    available: false,
    label: "Follow-ups",
    icon: "follow-ups",
    summary: "Reminders to call, message or chase payments, and repeat-order prompts.",
    entities: ["FollowUp"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
  {
    slug: "ai-sales-agent",
    available: false,
    label: "AI Sales Agent",
    icon: "ai",
    summary: "Agent conversations, drafts waiting for review, and the approval queue where the owner decides on commercial actions.",
    entities: ["ApprovalRequest", "Quotation (DRAFT)", "Enquiry"],
    phase: 3,
    requires: ["Database", "WhatsApp Business API", "AI provider key", "Owner approval workflow"],
  },
  {
    slug: "settings",
    available: false,
    label: "Settings",
    icon: "settings",
    summary: "Business details, GST information, invoice numbering, staff accounts and integrations.",
    entities: ["AdminUser"],
    phase: 2,
    requires: ["Database", "Admin sign-in"],
  },
];

export function adminHref(section: Pick<AdminSection, "slug">): string {
  return section.slug === "dashboard" ? "/admin" : `/admin/${section.slug}`;
}

export function getAdminSection(slug: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((section) => section.slug === slug);
}
