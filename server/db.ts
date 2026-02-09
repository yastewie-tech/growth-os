import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js"; // 1. Импортируем схему

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing");
}

const client = postgres(process.env.DATABASE_URL);

// 2. Передаем схему в drizzle, чтобы работали команды типа findFirst
export const db = drizzle(client, { schema });