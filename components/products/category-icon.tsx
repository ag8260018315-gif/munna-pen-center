import {
  Briefcase,
  Calculator,
  DraftingCompass,
  FolderOpen,
  GraduationCap,
  NotebookText,
  Palette,
  PenLine,
  Pencil,
  Shapes,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  pens: PenLine,
  pencils: Pencil,
  "school-supplies": GraduationCap,
  "office-supplies": Briefcase,
  "engineering-supplies": DraftingCompass,
  calculators: Calculator,
  "writing-drawing-supplies": Palette,
  "files-folders": FolderOpen,
  "paper-registers": NotebookText,
  "other-stationery": Shapes,
};

/** Icon for a category slug. Falls back to a neutral shape for categories added later. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? Shapes;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}
