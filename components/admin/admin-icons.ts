import {
  Bell,
  BookUser,
  Bot,
  Boxes,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Inbox,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { AdminIcon } from "@/lib/admin/sections";

/**
 * Section icons. Kept out of admin-nav.tsx on purpose: that file is a Client Component, and a
 * Server Component that imports a plain value (like this map) from a client module receives an
 * opaque reference instead of the object.
 */
export const ADMIN_ICONS: Record<AdminIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Package,
  categories: Tags,
  inventory: Boxes,
  customers: BookUser,
  leads: ClipboardList,
  enquiries: Inbox,
  quotes: FileText,
  orders: ShoppingCart,
  invoices: FileSpreadsheet,
  payments: CreditCard,
  "follow-ups": Bell,
  ai: Bot,
  settings: Settings,
};
