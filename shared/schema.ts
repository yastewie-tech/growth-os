import { pgTable, text, serial, integer, real, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- 1. Таблица ПОЛЬЗОВАТЕЛИ ---
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email"),
  name: text("name").notNull().default("Сотрудник"),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- 2. Таблица ТОВАРЫ ---
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  productName: text("product_name").notNull(),
  category: text("category").notNull(),
  platform: text("platform"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;

// --- 2.1. Таблица КОНТЕКСТЫ SKU ---
export const skuContexts = pgTable("sku_contexts", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});


// --- 3. Таблица A/B ТЕСТЫ ---
export const abTests = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  category: text("category").notNull(),
  platform: text("platform").notNull(),
  testType: text("test_type").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  
  // Добавил default("3"), чтобы не ломалось, если форма не шлет tier
  tier: text("tier").notNull().default("3"), 
  
  status: text("status").notNull().default("backlog"),
  description: text("description"),
  
  // --- НОВОЕ ПОЛЕ ДЛЯ КАРТИНОК ---
  // Массив строк, по умолчанию пустой
  images: text("images").array().notNull().default(sql`ARRAY[]::text[]`),
  
  // --- НОВОЕ ПОЛЕ ДЛЯ РЕФЕРЕНСОВ ---
  // Массив URL, по умолчанию пустой
  references: text("references").array().notNull().default(sql`ARRAY[]::text[]`),
  
  metricCurrent: text("metric_current"),
  metricGoal: text("metric_goal"),
  
  position: integer("position").default(0),
  sprint: text("sprint"),
  
  // --- НОВЫЕ ПОЛЯ ДЛЯ LABA ---
  variants: jsonb("variants"), // Храним JSON с метриками/структурой вариантов
  winner: text("winner"), 
  targetMultiplier: real("target_multiplier"),
  voisBenchmark: real("vois_benchmark"),
  manager: text("manager"),
  contentManager: text("content_manager"),
  designerGen: text("designer_gen"),
  designerTech: text("designer_tech"),

  createdBy: text("created_by"),
  hiddenScopes: jsonb("hidden_scopes").notNull().default(sql`'{}'::jsonb`),
  assignees: jsonb("assignees").notNull().default(sql`'{}'::jsonb`),

  // Visibility flags for independent deletion/viewing
  showInBase: boolean("show_in_base").default(true).notNull(),
  showInLab: boolean("show_in_lab").default(false).notNull(),
  showInKanban: boolean("show_in_kanban").default(false).notNull(),

  visibility: jsonb("visibility").notNull().default(sql`'{}'::jsonb`),

  authorId: integer("author_id").references(() => users.id),
});

// --- Zod Схемы (для совместимости) ---
export const insertUserSchema = {} as any;
export const selectUserSchema = {} as any;

export const insertABTestSchema = {} as any;
export const selectABTestSchema = {} as any;

export type User = {
  id: number;
  username: string;
  email?: string | null;
  name: string;
  password?: string;
  role: string;
  isAdmin?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type InsertUser = {
  username: string;
  email?: string | null;
  name: string;
  password: string;
  role?: string;
  isAdmin?: boolean;
  isActive?: boolean;
};

export type SkuContext = typeof skuContexts.$inferSelect;

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
  variants?: any;
  winner?: string;
  targetMultiplier?: number;
  voisBenchmark?: number;
  manager?: string;
  contentManager?: string;
  designerGen?: string;
  designerTech?: string;
  createdBy?: string;
  hiddenScopes?: {
    base?: boolean;
    laba?: boolean;
  };
  assignees?: {
    designer?: string;
    contentManager?: string;
  };
  createdBy?: string;
  hiddenScopes?: {
    base?: boolean;
    laba?: boolean;
  };
  assignees?: {
    designer?: string;
    contentManager?: string;
  };
  showInBase?: boolean;
  showInLab?: boolean;
  showInKanban?: boolean;
  visibility?: {
    base?: boolean;
    lab?: boolean;
    kanban?: boolean;
  };
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
  showInBase?: boolean;
  showInLab?: boolean;
  showInKanban?: boolean;
  visibility?: {
    base?: boolean;
    lab?: boolean;
    kanban?: boolean;
  };
  authorId?: number;
};