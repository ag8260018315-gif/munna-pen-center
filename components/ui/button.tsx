import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "whatsapp" | "ghost" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform,border-color] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-60";

const variants: Record<Variant, string> = {
  // Strong contrast CTA: amber with indigo-black text (≈8:1).
  primary: "bg-accent-500 text-brand-950 shadow-sm hover:bg-accent-400 hover:shadow-md",
  // Outlined indigo.
  secondary: "border border-brand-200 bg-white text-brand-800 hover:border-brand-400 hover:bg-brand-50",
  whatsapp: "bg-whatsapp text-white shadow-sm hover:bg-whatsapp-dark",
  ghost: "text-brand-800 hover:bg-brand-50",
  // For use on dark/indigo surfaces.
  light: "border border-white/30 bg-white/10 text-white hover:bg-white/20",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

export function buttonStyles({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

/** Internal navigation. */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
  return (
    <Link href={href} className={buttonStyles({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}

/** External or `tel:` / `wa.me` links — plain anchors, no client routing. */
export function ExternalButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
  const isHttp = href.startsWith("http");
  return (
    <a
      href={href}
      className={buttonStyles({ variant, size, className })}
      {...(isHttp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}

export function Button({
  variant,
  size,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button type={type} className={buttonStyles({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}
