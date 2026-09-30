import { NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { assertSameOrigin, createOrganizationUser, createSession } from "@/lib/auth";

export const runtime = "nodejs";
const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(12).max(128), organizationName: z.string().trim().min(2).max(80) });
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe e-mail válido, senha com pelo menos 12 caracteres e nome da organização." }, { status: 400 });
  try {
    const email = parsed.data.email.toLowerCase();
    const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const identity = await createOrganizationUser({ email, passwordHash, organizationName: parsed.data.organizationName });
    await createSession(identity.userId, identity.organizationId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return NextResponse.json({ error: "Não foi possível criar a conta com esses dados." }, { status: 409 });
    console.error(JSON.stringify({ level: "error", event: "registration_failed", code: (error as { code?: string })?.code ?? "UNKNOWN" }));
    return NextResponse.json({ error: "Não foi possível concluir o cadastro agora." }, { status: 500 });
  }
}
