import type { Product } from "@/lib/domain/types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER CATALOGUE — OWNER TO CONFIRM BEFORE LAUNCH
 * ─────────────────────────────────────────────────────────────────────────────
 * These entries are generic *product types* for each category. They are NOT an
 * inventory list: there are no brands, SKUs, prices or stock figures, and pack
 * sizes are intentionally blank (the UI shows "Pack sizes on request").
 *
 * To make this real:
 *   • Edit / remove / add entries below (V1), or
 *   • Move them into the database and manage them from the admin dashboard (V2).
 *
 * To add a product image, drop a file in /public/images/products/ and set
 * `imageUrl: "/images/products/<file>.jpg"` and `imageAlt: "…"`.
 * Products without an image render a neutral category placeholder.
 */

type ProductInput = {
  slug: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  packInfo?: string;
  imageUrl?: string;
  imageAlt?: string;
  tags?: string[];
  isFeatured?: boolean;
};

const product = (input: ProductInput): Product => ({
  id: input.slug,
  slug: input.slug,
  name: input.name,
  categoryId: input.categoryId,
  shortDescription: input.shortDescription,
  packInfo: input.packInfo,
  imageUrl: input.imageUrl,
  imageAlt: input.imageAlt,
  tags: input.tags ?? [],
  status: "ACTIVE",
  isFeatured: input.isFeatured ?? false,
});

