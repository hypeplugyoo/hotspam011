import { Pool, type PoolClient } from "pg";

declare global { var __pulsoDb: Pool | undefined; }
export const db = globalThis.__pulsoDb ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, application_name: "pulso-social" });
if (process.env.NODE_ENV !== "production") globalThis.__pulsoDb = db;

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
