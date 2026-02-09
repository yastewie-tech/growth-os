import "dotenv/config";
import { db } from "./db";
import { sql } from "drizzle-orm";

async function forceInit() {
  console.log("🔨 Принудительное создание таблиц...");

  try {
    // 1. Прямой SQL запрос на создание таблицы пользователей
    // Полностью соответствует тому, что написано в schema.ts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" text NOT NULL UNIQUE,
        "password" text NOT NULL,
        "role" text DEFAULT 'manager' NOT NULL,
        "name" text NOT NULL,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ Таблица 'users' создана вручную.");

    // 2. Добавляем колонку author_id в ab_tests, если её нет
    // Используем безопасный блок DO, чтобы не упасть, если колонка уже есть
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ab_tests' AND column_name='author_id') THEN
          ALTER TABLE "ab_tests" ADD COLUMN "author_id" integer REFERENCES "users"("id");
        END IF;
      END $$;
    `);
    console.log("✅ Связь 'author_id' проверена/добавлена.");
    
    process.exit(0);
  } catch (e) {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  }
}

forceInit();