export const products: Product[] = [
  /* ------------------------------------------------------------------ Pens */
  product({
    slug: "ball-pens",
    name: "Ball Pens",
    categoryId: "pens",
    shortDescription: "Everyday ball point pens for schools, offices and institutions.",
    tags: ["ballpoint", "ball point", "writing"],
    isFeatured: true,
  }),
  product({
    slug: "gel-pens",
    name: "Gel Pens",
    categoryId: "pens",
    shortDescription: "Smooth-writing gel pens in common ink colours.",
    tags: ["gel", "writing"],
    isFeatured: true,
  }),
  product({
    slug: "fountain-pens-and-ink",
    name: "Fountain Pens & Ink",
    categoryId: "pens",
    shortDescription: "Fountain pens with ink bottles and cartridges.",
    tags: ["ink", "cartridge", "calligraphy"],
  }),
  product({
    slug: "permanent-markers",
    name: "Permanent Markers",
    categoryId: "pens",
    shortDescription: "Permanent markers for labelling, packaging and general marking.",
    tags: ["marker", "labelling"],
  }),
  product({
    slug: "whiteboard-markers",
    name: "Whiteboard Markers",
    categoryId: "pens",
    shortDescription: "Dry-erase markers for classrooms, training rooms and offices.",
    tags: ["marker", "board", "classroom"],
  }),
  product({
    slug: "highlighters",
    name: "Highlighters",
    categoryId: "pens",
    shortDescription: "Highlighter pens for study material and documents.",
    tags: ["highlight", "marker"],
  }),

  /* --------------------------------------------------------------- Pencils */
  product({
    slug: "graphite-pencils",
    name: "Graphite Pencils",
    categoryId: "pencils",
    shortDescription: "Standard writing and drawing pencils in common grades.",
    tags: ["hb", "lead pencil", "drawing"],
    isFeatured: true,
  }),
  product({
    slug: "colour-pencils",
    name: "Colour Pencils",
    categoryId: "pencils",
    shortDescription: "Colouring pencil sets for schools and art classes.",
    tags: ["color pencils", "coloring", "art"],
  }),
  product({
    slug: "mechanical-pencils-and-leads",
    name: "Mechanical Pencils & Leads",
    categoryId: "pencils",
    shortDescription: "Mechanical pencils with refill leads for writing and drafting.",
    tags: ["clutch pencil", "refill", "drafting"],
  }),
  product({
    slug: "erasers-and-sharpeners",
    name: "Erasers & Sharpeners",
    categoryId: "pencils",
    shortDescription: "Erasers and pencil sharpeners for classroom and office use.",
    tags: ["rubber", "eraser", "sharpener"],
  }),

  /* ------------------------------------------------------- School supplies */
  product({
    slug: "school-notebooks",
    name: "School Notebooks",
    categoryId: "school-supplies",
    shortDescription: "Ruled and plain notebooks for classroom use.",
    tags: ["copy", "exercise book", "notebook"],
    isFeatured: true,
  }),
  product({
    slug: "geometry-boxes",
    name: "Geometry Boxes",
    categoryId: "school-supplies",
    shortDescription: "Geometry instrument boxes for school mathematics.",
    tags: ["compass", "divider", "protractor", "math"],
  }),
  product({
    slug: "pencil-boxes-and-pouches",
    name: "Pencil Boxes & Pouches",
    categoryId: "school-supplies",
    shortDescription: "Pencil boxes and pouches for students.",
    tags: ["pouch", "case"],
  }),
  product({
    slug: "crayons-and-colouring-sets",
    name: "Crayons & Colouring Sets",
    categoryId: "school-supplies",
    shortDescription: "Crayons and colouring sets for younger students.",
    tags: ["crayon", "colour", "kids"],
  }),
  product({
    slug: "rulers-and-scales",
    name: "Rulers & Scales",
    categoryId: "school-supplies",
    shortDescription: "Plastic, wooden and steel rulers and scales.",
    tags: ["ruler", "scale", "measure"],
  }),
  product({
    slug: "glue-and-adhesives",
    name: "Glue & Adhesives",
    categoryId: "school-supplies",
    shortDescription: "Glue sticks, liquid glue and paste for classroom and craft use.",
    tags: ["gum", "paste", "glue stick"],
  }),

  /* ------------------------------------------------------- Office supplies */
  product({
    slug: "staplers-and-staple-pins",
    name: "Staplers & Staple Pins",
    categoryId: "office-supplies",
    shortDescription: "Staplers with matching staple pins for office use.",
    tags: ["stapler", "pins", "stapling"],
    isFeatured: true,
  }),
  product({
    slug: "paper-clips-and-binder-clips",
    name: "Paper Clips & Binder Clips",
    categoryId: "office-supplies",
    shortDescription: "Paper clips and binder clips for document handling.",
    tags: ["clip", "u clip", "document"],
  }),
  product({
    slug: "sticky-notes",
    name: "Sticky Notes",
    categoryId: "office-supplies",
    shortDescription: "Self-adhesive notes and page markers.",
    tags: ["post-it", "memo", "flags"],
  }),
  product({
    slug: "tapes-and-dispensers",
    name: "Tapes & Dispensers",
    categoryId: "office-supplies",
    shortDescription: "Adhesive tapes for office and packing use, with dispensers.",
    tags: ["cello tape", "double sided", "packing tape"],
  }),
  product({
    slug: "scissors-and-cutters",
    name: "Scissors & Cutters",
    categoryId: "office-supplies",
    shortDescription: "Office scissors and paper cutters.",
    tags: ["scissor", "cutter", "blade"],
  }),
  product({
    slug: "stamp-pads-and-ink",
    name: "Stamp Pads & Ink",
    categoryId: "office-supplies",
    shortDescription: "Stamp pads and refill ink for office stamps.",
    tags: ["stamp", "ink pad", "seal"],
  }),
  product({
    slug: "desk-organisers",
    name: "Desk Organisers",
    categoryId: "office-supplies",
    shortDescription: "Pen stands, trays and organisers for office desks.",
    tags: ["pen stand", "tray", "desk"],
  }),

  /* ---------------------------------------------------- Engineering supplies */
  product({
    slug: "drawing-instrument-boxes",
    name: "Drawing Instrument Boxes",
    categoryId: "engineering-supplies",
    shortDescription: "Drafting and drawing instrument sets for engineering students.",
    tags: ["drafting", "compass", "divider", "engineering drawing"],
    isFeatured: true,
  }),
  product({
    slug: "drawing-sheets-and-graph-paper",
    name: "Drawing Sheets & Graph Paper",
    categoryId: "engineering-supplies",
    shortDescription: "Drawing sheets and graph paper for technical and engineering work.",
    tags: ["drawing paper", "graph", "a3", "a2", "sheet"],
  }),
  product({
    slug: "set-squares-and-protractors",
    name: "Set Squares & Protractors",
    categoryId: "engineering-supplies",
    shortDescription: "Set squares, protractors and scales for technical drawing.",
    tags: ["set square", "protractor", "scale", "t-square"],
  }),
  product({
    slug: "technical-drawing-pens",
    name: "Technical Drawing Pens",
    categoryId: "engineering-supplies",
    shortDescription: "Fine-line technical pens for drafting and drawing.",
    tags: ["fineliner", "drafting", "technical pen"],
  }),

  /* ------------------------------------------------------------ Calculators */
  product({
    slug: "basic-calculators",
    name: "Basic Calculators",
    categoryId: "calculators",
    shortDescription: "Simple calculators for everyday arithmetic.",
    tags: ["pocket calculator", "arithmetic"],
  }),
  product({
    slug: "scientific-calculators",
    name: "Scientific Calculators",
    categoryId: "calculators",
    shortDescription: "Scientific calculators for students and engineers.",
    tags: ["engineering", "exam", "functions"],
    isFeatured: true,
  }),
  product({
    slug: "desktop-calculators",
    name: "Desktop Calculators",
    categoryId: "calculators",
    shortDescription: "Large-display desktop calculators for offices and accounts.",
    tags: ["office calculator", "accounts", "12 digit"],
  }),

  /* ------------------------------------------------ Writing & drawing supplies */
  product({
    slug: "sketch-pens",
    name: "Sketch Pens",
    categoryId: "writing-drawing-supplies",
    shortDescription: "Sketch pen sets for colouring and drawing.",
    tags: ["felt tip", "colour", "art"],
  }),
  product({
    slug: "water-and-poster-colours",
    name: "Water & Poster Colours",
    categoryId: "writing-drawing-supplies",
    shortDescription: "Water colours and poster colours for school and art use.",
    tags: ["paint", "watercolour", "poster colour"],
  }),
  product({
    slug: "oil-pastels",
    name: "Oil Pastels",
    categoryId: "writing-drawing-supplies",
    shortDescription: "Oil pastel sets for drawing and colouring.",
    tags: ["pastel", "crayon", "art"],
  }),
  product({
    slug: "brushes-and-sketchbooks",
    name: "Brushes & Sketchbooks",
    categoryId: "writing-drawing-supplies",
    shortDescription: "Paint brushes and sketchbooks for art classes.",
    tags: ["brush", "drawing book", "art"],
  }),

  /* --------------------------------------------------------- Files & folders */
  product({
    slug: "box-files",
    name: "Box Files",
    categoryId: "files-folders",
    shortDescription: "Box files for storing and archiving documents.",
    tags: ["lever arch", "archive", "document storage"],
  }),
  product({
    slug: "ring-binders",
    name: "Ring Binders",
    categoryId: "files-folders",
    shortDescription: "Ring binders for organising loose documents.",
    tags: ["binder", "d ring", "folder"],
  }),
  product({
    slug: "clear-pocket-files",
    name: "Clear Pocket Files",
    categoryId: "files-folders",
    shortDescription: "Transparent pocket files and sheet protectors.",
    tags: ["plastic file", "sheet protector", "display file"],
  }),
  product({
    slug: "document-folders",
    name: "Document Folders",
    categoryId: "files-folders",
    shortDescription: "Paper and plastic folders for documents and certificates.",
    tags: ["folder", "certificate", "l-folder"],
  }),

  /* -------------------------------------------------------- Paper & registers */
  product({
    slug: "copier-paper",
    name: "Copier Paper",
    categoryId: "paper-registers",
    shortDescription: "Copier and printer paper for office printing and photocopying.",
    tags: ["a4", "a3", "photocopy", "printing paper", "xerox"],
    isFeatured: true,
  }),
  product({
    slug: "registers-and-ledgers",
    name: "Registers & Ledgers",
    categoryId: "paper-registers",
    shortDescription: "Registers, ledgers and account books for record-keeping.",
    tags: ["account book", "register", "ledger", "record"],
  }),
  product({
    slug: "notepads-and-memo-pads",
    name: "Notepads & Memo Pads",
    categoryId: "paper-registers",
    shortDescription: "Notepads and memo pads for offices and meetings.",
    tags: ["pad", "memo", "jotter"],
  }),
  product({
    slug: "envelopes",
    name: "Envelopes",
    categoryId: "paper-registers",
    shortDescription: "Office envelopes in common sizes.",
    tags: ["cover", "mailing", "letter"],
  }),

  /* ----------------------------------------------------------- Other stationery */
  product({
    slug: "correction-fluid-and-pens",
    name: "Correction Fluid & Pens",
    categoryId: "other-stationery",
    shortDescription: "Correction fluid and correction pens.",
    tags: ["whitener", "white out", "tipp-ex"],
  }),
  product({
    slug: "labels-and-stickers",
    name: "Labels & Stickers",
    categoryId: "other-stationery",
    shortDescription: "Labels and stickers for files, packaging and general use.",
    tags: ["label", "sticker", "adhesive"],
  }),
  product({
    slug: "id-card-holders-and-lanyards",
    name: "ID Card Holders & Lanyards",
    categoryId: "other-stationery",
    shortDescription: "ID card holders and lanyards for offices, schools and events.",
    tags: ["badge", "id card", "lanyard"],
  }),
  product({
    slug: "rubber-bands-and-pins",
    name: "Rubber Bands & Pins",
    categoryId: "other-stationery",
    shortDescription: "Rubber bands, drawing pins and push pins.",
    tags: ["band", "board pin", "push pin"],
  }),
];
