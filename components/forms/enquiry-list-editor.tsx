"use client";

import { ClipboardList, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { enquiryList, useEnquiryList } from "@/lib/client/enquiry-list";

/**
 * Products the visitor chose with "Add to Enquiry", with an optional quantity each.
 * Submitted with the form as repeated `itemSlug` / `itemQuantity` fields.
 */
export function EnquiryListEditor({ preselect }: { preselect?: { slug: string; name: string } }) {
  const items = useEnquiryList();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  // Arriving from a product's "Request Quote" button: make sure that product is on the list.
  useEffect(() => {
    if (preselect) enquiryList.add(preselect);
  }, [preselect]);

  return (
    <fieldset ref={fieldsetRef} tabIndex={-1} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <legend className="flex items-center gap-2 px-2 text-sm font-bold text-brand-900">
        <ClipboardList className="size-4 text-brand-600" aria-hidden="true" />
        Your enquiry list{items.length > 0 ? ` (${items.length})` : ""}
      </legend>

      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          No products added yet. <Link href="/products" className="font-semibold text-brand-700 underline underline-offset-2">Browse products</Link> and
          choose <strong className="text-ink">Add to Enquiry</strong>, or just describe what you need in the form below.
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.slug} className="grid gap-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-[1fr_13.5rem_auto] sm:items-center sm:gap-3">
              <span className="font-semibold text-ink">{item.name}</span>
              <input type="hidden" name="itemSlug" value={item.slug} />
              <div>
                <label htmlFor={`qty-${item.slug}`} className="sr-only">
                  Quantity for {item.name}
                </label>
                <input
                  id={`qty-${item.slug}`}
                  name="itemQuantity"
                  type="text"
                  value={item.quantity}
                  maxLength={100}
                  onChange={(event) => enquiryList.setQuantity(item.slug, event.target.value)}
                  placeholder="Qty, e.g. 20 boxes"
                  autoComplete="off"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base placeholder:text-slate-500 hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  enquiryList.remove(item.slug);
                  // The focused Remove button is about to disappear: park focus on the list so it is not lost to <body>.
                  fieldsetRef.current?.focus();
                }}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove<span className="sr-only"> {item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
