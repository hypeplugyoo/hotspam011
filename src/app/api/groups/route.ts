import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireIdentity } from "@/lib/auth";
import { db, transaction } from "@/lib/db";

export const runtime = "nodejs";
export async function GET() {
  try { const user=await requireIdentity(); const groups=await db.query(`SELECT g.id,g.name,COALESCE(json_agg(json_build_object('id',a.id,'username',a.username)) FILTER (WHERE a.id IS NOT NULL),'[]') AS accounts FROM account_groups g LEFT JOIN account_group_members gm ON gm.group_id=g.id LEFT JOIN instagram_accounts a ON a.id=gm.account_id WHERE g.organization_id=$1 GROUP BY g.id ORDER BY g.name`,[user.organizationId]); return NextResponse.json({groups:groups.rows}); }
  catch { return NextResponse.json({error:"Não autenticado."},{status:401}); }
}
const schema=z.object({name:z.string().trim().min(1).max(80),accountIds:z.array(z.string().uuid()).max(500)});
export async function POST(request:Request){
  if(!assertSameOrigin(request))return NextResponse.json({error:"Requisição inválida."},{status:403});
  try{const identity=await requireIdentity();const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Dados do grupo inválidos."},{status:400});
    const group=await transaction(async client=>{const result=await client.query<{id:string}>("INSERT INTO account_groups(organization_id,name) VALUES($1,$2) RETURNING id",[identity.organizationId,parsed.data.name]);const id=result.rows[0].id;
      const valid=await client.query("SELECT id FROM instagram_accounts WHERE organization_id=$1 AND id=ANY($2::uuid[])",[identity.organizationId,parsed.data.accountIds]);if(valid.rowCount!==parsed.data.accountIds.length)throw new Error("ACCOUNT_SCOPE");
      if(parsed.data.accountIds.length)await client.query("INSERT INTO account_group_members(group_id,account_id) SELECT $1, unnest($2::uuid[])",[id,parsed.data.accountIds]);
      await client.query("INSERT INTO audit_events(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'account_group.created','account_group',$3)",[identity.organizationId,identity.userId,id]);return id;});
    return NextResponse.json({id:group},{status:201});
  }catch(error){if((error as Error)?.message==="ACCOUNT_SCOPE")return NextResponse.json({error:"Um ou mais perfis não pertencem a esta organização."},{status:400});if((error as {code?:string})?.code==="23505")return NextResponse.json({error:"Já existe um grupo com esse nome."},{status:409});return NextResponse.json({error:"Não foi possível criar o grupo."},{status:500});}
}
