import { cn } from "@/lib/cn";

/**
 * Munna Pen Center brand mark: a fountain-pen nib resting on an ink line,
 * on an indigo tile. Simple, geometric and legible at favicon size.
 * The same artwork lives in /public/brand/logo-mark.svg and app/icon.svg.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill="#2b367a" />
      <path
        d="M23.5 9h17c.6 6.2 6.6 10.4 6.6 18.2 0 7.4-8.7 14.2-15.1 20.3C25.6 41.4 16.9 34.6 16.9 27.2 16.9 19.4 22.9 15.2 23.5 9Z"
        fill="#ffffff"
      />
      <path d="M32 31.5v16" stroke="#2b367a" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="27.4" r="3.4" fill="#2b367a" />
      <rect x="14.5" y="51.5" width="35" height="4.5" rx="2.25" fill="#fbb724" />
    </svg>
  );
}

interface LogoProps {
  /** `light` = for white backgrounds, `dark` = for the indigo footer/hero. */
  tone?: "light" | "dark";
  className?: string;
  /** Hide the descriptor line under the name (e.g. in tight spaces). */
  compact?: boolean;
}

/** Mark + wordmark. The name is real text, so it is selectable, translatable and screen-reader friendly. */
export function Logo({ tone = "light", className, compact = false }: LogoProps) {
  const dark = tone === "dark";
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark className="size-10 sm:size-11" />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-[1.15rem] font-extrabold tracking-tight whitespace-nowrap sm:text-[1.3rem]", dark ? "text-white" : "text-brand-900")}>
          Munna Pen Center
        </span>
        {/* The {" "} gives assistive tech / text extraction a word break between the two lines; flex ignores it visually. */}
        {!compact && (
          <>
            {" "}
            <span className={cn("mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] sm:text-[0.65rem]", dark ? "text-brand-200" : "text-brand-600")}>
              Wholesale Stationery
            </span>
          </>
        )}
      </span>
    </span>
  );
}
