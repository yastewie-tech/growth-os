import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/lib/components/ui/button";
import { Input } from "@/lib/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/components/ui/select";
import { Badge } from "@/lib/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Activity, ArrowUpRight } from "lucide-react";

const dateRanges = [
  { id: "7d", label: "7 дней" },
  { id: "30d", label: "30 дней" },
  { id: "90d", label: "90 дней" },
  { id: "all", label: "За все время" },
];

const testTypes = ["CTR", "CR", "RICH"];

const buildQuery = (base: string, params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${base}?${query}` : base;
};

type MetricsResponse = {
  warnings?: string[];
  options: {
    categories: string[];
    designers: string[];
    contentManagers: string[];
    platforms: string[];
  };
  kpis: {
    totalTests: number;
    byType: Record<string, number>;
    totalPrepared: number;
    avgPrepared: number;
    status: {
      active: number;
      completed: number;
    };
    winners: number;
    winnersShare: number;
    goal1Reached: number;
    goal1Share: number;
    goal2Reached: number;
    goal2Share: number;
    strongWins: number;
    strongWinShare: number;
    dataQuality: {
      missingA: number;
      missingMetrics: number;
      missingImages: number;
    };
  };
  breakdowns: {
    byDesigner: Array<any>;
    byContent: Array<any>;
    byCategory: Array<any>;
  };
  rows: Array<any>;
};

const formatPercent = (value: number) => `${Math.round(value)}%`;

export function MetricsPage() {
  const [, setLocation] = useLocation();
  const [dateRange, setDateRange] = useState("30d");
  const [category, setCategory] = useState("all");
  const [testType, setTestType] = useState("all");
  const [designer, setDesigner] = useState("all");
  const [contentManager, setContentManager] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [skuSearch, setSkuSearch] = useState("");

  const metricsQuery = useQuery<MetricsResponse>({
    queryKey: [
      "/api/metrics/lab",
      dateRange,
      category,
      testType,
      designer,
      contentManager,
      platform,
      skuSearch,
    ],
    queryFn: async () => {
      const url = buildQuery("/api/metrics/lab", {
        dateRange,
        category: category === "all" ? undefined : category,
        testType: testType === "all" ? undefined : testType,
        designer: designer === "all" ? undefined : designer,
        contentManager: contentManager === "all" ? undefined : contentManager,
        platform: platform === "all" ? undefined : platform,
        sku: skuSearch || undefined,
      });
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const options = metricsQuery.data?.options;
  const kpis = metricsQuery.data?.kpis;

  const detailsRows = useMemo(() => metricsQuery.data?.rows || [], [metricsQuery.data]);

  return (
    <AppShell
      title="Метрики"
      subtitle="Статистика по тестам в Лаборатории"
      activeSection="metrics"
    >
      <PageContainer>
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent>
                {dateRanges.map((range) => (
                  <SelectItem key={range.id} value={range.id}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {(options?.categories || []).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={testType} onValueChange={setTestType}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {testTypes.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={designer} onValueChange={setDesigner}>
              <SelectTrigger className="h-9 w-[190px]">
                <SelectValue placeholder="Дизайнер" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все дизайнеры</SelectItem>
                {(options?.designers || []).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={contentManager} onValueChange={setContentManager}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Контент" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Весь контент</SelectItem>
                {(options?.contentManagers || []).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Платформа" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все платформы</SelectItem>
                {(options?.platforms || []).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative min-w-[200px] flex-1">
              <Input
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="Поиск по SKU"
                className="h-9"
              />
            </div>
          </div>
        </div>

        {metricsQuery.data?.warnings?.length ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {metricsQuery.data.warnings[0]}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-slate-400 font-bold">Всего тестов</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{kpis?.totalTests || 0}</div>
              <div className="text-xs text-slate-500">
                Активные: {kpis?.status?.active || 0} / Завершенные: {kpis?.status?.completed || 0}
              </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-slate-400 font-bold">Типы тестов</span>
            </div>
            <div className="mt-3 text-sm text-slate-700 space-y-1">
              <div>CTR: {kpis?.byType?.CTR || 0}</div>
              <div>CR: {kpis?.byType?.CR || 0}</div>
              <div>RICH: {kpis?.byType?.RICH || 0}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-slate-400 font-bold">Подготовлено вариантов</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{kpis?.totalPrepared || 0}</div>
            <div className="text-xs text-slate-500">Среднее: {kpis ? kpis.avgPrepared.toFixed(1) : "0"}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-slate-400 font-bold">Победители</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{kpis?.winners || 0}</div>
            <div className="text-xs text-slate-500">Доля: {kpis ? formatPercent(kpis.winnersShare) : "0%"}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-slate-400 font-bold">Достигли цели 1</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{kpis?.goal1Reached || 0}</div>
            <div className="text-xs text-slate-500">Доля: {kpis ? formatPercent(kpis.goal1Share) : "0%"}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-slate-400 font-bold">Цель 2 (Vois)</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{kpis?.goal2Reached || 0}</div>
            <div className="text-xs text-slate-500">Доля: {kpis ? formatPercent(kpis.goal2Share) : "0%"}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-slate-400 font-bold">Победа &gt; 15%</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{kpis?.strongWins || 0}</div>
            <div className="text-xs text-slate-500">Доля: {kpis ? formatPercent(kpis.strongWinShare) : "0%"}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-slate-400 font-bold">Качество данных</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">A нет: {kpis?.dataQuality?.missingA || 0}</Badge>
              <Badge variant="secondary">Метрик нет: {kpis?.dataQuality?.missingMetrics || 0}</Badge>
              <Badge variant="secondary">Изображений нет: {kpis?.dataQuality?.missingImages || 0}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SectionCard title="По дизайнерам">
            <div className="grid grid-cols-8 gap-2 pb-2 text-[11px] font-bold uppercase text-slate-400">
              <div className="col-span-2">Дизайнер</div>
              <div className="col-span-1 text-center">Тестов</div>
              <div className="col-span-1 text-center">Вариантов</div>
              <div className="col-span-1 text-center">Побед</div>
              <div className="col-span-1 text-center">Цель 1</div>
              <div className="col-span-1 text-center">Цель 2</div>
              <div className="col-span-1 text-center">Win %</div>
            </div>
            <div className="divide-y">
              {(metricsQuery.data?.breakdowns.byDesigner || []).map((row: any) => (
                <div key={row.key} className="grid grid-cols-8 gap-2 py-2 text-sm items-center">
                  <div className="col-span-2 truncate">{row.label}</div>
                  <div className="col-span-1 text-center">{row.tests}</div>
                  <div className="col-span-1 text-center">{row.variants}</div>
                  <div className="col-span-1 text-center">{row.winners}</div>
                  <div className="col-span-1 text-center">{row.goal1}</div>
                  <div className="col-span-1 text-center">{row.goal2}</div>
                  <div className="col-span-1 text-center">{formatPercent(row.winRate || 0)}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="По контент-менеджерам">
            <div className="grid grid-cols-8 gap-2 pb-2 text-[11px] font-bold uppercase text-slate-400">
              <div className="col-span-2">Контент</div>
              <div className="col-span-1 text-center">Тестов</div>
              <div className="col-span-1 text-center">Вариантов</div>
              <div className="col-span-1 text-center">Побед</div>
              <div className="col-span-1 text-center">Цель 1</div>
              <div className="col-span-1 text-center">Цель 2</div>
              <div className="col-span-1 text-center">Win %</div>
            </div>
            <div className="divide-y">
              {(metricsQuery.data?.breakdowns.byContent || []).map((row: any) => (
                <div key={row.key} className="grid grid-cols-8 gap-2 py-2 text-sm items-center">
                  <div className="col-span-2 truncate">{row.label}</div>
                  <div className="col-span-1 text-center">{row.tests}</div>
                  <div className="col-span-1 text-center">{row.variants}</div>
                  <div className="col-span-1 text-center">{row.winners}</div>
                  <div className="col-span-1 text-center">{row.goal1}</div>
                  <div className="col-span-1 text-center">{row.goal2}</div>
                  <div className="col-span-1 text-center">{formatPercent(row.winRate || 0)}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="По категориям" className="mb-8">
          <div className="grid grid-cols-6 gap-2 pb-2 text-[11px] font-bold uppercase text-slate-400">
            <div className="col-span-2">Категория</div>
            <div className="col-span-1 text-center">Тестов</div>
            <div className="col-span-1 text-center">Побед</div>
            <div className="col-span-1 text-center">Цель 1</div>
            <div className="col-span-1 text-center">Цель 2</div>
          </div>
          <div className="divide-y">
            {(metricsQuery.data?.breakdowns.byCategory || []).map((row: any) => (
              <div key={row.key} className="grid grid-cols-6 gap-2 py-2 text-sm items-center">
                <div className="col-span-2 truncate">{row.label}</div>
                <div className="col-span-1 text-center">{row.tests}</div>
                <div className="col-span-1 text-center">{row.winners}</div>
                <div className="col-span-1 text-center">{row.goal1}</div>
                <div className="col-span-1 text-center">{row.goal2}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Тесты в Лаборатории">
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Товар</th>
                  <th className="px-3 py-2 text-left">Тип</th>
                  <th className="px-3 py-2 text-left">Категория</th>
                  <th className="px-3 py-2 text-left">Дизайнер</th>
                  <th className="px-3 py-2 text-left">Контент</th>
                  <th className="px-3 py-2 text-center">A</th>
                  <th className="px-3 py-2 text-center">Лучший</th>
                  <th className="px-3 py-2 text-center">Прирост</th>
                  <th className="px-3 py-2 text-center">Цель 1</th>
                  <th className="px-3 py-2 text-center">Цель 2</th>
                  <th className="px-3 py-2 text-center">Статус</th>
                  <th className="px-3 py-2 text-center">Дата</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detailsRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono">{row.sku}</td>
                    <td className="px-3 py-2 truncate">{row.productName}</td>
                    <td className="px-3 py-2">{row.testType}</td>
                    <td className="px-3 py-2 truncate">{row.category}</td>
                    <td className="px-3 py-2 truncate">{row.designer}</td>
                    <td className="px-3 py-2 truncate">{row.contentManager}</td>
                    <td className="px-3 py-2 text-center">
                      {row.metricA?.toFixed ? row.metricA.toFixed(2) : row.metricA}
                    </td>
                    <td className="px-3 py-2 text-center">{row.bestVariant}</td>
                    <td className="px-3 py-2 text-center">{formatPercent((row.uplift || 0) * 100)}</td>
                    <td className="px-3 py-2 text-center">{row.goal1 ? row.goal1.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center">{row.goal2 ? row.goal2.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-center">{row.status || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString("ru-RU") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Открыть в Лабе"
                        onClick={() => setLocation(`/laba?testId=${row.id}`)}
                        className="h-8 w-8"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {detailsRows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-3 py-6 text-center text-sm text-slate-400">Нет данных</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </PageContainer>
    </AppShell>
  );
}

export default MetricsPage;
