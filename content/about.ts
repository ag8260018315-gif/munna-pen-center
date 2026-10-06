/**
 * About-page copy. Plain text, easy to edit.
 *
 * Only statements the owner has confirmed are included. To make the page richer, fill in the
 * optional fields at the bottom — they render automatically once they have a value:
 *   • `story`        — a short paragraph on how the business started
 *   • `established`  — the year, if you want to show it
 * Do not add facts you cannot stand behind (years in business, customer counts, certifications).
 */

export const about = {
  eyebrow: "About us",
  headline: "A wholesale supplier of stationery and office essentials",
  intro:
    "Munna Pen Center is a wholesale stationery and office-supply supplier based in Dhanbad, Jharkhand. We supply stationery and office essentials to customers and organisations across India.",

  sections: [
    {
      title: "What we supply",
      paragraphs: [
        "We supply the products that schools, offices and businesses use every day — pens, pencils, school and office supplies, engineering and drawing materials, calculators, files and folders, and paper and registers.",
        "If you need something that is not listed on the website, ask us. We will confirm whether we can supply it.",
      ],
    },
    {
      title: "Who we serve",
      paragraphs: [
        "Our customers include schools, offices, engineers, businesses, institutions and retailers. We welcome bulk orders and ongoing supply requirements.",
      ],
    },
    {
      title: "How we work",
      paragraphs: [
        "Wholesale pricing depends on what you need, so we share prices as a quotation. Send us your products and approximate quantities — through the website or on WhatsApp — and we will respond with availability and pricing.",
        "We serve customers across India. Delivery details are confirmed with each quotation.",
      ],
    },
  ],

  /** Optional — shown only when set. */
  story: null as string | null,
  established: null as string | null,
} as const;
