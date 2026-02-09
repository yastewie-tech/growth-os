// server/db.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../shared/schema.js";

const exampleUrl =
  "postgresql://user:password@host:5432/dbname?sslmode=require";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim() || "";
  console.log("DATABASE_URL present:", Boolean(url));
  return url;
}

function validateDatabaseUrl(url: string) {
  if (!url) {
    throw new Error(
      `DATABASE_URL is missing. Provide a valid Postgres connection string, e.g. ${exampleUrl}`
    );
  }
}

let _db: any | null = null;

function createDb() {
  const url = getDatabaseUrl();
  validateDatabaseUrl(url);

  // Neon обычно требует sslmode=require
  const sql = postgres(url, {
    ssl: "require",
    max: 5,
    prepare: false,
  });

  // Передаём schema — если schema импортируется корректно,
  // drizzle будет иметь db.query.users и т.п.
  return drizzle(sql, { schema });
}

// Экспортируем db как any, чтобы routes.ts не падал на типах
export const db: any = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!_db) _db = createDb();
      return (_db as any)[prop as any];
    },
  }
);

// Если где-то используешь lazy getter:
export function getDb(): any {
  if (!_db) _db = createDb();
  return _db;
}