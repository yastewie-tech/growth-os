import fs from "fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../shared/schema.js";

const exampleUrl = "postgresql://user:password@host:5432/dbname?sslmode=require";

let _sql: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function readSecretFile(filePath: string) {
  try {
    if (!filePath) return null;
    if (!fs.existsSync(filePath)) return null;
    const value = fs.readFileSync(filePath, "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function resolveDatabaseUrl() {
  let url = (process.env.DATABASE_URL || "").trim();

  if (!url) {
    url =
      readSecretFile(process.env.DATABASE_URL_FILE || "") ||
      readSecretFile("/etc/secrets/DATABASE_URL") ||
      readSecretFile("/etc/secrets/DATABASE_URL.txt") ||
      "";
  }

  return url.trim();
}

function validateDatabaseUrl(value: string) {
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
    throw new Error(`DATABASE_URL must start with postgres:// or postgresql://. Example: ${exampleUrl}`);
  }

  if (value.includes("neon.tech") && !/sslmode=/.test(value)) {
    return value + (value.includes("?") ? "&" : "?") + "sslmode=require";
  }

  return value;
}

export function getDb() {
  if (_db) return _db;

  const connectionString = validateDatabaseUrl(resolveDatabaseUrl());

  _sql = postgres(connectionString, {
    ssl: "require",
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  _db = drizzle(_sql, { schema });
  return _db;
}

// Preserve existing API: export { db } with lazy init to avoid crashes on import.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_t, prop) {
    const real = getDb();
    return (real as any)[prop];
  },
});