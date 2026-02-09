import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "./db.js";
import { abTests, users, products, skuContexts } from "../shared/schema.js";
import { eq, desc, and, or, ilike, sql, isNull } from "drizzle-orm";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

type GenerateHypothesisParams = {
  productName: string;
  productContext: string;
  type: "CTR" | "CR";
  painPoints: string[];
  currentImages: string[]; // base64 data URLs
  competitorImages: string[]; // base64 data URLs
};

const safeArrayOfStrings = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

const buildHypothesisPrompt = (params: GenerateHypothesisParams) => {
  const isCTR = params.type === "CTR";

  return `
Ты — Маркетолог-Стратег. Верни СТРОГИЙ JSON ответ.

ТОВАР: ${params.productName}
ИНФО: ${params.productContext}
ТРИГГЕРЫ: ${(params.painPoints ?? []).join(", ")}

ЗАДАЧА:
${
  isCTR
    ? "Придумай 3 варианта Главного Фото (CTR). Сравни с конкурентом."
    : 'Разработай структуру воронки (5-7 слайдов) по методу "Скользкая горка".'
}

ФОРМАТ ОТВЕТА (JSON):
{
  "analysis": "Анализ текущей ситуации (Наши фото vs Конкурент). В чем мы слабее?",
  "items": [
    {
      "title": "${isCTR ? "Вариант 1 (Название концепции)" : "Слайд 1 (Заголовок)"}",
      "visual": "ТЗ дизайнеру: что показать визуально",
      "text": "Копирайтинг: текст на макете",
      "badge": "Главный триггер (коротко)"
    }
  ]
}
`.trim();
};

const isDataImage = (s: string) => typeof s === "string" && s.startsWith("data:image");

