import React, { useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  MessageSquarePlus,
  Activity,
  Check,
  Upload,
  Trash2,
  Plus,
  X,
} from "lucide-react";

import { Button } from "@/lib/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/lib/components/ui/dialog";
import { Badge } from "@/lib/components/ui/badge";
import { cn } from "@/lib/utils";

import { generateHypothesis } from "@/lib/gemini/generateHypothesis";
import { TestType, AiStrategy, AiMode } from "@/lib/ai/ai-mixer.types";

type AiMixerModalProps = {
  productName: string;
  productContext: string;
  testType: TestType;

  images?: string[]; // наши картинки из карточки (URL)
  painPoints?: string[]; // можно прокинуть дефолтные боли из карточки/категории

  onCreated: (resultJson: string) => void; // строка JSON
  triggerLabel?: string;
  triggerVariant?: "default" | "secondary" | "outline" | "ghost";
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerClassName?: string;
};

// ---------- helpers ----------
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

/**
 * Небольшой базовый набор триггеров "болей" (облако).
 * Если хочешь — заменим на динамику по category из твоего TRIGGER_DATABASE
 * (когда прокинешь category или ключ).
 */
const DEFAULT_TRIGGER_CLOUD: string[] = [
  "Нет эффекта",
  "Сухость/Шелушение",
  "Тусклый цвет",
  "Жирный блеск",
  "Раздражение",
  "Дорого",
  "Страх подделки",
  "Неудобное нанесение",
  "Пачкает одежду",
  "Липкость",
  "Аллергия",
  "Обман ожиданий",
];

