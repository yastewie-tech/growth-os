import "dotenv/config";
import { db } from "./db";
import { sql } from "drizzle-orm";

async function resetAndInit() {
  try {
    console.log("🔄 Сбрасываем таблицы...");
    
    // Удаляем таблицы если они существуют
    await db.execute(sql`DROP TABLE IF EXISTS "ab_tests" CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS "users" CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS "products" CASCADE`);
    
    console.log("✅ Таблицы удалены");
    console.log("📝 Пересоздаём таблицы...");
    
    // Пересоздаём таблицы
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" text NOT NULL UNIQUE,
        "name" text NOT NULL DEFAULT 'Сотрудник',
        "password" text NOT NULL,
        "role" text NOT NULL DEFAULT 'member'
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" serial PRIMARY KEY NOT NULL,
        "sku" text NOT NULL UNIQUE,
        "name" text NOT NULL,
        "category" text NOT NULL
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "ab_tests" (
        "id" serial PRIMARY KEY NOT NULL,
        "sku" text NOT NULL,
        "product_name" text NOT NULL,
        "category" text NOT NULL,
        "platform" text NOT NULL,
        "test_type" text NOT NULL,
        "tier" text NOT NULL DEFAULT '3',
        "status" text NOT NULL DEFAULT 'backlog',
        "description" text,
        "images" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "references" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "metric_current" text,
        "metric_goal" text,
        "position" integer DEFAULT 0,
        "sprint" text,
        "author_id" integer REFERENCES "users"("id")
      );
    `);

    console.log("✅ Таблицы пересозданы с поддержкой references!");
    
  } catch (error) {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

resetAndInit();
