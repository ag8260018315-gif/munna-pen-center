"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ADMIN_ICONS } from "@/components/admin/admin-icons";
import { ADMIN_SECTIONS, adminHref } from "@/lib/admin/sections";

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections">
      <ul className="grid gap-1">
        {ADMIN_SECTIONS.map((section) => {
          const href = adminHref(section);
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          const Icon = ADMIN_ICONS[section.icon];
          return (
            <li key={section.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  active ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                {section.label}
                {!section.available && <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand-100">Soon</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
