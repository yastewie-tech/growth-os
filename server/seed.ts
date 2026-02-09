import { db } from "./db.js";
import { products } from "../shared/schema.js";

async function seed() {
  console.log("🌱 Заполняем базу реальными категориями...");

  try {
    await db.insert(products).values([
      // oral care
      { sku: "10001", productName: "Электрическая зубная щетка Pro", category: "oral care" },
      // hair
      { sku: "10002", productName: "Профессиональный шампунь (1л)", category: "hair" },
      // body
      { sku: "10003", productName: "Увлажняющий лосьон для тела", category: "body" },
      // make-up
      { sku: "10004", productName: "Тональная основа Matte", category: "make-up" },
      // face
      { sku: "10005", productName: "Сыворотка с гиалуроновой кислотой", category: "face" },
    ]).onConflictDoNothing(); // Если товары уже есть, не дублируем их

    console.log("✅ Товары добавлены!");
    process.exit(0);
  } catch (e) {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  }
}

seed();