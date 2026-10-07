import { StorageUnavailableError } from "@/lib/repositories/types";

/**
 * Rejects with `StorageUnavailableError` if `promise` has not settled within `ms`.
 *
 * A hung store (stalled network disk, database connection that never answers) must not leave a
 * customer staring at a spinner: after the timeout they get the WhatsApp fallback instead. The
 * underlying write is not cancelled, so a late success can produce a duplicate enquiry — which is
 * the safe side to err on, compared with losing one.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StorageUnavailableError(`Storage did not respond within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