const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI is not configured: missing OPENAI_API_KEY. Set it in .env or enable AI_MOCK=1 for local mock."
    );
  }
  return new OpenAI({ apiKey });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // IMPORTANT: allow large JSON because base64 images can be big
  app.use(express.json({ limit: "25mb" }));

  const wrapAsync =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  // --- HELPERS ---
  const safeJsonParse = <T>(text: string): T => {
    try {
      return JSON.parse(text) as T;
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) {
        throw new Error(`AI returned non-JSON response. Head: ${text.slice(0, 200)}`);
      }
      const candidate = text.slice(start, end + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch (e: any) {
        throw new Error(`AI returned invalid JSON. ParseError: ${e?.message ?? "unknown"}`);
      }
    }
  };

  const parseBoolean = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return undefined;
  };

  const getRequestUser = async (req: express.Request) => {
    const idHeader = req.header("x-user-id");
    if (!idHeader) return null;
    const id = Number(idHeader);
    if (!Number.isFinite(id)) return null;
    const found = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return found[0] ?? null;
  };

  const isAdminUser = (user: any) => Boolean(user?.isAdmin || user?.role === "admin");

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const normalizeTestType = (value: unknown) => {
    const s = String(value ?? "").trim().toUpperCase();
    if (s === "CRT") return "CTR";
    if (s === "РИЧ") return "RICH";
    if (s === "CR") return "CR";
    if (s === "RICH") return "RICH";
    return "CTR";
  };

  const parseMetric = (value: unknown) => {
    if (value === null || value === undefined) return 0;
    const s = String(value).replace(",", ".").replace(/[^\d.]/g, "");
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const resolveLabMembership = (test: any) => {
    const visibility = test?.visibility;
    if (visibility && typeof visibility === "object" && visibility.lab === true) return true;
    return false;
  };

  const normalizeVariants = (raw: any) => {
    if (!raw) return {} as any;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return {} as any;
    try {
      return JSON.parse(raw);
    } catch {
      return {} as any;
    }
  };

  const getImagesMap = (test: any) => {
    const variants = normalizeVariants(test?.variants);
    const perVariantMap: Record<string, string> = {};
    ["A", "B", "C", "D", "E"].forEach((key) => {
      const arr = variants?.[key]?.assets?.images;
      if (Array.isArray(arr) && arr[0]) perVariantMap[key] = arr[0];
    });
    if (Object.keys(perVariantMap).length > 0) return perVariantMap;

    const assetsImages = variants?.assets?.images;
    if (assetsImages && typeof assetsImages === "object") return assetsImages;
    const legacyImages = variants?.images;
    if (legacyImages && typeof legacyImages === "object") return legacyImages;
    if (Array.isArray(test?.images)) {
      const map: Record<string, string> = {};
      ["A", "B", "C", "D", "E"].forEach((key, idx) => {
        const url = test.images[idx];
        if (url) map[key] = url;
      });
      return map;
    }
    return {} as Record<string, string>;
  };

  const getMetricMap = (test: any) => {
    const variants = normalizeVariants(test?.variants);
    return variants || {};
  };

  const getMetricValue = (metrics: any, variant: string, metricKey: "ctr" | "cr") =>
    parseMetric(metrics?.[variant]?.[metricKey]);

  const getComparableVariants = (testType: string) => (testType === "CR" ? ["B"] : ["B", "C", "D", "E"]);

  const getBestVariant = (metrics: any, testType: string, metricKey: "ctr" | "cr") => {
    const candidates = getComparableVariants(testType);
    let bestVariant = "A";
    let bestValue = 0;
    for (const v of candidates) {
      const val = getMetricValue(metrics, v, metricKey);
      if (val > bestValue) {
        bestValue = val;
        bestVariant = v;
      }
    }
    return { bestVariant, bestValue };
  };

  const calcGoal1 = (valA: number, targetMultiplier: unknown, metricGoal: unknown) => {
    const directGoal = parseMetric(metricGoal);
    if (directGoal > 0) return directGoal;
    if (valA <= 0) return 0;
    const mul = parseMetric(targetMultiplier) || 1.2;
    return valA * mul;
  };

  const countPreparedVariants = (metrics: any, testType: string, metricKey: "ctr" | "cr") => {
    const candidates = getComparableVariants(testType);
    let prepared = 0;
    candidates.forEach((v) => {
      if (getMetricValue(metrics, v, metricKey) > 0) prepared += 1;
    });
    return prepared;
  };

  const requireAdmin = async (req: express.Request, res: express.Response) => {
    const user = await getRequestUser(req);
    if (!user || !isAdminUser(user) || user.isActive === false) {
      res.status(403).json({ message: "Нет доступа" });
      return null;
    }
    return user;
  };

  // --- API: AI HEALTH ---
  app.get("/api/ai/health", (_req, res) => {
    const aiMock = process.env.AI_MOCK === "1";
    res.json({
      ok: true,
      ai_mock_enabled: aiMock,
      openai_key_present: !!process.env.OPENAI_API_KEY,
      node_env: process.env.NODE_ENV ?? "unknown",
      runtime: { node: process.version, pid: process.pid },
      env_loaded: true,
    });
  });

  // --- API: AI MIXER - GENERATE HYPOTHESIS (JSON mode) ---
  app.post("/api/ai/generate-hypothesis", async (req, res) => {
    try {
      const body = req.body ?? {};
      const params: GenerateHypothesisParams = {
        productName: normalizeText(body.productName),
        productContext: normalizeText(body.productContext),
        type: body.type === "CR" ? "CR" : "CTR",
        painPoints: safeArrayOfStrings(body.painPoints),
        currentImages: safeArrayOfStrings(body.currentImages),
        competitorImages: safeArrayOfStrings(body.competitorImages),
      };

      const isMock = process.env.AI_MOCK === "1" || !process.env.OPENAI_API_KEY;

      if (!params.productName) return res.status(400).json({ message: "productName обязателен" });
      if (!params.productContext) return res.status(400).json({ message: "productContext обязателен" });

      console.log(`🧪 AI Mixer hypothesis. type=${params.type}. mock=${isMock}`);

      if (isMock) {
        await new Promise((r) => setTimeout(r, 800));
        return res.json({
          json: JSON.stringify({
            analysis: `MOCK: анализ для ${params.productName}. Триггеры: ${(params.painPoints ?? []).slice(0, 6).join(", ")}`,
            items: [
              {
                title: params.type === "CTR" ? "Вариант 1 (Эмоция + результат)" : "Слайд 1 (Боль)",
                visual: "MOCK: визуальный хук + читаемый заголовок.",
                text: "MOCK: короткий текст.",
                badge: "MOCK",
              },
              {
                title: params.type === "CTR" ? "Вариант 2 (До/После)" : "Слайд 2 (Обещание)",
                visual: "MOCK: сравнение/преимущество.",
                text: "MOCK: короткий текст.",
                badge: "MOCK",
              },
              {
                title: params.type === "CTR" ? "Вариант 3 (Доверие)" : "Слайд 3 (Доказательство)",
                visual: "MOCK: соцдоказательство/бейдж.",
                text: "MOCK: короткий текст.",
                badge: "MOCK",
              },
            ],
          }),
        });
      }

      const openai = getOpenAI();
      const prompt = buildHypothesisPrompt(params);

      const contentParts: any[] = [{ type: "text", text: prompt }];

      const addImages = (imgs: string[], label: string) => {
        const safeImgs = (imgs ?? []).filter((x) => typeof x === "string");
        if (!safeImgs.length) return;
        contentParts.push({ type: "text", text: `\n${label}:` });
        safeImgs.forEach((b64) => {
          if (isDataImage(b64)) {
            contentParts.push({ type: "image_url", image_url: { url: b64, detail: "low" } });
          }
        });
      };

      addImages(params.currentImages, "НАШИ ФОТО");
      addImages(params.competitorImages, "КОНКУРЕНТ");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: contentParts }],
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });

      const json = completion.choices?.[0]?.message?.content ?? "";
      return res.json({ json });
    } catch (e: any) {
      console.error("❌ /api/ai/generate-hypothesis error:", e?.message || e);
      return res.status(500).json({ message: "AI Generation failed" });
    }
  });

  // --- API: AI INSIGHT GENERATION (Server-Side) ---
  app.post("/api/ai/insight", async (req, res) => {
    try {
      const { testId, productName, description, testType, imagesToAnalyze } = req.body;

      // IMPORTANT: OpenAI client uses ONLY OPENAI_API_KEY
      const apiKey = process.env.OPENAI_API_KEY;
      const isMock = !apiKey || process.env.AI_MOCK === "1";

      console.log(`🤖 AI Insight Request for Test #${testId} (${testType}). Mock: ${isMock}`);

      if (isMock) {
        await new Promise((r) => setTimeout(r, 1500));
        return res.json({
          insightJsonString: JSON.stringify({
            meta: { mode: "insight", test_type: testType, generated_at: new Date().toISOString() },
            analysis: {
              current_state: `Mock analysis for ${productName}. Detected ${imagesToAnalyze?.length || 0} variants.`,
              competitor_gap: "Competitors use brighter colors and emotional faces.",
              visual_hooks: ["Add 'Best Seller' badge", "Use green background"],
            },
            market_insight: "Users respond well to before/after comparisons in this category.",
            items:
              imagesToAnalyze?.map((img: any, i: number) => ({
                title: `Feedback on ${img.label || "Variant"}`,
                visual: "Improve contrast and add CTA.",
                badge: i === 0 ? "Control" : "Variant",
              })) || [],
          }),
        });
      }

      const openai = getOpenAI();

      const prompt = `
Role: Senior Conversion Rate Optimization Specialist & UI/UX Critic.
Task: Analyze A/B test variants strictly against the schema provided.

Context:
- Product: ${productName}
- Description: ${description}
- Test Type: ${testType}
- Variant Labels: ${imagesToAnalyze.map((img: any) => img.label).join(", ")}

Output Schema (Strict JSON):
{
  "meta": {
    "analysis_date": "ISO String",
    "model_version": "gpt-4o",
    "strategy_applied": "Name of the CRO framework used (e.g. LIFT, Cialdini)",
    "confidence_score": 0.0 to 1.0,
    "tokens_used": 0
  },
  "analysis": {
    "visual_hierarchy_score": 0-10,
    "clarity_score": 0-10,
    "emotional_impact_score": 0-10,
    "summary": "High-level summary of the test comparing variants.",
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"]
  },
  "market_insight": {
    "competitor_comparison": "How this compares to category leaders",
    "trend_alignment": "Modern vs Outdated",
    "target_audience_resonance": "Predicted fit for audience"
  },
  "items": [
    {
      "variant_id": "Matches Variant Label",
      "score": 0-10,
      "reasoning": "Why this score?",
      "improvement_suggestions": ["fix 1", "fix 2"],
      "is_winner": boolean
    }
  ]
}
`.trim();

      const contentParts: any[] = [{ type: "text", text: prompt }];

      const processImage = (url: string) => {
        if (!url || typeof url !== "string") return null;

        // Base64
        if (url.startsWith("data:image")) return { type: "image_url", image_url: { url } };

        // External URL
        if (url.startsWith("http") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
          return { type: "image_url", image_url: { url } };
        }

        // Local File (/uploads/...) => convert to base64
        if (url.startsWith("/uploads/")) {
          try {
            const filePath = path.join(process.cwd(), url);
            if (fs.existsSync(filePath)) {
              const b64 = fs.readFileSync(filePath, { encoding: "base64" });
              const ext = path.extname(filePath).toLowerCase();
              const mime = ext === ".png" ? "image/png" : "image/jpeg";
              return { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } };
            }
          } catch (e) {
            console.error("Failed to read local image for AI:", url, e);
          }
        }
        return null;
      };

      (imagesToAnalyze || []).forEach((img: any) => {
        const p = processImage(img?.url);
        if (p) contentParts.push(p);
      });

      if (contentParts.length === 1 && (imagesToAnalyze || []).length > 0) {
        contentParts[0].text += "\n\n(Note: Images could not be loaded. Perform heuristic analysis based on text only.)";
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert CRO analyst. Use the JSON schema provided." },
          { role: "user", content: contentParts },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const content = response.choices[0].message.content;
      res.json({ insightJsonString: content });
    } catch (error: any) {
      console.error("❌ AI Insight Error:", error?.message || error);
      res.status(500).json({ message: "AI Generation failed" });
    }
  });

  // --- API: AI GENERATE (Legacy/Generic) ---
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt, mode = "assist" } = req.body;
      const apiKey = process.env.OPENAI_API_KEY;
      const isMock = process.env.AI_MOCK === "1";

      if (process.env.NODE_ENV !== "production") {
        console.log("🤖 AI Request. Mock:", isMock, "Key exists:", !!apiKey);
      }

      if (isMock) {
        console.warn("⚠️ AI Mock Mode Enabled. Returning mock data.");
        await new Promise((r) => setTimeout(r, 1000));

        return res.json({
          meta: {
            mode,
            test_type: "CTR",
            strategy: "safe",
            category: "mock-category",
            generated_at: new Date().toISOString(),
          },
          analysis: {
            summary: "Mock generated hypothesis (AI_MOCK=1).",
            goal: "Demonstrate UI functionality",
            confidence: 0.95,
          },
          market_insight: {
            competitors_do: ["Use standard product shots", "White background"],
            we_do_now: ["Similar to competitors"],
            opportunities: ["Add emotional trigger", "Use bold colors"],
          },
          items: [
            {
              id: "mock-1",
              title: "Mock: Emotional Benefit",
              badge: "Quick Win",
              visual: "Show smiling person using product",
              text: "Connecting product to happiness increases desire.",
              why: "Emotional mirroring",
              apply_as: ["preview"],
              expected_effect: { metric: "CTR", uplift_range: "5-10%" },
            },
            {
              id: "mock-2",
              title: "Mock: Contrast Boost",
              badge: "High Impact",
              visual: "Use bright yellow background",
              text: "Stand out in the feed.",
              why: "Visual salience",
              apply_as: ["preview"],
              expected_effect: { metric: "CTR", uplift_range: "12-15%" },
            },
          ],
        });
      }

      if (!apiKey) {
        throw new Error(
          "AI is not configured: missing OPENAI_API_KEY. Set it in .env or enable AI_MOCK=1 for local mock."
        );
      }

      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant that outputs strict JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No content from OpenAI");

      const parsed = safeJsonParse(content);
      res.json(parsed);
    } catch (error: any) {
      console.error("❌ AI Error:", error?.message || error);
      res.status(500).json({ message: error?.message || "AI Generation failed" });
    }
  });

  // --- API: ВХОД В СИСТЕМУ ---
  app.post(
    "/api/login",
    wrapAsync(async (req, res) => {
      try {
        const { username, password } = req.body;

        const user = await db.query.users.findFirst({
          where: eq(users.username, username),
        });

        if (!user || user.password !== password) {
          return res.status(401).json({ message: "Неверный логин или пароль" });
        }

        if (user.isActive === false) {
          return res.status(403).json({ message: "Пользователь отключен" });
        }

        const { password: _, ...userInfo } = user;
        res.json({
          ...userInfo,
          isAdmin: Boolean(user.isAdmin || user.role === "admin"),
        });
      } catch (error) {
        console.error("❌ /api/login error:", error);
        return res.status(503).json({ error: "DB_UNAVAILABLE" });
      }
    })
  );

  // --- API: ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЕЙ ---
  app.get("/api/users", async (_req, res) => {
    const allUsers = await db.select().from(users);
    const safeUsers = allUsers.map(({ password, ...u }: any) => ({
      ...u,
      isAdmin: Boolean(u.isAdmin || u.role === "admin"),
    }));
    res.json(safeUsers);
  });

  // --- API: ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЯ ПО ID ---
  app.get("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await db.select().from(users).where(eq(users.id, parseInt(id))).limit(1);

      if (user.length === 0) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const { password, ...safeUser } = user[0];
      res.json({
        ...safeUser,
        isAdmin: Boolean(safeUser.isAdmin || safeUser.role === "admin"),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Ошибка при получении пользователя" });
    }
  });

  // --- API: СПРАВОЧНИК ЛЮДЕЙ ---
  app.get("/api/dictionaries/people", async (_req, res) => {
    try {
      const allUsers = await db.select().from(users).where(eq(users.isActive, true));
      const normalizeRole = (value?: string | null) => String(value || "").toLowerCase();

      const designers = allUsers.filter((u: any) => normalizeRole(u.role).includes("designer"));
      const contentManagers = allUsers.filter((u: any) => {
        const role = normalizeRole(u.role);
        return role.includes("content") || role.includes("контент") || role.includes("content_manager");
      });
      const managers = allUsers.filter((u: any) => normalizeRole(u.role).includes("manager"));

      res.json({ designers, contentManagers, managers });
    } catch (error) {
      console.error("❌ Ошибка получения справочника:", error);
      res.status(500).json({ message: "Ошибка базы данных" });
    }
  });

  // --- API: КОНТЕКСТЫ SKU (для LABA) ---
  app.get("/api/sku-contexts/:sku", async (req, res) => {
    try {
      const sku = normalizeText(req.params.sku);
      if (!sku) {
        return res.status(400).json({ message: "SKU обязателен" });
      }

      const contexts = await db
        .select()
        .from(skuContexts)
        .where(and(eq(skuContexts.sku, sku), eq(skuContexts.isActive, true), isNull(skuContexts.archivedAt)));

      res.json(contexts);
    } catch (error) {
      console.error("❌ Ошибка получения контекстов SKU:", error);
      res.status(500).json({ message: "Ошибка базы данных" });
    }
  });

  // --- API: METRICS (LAB ONLY) ---
  app.get("/api/metrics/lab", async (req, res) => {
    try {
      const dateRange = String(req.query.dateRange || "all");
      const category = normalizeText(req.query.category);
      const testTypeFilter = normalizeTestType(req.query.testType);
      const designer = normalizeText(req.query.designer);
      const contentManager = normalizeText(req.query.contentManager);
      const skuSearch = normalizeText(req.query.sku);
      const platform = normalizeText(req.query.platform);

      const allTests = await db.select().from(abTests).orderBy(desc(abTests.id));
      const activeUsers = await db.select().from(users).where(eq(users.isActive, true));
      const allProducts = await db.select().from(products);
      const warnings: string[] = [];

      const now = new Date();
      const rangeDays = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : null;
      const rangeStart = rangeDays ? new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000) : null;

      const labTests = allTests.filter((t: any) => resolveLabMembership(t));

      const filtered = labTests.filter((t: any) => {
        const testType = normalizeTestType(t.testType);
        if (category && String(t.category || "").trim() !== category) return false;
        if (testTypeFilter && testTypeFilter !== "CTR" && testTypeFilter !== "CR" && testTypeFilter !== "RICH")
          return false;
        if (req.query.testType && testType !== testTypeFilter) return false;
        if (designer && String(t.designerGen || t?.assignees?.designer || "").trim() !== designer) return false;
        if (contentManager && String(t.contentManager || t?.assignees?.contentManager || "").trim() !== contentManager)
          return false;
        if (skuSearch && !String(t.sku || "").toLowerCase().includes(skuSearch.toLowerCase())) return false;
        if (platform && String(t.platform || "").trim() !== platform) return false;

        if (rangeStart) {
          const createdAt = t.createdAt || t.created_at || null;
          if (!createdAt) {
            warnings.push("Некоторые тесты не имеют даты создания; фильтр по датам может быть неполным.");
            return false;
          }
          const createdDate = new Date(createdAt);
          if (Number.isNaN(createdDate.getTime())) return false;
          if (createdDate < rangeStart) return false;
        }

        return true;
      });

      const normalizeRole = (value?: string | null) => String(value || "").toLowerCase();
      const designerUsers = activeUsers.filter((u: any) => normalizeRole(u.role).includes("designer"));
      const contentUsers = activeUsers.filter((u: any) => {
        const role = normalizeRole(u.role);
        return role.includes("content") || role.includes("контент") || role.includes("content_manager");
      });

      const fallbackDesigners = Array.from(
        new Set(filtered.map((t: any) => String(t.designerGen || t?.assignees?.designer || "").trim()).filter(Boolean))
      );
      const fallbackContent = Array.from(
        new Set(filtered.map((t: any) => String(t.contentManager || t?.assignees?.contentManager || "").trim()).filter(Boolean))
      );

      const designerOptions = designerUsers.length
        ? designerUsers.map((u: any) => u.name || u.username).filter(Boolean)
        : fallbackDesigners;
      const contentOptions = contentUsers.length
        ? contentUsers.map((u: any) => u.name || u.username).filter(Boolean)
        : fallbackContent;
      const categoryFromTests = filtered.map((t: any) => String(t.category || "").trim()).filter(Boolean);
      const categoryFromProducts = allProducts.map((p: any) => String(p.category || "").trim()).filter(Boolean);
      const categoryOptions = Array.from(new Set([...categoryFromTests, ...categoryFromProducts]));
      const platformOptions = Array.from(new Set(filtered.map((t: any) => String(t.platform || "").trim()).filter(Boolean)));

      let totalPrepared = 0;
      let totalWinners = 0;
      let goal1Reached = 0;
      let goal2Reached = 0;
      let strongWins = 0;
      let missingA = 0;
      let missingMetrics = 0;
      let missingImages = 0;
      let activeCount = 0;
      let completedCount = 0;

      const byType: Record<string, number> = { CTR: 0, CR: 0, RICH: 0 };
      const detailRows: any[] = [];

      const breakdown = (key: string, label: string) => ({ key, label, tests: 0, variants: 0, winners: 0, goal1: 0, goal2: 0 });

      const designerMap = new Map<string, any>();
      const contentMap = new Map<string, any>();
      const categoryMap = new Map<string, any>();

      filtered.forEach((t: any) => {
        const testType = normalizeTestType(t.testType);
        const metricKey = testType === "CR" ? "cr" : "ctr";
        const metrics = getMetricMap(t);
        const valA = getMetricValue(metrics, "A", metricKey);
        const { bestVariant, bestValue } = getBestVariant(metrics, testType, metricKey);
        const uplift = valA > 0 ? (bestValue - valA) / valA : 0;
        const goal1 = calcGoal1(valA, t.targetMultiplier, t.metricGoal);
        const goal2 = parseMetric(t.voisBenchmark);
        const prepared = countPreparedVariants(metrics, testType, metricKey);
        const winner = Boolean(t.winner);

        totalPrepared += prepared;
        totalWinners += winner ? 1 : 0;
        goal1Reached += goal1 > 0 && bestValue >= goal1 ? 1 : 0;
        goal2Reached += goal2 > 0 && bestValue >= goal2 ? 1 : 0;
        strongWins += uplift > 0.15 ? 1 : 0;

        if (valA <= 0) missingA += 1;
        const hasAnyMetric = valA > 0 || getComparableVariants(testType).some((v) => getMetricValue(metrics, v, metricKey) > 0);
        if (!hasAnyMetric) missingMetrics += 1;
        const images = getImagesMap(t);
        if (!images?.A) missingImages += 1;

        byType[testType] = (byType[testType] || 0) + 1;

        const designerLabel = String(t.designerGen || t?.assignees?.designer || "—").trim() || "—";
        const contentLabel = String(t.contentManager || t?.assignees?.contentManager || "—").trim() || "—";
        const categoryLabel = String(t.category || "—").trim() || "—";

        const statusText = String(t.status || "").toLowerCase();
        if (statusText.includes("active") || statusText.includes("running")) activeCount += 1;
        if (statusText.includes("complete") || statusText.includes("finish")) completedCount += 1;

        if (!designerMap.has(designerLabel)) designerMap.set(designerLabel, breakdown(designerLabel, designerLabel));
        if (!contentMap.has(contentLabel)) contentMap.set(contentLabel, breakdown(contentLabel, contentLabel));
        if (!categoryMap.has(categoryLabel)) categoryMap.set(categoryLabel, breakdown(categoryLabel, categoryLabel));

        [designerMap.get(designerLabel), contentMap.get(contentLabel), categoryMap.get(categoryLabel)].forEach((row) => {
          if (!row) return;
          row.tests += 1;
          row.variants += prepared;
          row.winners += winner ? 1 : 0;
          row.goal1 += goal1 > 0 && bestValue >= goal1 ? 1 : 0;
          row.goal2 += goal2 > 0 && bestValue >= goal2 ? 1 : 0;
        });

        detailRows.push({
          id: t.id,
          sku: t.sku,
          productName: t.productName,
          testType,
          category: t.category,
          designer: designerLabel,
          contentManager: contentLabel,
          metricA: valA,
          bestVariant,
          bestValue,
          uplift,
          goal1,
          goal2,
          status: t.status,
          createdAt: t.createdAt || t.created_at || null,
        });
      });

      const totalTests = filtered.length;
      const avgPrepared = totalTests > 0 ? totalPrepared / totalTests : 0;
      const winnersShare = totalTests > 0 ? (totalWinners / totalTests) * 100 : 0;
      const goal1Share = totalTests > 0 ? (goal1Reached / totalTests) * 100 : 0;
      const goal2Share = totalTests > 0 ? (goal2Reached / totalTests) * 100 : 0;
      const strongWinShare = totalTests > 0 ? (strongWins / totalTests) * 100 : 0;

      const withWinRate = (rows: any[]) =>
        rows.map((row) => ({ ...row, winRate: row.tests > 0 ? (row.winners / row.tests) * 100 : 0 }));

      res.json({
        warnings,
        filters: {
          dateRange,
          category,
          testType: req.query.testType ? testTypeFilter : "",
          designer,
          contentManager,
          skuSearch,
          platform,
        },
        options: {
          categories: categoryOptions,
          designers: designerOptions,
          contentManagers: contentOptions,
          platforms: platformOptions,
        },
        kpis: {
          totalTests,
          byType,
          totalPrepared,
          avgPrepared,
          status: { active: activeCount, completed: completedCount },
          winners: totalWinners,
          winnersShare,
          goal1Reached,
          goal1Share,
          goal2Reached,
          goal2Share,
          strongWins,
          strongWinShare,
          dataQuality: { missingA, missingMetrics, missingImages },
        },
        breakdowns: {
          byDesigner: withWinRate(Array.from(designerMap.values())),
          byContent: withWinRate(Array.from(contentMap.values())),
          byCategory: withWinRate(Array.from(categoryMap.values())),
        },
        rows: detailRows,
      });
    } catch (error) {
      console.error("❌ Ошибка метрик:", error);
      res.status(500).json({ message: "Ошибка расчета метрик" });
    }
  });

  // --- ADMIN API: USERS ---
  app.get("/api/admin/users", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    try {
      const q = normalizeText(req.query.q);
      const active = parseBoolean(req.query.active);
      const filters = [] as any[];

      if (q) {
        filters.push(
          or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.username, `%${q}%`))
        );
      }
      if (active !== undefined) {
        filters.push(eq(users.isActive, active));
      }

      const whereClause = filters.length ? and(...filters) : undefined;
      const allUsers = whereClause ? await db.select().from(users).where(whereClause) : await db.select().from(users);

      const safeUsers = allUsers.map(({ password, ...u }: any) => ({
        ...u,
        isAdmin: Boolean(u.isAdmin || u.role === "admin"),
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("❌ Ошибка получения пользователей:", error);
      res.status(500).json({ message: "Ошибка базы данных" });
    }
  });

  // ---- дальше файл без изменений по твоей логике ----
  // ВАЖНО: я оставляю остальной код как есть у тебя. Ниже — продолжение "как было":

  app.post("/api/admin/users", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    try {
      const email = normalizeText(req.body.email);
      const name = normalizeText(req.body.name);
      const role = normalizeText(req.body.role || "user") || "user";
      const isAdminFlag = Boolean(req.body.is_admin ?? req.body.isAdmin ?? false);
      const isActiveFlag = req.body.is_active ?? req.body.isActive ?? true;
      const username = normalizeText(req.body.username || email);
      const password = normalizeText(req.body.password || "123");

      if (!email || !isValidEmail(email)) return res.status(400).json({ message: "Некорректный email" });
      if (!name) return res.status(400).json({ message: "Имя обязательно" });
      if (!username) return res.status(400).json({ message: "Логин обязателен" });

      const emailExists = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (emailExists.length > 0) return res.status(409).json({ message: "Email уже используется" });

      const usernameExists = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (usernameExists.length > 0) return res.status(409).json({ message: "Логин уже используется" });

      const created = await db
        .insert(users)
        .values({
          email,
          name,
          role,
          isAdmin: isAdminFlag,
          isActive: Boolean(isActiveFlag),
          username,
          password,
          updatedAt: new Date(),
        })
        .returning();

      const { password: _, ...safeUser } = created[0];
      res.json({
        ...safeUser,
        isAdmin: Boolean(safeUser.isAdmin || safeUser.role === "admin"),
      });
    } catch (error) {
      console.error("❌ Ошибка создания пользователя:", error);
      res.status(500).json({ message: "Ошибка базы данных" });
    }
  });

  // ... (ВАЖНО) Дальше у тебя ещё очень много кода, который ты прислал (users patch/delete, products, tests и т.д.)
  // Чтобы не порезать по лимиту сообщения и не сломать вставку, продолжай использовать свой текущий файл ниже этой точки
  // БЕЗ ИЗМЕНЕНИЙ, кроме того что:
  // 1) express.json limit уже добавлен сверху
  // 2) добавлен /api/ai/generate-hypothesis
  // 3) в /api/ai/insight убран GEMINI_API_KEY из выбора ключа и используется только OPENAI_API_KEY

  // --- API: ЗАГРУЗКА ИЗОБРАЖЕНИЯ (Local + Serve) ---
  app.post("/api/uploads/image", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Serve uploads statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const httpServer = createServer(app);
  return httpServer;
}