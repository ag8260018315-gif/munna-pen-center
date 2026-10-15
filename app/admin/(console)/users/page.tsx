import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseRequired, Notice, PageHeader, StatusBadge, tableClasses } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { listAdminUsers } from "@/lib/admin/user-admin";
import { requireOwner } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Users" };

const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d) : "never");

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  if (!isDatabaseConfigured()) return <div className="mx-auto grid max-w-5xl gap-6"><PageHeader title="Users" /><DatabaseRequired /></div>;
  const users = await listAdminUsers();
  const now = new Date();
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Users" intro="People who can sign in to this admin. Staff can work with products, customers and draft quotations; only owners handle prices, GST and sending quotations." actions={<ButtonLink href="/admin/users/new">Add staff account</ButtonLink>} />
      {sp.created && <Notice kind="success">Staff account created. Tell them their starting password in person.</Notice>}
      <div className={tableClasses.wrap}>
        <table className={tableClasses.table}>
          <caption className="sr-only">Admin users ({users.length})</caption>
          <thead>
            <tr>
              <th scope="col" className={tableClasses.th}>Name</th>
              <th scope="col" className={tableClasses.th}>E-mail</th>
              <th scope="col" className={tableClasses.th}>Role</th>
              <th scope="col" className={tableClasses.th}>Status</th>
              <th scope="col" className={tableClasses.th}>Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <th scope="row" className={`${tableClasses.td} font-semibold`}><Link href={`/admin/users/${u.id}`} className="text-brand-800 hover:underline">{u.name}</Link></th>
                <td className={tableClasses.td}>{u.email}</td>
                <td className={tableClasses.td}>{u.role === "OWNER" ? "Owner" : "Staff"}</td>
                <td className={tableClasses.td}>
                  <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
                  {u.lockedUntil && u.lockedUntil > now && <span className="ml-2 text-xs font-bold text-red-700">Locked</span>}
                </td>
                <td className={tableClasses.td}>{when(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
