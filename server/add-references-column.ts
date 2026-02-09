import "dotenv/config";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function addReferencesColumn() {
  try {
    console.log("🔄 Добавляю колонку references если её нет...");
    
    // Добавляем колонку references если её нет
    await db.execute(
      sql`ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "references" text[] DEFAULT ARRAY[]::text[]`
    );
    
    console.log("✅ Колонка references успешно добавлена!");
  } catch (error) {
    console.error("❌ Ошибка при добавлении колонки:", error);
    process.exit(1);
  }
}

addReferencesColumn();
