import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { recoveryAction } from "@/app/actions/admin-users";
import { RecoveryForm } from "@/components/admin/user-forms";
import { recoveryEnabled } from "@/lib/auth/recovery";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Reset password" };

export default function AdminResetPage() {
  // Invisible unless the owner has switched recovery on in Vercel with a long key.
  if (!isDatabaseConfigured() || !recoveryEnabled(getServerEnv().ADMIN_SETUP_TOKEN)) notFound();
  return (
    <>
      <h1 className="text-2xl font-extrabold">Reset a password</h1>
      <p className="mt-2 text-sm text-muted">For when nobody can sign in. It needs the setup key from your Vercel settings. After you are back in, delete that key in Vercel.</p>
      <div className="mt-6">
        <RecoveryForm action={recoveryAction} />
      </div>
      <p className="mt-6 text-sm">
        <Link href="/admin/login" className="font-semibold text-brand-800 underline">Back to sign in</Link>
      </p>
    </>
  );
}
