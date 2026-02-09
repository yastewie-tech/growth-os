import { db } from "./db";
import { sql } from "drizzle-orm";

async function addReferencesColumn() {
  try {
    console.log("📝 Добавляем колонку references...");
    
    await db.execute(
      sql`ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "references" text[] DEFAULT ARRAY[]::text[];`
    );
    
    console.log("✅ Колонка references успешно добавлена!");
  } catch (error) {
    console.error("❌ Ошибка при добавлении колонки:", error);
  }
}

addReferencesColumn();
