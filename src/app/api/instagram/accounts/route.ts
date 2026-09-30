import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireIdentity } from "@/lib/auth";
import { db, transaction } from "@/lib/db";

export const runtime = "nodejs";
export async function GET() {
  try {
    const identity = await requireIdentity();
    const result = await db.query(`SELECT id,username,display_name AS "displayName",state,created_at AS "createdAt",last_authenticated_at AS "lastAuthenticatedAt" FROM instagram_accounts WHERE organization_id=$1 ORDER BY created_at DESC`, [identity.organizationId]);
    return NextResponse.json({ accounts: result.rows });
  } catch { return NextResponse.json({ error: "Não autenticado." }, { status: 401 }); }
}

const createSchema = z.object({ username: z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/) });
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
  try {
    const identity = await requireIdentity();
    const body = createSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Informe um nome de usuário válido do Instagram." }, { status: 400 });
    const account = await transaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`org-accounts:${identity.organizationId}`]);
      const count = await client.query("SELECT count(*)::int AS count FROM instagram_accounts WHERE organization_id=$1", [identity.organizationId]);
      if (count.rows[0].count >= 500) throw new Error("ACCOUNT_LIMIT");
      const inserted = await client.query<{ id:string; username:string; state:string }>("INSERT INTO instagram_accounts(organization_id,username,state) VALUES($1,$2,'DISCONNECTED') RETURNING id,username,state", [identity.organizationId, body.data.username.toLowerCase()]);
      await client.query("INSERT INTO audit_events(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'instagram_account.added','instagram_account',$3)", [identity.organizationId,identity.userId,inserted.rows[0].id]);
      return inserted.rows[0];
    });
    return NextResponse.json({ account, connection: "manual_authorization_required" }, { status: 201 });
  } catch (error) {
    if ((error as Error)?.message === "ACCOUNT_LIMIT") return NextResponse.json({ error: "Esta organização já atingiu o limite de 500 contas." }, { status: 409 });
    if ((error as {code?:string})?.code === "23505") return NextResponse.json({ error: "Essa conta já está cadastrada nesta organização." }, { status: 409 });
    if ((error as Error)?.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    return NextResponse.json({ error: "Não foi possível cadastrar a conta." }, { status: 500 });
  }
}
