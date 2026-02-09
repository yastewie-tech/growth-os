import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const isProd = process.env.NODE_ENV === "production";

/**
 * DEV only: подключает Vite middleware и отдаёт index.html из /client
 * PROD: ничего не делает (чтобы на Fly не требовался пакет vite)
 */
export async function setupVite(app: Express, server: Server) {
  if (isProd) {
    log("Skipping Vite setup in production", "vite");
    return;
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");

      if (!fs.existsSync(clientTemplate)) {
        console.error(`❌ Template not found: ${clientTemplate}`);
        return res
          .status(500)
          .send("Client template (index.html) not found. Check your file structure.");
      }

      let template = fs.readFileSync(clientTemplate, "utf-8");
      template = await vite.transformIndexHtml(url, template);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * PROD: раздаёт сборку Vite из dist/public.
 * Пытаемся найти dist/public в нескольких типичных местах (локально/в контейнере).
 */
export function serveStatic(app: Express) {
  const candidates = [
    // стандартно в контейнере Fly обычно /app/dist/public
    path.resolve(process.cwd(), "dist", "public"),
    // если процесс.cwd() = dist-server/server или что-то рядом
    path.resolve(process.cwd(), "..", "dist", "public"),
    // на всякий случай — относительный от текущего файла
    path.resolve(__dirname, "..", "..", "dist", "public"),
  ];

  const distPath = candidates.find((p) => fs.existsSync(p));

  if (!distPath) {
    throw new Error(
      `Could not find the build directory. Tried:\n` +
        candidates.map((p) => `- ${p}`).join("\n") +
        `\nMake sure to build the client first (vite build).`
    );
  }

  log(`Serving static from: ${distPath}`, "static");

  app.use(express.static(distPath));

  // SPA fallback
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}