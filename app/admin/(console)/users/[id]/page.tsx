import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setUserActiveAction, setUserPasswordAction, unlockUserAction } from "@/app/actions/admin-users";
import { Backlink } from "@/components/admin/backlink";
import { ActionButton, SetPasswordForm } from "@/components/admin/user-forms";
import { DatabaseRequired, Notice, PageHeader, StatusBadge } from "@/components/admin/ui";
import { getAdminUser } from "@/lib/admin/user-admin";
import { requireOwner } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "User" };

const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d) : "never");

const DONE: Record<string, string> = {
  unlocked: "Unlocked. They can sign in again.",
  deactivated: "Account deactivated and signed out everywhere.",
  reactivated: "Account reactivated.",
};

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const me = await requireOwner();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const user = await getAdminUser(id);
  if (!user) notFound();
  const self = user.id === me.userId;
  const locked = Boolean(user.lockedUntil && user.lockedUntil > new Date());
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <Backlink href="/admin/users">Users</Backlink>
      <PageHeader
        title={user.name}
        intro={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
            <span>{user.email} · {user.role === "OWNER" ? "Owner" : "Staff"} · last sign-in {when(user.lastLoginAt)}</span>
          </span>
        }
      />
      {done && DONE[done] && <Notice kind="success">{DONE[done]}</Notice>}
      {locked && <Notice kind="error">This account is locked after too many wrong passwords. It unlocks by itself after 15 minutes, or you can unlock it now.</Notice>}

      {self ? (
        <Notice kind="info">This is your own account. Change your password under “My account”.</Notice>
      ) : (
        <>
          <section aria-labelledby="pw" className="grid gap-4 rounded-xl border border-line bg-white p-5">
            <h2 id="pw" className="text-lg font-extrabold">Set a new password</h2>
            <p className="text-sm text-muted">Use this when they forgot their password. They are signed out everywhere and any lock is lifted. Tell them the new password in person.</p>
            <SetPasswordForm action={setUserPasswordAction.bind(null, user.id)} />
          </section>

          <section aria-labelledby="access" className="grid gap-4 rounded-xl border border-line bg-white p-5">
            <h2 id="access" className="text-lg font-extrabold">Access</h2>
            <div className="flex flex-wrap gap-4">
              {locked && <ActionButton action={unlockUserAction.bind(null, user.id)} label="Unlock now" />}
              {user.isActive ? (
                <ActionButton action={setUserActiveAction.bind(null, user.id, false)} label="Deactivate account" confirm={`Deactivate ${user.name}? They are signed out at once and can not sign in until you reactivate them.`} />
              ) : (
                <ActionButton action={setUserActiveAction.bind(null, user.id, true)} label="Reactivate account" variant="primary" />
              )}
            </div>
            <p className="text-sm text-muted">Accounts are never deleted: their name stays on anything they did.</p>
          </section>
        </>
      )}
    </div>
  );
}
