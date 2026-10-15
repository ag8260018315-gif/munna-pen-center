import type { Metadata } from "next";
import { changeOwnPasswordAction, signOutOtherDevicesAction } from "@/app/actions/admin-users";
import { ActionButton, ChangeOwnPasswordForm } from "@/components/admin/user-forms";
import { Notice, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const session = await requireAdmin();
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader title="My account" intro={`${session.name} · ${session.email} · ${session.role === "OWNER" ? "Owner" : "Staff"}`} />
      {session.isPreview ? (
        <Notice kind="info">This is the development preview account. It has no password.</Notice>
      ) : (
        <>
          <section aria-labelledby="pw" className="grid gap-4 rounded-xl border border-line bg-white p-5">
            <h2 id="pw" className="text-lg font-extrabold">Change my password</h2>
            <ChangeOwnPasswordForm action={changeOwnPasswordAction} />
            <p className="text-sm text-muted">Changing it signs you out on every other device.</p>
          </section>
          <section aria-labelledby="devices" className="grid gap-4 rounded-xl border border-line bg-white p-5">
            <h2 id="devices" className="text-lg font-extrabold">Other devices</h2>
            <p className="text-sm text-muted">Signed in on a shared computer or a phone you lost? This signs you out everywhere except here.</p>
            <ActionButton action={signOutOtherDevicesAction} label="Sign out on other devices" />
          </section>
        </>
      )}
    </div>
  );
}
