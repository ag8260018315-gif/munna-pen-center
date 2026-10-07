import {
  BookOpen,
  Briefcase,
  Calculator,
  CircleDot,
  DraftingCompass,
  Eraser,
  FileText,
  FolderOpen,
  GraduationCap,
  Highlighter,
  Library,
  NotebookText,
  Palette,
  Paperclip,
  PenLine,
  PenTool,
  Pencil,
  Scroll,
  Shapes,
  Sticker,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  pens: PenLine,
  pencils: Pencil,
  notebooks: NotebookText,
  registers: Library,
  files: FileText,
  folders: FolderOpen,
  calculators: Calculator,
  "school-stationery": GraduationCap,
  "office-stationery": Briefcase,
  "engineering-stationery": DraftingCompass,
  erasers: Eraser,
  sharpeners: CircleDot,
  markers: PenTool,
  highlighters: Highlighter,
  "drawing-supplies": Palette,
  "adhesive-tape": Sticker,
  "cello-tape": Scroll,
  glue: Paperclip,
  "glue-guns": Wrench,
  "glue-sticks": Sticker,
  "paper-products": BookOpen,
  "writing-instruments": PenLine,
  "other-stationery": Shapes,
};

/** Icon for a category slug. Falls back to a neutral shape for categories added later. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? Shapes;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}