export function AiMixerModal({
  productName,
  productContext,
  testType,
  images = [],
  painPoints = [],
  onCreated,
  triggerLabel = "AI инсайты",
  triggerVariant = "outline",
  triggerSize = "default",
  triggerClassName,
}: AiMixerModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customWish, setCustomWish] = useState("");

  // --- pains: базовые (из props) + возможность выбора из облака ---
  const [selectedPains, setSelectedPains] = useState<string[]>(() => uniq(painPoints));

  // --- competitor upload ---
  const [competitorFiles, setCompetitorFiles] = useState<File[]>([]);
  const [competitorPreviews, setCompetitorPreviews] = useState<string[]>([]); // objectUrl
  const [competitorDataUrls, setCompetitorDataUrls] = useState<string[]>([]); // dataUrl for AI
  const compInputRef = useRef<HTMLInputElement>(null);

  const safeName = (productName ?? "").toString();
  const safeContext = (productContext ?? "").toString();

  const canGenerateRelaxed = useMemo(() => {
    return safeName.trim().length > 0;
  }, [safeName]);

  const canGenerate = useMemo(() => {
    const hasName = safeName.trim().length > 0;
    const hasContext = safeContext.trim().length > 0 || customWish.trim().length > 0;
    return hasName && hasContext;
  }, [safeName, safeContext, customWish]);

  const triggerCloud = useMemo(() => {
    // Облако: сначала то, что уже есть, + дефолтные
    return uniq([...painPoints, ...DEFAULT_TRIGGER_CLOUD]).filter(Boolean);
  }, [painPoints]);

  const togglePain = (p: string) => {
    setSelectedPains((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : uniq([...prev, p])));
  };

  const removeSelectedPain = (p: string) => {
    setSelectedPains((prev) => prev.filter((x) => x !== p));
  };

  const handleCompetitorFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    // лимит 5
    if (competitorFiles.length + files.length > 5) {
      setError("Можно загрузить максимум 5 изображений конкурента.");
      e.target.value = "";
      return;
    }

    try {
      setError(null);

      const newObjectUrls = files.map((f) => URL.createObjectURL(f));
      const newDataUrls = await Promise.all(files.map(fileToDataUrl));

      setCompetitorFiles((prev) => [...prev, ...files]);
      setCompetitorPreviews((prev) => [...prev, ...newObjectUrls]);
      setCompetitorDataUrls((prev) => [...prev, ...newDataUrls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка чтения файлов");
    } finally {
      e.target.value = "";
    }
  };

  const removeCompetitorAt = (idx: number) => {
    setCompetitorFiles((prev) => prev.filter((_, i) => i !== idx));
    setCompetitorDataUrls((prev) => prev.filter((_, i) => i !== idx));
    setCompetitorPreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const clearCompetitors = () => {
    competitorPreviews.forEach((u) => URL.revokeObjectURL(u));
    setCompetitorFiles([]);
    setCompetitorPreviews([]);
    setCompetitorDataUrls([]);
  };

  const resetLocalStateOnClose = () => {
    setCustomWish("");
    setError(null);
    setSelectedPains(uniq(painPoints));
    clearCompetitors();
  };

  const handleGenerate = async () => {
    if (!canGenerateRelaxed) return;

    setLoading(true);
    setError(null);

    const safeExtractJson = (raw: string) => {
      const s = (raw || "").trim();
      if (!s) return null;
      // strip ```json fences if present
      const fenced = s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        return JSON.parse(fenced);
      } catch {
        return null;
      }
    };

    try {
      const enrichedContext = customWish
        ? `${safeContext}\n\nДополнительные инструкции:\n${customWish}`
        : safeContext;

      const result = await generateHypothesis({
        mode: "assist" as AiMode,
        productName,
        productContext: enrichedContext,
        category: "Marketing Assets",
        testType,
        strategy: "empathetic" as AiStrategy,
        painPoints: selectedPains,
        currentImages: images, // ✅ наши URL из карточки
        competitorImages: competitorDataUrls, // ✅ base64/dataUrl конкурентов
      });

      // Normalize output to strict JSON string
      if (typeof result === "string") {
        const parsed = safeExtractJson(result);
        if (!parsed) throw new Error("AI вернул невалидный JSON. Проверь prompt/обработку ответа.");
        onCreated(JSON.stringify(parsed));
      } else {
        onCreated(JSON.stringify(result));
      }
      setOpen(false);
      resetLocalStateOnClose();
    } catch (e: any) {
      console.error("Generation error:", e);
      setError(e?.message || "Не удалось сгенерировать гипотезы. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setLoading(false);
          setError(null);
        } else {
          resetLocalStateOnClose();
          setLoading(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={cn("gap-2", triggerClassName)}>
          <Sparkles className="h-4 w-4 text-violet-500" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-design-lavender/50 text-violet-600">
            <Sparkles className="w-5 h-5" />
          </div>
          AI Mixer
        </DialogTitle>

        <div className="mt-6 space-y-6">
          <p className="text-design-text/80 text-base leading-relaxed">
            AI проанализирует тест, сравнит с конкурентом (если добавишь изображения) и предложит гипотезы.
            <Badge variant="outline" className="ml-2 bg-slate-100">
              {String(testType).toUpperCase()}
            </Badge>
          </p>

          {/* CONTEXT */}
          <div className="rounded-2xl bg-design-background p-6 space-y-3 border border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-design-text-muted flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Контекст продукта
              </div>

              <Badge
                variant="outline"
                className={`${
                  canGenerate ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500"
                }`}
              >
                {canGenerate ? "готово" : "нужно описание"}
              </Badge>
            </div>

            {productName?.trim() && <div className="text-xs font-bold text-slate-600">{productName}</div>}

            <div className="text-sm text-design-text leading-relaxed font-medium">
              {productContext?.trim() ? productContext : "Добавь описание теста, чтобы AI мог дать более точные гипотезы."}
            </div>
          </div>

          {/* OUR IMAGES (from card) */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-design-text-muted">Наши изображения (из карточки)</div>

            {images.length === 0 ? (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                В карточке нет изображений — AI сможет работать, но сравнение по визуалу будет слабее.
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50/70 border border-slate-200 p-3">
                <div className="grid grid-cols-5 gap-2">
                  {images.slice(0, 5).map((url, i) => (
                    <div key={url + i} className="relative aspect-square rounded-xl overflow-hidden bg-white border border-slate-200">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                    </div>
                  ))}

                  {images.length > 5 && (
                    <div className="aspect-square rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500">
                      +{images.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* COMPETITORS UPLOAD */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-design-text-muted">
                Изображения конкурента (до 5)
              </div>

              {competitorPreviews.length > 0 && (
                <button
                  type="button"
                  onClick={clearCompetitors}
                  className="text-[11px] font-medium text-slate-400 hover:text-red-500 transition"
                >
                  Очистить
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50/70 border border-slate-200 p-3">
              <div className="grid grid-cols-5 gap-2">
                {competitorPreviews.map((url, i) => (
                  <div key={url + i} className="relative aspect-square rounded-xl overflow-hidden bg-white border border-slate-200">
                    <img src={url} className="w-full h-full object-cover" alt="" />
                    <button
                      type="button"
                      onClick={() => removeCompetitorAt(i)}
                      className="absolute top-1 right-1 p-1 rounded-lg bg-white/75 border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition"
                      aria-label="Удалить"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {competitorPreviews.length < 5 && (
                  <button
                    type="button"
                    onClick={() => compInputRef.current?.click()}
                    className={[
                      "aspect-square rounded-xl border border-dashed border-slate-300 bg-white",
                      "flex items-center justify-center hover:bg-slate-50 transition",
                    ].join(" ")}
                    title="Добавить изображения конкурента"
                  >
                    <Plus className="w-4 h-4 text-slate-300" />
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={compInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleCompetitorFiles}
              />

              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <Upload className="w-3.5 h-3.5" />
                Добавь скриншоты карточки конкурента — AI сравнит оффер, визуальные паттерны и предложит дифференциацию.
              </div>
            </div>
          </div>

          {/* PAINS: selected + cloud */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-design-text-muted">Триггеры и боли (кликабельные)</div>

            {/* selected */}
            {selectedPains.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedPains.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white text-xs px-3 py-1">
                    {p}
                    <button
                      type="button"
                      onClick={() => removeSelectedPain(p)}
                      className="ml-1 text-white/80 hover:text-white"
                      title="Убрать"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                Можно выбрать триггеры ниже — это сильно улучшает качество идей.
              </div>
            )}

            {/* cloud */}
            <div className="flex flex-wrap gap-2">
              {triggerCloud.map((p) => {
                const active = selectedPains.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePain(p)}
                    className={[
                      "px-3 py-2 rounded-xl text-xs font-medium border transition text-left",
                      active
                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* WISH */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-design-text-muted flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4" />
              Пожелания к AI (необязательно)
            </div>

            <textarea
              value={customWish}
              onChange={(e) => setCustomWish(e.target.value)}
              placeholder="Например: стиль Apple, больше конкретики по офферам, акцент на доверии, меньше клише, предложи 5 вариантов заголовков и 5 оффер-лейблов…"
              className={[
                "w-full h-24 resize-none rounded-2xl border border-slate-200 bg-white p-4",
                "text-sm text-slate-800 placeholder:text-slate-400 outline-none",
                "focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all",
              ].join(" ")}
            />
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Button
            className="w-full h-12 rounded-xl text-base gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200"
            onClick={handleGenerate}
            disabled={loading || !canGenerateRelaxed}
            title={!canGenerateRelaxed ? "Нужно заполнить название и описание (контекст) теста" : ""}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {loading ? "AI думает..." : "Сгенерировать гипотезы"}
          </Button>

          <div className="mt-3 text-[11px] text-center text-slate-400">
            Результат вернётся в виде JSON и будет применён в карточке.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}