import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET() {
  let database = "ok";
  try { const { db } = await import("@/lib/db"); await db.query("SELECT 1"); }
  catch { database = "unavailable"; }
  const healthy = database === "ok";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", mode: process.env.DEMO_MODE === "false" ? "REAL_ADAPTER_DISABLED" : "DEMO", services: { database, instagram: "not_connected", metrics: "demo_data_only" }, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503 });
}
