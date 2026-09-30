import { NextResponse } from "next/server";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { assertSameOrigin, requireIdentity } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaBucket, s3Browser } from "@/lib/storage";

export const runtime = "nodejs";
const schema=z.object({name:z.string().trim().min(1).max(180),mimeType:z.enum(["image/jpeg","image/png","image/webp","video/mp4"]),bytes:z.number().int().positive()});
const maximumBytes=100*1024*1024;
export async function POST(request:Request){
  if(!assertSameOrigin(request))return NextResponse.json({error:"Requisição inválida."},{status:403});
  try{
    const identity=await requireIdentity();const parsed=schema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success)return NextResponse.json({error:"Formato de arquivo não suportado. Use JPG, PNG, WebP ou MP4."},{status:400});
    if(parsed.data.bytes>maximumBytes||parsed.data.mimeType.startsWith("image/")&&parsed.data.bytes>20*1024*1024)return NextResponse.json({error:"O arquivo excede o limite de tamanho deste envio."},{status:413});
    const id=randomUUID();const objectKey=`${identity.organizationId}/media/${id}`;const name=parsed.data.name.replace(/[\\/\u0000-\u001f]/g,"_").slice(0,180);
    await db.query("INSERT INTO media(id,organization_id,object_key,original_name,mime_type,bytes,kind,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'UPLOADING',$8)",[id,identity.organizationId,objectKey,name,parsed.data.mimeType,parsed.data.bytes,parsed.data.mimeType.startsWith("video/")?"REEL":"IMAGE",identity.userId]);
    const command=new PutObjectCommand({Bucket:mediaBucket,Key:objectKey,ContentType:parsed.data.mimeType,ContentLength:parsed.data.bytes});
    const uploadUrl=await getSignedUrl(s3Browser,command,{expiresIn:300});
    return NextResponse.json({id,uploadUrl,requiredHeaders:{"Content-Type":parsed.data.mimeType},expiresInSeconds:300},{status:201});
  }catch(error){if((error as Error)?.message==="UNAUTHENTICATED")return NextResponse.json({error:"Não autenticado."},{status:401});return NextResponse.json({error:"Não foi possível preparar o upload."},{status:500});}
}
