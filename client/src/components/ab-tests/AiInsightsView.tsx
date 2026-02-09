import React from "react";
import { 
  Lightbulb, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart3,
  Search,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/lib/components/ui/card";
import { Badge } from "@/lib/components/ui/badge";
import type { AiMixerResultV3 } from "@/lib/ai/ai-mixer.types";

interface AiInsightsViewProps {
  result: AiMixerResultV3;
}

export function AiInsightsView({ result }: AiInsightsViewProps) {
  const { meta, analysis, market_insight, items } = result;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">AI Analysis Report</h3>
            <p className="text-xs text-slate-500">
              Strategy: <span className="font-medium text-slate-700 capitalize">{meta.strategy_applied}</span>
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 pr-3">
          <CheckCircle2 className="w-3 h-3" />
          Confidence: {Math.round(meta.confidence_score * 100)}%
        </Badge>
      </div>

      {/* ANALYSIS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current State */}
        <Card className="bg-slate-50/50 border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Search className="w-4 h-4" /> Current State
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              {analysis.current_state}
            </p>
          </CardContent>
        </Card>

        {/* Competitor Gap */}
        <Card className="bg-blue-50/30 border-blue-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
              <Target className="w-4 h-4" /> Competitor Gap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 leading-relaxed">
              {analysis.competitor_gap}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* VISUAL HOOKS & INSIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Market Insight
          </div>
          <p className="text-sm text-amber-900/80 italic leading-relaxed">
            "{typeof market_insight === 'string' ? market_insight : (market_insight as any)?.opportunities?.join(', ') || ''}"
          </p>
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl p-4 border border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Suggested Visual Hooks
          </div>
          <div className="flex flex-wrap gap-2">
            {(analysis.visual_hooks || []).map((hook, i) => (
              <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors py-1.5 px-3">
                {hook}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* HYPOTHESES LIST */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 pl-1">Generated Hypotheses</h4>
        
        {(items || []).map((item, idx) => (
          <div key={idx} className="group relative bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:border-violet-200">
            <div className="absolute top-4 right-4 flex gap-2">
              <Badge className={`
                ${item.impact === 'high' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}
                border-none uppercase text-[10px] font-bold tracking-wider
              `}>
                {item.impact} Impact
              </Badge>
            </div>

            <div className="pr-20">
              <h5 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-violet-700 transition-colors">
                {idx + 1}. {item.title}
              </h5>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="flex gap-3">
                <div className="mt-0.5 min-w-[16px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-700 uppercase block mb-0.5">Rationale</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.rationale}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="mt-0.5 min-w-[16px]">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-700 uppercase block mb-0.5">Risk</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.risk}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
