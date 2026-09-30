import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db, transaction } from "./db";

const COOKIE = "pulso_session";
const SESSION_DAYS = 14;
export type Identity = { userId: string; organizationId: string; email: string; role: string; organizationName: string };
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, organizationId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.query("INSERT INTO user_sessions(user_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,$4)", [userId, organizationId, hashToken(token), expires]);
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires });
}

export async function currentIdentity(): Promise<Identity | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const result = await db.query<Identity>(
    `SELECT u.id AS "userId", m.organization_id AS "organizationId", u.email, m.role,
      o.name AS "organizationName"
     FROM user_sessions s JOIN users u ON u.id=s.user_id
     JOIN memberships m ON m.user_id=s.user_id AND m.organization_id=s.organization_id
     JOIN organizations o ON o.id=s.organization_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now() LIMIT 1`, [hashToken(token)]);
  return result.rows[0] ?? null;
}

export async function requireIdentity() {
  const identity = await currentIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  return identity;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.query("UPDATE user_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL", [hashToken(token)]);
  jar.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: new Date(0) });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase(); } catch { return false; }
}

export async function createOrganizationUser(input: { email: string; passwordHash: string; organizationName: string }) {
  return transaction(async client => {
    const user = await client.query<{ id: string }>("INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id", [input.email, input.passwordHash]);
    const org = await client.query<{ id: string }>("INSERT INTO organizations(name) VALUES($1) RETURNING id", [input.organizationName]);
    await client.query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,'OWNER')", [org.rows[0].id, user.rows[0].id]);
    return { userId: user.rows[0].id, organizationId: org.rows[0].id };
  });
}
