import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function Backlink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" /> {children}
    </Link>
  );
}
