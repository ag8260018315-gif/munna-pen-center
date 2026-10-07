import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/app/actions/admin-auth";
import { requireAdmin } from "@/lib/auth/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[17.5rem_1fr]">
      <aside className="on-dark bg-brand-950 px-4 py-5 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <Link href="/admin" aria-label="Munna Pen Center admin dashboard">
          <Logo tone="dark" compact />
        </Link>
        <details className="mt-5 lg:hidden">
          <summary className="cursor-pointer rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white">Sections</summary>
          <div className="mt-2">
            <AdminNav />
          </div>
        </details>
        <div className="mt-6 hidden lg:block">
          <AdminNav />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-4 py-3 sm:px-8">
          <p className="text-sm font-semibold text-muted">{session.isPreview ? "Signed in as development preview" : `${session.name} · ${session.email}`}</p>
          {session.isPreview ? (
            <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">Preview · not available in production</span>
          ) : (
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                Sign out
              </button>
            </form>
          )}
        </header>
        <main className="px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
