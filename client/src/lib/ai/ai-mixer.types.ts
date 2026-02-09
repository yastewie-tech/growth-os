export type TestType = "creative" | "copy" | "offer" | "layout";
export type AiStrategy = "aggressive" | "empathetic" | "minimalist" | "scientific";
export type AiMode = "assist" | "generate" | "analyze";

export interface GenerateHypothesisInput {
  mode: AiMode;
  productName: string;
  productContext: string;
  category: string;
  testType: string;
  strategy: string;
  painPoints: string[];
  currentImages: string[];
  competitorImages: string[];
}

export interface AiMixerResultV3 {
  meta: {
    language: string;
    strategy_applied: string;
    confidence_score: number; // Насколько AI уверен в гипотезах
  };
  analysis: {
    current_state: string;
    competitor_gap: string;
    visual_hooks: string[]; // Конкретные визуальные зацепки
  };
  market_insight: string;
  items: Array<{
    title: string;
    description: string;
    rationale: string;
    risk: string;
    impact: "high" | "medium" | "low"; // Приоритетность
  }>;
}