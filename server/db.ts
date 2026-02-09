import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "../shared/schema.js";

const exampleUrl = "postgresql://user:password@host:5432/dbname?sslmode=require";

let _sql: Sql | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function validateDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error(
      `DATABASE_URL is missing. Provide a valid Postgres connection string, e.g. ${exampleUrl}`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`DATABASE_URL is invalid. Expected format: ${exampleUrl}`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(
      `DATABASE_URL must start with postgres:// or postgresql://. Example: ${exampleUrl}`
    );
  }

  return value;
}

function getDb() {
  if (_db) return _db;

  const databaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);

  _sql = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 20,
  });

  _db = drizzle(_sql, { schema });
  return _db;
}

// ВАЖНО: сохраняем прежний API `export { db }`
export const db = new Proxy({} as any, {
  get(_t, prop) {
    const real = getDb() as any;
    return real[prop];
  },
});