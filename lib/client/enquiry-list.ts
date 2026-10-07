"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's "enquiry list" — products they have chosen with "Add to Enquiry".
 *
 * It is a tiny external store persisted in localStorage (no account, no server
 * round-trip, no state library). It becomes the product lines on the quote form.
 * localStorage may be unavailable (private mode, blocked storage): everything
 * still works for the current page view, it just isn't remembered.
 */

export interface EnquiryListItem {
  slug: string;
  name: string;
  /** Free text the visitor types, e.g. "10 boxes". */
  quantity: string;
}

const STORAGE_KEY = "mpc:enquiry-list:v1";
const MAX_ITEMS = 50;
const EMPTY: EnquiryListItem[] = [];

let snapshot: EnquiryListItem[] | null = null;
const listeners = new Set<() => void>();

function sanitise(value: unknown): EnquiryListItem[] {
  if (!Array.isArray(value)) return EMPTY;
  return value
    .filter((item): item is EnquiryListItem => typeof item?.slug === "string" && typeof item?.name === "string")
    .slice(0, MAX_ITEMS)
    .map((item) => ({ slug: item.slug, name: item.name, quantity: typeof item.quantity === "string" ? item.quantity : "" }));
}

function readStorage(): EnquiryListItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitise(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): EnquiryListItem[] {
  snapshot ??= readStorage();
  return snapshot;
}

function getServerSnapshot(): EnquiryListItem[] {
  return EMPTY;
}

function commit(next: EnquiryListItem[]) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — keep the in-memory list for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      snapshot = null; // another tab changed it — re-read
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const enquiryList = {
  add(item: Pick<EnquiryListItem, "slug" | "name">) {
    const current = getSnapshot();
    if (current.some((existing) => existing.slug === item.slug) || current.length >= MAX_ITEMS) return;
    commit([...current, { ...item, quantity: "" }]);
  },
  remove(slug: string) {
    commit(getSnapshot().filter((item) => item.slug !== slug));
  },
  setQuantity(slug: string, quantity: string) {
    commit(getSnapshot().map((item) => (item.slug === slug ? { ...item, quantity: quantity.slice(0, 100) } : item)));
  },
  clear() {
    commit(EMPTY);
  },
};

export function useEnquiryList(): EnquiryListItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
