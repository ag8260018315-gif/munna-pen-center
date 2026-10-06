"use client";

import { Check, Plus } from "lucide-react";
import { enquiryList, useEnquiryList } from "@/lib/client/enquiry-list";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Adds a product to (or removes it from) the visitor's enquiry list. */
export function AddToEnquiryButton({
  slug,
  name,
  size = "md",
  className,
}: {
  slug: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const items = useEnquiryList();
  const added = items.some((item) => item.slug === slug);

  return (
    <button
      type="button"
      aria-pressed={added}
      onClick={() => (added ? enquiryList.remove(slug) : enquiryList.add({ slug, name }))}
      className={cn(
        buttonStyles({ variant: "secondary", size }),
        added && "border-brand-600 bg-brand-50 text-brand-800",
        className,
      )}
    >
      {added ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
      <span>{added ? "Added to Enquiry" : "Add to Enquiry"}</span>
      <span className="sr-only">{added ? `. ${name} is in your enquiry list. Press to remove.` : `. Adds ${name} to your enquiry list.`}</span>
    </button>
  );
}
