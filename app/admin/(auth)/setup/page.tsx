import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SetupForm } from "@/components/admin/auth-forms";
import { hasAnyAdminUser } from "@/lib/auth/authenticate";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = { title: "First-time setup" };

export default async function AdminSetupPage() {
  // Invisible unless the owner has switched setup on AND no admin exists yet.
  if (!isDatabaseConfigured() || !getServerEnv().ADMIN_SETUP_TOKEN) notFound();
  if (await hasAnyAdminUser(getDb())) redirect("/admin/login");
  return (
    <>
      <h1 className="text-2xl font-extrabold">Create the owner account</h1>
      <p className="mt-2 text-sm text-muted">One-time setup. This page disappears as soon as the first account exists.</p>
      <div className="mt-6">
        <SetupForm />
      </div>
    </>
  );
}
