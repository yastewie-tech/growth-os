import "dotenv/config";
import { db } from "./db.js";
import { users } from "../shared/schema.js";

async function createAdmin() {
  console.log("👤 Создаю администратора...");
  
  try {
    // Создаем админа (без поля name, так как мы его удалили)
    await db.insert(users).values({
      username: "admin",
      password: "123",
      role: "admin",
    }).onConflictDoNothing(); // Если такой уже есть - ничего не делать

    console.log("✅ Готово!");
    console.log("👉 Admin: admin / 123");
    process.exit(0);
  } catch (e) {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  }
}

createAdmin();