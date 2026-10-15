import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { MIN_RECOVERY_KEY_LENGTH, recoveryEnabled } from "@/lib/auth/recovery";

describe("recovery key", () => {
  it("is off unless the key is long enough to be unguessable", () => {
    expect(recoveryEnabled(undefined)).toBe(false);
    expect(recoveryEnabled("")).toBe(false);
    expect(recoveryEnabled("short-key")).toBe(false);
    expect(recoveryEnabled("x".repeat(MIN_RECOVERY_KEY_LENGTH - 1))).toBe(false);
    expect(recoveryEnabled("x".repeat(MIN_RECOVERY_KEY_LENGTH))).toBe(true);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("password checks and recovery on a real database", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;
  let auth: typeof import("@/lib/auth/authenticate");
  let sess: typeof import("@/lib/auth/session");
  let recovery: typeof import("@/lib/auth/recovery");
  const OLD = "T9!kd-plum-ocean-77";
  const NEW = "Rk4#-mango-harbor-31";
  let id = "";
  const wipe = () => db.adminUser.deleteMany({ where: { email: { endsWith: "@rec.example.test" } } });

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    db = (await import("@/lib/db/client")).getDb();
    auth = await import("@/lib/auth/authenticate");
    sess = await import("@/lib/auth/session");
    recovery = await import("@/lib/auth/recovery");
  });
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });
  beforeEach(async () => {
    await wipe();
    id = (await db.adminUser.create({ data: { email: "staff@rec.example.test", name: "Staff", role: "STAFF", passwordHash: await hashPassword(OLD) } })).id;
  });

  it("verifyUserPassword: right password passes; wrong ones count toward the same lock as sign-in", async () => {
    expect(await auth.verifyUserPassword(db, id, OLD)).toBe(true);
    const t0 = new Date();
    for (let i = 0; i < auth.MAX_FAILED_LOGINS; i++) expect(await auth.verifyUserPassword(db, id, "wrong-password-123", t0)).toBe(false);
    expect(await auth.verifyUserPassword(db, id, OLD, new Date(t0.getTime() + 1000))).toBe(false); // locked
    expect((await auth.attemptLogin(db, "staff@rec.example.test", OLD, null, new Date(t0.getTime() + 1000))).ok).toBe(false);
    expect(await auth.verifyUserPassword(db, id, OLD, new Date(t0.getTime() + auth.LOCK_MS + 1000))).toBe(true);
  });

  it("verifyUserPassword refuses a deactivated user and a missing one", async () => {
    await db.adminUser.update({ where: { id }, data: { isActive: false } });
    expect(await auth.verifyUserPassword(db, id, OLD)).toBe(false);
    expect(await auth.verifyUserPassword(db, "missing", OLD)).toBe(false);
  });

  it("a successful check clears earlier failures", async () => {
    for (let i = 0; i < 3; i++) await auth.verifyUserPassword(db, id, "wrong-password-123");
    expect(await auth.verifyUserPassword(db, id, OLD)).toBe(true);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id } })).failedLoginCount).toBe(0);
  });

  it("recovery sets a new password, lifts a lock, and signs the account out everywhere", async () => {
    await sess.createSession(db, id, null);
    await sess.createSession(db, id, null);
    await db.adminUser.update({ where: { id }, data: { failedLoginCount: 3, lockedUntil: new Date(Date.now() + 600_000) } });
    expect(await recovery.resetPasswordWithKey(db, { email: "  STAFF@rec.example.test ", newPassword: NEW })).toEqual({ ok: true });
    expect(await db.adminSession.count({ where: { adminUserId: id } })).toBe(0);
    expect(await db.adminUser.findUniqueOrThrow({ where: { id } })).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
    expect((await auth.attemptLogin(db, "staff@rec.example.test", OLD, null)).ok).toBe(false);
    expect((await auth.attemptLogin(db, "staff@rec.example.test", NEW, null)).ok).toBe(true);
  });

  it("recovery refuses a weak password, an unknown e-mail and a deactivated account, changing nothing", async () => {
    expect(await recovery.resetPasswordWithKey(db, { email: "staff@rec.example.test", newPassword: "short" })).toMatchObject({ ok: false, reason: "weak-password" });
    expect(await recovery.resetPasswordWithKey(db, { email: "nobody@rec.example.test", newPassword: NEW })).toMatchObject({ ok: false, reason: "unknown-account" });
    await db.adminUser.update({ where: { id }, data: { isActive: false } });
    expect(await recovery.resetPasswordWithKey(db, { email: "staff@rec.example.test", newPassword: NEW })).toMatchObject({ ok: false, reason: "unknown-account" });
    expect(await db.adminUser.findUniqueOrThrow({ where: { id } })).toMatchObject({ isActive: false });
    await db.adminUser.update({ where: { id }, data: { isActive: true } });
    expect((await auth.attemptLogin(db, "staff@rec.example.test", OLD, null)).ok).toBe(true); // old password still works
  });

  it("deleteOtherSessions keeps only the browser that is changing the password", async () => {
    const keep = await sess.createSession(db, id, null);
    await sess.createSession(db, id, null);
    await sess.createSession(db, id, null);
    await sess.deleteOtherSessions(db, id, keep.token);
    const left = await db.adminSession.findMany({ where: { adminUserId: id } });
    expect(left).toHaveLength(1);
    expect(left[0]!.tokenHash).toBe(sess.hashSessionToken(keep.token));
    await sess.deleteOtherSessions(db, id, undefined);
    expect(await db.adminSession.count({ where: { adminUserId: id } })).toBe(0);
  });
});
