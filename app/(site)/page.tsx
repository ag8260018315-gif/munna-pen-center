import { Audiences } from "@/components/home/audiences";
import { CategoriesGrid } from "@/components/home/categories-grid";
import { CtaBand } from "@/components/home/cta-band";
import { Delivery } from "@/components/home/delivery";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { WhyUs } from "@/components/home/why-us";
import { getCatalogue } from "@/lib/repositories";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Wholesale Stationery Supplier in Dhanbad | Munna Pen Center",
  absoluteTitle: true,
  description:
    "Munna Pen Center is a wholesale stationery and office supplies supplier in Dhanbad, Jharkhand, serving schools, offices, engineers and retailers across India. Request a bulk quote.",
  path: "/",
});

export default async function HomePage() {
  const categories = await getCatalogue().listCategories();
  return (
    <>
      <Hero />
      <Audiences />
      <CategoriesGrid categories={categories} />
      <HowItWorks />
      <Delivery />
      <WhyUs />
      <CtaBand />
    </>
  );
}
