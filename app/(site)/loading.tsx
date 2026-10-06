import { Container } from "@/components/ui/section";

export default function Loading() {
  return (
    <Container className="py-16" aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="skeleton h-10 w-2/3 max-w-xl rounded-lg" />
      <div className="skeleton mt-5 h-5 w-1/2 max-w-md rounded-lg" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-64 rounded-2xl" />
        ))}
      </div>
    </Container>
  );
}
