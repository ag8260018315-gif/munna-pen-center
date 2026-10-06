"use client";

import { ButtonLink } from "@/components/ui/button";
import { useEnquiryList } from "@/lib/client/enquiry-list";
import { quoteNav } from "@/lib/config/navigation";

/** Primary header CTA. Shows how many products are in the visitor's enquiry list. */
export function QuoteCta({ label = "Request Bulk Quote", className, size = "md" }: { label?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const count = useEnquiryList().length;
  return (
    <ButtonLink href={quoteNav.href} variant="primary" size={size} className={className}>
      {label}
      {count > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-brand-950 px-1.5 text-xs font-bold leading-5 text-white">
          {count}
          <span className="sr-only"> products in your enquiry list</span>
        </span>
      )}
    </ButtonLink>
  );
}
