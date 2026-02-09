import { AbTest } from "@shared/schema";
import { VariantItem } from "@/lib/types";
import { Card } from "@/lib/components/ui/card";
import { Badge } from "@/lib/components/ui/badge";
import { BrainCircuit } from "lucide-react";
import { AiInsightsView } from "@/components/ab-tests/AiInsightsView";
import { AiMixerResultV3 } from "@/lib/ai/ai-mixer.types";
import { normalizeVariants } from "@/lib/variants/normalizeVariants";

export function SmartHypothesisViewer({ test }: { test: AbTest }) {
  if (!test.variants) return null;
  
  // Cast variants to check for rich structure
  const variants = test.variants as any;
  const normalized = normalizeVariants(test.variants, test.images);
  const latestEntry = normalized?.ai?.latest;
  const latestValue = latestEntry && typeof latestEntry === "object" && "value" in latestEntry
    ? (latestEntry as any).value
    : latestEntry;
  const insightText = normalized?.insight || normalized?.assets?.insight || "";
  
  // Check if it matches AiMixerResultV3 structure (has meta and analysis objects)
  const isRichResult = variants && variants.meta && variants.analysis && Array.isArray(variants.items);

  if (isRichResult) {
      // Pass the variants object as the result since it contains all the keys
      return <AiInsightsView result={variants as AiMixerResultV3} />;
  }

  if (latestValue && typeof latestValue === "object" && (latestValue as any).analysis && (latestValue as any).items) {
    return <AiInsightsView result={latestValue as AiMixerResultV3} />;
  }
  
  // Fallback: Legacy view
  const legacyVariants = test.variants as unknown as { analysis: string, items: VariantItem[] };

  return (
    <div className="space-y-4">
      {(isNonEmptyString(insightText) || test.aiInsight) && (
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
           <div className="flex items-center gap-2 mb-2 text-indigo-600">
             <BrainCircuit className="w-4 h-4" />
             <span className="text-xs font-bold uppercase tracking-wider">AI Insight</span>
           </div>
           <p className="text-sm text-slate-700 font-light leading-relaxed">
             {legacyVariants.analysis || insightText || test.aiInsight}
           </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {legacyVariants.items && legacyVariants.items.map((item, idx) => (
          <Card key={idx} className="p-3 border-slate-100 shadow-sm flex gap-4 items-start">
             <div className="w-16 h-16 bg-slate-100 rounded-lg shrink-0 flex items-center justify-center text-[10px] text-slate-400 text-center px-1">
                {item.visual || "No visual"}
             </div>
             <div className="flex-1 min-w-0">
               <div className="flex justify-between items-start">
                 <h5 className="font-medium text-sm text-slate-800">{item.title}</h5>
                 {item.badge && <Badge variant="secondary" className="bg-pink-50 text-pink-600 text-[10px]">{item.badge}</Badge>}
               </div>
               <p className="text-xs text-slate-500 mt-1">{item.text}</p>
             </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function isNonEmptyString(v: any) {
  return typeof v === "string" && v.trim().length > 0;
}