import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import { registerRoutes } from "./routes.js";
import { serveStatic, log } from "./vite.js";
import { db } from "./db.js";
import { users, abTests } from "../shared/schema.js";
import { sql } from "drizzle-orm";

const app = express();

const readSecretFile = (filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
};

const resolveDatabaseUrl = () =>
  process.env.DATABASE_URL?.trim() || readSecretFile("/etc/secrets/DATABASE_URL");

// --- ВОТ ЭТОЙ СТРОКИ НЕ ХВАТАЛО: ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));
// -----------------------------------

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Логирование запросов
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  const databaseUrl = resolveDatabaseUrl();
  log(`DB URL present: ${Boolean(databaseUrl)}`, "db");
  log(`DB URL length: ${databaseUrl.length}`, "db");

  // Schema sync is handled by drizzle-kit push

  const ensureAbTestsColumns = async () => {
    try {
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "images" text[] NOT NULL DEFAULT ARRAY[]::text[];
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
      `);
      await db.execute(sql`
        UPDATE "ab_tests"
          SET created_at = COALESCE(created_at, now());
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "references" text[] NOT NULL DEFAULT ARRAY[]::text[];
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "metric_current" text,
          ADD COLUMN IF NOT EXISTS "metric_goal" text;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "sprint" text;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "variants" jsonb,
          ADD COLUMN IF NOT EXISTS "winner" text,
          ADD COLUMN IF NOT EXISTS "target_multiplier" real,
          ADD COLUMN IF NOT EXISTS "vois_benchmark" real;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "manager" text,
          ADD COLUMN IF NOT EXISTS "content_manager" text,
          ADD COLUMN IF NOT EXISTS "designer_gen" text,
          ADD COLUMN IF NOT EXISTS "designer_tech" text;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "created_by" text;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "hidden_scopes" jsonb NOT NULL DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS "assignees" jsonb NOT NULL DEFAULT '{}'::jsonb;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "show_in_base" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "show_in_lab" boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "show_in_kanban" boolean NOT NULL DEFAULT false;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "visibility" jsonb NOT NULL DEFAULT '{}'::jsonb;
      `);
      await db.execute(sql`
        ALTER TABLE "ab_tests"
          ADD COLUMN IF NOT EXISTS "author_id" integer REFERENCES "users"("id");
      `);
    } catch (error) {
      log("⚠️  Не удалось синхронизировать колонки ab_tests, продолжаю работу...");
      console.error(error);
    }
  };

  const ensureAdminSchema = async () => {
    try {
      await db.execute(sql`
        ALTER TABLE "users"
          ADD COLUMN IF NOT EXISTS "email" text,
          ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
      `);
      await db.execute(sql`
        UPDATE "users"
          SET email = COALESCE(email, username || '@local'),
              is_admin = CASE WHEN role = 'admin' THEN true ELSE is_admin END,
              is_active = COALESCE(is_active, true),
              updated_at = COALESCE(updated_at, now()),
              created_at = COALESCE(created_at, now());
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
      `);

      await db.execute(sql`
        ALTER TABLE "products"
          ADD COLUMN IF NOT EXISTS "product_name" text,
          ADD COLUMN IF NOT EXISTS "platform" text,
          ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
      `);
      await db.execute(sql`
        UPDATE "products"
          SET product_name = COALESCE(product_name, name),
              is_active = COALESCE(is_active, true),
              updated_at = COALESCE(updated_at, now()),
              created_at = COALESCE(created_at, now());
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "sku_contexts" (
          "id" serial PRIMARY KEY,
          "sku" text NOT NULL,
          "title" text NOT NULL,
          "kind" text NOT NULL,
          "content" text NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_by_user_id" integer,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "archived_at" timestamptz
        );
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "sku_contexts_sku_active_idx" ON "sku_contexts" ("sku", "is_active");
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "sku_contexts_sku_archived_idx" ON "sku_contexts" ("sku", "archived_at");
      `);
    } catch (error) {
      log("⚠️  Не удалось синхронизировать admin-схему, продолжаю работу...");
      console.error(error);
    }
  };

  const shouldInitDb = process.env.DB_INIT_ON_START === "true";

  const initDb = async () => {
    const existingUsers = await db.select().from(users);
    const existingTests = await db.select().from(abTests);

    if (existingUsers.length === 0 || existingTests.length === 0) {
      log("📝 БД пуста, инициализирую данные...");

      // Чистим старое
      await db.delete(abTests);
      await db.delete(users);

      // Создаем пользователей
      const usersResult = await db.insert(users).values([
        { username: "admin", name: "Алексей Смирнов", password: "123", role: "admin" },
        { username: "masha", name: "Мария Петрова", password: "123", role: "member" },
        { username: "dima", name: "Дмитрий Волков", password: "123", role: "member" },
      ]).returning();

      const adminId = usersResult[0].id;

      // Создаем AB-тесты
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
      ]);

      log("✅ БД инициализирована с данными!");
    }
  };

  // Проверяем и инициализируем БД если нужно
  try {
    if (shouldInitDb) {
      await ensureAbTestsColumns();
      await ensureAdminSchema();
      await initDb();
    } else {
      log("DB init on start is disabled (set DB_INIT_ON_START=true to enable)", "db");
    }
  } catch (error) {
    log("⚠️  Не удалось инициализировать БД, продолжаю работу...");
    console.error(error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err?.message || err);
    res.status(500).json({ error: "SERVER_ERROR" });
  });

  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || 3000);
  const host = "0.0.0.0";
  server.listen(port, host, () => {
    log(`serving on port ${port}`);
  });
})();
