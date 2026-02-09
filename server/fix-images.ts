import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function fix() {
  console.log("🔧 Удаляем таблицу ab_tests...");
  // Удаляем только таблицу тестов, товары и пользователей не трогаем
  await db.execute(sql`DROP TABLE IF EXISTS "ab_tests" CASCADE;`);
  console.log("✅ Таблица удалена. Теперь можно создавать новую.");
  process.exit(0);
}

fix();