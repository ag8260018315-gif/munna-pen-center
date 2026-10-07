"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/config/navigation";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation with the current page marked (`aria-current`). */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] font-semibold transition-colors",
                active ? "text-brand-800" : "text-muted hover:text-brand-800",
              )}
            >
              {item.label}
              <span
                aria-hidden="true"
                className={cn("absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-accent-500 transition-opacity", active ? "opacity-100" : "opacity-0")}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
