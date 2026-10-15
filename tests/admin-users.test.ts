import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("admin users on a real database", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;
  let users: typeof import("@/lib/admin/user-admin");
  let auth: typeof import("@/lib/auth/authenticate");
  let sess: typeof import("@/lib/auth/session");
  let current: { userId: string; email: string; name: string; role: "OWNER" | "STAFF"; isPreview: boolean } | null = null;
  const PW = "T9!kd-plum-ocean-77";
  const NEW = "Rk4#-mango-harbor-31";
  let ownerId = "";
  let staffId = "";
  const wipe = () => db.adminUser.deleteMany({ where: { email: { endsWith: "@usr.example.test" } } });

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("@/lib/auth/guard", () => ({
      requireAdmin: async () => {
        if (!current) throw new Error("NEXT_REDIRECT:/admin/login");
        return current;
      },
      requireOwner: async () => {
        if (!current) throw new Error("NEXT_REDIRECT:/admin/login");
        if (current.role !== "OWNER") throw new Error("NEXT_NOT_FOUND");
        return current;
      },
    }));
    db = (await import("@/lib/db/client")).getDb();
    users = await import("@/lib/admin/user-admin");
    auth = await import("@/lib/auth/authenticate");
    sess = await import("@/lib/auth/session");
  });
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });
  beforeEach(async () => {
    // These tests need a clean slate of owners: other test files leave no admin users behind, but be safe.
    await wipe();
    const owner = await db.adminUser.create({ data: { email: "owner@usr.example.test", name: "Owner", role: "OWNER", passwordHash: await hashPassword(PW) } });
    const staff = await db.adminUser.create({ data: { email: "staff@usr.example.test", name: "Staff", role: "STAFF", passwordHash: await hashPassword(PW) } });
    ownerId = owner.id;
    staffId = staff.id;
    current = { userId: ownerId, email: "owner@usr.example.test", name: "Owner", role: "OWNER", isPreview: false };
  });

  const asStaff = () => (current = { userId: staffId, email: "staff@usr.example.test", name: "Staff", role: "STAFF", isPreview: false });

  it("signed-out visitors and staff can not manage users; staff can only change their own password", async () => {
    current = null;
    await expect(users.listAdminUsers()).rejects.toThrow("NEXT_REDIRECT");
    await expect(users.createStaffUser({})).rejects.toThrow("NEXT_REDIRECT");
    asStaff();
    for (const call of [() => users.listAdminUsers(), () => users.getAdminUser(ownerId), () => users.createStaffUser({}), () => users.setUserPassword(ownerId, {}), () => users.setUserActive(ownerId, false), () => users.unlockUser(ownerId)]) {
      await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: ownerId } })).toMatchObject({ isActive: true });
  });

  it("lists users without ever returning password hashes", async () => {
    const list = await users.listAdminUsers();
    expect(list.map((u) => u.email)).toEqual(expect.arrayContaining(["owner@usr.example.test", "staff@usr.example.test"]));
    expect(JSON.stringify(list)).not.toContain("scrypt$");
    expect(Object.keys(list[0]!)).not.toContain("passwordHash");
    expect(JSON.stringify(await users.getAdminUser(staffId))).not.toContain("scrypt$");
  });

  it("creates a STAFF account that can sign in, and rejects duplicates and weak passwords", async () => {
    const made = await users.createStaffUser({ name: "Ravi", email: " Ravi@USR.example.test ", password: NEW, confirm: NEW });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({ email: "ravi@usr.example.test", role: "STAFF", isActive: true });
    expect((await auth.attemptLogin(db, "ravi@usr.example.test", NEW, null)).ok).toBe(true);
    expect(await users.createStaffUser({ name: "Ravi 2", email: "RAVI@usr.example.test", password: NEW, confirm: NEW })).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
    expect(await users.createStaffUser({ name: "X Y", email: "x@usr.example.test", password: "short", confirm: "short" })).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
    expect(await users.createStaffUser({ name: "X Y", email: "x@usr.example.test", password: NEW, confirm: NEW + "1" })).toMatchObject({ ok: false, fieldErrors: { confirm: expect.any(String) } });
    expect(await users.createStaffUser({ name: "X Y", email: "not-an-email", password: NEW, confirm: NEW })).toMatchObject({ ok: false });
    expect(await db.adminUser.count({ where: { email: { in: ["x@usr.example.test", "not-an-email"] } } })).toBe(0);
  });

  it("ignores any attempt to pick a role: new accounts are always STAFF", async () => {
    const made = await users.createStaffUser({ name: "Sneaky", email: "sneaky@usr.example.test", password: NEW, confirm: NEW, role: "OWNER" });
    if (!made.ok) throw new Error("setup");
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: made.id } })).role).toBe("STAFF");
  });

  it("the owner sets another person's password: old password stops working, lock lifted, signed out everywhere", async () => {
    await sess.createSession(db, staffId, null);
    await db.adminUser.update({ where: { id: staffId }, data: { failedLoginCount: 4, lockedUntil: new Date(Date.now() + 600_000) } });
    expect(await users.setUserPassword(staffId, { password: NEW, confirm: NEW })).toMatchObject({ ok: true });
    expect(await db.adminSession.count({ where: { adminUserId: staffId } })).toBe(0);
    expect((await auth.attemptLogin(db, "staff@usr.example.test", PW, null)).ok).toBe(false);
    expect((await auth.attemptLogin(db, "staff@usr.example.test", NEW, null)).ok).toBe(true);
    expect(await users.setUserPassword(staffId, { password: "short", confirm: "short" })).toMatchObject({ ok: false });
    expect(await users.setUserPassword(staffId, { password: NEW, confirm: "different-password-1" })).toMatchObject({ ok: false });
    expect(await users.setUserPassword("missing", { password: NEW, confirm: NEW })).toMatchObject({ ok: false });
    expect(await users.setUserPassword(ownerId, { password: NEW, confirm: NEW })).toMatchObject({ ok: false, message: expect.stringContaining("Change my password") });
  });

  it("deactivating signs the person out and blocks sign-in; reactivating restores it; never yourself, never the last owner", async () => {
    await sess.createSession(db, staffId, null);
    expect(await users.setUserActive(staffId, false)).toMatchObject({ ok: true });
    expect(await db.adminSession.count({ where: { adminUserId: staffId } })).toBe(0);
    expect((await auth.attemptLogin(db, "staff@usr.example.test", PW, null)).ok).toBe(false);
    expect(await users.setUserActive(staffId, true)).toMatchObject({ ok: true });
    expect((await auth.attemptLogin(db, "staff@usr.example.test", PW, null)).ok).toBe(true);
    expect(await users.setUserActive(ownerId, false)).toMatchObject({ ok: false, message: expect.stringContaining("own account") });
    expect(await users.setUserActive("missing", false)).toMatchObject({ ok: false });
    // a second owner exists only by hand; with two, either can be deactivated by the other, but never both
    const other = await db.adminUser.create({ data: { email: "owner2@usr.example.test", name: "Owner 2", role: "OWNER", passwordHash: await hashPassword(PW) } });
    expect(await users.setUserActive(other.id, false)).toMatchObject({ ok: true });
    expect(await users.setUserActive(other.id, true)).toMatchObject({ ok: true });
  });

  it("refuses to deactivate the last active owner: with two owners only one deactivation can win, and the check waits for its lock", async () => {
    const other = await db.adminUser.create({ data: { email: "owner2@usr.example.test", name: "Owner 2", role: "OWNER", passwordHash: await hashPassword(PW) } });
    const { Client } = await import("pg");
    const holder = new Client({ connectionString: url });
    await holder.connect();
    try {
      await holder.query("SELECT pg_advisory_lock(7420002)");
      let finished = false;
      const pending = users.setUserActive(other.id, false).then((r) => ((finished = true), r));
      await new Promise((r) => setTimeout(r, 1000));
      expect(finished).toBe(false); // would be true without the lock: two owners deactivating each other could both pass the count
      await holder.query("SELECT pg_advisory_unlock(7420002)");
      expect(await pending).toMatchObject({ ok: true });
    } finally {
      await holder.end();
    }
    // now only the first owner is left active: nobody (not even via a second session) can deactivate it
    current = { userId: other.id, email: "owner2@usr.example.test", name: "Owner 2", role: "OWNER", isPreview: false };
    expect(await users.setUserActive(ownerId, false)).toMatchObject({ ok: false, message: expect.stringContaining("last active owner") });
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: ownerId } })).isActive).toBe(true);
  });

  it("unlock clears a sign-in lock", async () => {
    await db.adminUser.update({ where: { id: staffId }, data: { failedLoginCount: 2, lockedUntil: new Date(Date.now() + 600_000) } });
    expect(await users.unlockUser(staffId)).toMatchObject({ ok: true });
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: staffId } })).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
    expect((await auth.attemptLogin(db, "staff@usr.example.test", PW, null)).ok).toBe(true);
    expect(await users.unlockUser("missing")).toMatchObject({ ok: false });
  });

  it("changing your own password needs the current one, keeps this browser signed in and signs out the others", async () => {
    asStaff();
    const mine = await sess.createSession(db, staffId, null);
    await sess.createSession(db, staffId, null);
    expect(await users.changeOwnPassword({ current: "wrong-password-123", password: NEW, confirm: NEW }, mine.token)).toMatchObject({ ok: false, fieldErrors: { current: expect.any(String) } });
    expect(await users.changeOwnPassword({ current: PW, password: PW, confirm: PW }, mine.token)).toMatchObject({ ok: false });
    expect(await users.changeOwnPassword({ current: PW, password: "short", confirm: "short" }, mine.token)).toMatchObject({ ok: false });
    expect(await users.changeOwnPassword({ current: PW, password: NEW, confirm: "nope-nope-nope-1" }, mine.token)).toMatchObject({ ok: false });
    expect(await db.adminSession.count({ where: { adminUserId: staffId } })).toBe(2); // nothing happened yet
    expect(await users.changeOwnPassword({ current: PW, password: NEW, confirm: NEW }, mine.token)).toMatchObject({ ok: true });
    const left = await db.adminSession.findMany({ where: { adminUserId: staffId } });
    expect(left.map((s) => s.tokenHash)).toEqual([sess.hashSessionToken(mine.token)]);
    expect((await auth.attemptLogin(db, "staff@usr.example.test", PW, null)).ok).toBe(false);
    expect((await auth.attemptLogin(db, "staff@usr.example.test", NEW, null)).ok).toBe(true);
  });

  it("wrong current passwords on the change form lock the account like the sign-in page", async () => {
    asStaff();
    for (let i = 0; i < auth.MAX_FAILED_LOGINS; i++) await users.changeOwnPassword({ current: "wrong-password-123", password: NEW, confirm: NEW }, undefined);
    expect(await users.changeOwnPassword({ current: PW, password: NEW, confirm: NEW }, undefined)).toMatchObject({ ok: false });
    expect((await auth.attemptLogin(db, "staff@usr.example.test", PW, null)).ok).toBe(false);
  });

  it("the development preview account has no password to change, and 'sign out other devices' only touches your own sessions", async () => {
    current = { userId: "dev-preview", email: "preview@localhost", name: "Preview", role: "OWNER", isPreview: true };
    expect(await users.changeOwnPassword({ current: "x", password: NEW, confirm: NEW }, undefined)).toMatchObject({ ok: false });
    const mine = await sess.createSession(db, staffId, null);
    await sess.createSession(db, staffId, null);
    const ownerSession = await sess.createSession(db, ownerId, null);
    asStaff();
    expect(await users.signOutOtherDevices(mine.token)).toMatchObject({ ok: true });
    expect(await db.adminSession.count({ where: { adminUserId: staffId } })).toBe(1);
    expect(await db.adminSession.count({ where: { tokenHash: sess.hashSessionToken(ownerSession.token) } })).toBe(1);
  });
});
