export type VariantKey = "A" | "B" | "C" | "D" | "E";

export type LabaMetricKey = "ctr" | "cr";

export function normalizeTestType(v: any): "CTR" | "CR" | "RICH" {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "CRT") return "CTR";
  if (s === "РИЧ") return "RICH";
  if (s === "CTR") return "CTR";
  if (s === "CR") return "CR";
  if (s === "RICH") return "RICH";
  return "CTR";
}

export function parseNum(input: any): number {
  if (input === null || input === undefined) return 0;
  const s = String(input).replace(",", ".").replace(/[^\d.]/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function getMetricKey(testType: any): LabaMetricKey {
  const t = normalizeTestType(testType);
  return t === "CR" ? "cr" : "ctr";
}

export function getAvailableVariants(testType: any): VariantKey[] {
  const t = normalizeTestType(testType);
  return t === "CR" ? ["A", "B"] : ["A", "B", "C", "D", "E"];
}

export function getComparableVariants(testType: any): VariantKey[] {
  const t = normalizeTestType(testType);
  return t === "CR" ? ["A", "B"] : ["B", "C", "D", "E"];
}

export function getValue(metrics: any, variant: VariantKey, metricKey: LabaMetricKey): number {
  return parseNum(metrics?.[variant]?.[metricKey]);
}

export function calcGoal1(valA: number, targetMul: number): number {
  if (valA <= 0) return 0;
  const mul = parseNum(targetMul) || 1;
  return valA * mul;
}

export function calcProgress(current: number, goal: number): number {
  if (goal <= 0 || current <= 0) return 0;
  return clamp((current / goal) * 100, 0, 100);
}

export function calcUpliftRatio(valA: number, valX: number): number {
  if (valA <= 0 || valX <= 0) return 0;
  return (valX - valA) / valA; // 0.15 = +15%
}

export function pickLeader(metrics: any, testType: any): {
  leaderVariant: VariantKey | null;
  leaderValue: number;
  leaderUplift: number; // ratio
  isLeaderSignificant: boolean; // uplift >= 0.15
  hasAnyData: boolean;
} {
  const metricKey = getMetricKey(testType);
  const valA = getValue(metrics, "A", metricKey);
  const candidates = getComparableVariants(testType);

  let leaderVariant: VariantKey | null = null;
  let leaderValue = 0;

  for (const v of candidates) {
    const val = getValue(metrics, v, metricKey);
    if (val > leaderValue) {
      leaderValue = val;
      leaderVariant = v;
    }
  }

  const hasAnyData = valA > 0 || leaderValue > 0;
  const leaderUplift = leaderVariant ? calcUpliftRatio(valA, leaderValue) : 0;
  const isLeaderSignificant = leaderVariant ? leaderUplift >= 0.15 : false;

  return { leaderVariant, leaderValue, leaderUplift, isLeaderSignificant, hasAnyData };
}
