import { db } from "./db.js";
import { users } from "../shared/schema.js";

async function checkUsers() {
  console.log("🔍 Смотрю в базу данных...");
  
  try {
    const allUsers = await db.select().from(users);
    
    if (allUsers.length === 0) {
      console.log("❌ Таблица пользователей пуста!");
    } else {
      console.log("✅ Найдены пользователи:");
      allUsers.forEach((u: any) => {
        console.log(`- Login: '${u.username}' | Pass: '${u.password}' | Role: ${u.role}`);
      });
    }
    process.exit(0);
  } catch (e) {
    console.error("❌ Ошибка чтения:", e);
    process.exit(1);
  }
}

checkUsers();
