import React, { useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Badge } from "../ui/badge";

import { generateHypothesis } from "@/lib/gemini/generateHypothesis";
import { TestType } from "@/lib/ai/ai-mixer.types";

type AiMixerModalProps = {
  productName: string;
  productContext: string;
  testType: TestType;
  images?: string[];

  painPoints?: string[]; // опционально, но желательно
  onCreated: (resultJson: string) => void;
};

export function AiMixerModal({
  productName,
  productContext,
  testType,
  images = [],
  painPoints = [],
  onCreated,
}: AiMixerModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = useMemo(() => {
    return productName.trim() && productContext.trim();
  }, [productName, productContext]);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setLoading(true);
    setError(null);

    try {
      const result = await generateHypothesis({
        mode: "assist",
        productName,
        productContext,
        testType,
        category: "Marketing Assets",
        strategy: "empathetic",
        painPoints,
        currentImages: images,
        competitorImages: [],
      });

      onCreated(JSON.stringify(result));
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Ошибка генерации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          AI Insights
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
            AI проанализирует текущий тест и предложит улучшения для категории
            <Badge variant="outline" className="ml-2 bg-slate-100">{testType.toUpperCase()}</Badge>
          </p>

          <div className="rounded-2xl bg-design-background p-6 space-y-3 border border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-design-text-muted">Контекст продукта</div>
            <div className="text-sm text-design-text leading-relaxed font-medium">{productContext}</div>
          </div>

          {painPoints.length > 0 && (
            <div className="space-y-2">
               <div className="text-xs font-bold uppercase tracking-wider text-design-text-muted">Болевые точки</div>
               <div className="flex flex-wrap gap-2">
                {painPoints.map((p) => (
                    <Badge key={p} className="bg-slate-900 text-white text-xs px-3 py-1 rounded-full">
                    {p}
                    </Badge>
                ))}
               </div>
            </div>
          )}
        </div>

        <div className="mt-8">
            <Button
            className="w-full h-12 rounded-xl text-base gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200"
            onClick={handleGenerate}
            disabled={loading || !canGenerate}
            >
            {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
                <Sparkles className="w-5 h-5" />
            )}
            {loading ? "Анализирую данные..." : "Сгенерировать гипотезы"}
            </Button>
        </div>

        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </DialogContent>
    </Dialog>
  );
}