import fs from "fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// если у тебя есть schema import — оставь как было
// import * as schema from "./schema";

const exampleUrl =
  "postgresql://user:password@host:5432/dbname?sslmode=require";

function readSecretFile(p: string) {
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  } catch {}
  return "";
}

function resolveDatabaseUrl() {
  // 1) обычный env
  const envUrl = (process.env.DATABASE_URL || "").trim();
  if (envUrl) return envUrl;

  // 2) Render Secret File (если ты хранишь строку так)
  const secretFileUrl = readSecretFile("/etc/secrets/DATABASE_URL");
  if (secretFileUrl) return secretFileUrl;

  // 3) иногда люди кладут как DATABASE_URL — тоже поддержим
  const alt = (process.env.DATABASE_URL || "").trim();
  if (alt) return alt;

  return "";
}

function validateDatabaseUrl(url: string) {
  if (!url) {
    throw new Error(
      `DATABASE_URL is missing. Provide a valid Postgres connection string, e.g. ${exampleUrl}`
    );
  }
  // простая sanity-check
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(
      `DATABASE_URL looks invalid (must start with postgres:// or postgresql://). Example: ${exampleUrl}`
    );
  }
}

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = resolveDatabaseUrl();
  validateDatabaseUrl(url);

  // важно: для Neon обычно ssl нужен — он у тебя уже в строке ?sslmode=require
  const client = postgres(url, {
    // разумные дефолты
    max: 5,
    idle_timeout: 20,
    connect_timeout: 20,
  });

  // если у тебя schema подключается — раскомментируй schema
  _db = drizzle(client /*, { schema }*/);
  return _db;
}