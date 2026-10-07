import { Audiences } from "@/components/home/audiences";
import { BrandsSection } from "@/components/home/brands-section";
import { CategoriesGrid } from "@/components/home/categories-grid";
import { CtaBand } from "@/components/home/cta-band";
import { Delivery } from "@/components/home/delivery";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { WhyUs } from "@/components/home/why-us";
import { pageSeo } from "@/content/seo";
import { getCatalogue } from "@/lib/repositories";
import { pageMetadata } from "@/lib/seo";

/** Re-generate at most every 5 minutes, so products the owner edits in the admin appear without a redeploy. */
export const revalidate = 300;

export const metadata = pageMetadata({ ...pageSeo.home, absoluteTitle: true, path: "/" });

export default async function HomePage() {
  const catalogue = getCatalogue();
  const [categories, brands] = await Promise.all([catalogue.listCategories(), catalogue.listBrands()]);
  return (
    <>
      <Hero />
      <Audiences />
      <CategoriesGrid categories={categories.slice(0, 10)} />
      <BrandsSection brands={brands} />
      <HowItWorks />
      <Delivery />
      <WhyUs />
      <CtaBand />
    </>
  );
}
