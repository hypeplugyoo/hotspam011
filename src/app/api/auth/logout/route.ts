import { NextResponse } from "next/server";
import { assertSameOrigin, destroySession } from "@/lib/auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
  await destroySession();
  return NextResponse.json({ ok: true });
}
