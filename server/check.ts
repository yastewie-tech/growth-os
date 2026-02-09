import { db } from "./db.js";
import { users } from "../shared/schema.js";

async function check() {
  console.log("🕵️‍♂️ Проверяем пользователей в базе...");
  try {
    const allUsers = await db.select().from(users);
    console.log("Найдено пользователей:", allUsers.length);
    console.log(allUsers);
    process.exit(0);
  } catch (e) {
    console.error("❌ Ошибка чтения:", e);
    process.exit(1);
  }
}

check();
