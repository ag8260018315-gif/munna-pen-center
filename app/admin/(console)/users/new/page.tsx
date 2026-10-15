import type { Metadata } from "next";
import { createStaffAction } from "@/app/actions/admin-users";
import { Backlink } from "@/components/admin/backlink";
import { NewStaffForm } from "@/components/admin/user-forms";
import { DatabaseRequired, PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { isDatabaseConfigured } from "@/lib/db/client";

export const metadata: Metadata = { title: "Add staff account" };

export default async function NewStaffPage() {
  await requireOwner();
  if (!isDatabaseConfigured()) return <DatabaseRequired />;
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Backlink href="/admin/users">Users</Backlink>
      <PageHeader title="Add staff account" />
      <NewStaffForm action={createStaffAction} />
    </div>
  );
}
