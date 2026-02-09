// DEPRECATED: Use shared/schema.ts
// import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
// import { sql } from "drizzle-orm";

// export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull().default("Сотрудник"), // <--- ЭТА СТРОКА ДОЛЖНА БЫТЬ
  password: text("password").notNull(),
  role: text("role").default("member").notNull(),
});

// --- 2. Таблица ТОВАРЫ ---
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
});

// --- 3. Таблица A/B ТЕСТЫ ---
export const abTests = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  category: text("category").notNull(),
  platform: text("platform").notNull(),
  
  // Тип теста (ctr, cr, rich)
  testType: text("test_type").notNull(),
  
  status: text("status").notNull().default("backlog"),
  description: text("description"),
  
  metricCurrent: text("metric_current"),
  metricGoal: text("metric_goal"),
  
  position: integer("position").default(0),
  
  // --- Вернули поля для будущего (необязательные) ---
  tier: text("tier"),     // <--- Вернули
  sprint: text("sprint"), // <--- Вернули
  
  // Создатель задачи
  authorId: integer("author_id").references(() => users.id).notNull(),
});

// --- Zod Схемы (для совместимости) ---
// Упрощенные версии (не используются, но оставлены для совместимости)
export const insertUserSchema = {} as any;
export const selectUserSchema = {} as any;

export const insertABTestSchema = {} as any;
export const selectABTestSchema = {} as any;

export type User = {
  id: number;
  username: string;
  name: string;
  password?: string;
  role: string;
};

export type InsertUser = {
  username: string;
  name: string;
  password: string;
  role?: string;
};

export type ABTest = {
  id: number;
  sku: string;
  productName: string;
  category: string;
  platform: string;
  testType: string;
  tier: string;
  status: string;
  description?: string;
  images: string[];
  references: string[];
  metricCurrent?: string;
  metricGoal?: string;
  position: number;
  sprint?: string;
  authorId?: number;
};

export type InsertABTest = {
  sku: string;
  productName: string;
  category: string;
  platform: string;
  testType: string;
  tier?: string;
  status?: string;
  description?: string;
  images?: string[];
  references?: string[];
  metricCurrent?: string;
  metricGoal?: string;
  position?: number;
  sprint?: string;
  authorId?: number;
};