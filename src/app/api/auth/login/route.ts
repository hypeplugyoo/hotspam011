import { NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { assertSameOrigin, createSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  const email = parsed.data.email.toLowerCase();
  const user = await db.query<{ id: string; password_hash: string; organization_id: string }>(
    `SELECT u.id,u.password_hash,m.organization_id FROM users u JOIN memberships m ON m.user_id=u.id
     WHERE lower(u.email)=$1 ORDER BY m.created_at LIMIT 1`, [email]);
  const row = user.rows[0];
  let valid = false;
  try { if (row) valid = await argon2.verify(row.password_hash, parsed.data.password); } catch { valid = false; }
  if (!row || !valid) return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  await createSession(row.id, row.organization_id);
  return NextResponse.json({ ok: true });
}
