import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/auth-forms";
import { getAdminSession } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  if (!isDatabaseConfigured()) notFound();
  if (await getAdminSession()) redirect("/admin");
  const { created } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-extrabold">Admin sign in</h1>
      {created === "1" && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-900">
          Owner account created. Sign in below.
        </p>
      )}
      <div className="mt-6">
        <LoginForm />
      </div>
    </>
  );
}
