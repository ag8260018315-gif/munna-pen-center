import { Container } from "@/components/ui/section";

export default function ProductsLoading() {
  return (
    <>
      <div className="border-b border-line bg-brand-50">
        <Container className="py-12 sm:py-16">
          <div className="skeleton h-12 w-3/4 max-w-2xl rounded-lg" />
          <div className="skeleton mt-5 h-5 w-1/2 max-w-lg rounded-lg" />
          <div className="skeleton mt-8 h-13 w-full max-w-3xl rounded-xl" />
        </Container>
      </div>
      <Container className="py-12" aria-busy="true">
        <p className="sr-only" role="status">
          Loading products…
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="skeleton aspect-[4/3]" />
              <div className="grid gap-3 p-5">
                <div className="skeleton h-3 w-1/3 rounded" />
                <div className="skeleton h-5 w-2/3 rounded" />
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton mt-3 h-10 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
