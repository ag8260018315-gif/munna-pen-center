"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { ExternalButtonLink } from "@/components/ui/button";
import { QuoteCta } from "@/components/layout/quote-cta";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/config/navigation";

export function MobileMenu({ items, whatsappUrl }: { items: NavItem[]; whatsappUrl: string }) {
  const pathname = usePathname();
  // Remember the page the menu was opened on: navigating elsewhere closes it, no effect needed.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpenOn(open ? null : pathname)}
        className="grid size-11 place-items-center rounded-lg border border-line bg-white text-brand-900 transition-colors hover:bg-brand-50"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-b border-line bg-white shadow-lift"
      >
        <nav aria-label="Mobile" className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <ul className="grid gap-1">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-3 text-base font-semibold",
                      active ? "bg-brand-50 text-brand-800" : "text-ink hover:bg-surface",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid gap-3 border-t border-line pt-4">
            <QuoteCta size="lg" className="w-full" />
            <ExternalButtonLink href={whatsappUrl} variant="whatsapp" size="lg" className="w-full">
              <WhatsAppIcon className="size-5" />
              WhatsApp Us
            </ExternalButtonLink>
          </div>
        </nav>
      </div>
    </div>
  );
}
