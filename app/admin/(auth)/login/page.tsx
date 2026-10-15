import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/auth-forms";
import { getAdminSession } from "@/lib/auth/guard";
import { recoveryEnabled } from "@/lib/auth/recovery";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ created?: string; reset?: string }> }) {
  if (!isDatabaseConfigured()) notFound();
  if (await getAdminSession()) redirect("/admin");
  const { created, reset } = await searchParams;
  const canRecover = recoveryEnabled(getServerEnv().ADMIN_SETUP_TOKEN);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Admin sign in</h1>
      {created === "1" && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-900">
          Owner account created. Sign in below.
        </p>
      )}
      {reset === "1" && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-900">
          Password changed. Sign in with the new one.
        </p>
      )}
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-5 text-sm text-muted">
        Forgot your password? Ask the owner to set a new one for you.
        {canRecover && (
          <>
            {" "}
            Nobody can sign in?{" "}
            <Link href="/admin/reset" className="font-semibold text-brand-800 underline">
              Reset with the setup key
            </Link>
            .
          </>
        )}
      </p>
    </>
  );
}
