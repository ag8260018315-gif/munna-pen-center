/**
 * Home-page copy. Edit the wording here — no component changes needed.
 * Keep it factual: no invented history, statistics, customers or certifications.
 */

export const hero = {
  eyebrow: "Wholesale supply · Dhanbad, Jharkhand",
  headline: "Wholesale Stationery & Office Supplies, Delivered Across India",
  description:
    "Munna Pen Center supplies stationery and essential office products for schools, offices, engineers, businesses, institutions and retailers.",
  primaryCta: "Request a Bulk Quote",
  secondaryCta: "Explore Products",
  trustPoints: ["Wholesale Supply", "All India Delivery", "GST Registered", "Bulk Orders Welcome"],
} as const;

export const audiences = {
  eyebrow: "Who we supply",
  title: "Stationery for every kind of buyer",
  description: "One supplier for the pens, paper, files and essentials that your organisation uses every day.",
  items: [
    { icon: "school", name: "Schools", text: "Writing, drawing and classroom essentials for schools and educational institutions." },
    { icon: "office", name: "Offices", text: "Everyday office stationery and desk supplies for teams of any size." },
    { icon: "engineer", name: "Engineers", text: "Drafting instruments, drawing sheets and calculators for technical work." },
    { icon: "business", name: "Businesses", text: "Stationery and paper for shops, firms and companies." },
    { icon: "institution", name: "Institutions", text: "Stationery and office supplies for institutions and organisations." },
    { icon: "retailer", name: "Retailers", text: "Wholesale stock for stationery shops and resellers." },
  ],
} as const;

export const process = {
  eyebrow: "How it works",
  title: "Wholesale ordering, kept simple",
  steps: [
    { title: "Share your requirement", text: "Tell us the products, approximate quantities and your city — through the form or on WhatsApp." },
    { title: "Receive a wholesale quotation", text: "We review your requirement and respond with wholesale pricing and availability." },
    { title: "Confirm your order", text: "Approve the quotation and we confirm your order and invoice." },
    { title: "Supply across India", text: "We arrange delivery to your location. Delivery details are confirmed with your quotation." },
  ],
} as const;

export const delivery = {
  eyebrow: "All India delivery",
  title: "We serve customers across India.",
  description:
    "From our base in Dhanbad, Jharkhand, Munna Pen Center supplies stationery and office products to customers across India.",
  points: [
    "Enquiries welcome from any city, town or district in India",
    "Delivery arrangements and timelines are confirmed with your quotation",
    "Share your city and state with your enquiry so we can plan your delivery",
  ],
  cta: "Ask about delivery to your city",
} as const;

export const why = {
  eyebrow: "Why Munna Pen Center",
  title: "Built for bulk buyers",
  items: [
    { icon: "wholesale", title: "Wholesale first", text: "We focus on bulk and institutional requirements." },
    { icon: "range", title: "Many categories, one supplier", text: "Pens, paper, files, calculators, drawing and office supplies — ask for all of it in a single enquiry." },
    { icon: "quote", title: "Quotation-based pricing", text: "Wholesale prices are shared as a quotation for your requirement, so you see pricing that fits your order." },
    { icon: "support", title: "Direct WhatsApp & phone support", text: "Talk to us directly to confirm products, quantities and delivery." },
  ],
} as const;

export const finalCta = {
  title: "Need stationery in bulk?",
  description: "Send us your requirement and we will respond with a wholesale quotation.",
  primary: "Request Bulk Quote",
  secondary: "WhatsApp Us",
} as const;
