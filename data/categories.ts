import type { Category } from "@/lib/domain/types";

/**
 * Product categories. In V1 these are static; once the database is connected they
 * move to the `Category` table and are managed from the admin dashboard.
 *
 * The category list was supplied by the owner. Copy here is deliberately generic — it describes the
 * kinds of products a stationery wholesaler supplies, not specific brands, stock or prices. Order
 * matters: the first ten are the main categories shown on the home page.
 */
const category = (sortOrder: number, slug: string, name: string, summary: string): Category => ({
  id: slug,
  slug,
  name,
  summary,
  description: `${summary} Share the type, brand preference and quantity you need and we will confirm availability and send a wholesale quotation.`,
  seoTitle: `Wholesale ${name} Supplier`,
  seoDescription: `${summary} Wholesale supply from Dhanbad, Jharkhand across India. Request a quote for your quantity.`,
  sortOrder,
});

export const categories: Category[] = [
  category(1, "pens", "Pens", "Ball, gel and fountain pens for everyday writing."),
  category(2, "pencils", "Pencils", "Pencils for school, office and drawing use."),
  category(3, "notebooks", "Notebooks", "Notebooks for school and office use."),
  category(4, "registers", "Registers", "Registers and ledgers for records and accounts."),
  category(5, "files", "Files", "Files for keeping documents and records in order."),
  category(6, "folders", "Folders", "Folders for organising and carrying documents."),
  category(7, "calculators", "Calculators", "Calculators for school, office and engineering use."),
  category(8, "school-stationery", "School Stationery", "Everyday stationery for schools and students."),
  category(9, "office-stationery", "Office Stationery", "Stationery and supplies for offices."),
  category(10, "engineering-stationery", "Engineering Stationery", "Stationery for engineering students and professionals."),
  category(11, "erasers", "Erasers", "Erasers for pencil work."),
  category(12, "sharpeners", "Sharpeners", "Pencil sharpeners."),
  category(13, "markers", "Markers", "Markers for writing, marking and labelling."),
  category(14, "highlighters", "Highlighters", "Highlighters for marking text."),
  category(15, "drawing-supplies", "Drawing Supplies", "Supplies for drawing and technical sketching."),
  category(16, "adhesive-tape", "Adhesive Tape", "Adhesive tapes for packing and general use."),
  category(17, "cello-tape", "Cello Tape", "Cello tape for office, school and packing use."),
  category(18, "glue", "Glue", "Glues and adhesives for paper and craft work."),
  category(19, "glue-guns", "Glue Guns", "Glue guns for craft, packaging and repair work."),
  category(20, "glue-sticks", "Glue Sticks", "Glue sticks and glue gun sticks."),
  category(21, "paper-products", "Paper Products", "Paper products for writing, printing and records."),
  category(22, "writing-instruments", "Writing Instruments", "Writing instruments for school, office and home."),
  category(23, "other-stationery", "Other Stationery", "Other stationery items — ask us for what you need."),
];
