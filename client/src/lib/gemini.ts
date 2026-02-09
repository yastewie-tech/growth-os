// client/src/lib/gemini.ts
// ВАЖНО: ключей в браузере нет. Клиент ходит в ваш серверный endpoint.

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export async function generateHypothesis(params: {
  productName: string;
  productContext: string;
  type: "CTR" | "CR";
  painPoints: string[];
  currentImages: string[];
  competitorImages: string[];
}): Promise<string | null> {
  try {
    const res = await fetch("/api/ai/generate-hypothesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("AI error:", res.status, text);
      return null;
    }

    const data = (await res.json()) as { json: string };
    return data.json ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}