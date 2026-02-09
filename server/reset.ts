import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function reset() {
  console.log("💥 Сносим старые таблицы...");
  try {
    // Удаляем таблицу тестов (она вызывает ошибку)
    await db.execute(sql`DROP TABLE IF EXISTS "ab_tests" CASCADE;`);
    // Удаляем товары (на всякий случай)
    await db.execute(sql`DROP TABLE IF EXISTS "products" CASCADE;`);
    
    console.log("✅ Таблицы удалены. Путь свободен!");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

reset();