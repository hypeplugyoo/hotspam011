import { NextResponse } from "next/server";
import { assertSameOrigin, requireIdentity } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export async function DELETE(request: Request, context: { params: Promise<{ id:string }> }) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
  try {
    const identity = await requireIdentity();
    const { id } = await context.params;
    const result = await db.query("DELETE FROM instagram_accounts WHERE id=$1 AND organization_id=$2 RETURNING id", [id,identity.organizationId]);
    if (!result.rowCount) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    await db.query("INSERT INTO audit_events(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'instagram_account.deleted','instagram_account',$3)", [identity.organizationId,identity.userId,id]);
    return NextResponse.json({ ok:true });
  } catch { return NextResponse.json({ error: "Não autenticado." }, { status: 401 }); }
}
