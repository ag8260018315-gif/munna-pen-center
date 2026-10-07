export interface NavItem {
  label: string;
  href: string;
}

/** Main navigation (header, mobile menu, footer). */
export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Bulk Orders", href: "/bulk-orders" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** The quotation entry point — shown as the primary CTA button. */
export const quoteNav: NavItem = { label: "Request Quote", href: "/request-quote" };
