import { Logo } from "@/components/brand/logo";

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  );
}
