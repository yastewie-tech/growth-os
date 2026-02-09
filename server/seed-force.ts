import "dotenv/config";
import { db } from "./db.js";
import { products, users, abTests } from "../shared/schema.js";

async function forceSeed() {
  console.log("☢️  Перезаливка базы с именами...");

  try {
    // Чистим старое
    await db.delete(abTests);
    await db.delete(products);
    await db.delete(users);

    // 1. Товары
    console.log("🌱 Товары...");
    await db.insert(products).values([
      { sku: "10001", productName: "Электрическая зубная щетка Pro", category: "oral care" },
      { sku: "10002", productName: "Профессиональный шампунь (1л)", category: "hair" },
      { sku: "10003", productName: "Увлажняющий лосьон для тела", category: "body" },
      { sku: "10004", productName: "Тональная основа Matte", category: "make-up" },
      { sku: "10005", productName: "Сыворотка с гиалуроновой кислотой", category: "face" },
      // Добавим еще для проверки поиска
      { sku: "20001", productName: "Помада красная", category: "make-up" },
      { sku: "20002", productName: "Крем для рук", category: "body" },
    ]);

    // 2. Пользователи с ИМЕНАМИ
    console.log("👤 Люди...");
    const usersResult = await db.insert(users).values([
      { username: "admin", name: "Алексей Смирнов", password: "123", role: "admin" },
      { username: "masha", name: "Мария Петрова", password: "123", role: "member" },
      { username: "dima", name: "Дмитрий Волков", password: "123", role: "member" },
    ]).returning();

    const adminId = usersResult[0].id;

    // 3. AB тесты
    console.log("🧪 AB-тесты...");
    await db.insert(abTests).values([
      {
        sku: "10001",
        productName: "Электрическая зубная щетка Pro",
        category: "oral care",
        platform: "Web",
        testType: "CRO",
        tier: "1",
        status: "active",
        description: "Тестирование цвета CTA кнопки",
        images: ["https://images.unsplash.com/photo-1584308666744-24d5f00206dd?w=300"],
        references: [],
        metricCurrent: "3.2%",
        metricGoal: "5%",
        authorId: adminId,
        sprint: "Sprint 25",
      },
      {
        sku: "10002",
        productName: "Профессиональный шампунь (1л)",
        category: "hair",
        platform: "Mobile",
        testType: "UX",
        tier: "2",
        status: "active",
        description: "Новый чекаут флоу",
        images: ["https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300"],
        references: [],
        metricCurrent: "2.1%",
        metricGoal: "4%",
        authorId: adminId,
        sprint: "Sprint 25",
      },
      {
        sku: "10003",
        productName: "Увлажняющий лосьон для тела",
        category: "body",
        platform: "Web",
        testType: "Content",
        tier: "3",
        status: "backlog",
        description: "Тестирование описания товара",
        images: ["https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=300"],
        references: [],
        metricCurrent: null,
        metricGoal: null,
        authorId: adminId,
      },
      {
        sku: "10004",
        productName: "Тональная основа Matte",
        category: "make-up",
        platform: "Mobile",
        testType: "Performance",
        tier: "1",
        status: "completed",
        description: "Оптимизация скорости загрузки",
        images: ["https://images.unsplash.com/photo-1596462502278-af96fcee71b5?w=300"],
        references: [],
        metricCurrent: "1.5s",
        metricGoal: "0.8s",
        authorId: adminId,
      },
    ]).returning();

    console.log("✅ Готово! Созданы люди и AB-тесты.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  }
}

forceSeed();