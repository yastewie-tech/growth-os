import "dotenv/config";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function manualFix() {
  console.log("🔧 Начинаем принудительный ремонт...");

  try {
    // 1. Чиним таблицу ab_tests (добавляем images)
    console.log("👉 Добавляем колонку images...");
    await db.execute(sql`
      ALTER TABLE "ab_tests" 
      ADD COLUMN IF NOT EXISTS "images" text[] DEFAULT '{}'::text[] NOT NULL;
    `);
    console.log("✅ Колонка images добавлена!");

    // 2. На всякий случай проверим таблицу users (колонку name)
    console.log("👉 Проверяем колонку name у пользователей...");
    await db.execute(sql`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "name" text DEFAULT 'Сотрудник' NOT NULL;
    `);
    console.log("✅ Колонка name проверена!");

    console.log("🎉 РЕМОНТ ЗАВЕРШЕН. Теперь все заработает.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Ошибка при ремонте:", e);
    console.log("Если ошибка 'relation ab_tests does not exist' — значит таблицы нет совсем. Тогда нужен drizzle-kit push.");
    process.exit(1);
  }
}

manualFix();