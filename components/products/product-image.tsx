import Image from "next/image";
import { CategoryIcon } from "@/components/products/category-icon";
import { cn } from "@/lib/cn";
import type { ProductWithCategory } from "@/lib/domain/types";

/**
 * Product image with a neutral placeholder.
 *
 * To use a real photo, put the file in /public/images/products/ and set `imageUrl` /
 * `imageAlt` on the product (see data/products.ts). Until then a category icon on a
 * soft tile is shown — no fake stock photography.
 */
export function ProductImage({
  product,
  className,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
}: {
  product: Pick<ProductWithCategory, "name" | "imageUrl" | "imageAlt" | "category">;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (product.imageUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-brand-50", className)}>
        <Image
          src={product.imageUrl}
          alt={product.imageAlt ?? product.name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain p-4"
        />
      </div>
    );
  }

  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-brand-50", className)} aria-hidden="true">
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="relative grid size-20 place-items-center rounded-2xl bg-white text-brand-600 shadow-card sm:size-24">
        <CategoryIcon slug={product.category.slug} className="size-9 sm:size-11" />
      </div>
    </div>
  );
}
