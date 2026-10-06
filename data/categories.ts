import type { Category } from "@/lib/domain/types";

/**
 * Product categories. In V1 these are static; once the database is connected they
 * move to the `Category` table and are managed from the admin dashboard.
 *
 * Copy here is deliberately generic — it describes the kinds of products a
 * stationery wholesaler supplies, not specific brands, stock or prices.
 */
export const categories: Category[] = [
  {
    id: "pens",
    slug: "pens",
    name: "Pens",
    summary: "Ball, gel and fountain pens, markers and highlighters for everyday writing.",
    description:
      "Writing instruments for schools, offices and institutions — ball pens, gel pens, fountain pens, markers and highlighters. Share your required type, colours and quantity and we will respond with a wholesale quotation.",
    seoTitle: "Wholesale Pens Supplier in India – Ball, Gel & Marker Pens",
    seoDescription:
      "Buy pens in bulk from Munna Pen Center, Dhanbad. Ball pens, gel pens, markers and highlighters for schools, offices and retailers across India. Request a wholesale quote.",
    sortOrder: 1,
  },
  {
    id: "pencils",
    slug: "pencils",
    name: "Pencils",
    summary: "Graphite and colour pencils, mechanical pencils, erasers and sharpeners.",
    description:
      "Pencils and related accessories for classrooms, drawing and drafting — graphite pencils, colour pencils, mechanical pencils with leads, erasers and sharpeners — available for bulk requirements.",
    seoTitle: "Wholesale Pencils & Erasers – Bulk Supply Across India",
    seoDescription:
      "Graphite pencils, colour pencils, mechanical pencils, erasers and sharpeners in bulk from Munna Pen Center, Dhanbad, Jharkhand. Request a wholesale quote.",
    sortOrder: 2,
  },
  {
    id: "school-supplies",
    slug: "school-supplies",
    name: "School Supplies",
    summary: "Notebooks, geometry boxes, pencil boxes and everyday classroom essentials.",
    description:
      "Classroom and student essentials for schools, coaching institutes and educational organisations — notebooks, geometry boxes, pencil boxes, colouring sets, rulers and adhesives. Ideal for term-start and institutional bulk requirements.",
    seoTitle: "School Stationery Wholesale – Bulk Supply for Schools in India",
    seoDescription:
      "School stationery wholesale from Munna Pen Center, Dhanbad: notebooks, geometry boxes, pencil boxes and classroom essentials for schools and institutions across India.",
    sortOrder: 3,
  },
  {
    id: "office-supplies",
    slug: "office-supplies",
    name: "Office Supplies",
    summary: "Staplers, clips, tapes, sticky notes and desk essentials for offices.",
    description:
      "Everyday office stationery for businesses, institutions and administrative departments — staplers and pins, clips, sticky notes, tapes, scissors, stamp pads and desk organisers — supplied in bulk.",
    seoTitle: "Office Stationery Supplier – Bulk Office Supplies in India",
    seoDescription:
      "Office stationery supplier in Dhanbad, Jharkhand. Staplers, clips, sticky notes, tapes and desk essentials for offices and businesses across India. Request a bulk quote.",
    sortOrder: 4,
  },
  {
    id: "engineering-supplies",
    slug: "engineering-supplies",
    name: "Engineering Supplies",
    summary: "Drafting instruments, drawing sheets, set squares and technical drawing tools.",
    description:
      "Drawing and drafting supplies for engineering students, professionals and technical institutions — drawing instrument boxes, drawing sheets and graph paper, set squares, protractors and technical pens.",
    seoTitle: "Engineering Stationery Supplier – Drafting & Drawing Supplies",
    seoDescription:
      "Engineering stationery supplier in Dhanbad, Jharkhand: drafting instruments, drawing sheets, set squares and technical drawing supplies in bulk. Request a wholesale quote.",
    sortOrder: 5,
  },
  {
    id: "calculators",
    slug: "calculators",
    name: "Calculators",
    summary: "Basic, scientific and desktop calculators for study and office use.",
    description:
      "Calculators for students, engineers, accountants and offices — basic, scientific and desktop models. Tell us the type and quantity you need and we will confirm availability and wholesale pricing.",
    seoTitle: "Wholesale Calculators – Scientific, Basic & Desktop | Bulk Supply",
    seoDescription:
      "Buy calculators in bulk from Munna Pen Center, Dhanbad. Basic, scientific and desktop calculators for schools, engineers and offices across India.",
    sortOrder: 6,
  },
  {
    id: "writing-drawing-supplies",
    slug: "writing-drawing-supplies",
    name: "Writing & Drawing Supplies",
    summary: "Sketch pens, colours, brushes, sketchbooks and art and craft materials.",
    description:
      "Creative and drawing materials for schools, art classes and institutions — sketch pens, water colours, poster colours, oil pastels, brushes and sketchbooks.",
    seoTitle: "Writing & Drawing Supplies Wholesale – Art & Craft Materials",
    seoDescription:
      "Sketch pens, colours, brushes, sketchbooks and art supplies in bulk from Munna Pen Center, Dhanbad. Wholesale supply for schools and institutions across India.",
    sortOrder: 7,
  },
  {
    id: "files-folders",
    slug: "files-folders",
    name: "Files & Folders",
    summary: "Box files, ring binders, document folders and pocket files.",
    description:
      "Document organisation for offices, institutions and businesses — box files, ring binders, clear pocket files, document folders and file dividers.",
    seoTitle: "Office Files & Folders Wholesale – Bulk Supply in India",
    seoDescription:
      "Box files, ring binders, document folders and pocket files in bulk from Munna Pen Center, Dhanbad, Jharkhand. Request a wholesale quote for your office or institution.",
    sortOrder: 8,
  },
  {
    id: "paper-registers",
    slug: "paper-registers",
    name: "Paper & Registers",
    summary: "Copier paper, registers, ledgers, notepads and envelopes.",
    description:
      "Paper products for offices, schools and businesses — copier paper, registers, ledgers and account books, notepads and memo pads, and envelopes.",
    seoTitle: "Paper & Registers Wholesale – Copier Paper, Ledgers, Notepads",
    seoDescription:
      "Copier paper, registers, ledgers, notepads and envelopes in bulk from Munna Pen Center, Dhanbad. Wholesale paper supply for offices and institutions across India.",
    sortOrder: 9,
  },
  {
    id: "other-stationery",
    slug: "other-stationery",
    name: "Other Stationery",
    summary: "Labels, correction products, ID card holders and more.",
    description:
      "Other stationery and office essentials that don't fit the categories above. If you can't find what you need, tell us — we will confirm whether we can supply it.",
    seoTitle: "Other Stationery Supplies – Labels, Correction Fluid & More",
    seoDescription:
      "Labels, correction products, ID card holders and other stationery in bulk from Munna Pen Center, Dhanbad. Ask us for any stationery requirement.",
    sortOrder: 10,
  },
];
