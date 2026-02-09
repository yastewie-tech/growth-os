import "dotenv/config";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function hardReset() {
  console.log("🧨 Сносим таблицы...");
  try {
    // CASCADE удаляет таблицу и все связи
    await db.execute(sql`DROP TABLE IF EXISTS "ab_tests" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "products" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "users" CASCADE;`);
    
    console.log("✅ База полностью чиста.");
    process.exit(0);
  } catch (e) {
    console.error("Ошибка:", e);
    process.exit(1);
  }
}

hardReset();