import { NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { assertSameOrigin, requireIdentity } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaBucket, s3 } from "@/lib/storage";

export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  if(!assertSameOrigin(request))return NextResponse.json({error:"Requisição inválida."},{status:403});
  try{
    const identity=await requireIdentity();const {id}=await context.params;
    const row=await db.query<{object_key:string;mime_type:string;bytes:string;status:string}>("SELECT object_key,mime_type,bytes,status FROM media WHERE id=$1 AND organization_id=$2",[id,identity.organizationId]);
    if(!row.rows[0])return NextResponse.json({error:"Mídia não encontrada."},{status:404});
    const media=row.rows[0];if(media.status==="READY")return NextResponse.json({ok:true});
    const head=await s3.send(new HeadObjectCommand({Bucket:mediaBucket,Key:media.object_key}));
    if(!head.ContentLength||head.ContentLength>100*1024*1024||head.ContentLength!==Number(media.bytes))return NextResponse.json({error:"O tamanho enviado não corresponde ao arquivo validado."},{status:422});
    const partial=await s3.send(new GetObjectCommand({Bucket:mediaBucket,Key:media.object_key,Range:"bytes=0-8191"}));
    const bytes=partial.Body?Buffer.from(await partial.Body.transformToByteArray()):Buffer.alloc(0);
    const detected=await fileTypeFromBuffer(bytes);
    if(!detected||detected.mime!==media.mime_type)return NextResponse.json({error:"O conteúdo real do arquivo não corresponde ao tipo informado."},{status:422});
    await db.query("UPDATE media SET status='READY',mime_type=$3 WHERE id=$1 AND organization_id=$2",[id,identity.organizationId,detected.mime]);
    await db.query("INSERT INTO audit_events(organization_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,'media.uploaded','media',$3)",[identity.organizationId,identity.userId,id]);
    return NextResponse.json({ok:true,id,mimeType:detected.mime,bytes:head.ContentLength});
  }catch(error){if((error as Error)?.message==="UNAUTHENTICATED")return NextResponse.json({error:"Não autenticado."},{status:401});return NextResponse.json({error:"Não foi possível confirmar este upload."},{status:422});}
}
