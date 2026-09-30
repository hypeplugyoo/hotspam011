import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireIdentity } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaBucket, s3Browser } from "@/lib/storage";

export const runtime="nodejs";
export async function GET(){
  try{const identity=await requireIdentity();const result=await db.query<{id:string;original_name:string;mime_type:string;bytes:string;kind:string;created_at:Date;object_key:string}>("SELECT id,original_name,mime_type,bytes,kind,created_at,object_key FROM media WHERE organization_id=$1 AND status='READY' ORDER BY created_at DESC LIMIT 100",[identity.organizationId]);
    const items=await Promise.all(result.rows.map(async row=>({id:row.id,name:row.original_name,mimeType:row.mime_type,bytes:Number(row.bytes),kind:row.kind,createdAt:row.created_at.toISOString(),url:await getSignedUrl(s3Browser,new GetObjectCommand({Bucket:mediaBucket,Key:row.object_key}),{expiresIn:600})})));
    return NextResponse.json({media:items,downloadUrlsExpireInSeconds:600});
  }catch{return NextResponse.json({error:"Não autenticado."},{status:401});}
}
