"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { ExternalButtonLink } from "@/components/ui/button";
import { QuoteCta } from "@/components/layout/quote-cta";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/config/navigation";

export function MobileMenu({ items, whatsappUrl }: { items: NavItem[]; whatsappUrl: string }) {
  const pathname = usePathname();
  // Remember the page the menu was opened on. Navigating elsewhere must CLOSE it for good (not merely hide it:
  // otherwise Back would find `openOn === pathname` again and pop it open), so state is reset during render —
  // React's documented way to adjust state when a value (here the path) changes, no effect needed.
  const [openOn, setOpenOn] = useState<string | null>(null);
  if (openOn !== null && openOn !== pathname) setOpenOn(null);
  const open = openOn === pathname;
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Hand focus back to the toggle if it was inside the menu, so keyboard users keep their place.
      const focusWasInMenu = containerRef.current?.contains(document.activeElement) ?? false;
      setOpenOn(null);
      if (focusWasInMenu) toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="lg:hidden">
      <button
        ref={toggleRef}
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
        <nav
          aria-label="Mobile"
          className="mx-auto max-w-7xl px-4 py-4 sm:px-6"
          // Any link in the menu (pages, Request Bulk Quote, WhatsApp) closes it — including when it points at the
          // page we are already on, where the path does not change.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpenOn(null);
          }}
        >
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
