import { GenerateHypothesisInput, AiMixerResultV3 } from "../ai/ai-mixer.types";

export async function generateHypothesis(
  input: GenerateHypothesisInput
): Promise<AiMixerResultV3> {
  const prompt = `
You are a Lead Growth Hacker and Conversion Rate Optimization (CRO) Expert.
Your task is to analyze marketing assets and provide actionable hypotheses in RUSSIAN.

CONTEXT:
- Product: ${input.productName}
- Description: ${input.productContext}
- Category: ${input.category}
- Strategy: ${input.strategy}
- Goal: Improve ${input.testType}

DATA:
- Pain Points: ${input.painPoints.join(", ") || "No specific pain points provided"}
- Current Assets: ${input.currentImages.length} images
- Competitor Assets: ${input.competitorImages.length} images

INSTRUCTIONS (STRICT):
1. Language: All values in the JSON must be in RUSSIAN (Кириллица).
2. Analysis: Identify why current creatives might be failing based on "Banner Blindness" and "Cognitive Load".
3. Comparison: Contrast current style with competitor patterns.
4. Hypotheses: Provide 3-5 hypotheses. Use marketing frameworks like AIDA or Jobs To Be Done.

OUTPUT JSON FORMAT:
{
  "meta": { "language": "ru", "strategy_applied": "${input.strategy}", "confidence_score": 0.95 },
  "analysis": {
    "current_state": "Анализ текущих материалов...",
    "competitor_gap": "Чего не хватает по сравнению с конкурентами...",
    "visual_hooks": ["крючок 1", "крючок 2"]
  },
  "market_insight": "Глубокое понимание психологии целевой аудитории...",
  "items": [
    {
      "title": "Заголовок гипотезы",
      "description": "Что именно изменить",
      "rationale": "Почему это сработает (психологический триггер)",
      "risk": "Возможный негативный эффект",
      "impact": "high"
    }
  ]
}
`;

  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      prompt,
      mode: input.mode, // Pass mode to backend
      temperature: 0.7, 
      response_format: { type: "json_object" } 
    }),
  });

  if (!response.ok) {
     const errBody = await response.text();
     let errMsg = `Ошибка сервера: ${response.status}`;
     try {
        const json = JSON.parse(errBody);
        if (json.message) errMsg = json.message;
     } catch {}
     throw new Error(errMsg);
  }

  const text = await response.text();
  // Очистка от markdown-оберток
  const jsonString = text.replace(/^```json\s*/, "").replace(/^```/, "").replace(/```$/, "").trim();
  
  try {
    return JSON.parse(jsonString) as AiMixerResultV3;
  } catch (e) {
    console.error("JSON Parsing Error. Raw text:", text);
    throw new Error("AI вернул некорректный формат данных (не JSON).");
  }
}