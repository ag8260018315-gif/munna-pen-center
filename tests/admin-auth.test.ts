import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword, checkNewPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("round-trips, salts every hash, and rejects wrong, empty and malformed values", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", a)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", a)).toBe(false);
    expect(await verifyPassword("", a)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$1$1$AA$AA")).toBe(false); // absurdly cheap parameters refused
    expect(await verifyPassword("x", "scrypt$99999999$8$1$AAAAAAAAAAAA$AA")).toBe(false); // absurdly costly refused
    expect(await verifyPassword("x", "plaintext")).toBe(false);
  });

  it("applies password rules", () => {
    expect(checkNewPassword("short", "a@b.co")).toMatch(/at least 12/);
    expect(checkNewPassword("aaaaaaaaaaaaaaaa", "a@b.co")).toMatch(/varied/);
    expect(checkNewPassword("owner-secret-1234", "owner@x.in")).toMatch(/e-mail/);
    expect(checkNewPassword("Password12345!", "z@x.in")).toMatch(/easy/);
    expect(checkNewPassword("T9!kd-plum-ocean-77", "z@x.in")).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("admin sign-in on a real database", () => {
  let db: Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;
  let auth: typeof import("@/lib/auth/authenticate");
  let sess: typeof import("@/lib/auth/session");
  const PW = "T9!kd-plum-ocean-77";
  const EMAIL = "itest-owner@example.test";
  let userId = "";

  const wipe = () => db.adminUser.deleteMany({ where: { email: { endsWith: "@example.test" } } });

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.resetModules();
    db = (await import("@/lib/db/client")).getDb();
    auth = await import("@/lib/auth/authenticate");
    sess = await import("@/lib/auth/session");
  });
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });
  beforeEach(async () => {
    await wipe();
    const user = await db.adminUser.create({ data: { email: EMAIL, name: "Test Owner", role: "OWNER", passwordHash: await hashPassword(PW) } });
    userId = user.id;
  });

  it("signs in with the right password (e-mail case/space insensitive) and stores only a HASH of the token", async () => {
    const result = await auth.attemptLogin(db, `  ${EMAIL.toUpperCase()} `, PW, "itest-agent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = await db.adminSession.findMany({ where: { adminUserId: userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(sess.hashSessionToken(result.token));
    expect(rows[0]!.tokenHash).not.toBe(result.token);
    expect(JSON.stringify(rows)).not.toContain(result.token);
    expect((await sess.findSession(db, result.token))?.email).toBe(EMAIL);
  });

  it("gives the same answer for unknown e-mail, wrong password, inactive and password-less accounts", async () => {
    await db.adminUser.create({ data: { email: "off@example.test", name: "Off", passwordHash: await hashPassword(PW), isActive: false } });
    await db.adminUser.create({ data: { email: "nopw@example.test", name: "NoPw" } });
    for (const [email, pw] of [["nobody@example.test", PW], [EMAIL, "wrong-password-123"], ["off@example.test", PW], ["nopw@example.test", PW]] as const) {
      expect(await auth.attemptLogin(db, email, pw, null)).toEqual({ ok: false });
    }
    expect(await db.adminSession.count({ where: { adminUserId: userId } })).toBe(0);
  });

  it("locks after 5 wrong passwords — even the right password is refused — and unlocks after 15 minutes", async () => {
    const t0 = new Date();
    for (let i = 0; i < 5; i++) expect((await auth.attemptLogin(db, EMAIL, "wrong-password-123", null, t0)).ok).toBe(false);
    expect((await auth.attemptLogin(db, EMAIL, PW, null, new Date(t0.getTime() + 60_000))).ok).toBe(false);
    const later = new Date(t0.getTime() + auth.LOCK_MS + 1000);
    expect((await auth.attemptLogin(db, EMAIL, PW, null, later)).ok).toBe(true);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: userId } })).failedLoginCount).toBe(0);
  });

  it("a success resets the failure counter", async () => {
    for (let i = 0; i < 4; i++) await auth.attemptLogin(db, EMAIL, "wrong-password-123", null);
    expect((await auth.attemptLogin(db, EMAIL, PW, null)).ok).toBe(true);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: userId } })).failedLoginCount).toBe(0);
  });

  it("sessions end at the absolute deadline, after idleness, on sign-out, and when the user is deactivated", async () => {
    const t0 = new Date();
    const s = await sess.createSession(db, userId, null, t0);
    expect(await sess.findSession(db, s.token, new Date(t0.getTime() + 60_000))).not.toBeNull();
    // idle: > 2h since last seen
    expect(await sess.findSession(db, s.token, new Date(t0.getTime() + sess.SESSION_IDLE_MS + 120_000))).toBeNull();
    expect(await db.adminSession.count({ where: { adminUserId: userId } })).toBe(0);

    const s2 = await sess.createSession(db, userId, null, t0);
    // keep it active every hour, still dies at 12h
    let t = t0.getTime();
    for (let i = 0; i < 11; i++) {
      t += 60 * 60 * 1000;
      expect(await sess.findSession(db, s2.token, new Date(t))).not.toBeNull();
    }
    expect(await sess.findSession(db, s2.token, new Date(t0.getTime() + sess.SESSION_LIFETIME_MS + 1000))).toBeNull();

    const s3 = await sess.createSession(db, userId, null);
    await sess.deleteSession(db, s3.token);
    expect(await sess.findSession(db, s3.token)).toBeNull();

    const s4 = await sess.createSession(db, userId, null);
    await db.adminUser.update({ where: { id: userId }, data: { isActive: false } });
    expect(await sess.findSession(db, s4.token)).toBeNull();
  });

  it("rejects missing, short, forged and altered tokens", async () => {
    const s = await sess.createSession(db, userId, null);
    expect(await sess.findSession(db, undefined)).toBeNull();
    expect(await sess.findSession(db, "abc")).toBeNull();
    expect(await sess.findSession(db, "x".repeat(43))).toBeNull();
    expect(await sess.findSession(db, s.token.slice(0, -1) + (s.token.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(await sess.findSession(db, sess.hashSessionToken(s.token))).toBeNull(); // the stored hash is not a credential
  });

  it("first-owner setup works once; a second, even simultaneous, setup is refused", async () => {
    await wipe();
    const attempts = await Promise.all(
      [1, 2, 3, 4].map((n) => auth.createFirstOwner(db, { email: `first${n}@example.test`, name: `First ${n}`, password: PW })),
    );
    expect(attempts.filter((r) => r.ok)).toHaveLength(1);
    expect(attempts.filter((r) => !r.ok && r.reason === "already-set-up")).toHaveLength(3);
    const users = await db.adminUser.findMany({ where: { email: { endsWith: "@example.test" } } });
    expect(users).toHaveLength(1);
    expect(users[0]!.role).toBe("OWNER");
    expect(users[0]!.passwordHash).not.toContain(PW);
  });

  it("first-owner setup waits for the advisory lock, so check-and-insert can not interleave", async () => {
    await wipe();
    const { Client } = await import("pg");
    const holder = new Client({ connectionString: url });
    await holder.connect();
    try {
      await holder.query("SELECT pg_advisory_lock(7420001)");
      let finished = false;
      const pending = auth.createFirstOwner(db, { email: "lock@example.test", name: "Lock", password: PW }).then((r) => ((finished = true), r));
      await new Promise((r) => setTimeout(r, 1200)); // far longer than hashing takes
      expect(finished).toBe(false);
      await holder.query("SELECT pg_advisory_unlock(7420001)");
      expect((await pending).ok).toBe(true);
    } finally {
      await holder.end();
    }
  });

  it("first-owner setup refuses weak passwords and does nothing when an admin already exists", async () => {
    expect(await auth.createFirstOwner(db, { email: "w@example.test", name: "W", password: "short" })).toMatchObject({ ok: false, reason: "weak-password" });
    expect(await auth.createFirstOwner(db, { email: "w@example.test", name: "W", password: PW })).toMatchObject({ ok: false, reason: "already-set-up" });
  });

  it("the setup key is compared exactly and is off when unset", () => {
    expect(auth.setupTokenMatches("abc", "abc")).toBe(true);
    expect(auth.setupTokenMatches("abd", "abc")).toBe(false);
    expect(auth.setupTokenMatches("abcd", "abc")).toBe(false);
    expect(auth.setupTokenMatches("", undefined)).toBe(false);
    expect(auth.setupTokenMatches("", "")).toBe(false);
  });
});
