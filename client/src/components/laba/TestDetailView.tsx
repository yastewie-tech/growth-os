import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
   Upload,
   Loader2,
   Sparkles,
   Save,
   Trophy,
   Target,
} from "lucide-react";
import { Button } from "@/lib/components/ui/button";
import { Input } from "@/lib/components/ui/input";
import { Textarea } from "@/lib/components/ui/textarea";
import { Label } from "@/lib/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/lib/components/ui/tabs";
import { useToast } from "@/lib/components/ui/use-toast";
import { Badge } from "@/lib/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/components/ui/select";
import type { ABTest, User, SkuContext } from "@shared/schema";
import { cn } from "@/lib/utils";
import { normalizeVariants, setVariantImage, appendAiHistory, tryParseJson } from "@/lib/variants/normalizeVariants";
import { t } from "@/lib/i18n/t";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import {
  VariantKey,
  getAvailableVariants,
  getMetricKey,
  getValue,
  pickLeader,
  calcGoal1,
  calcProgress,
  parseNum,
  normalizeTestType,
} from "@/lib/laba/metrics";

interface TestDetailViewProps {
  testId: number;
  onClose: () => void;
}

type PeopleDictionary = {
   designers: User[];
   contentManagers: User[];
   managers: User[];
};

const contextKindLabels: Record<string, string> = {
   base: "База (описание товара)",
   category_rules: "Правила категории",
   brand_tone: "Тон бренда",
   do_dont: "Можно / нельзя",
   insights_history: "История инсайтов",
   custom: "Другое",
};

export function TestDetailView({ testId, onClose }: TestDetailViewProps) {
  const { toast } = useToast();
   const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("A");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [aiMode, setAiMode] = useState<"friendly" | "json">("friendly");
   const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: test, isLoading } = useQuery<ABTest>({
    queryKey: ["/api/tests", testId],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${testId}`);
      if (!res.ok) throw new Error("Failed to fetch test");
      return res.json();
    },
  });

   const { data: skuContexts } = useQuery<SkuContext[]>({
      queryKey: ["/api/sku-contexts", test?.sku],
      enabled: Boolean(test?.sku),
      queryFn: async () => {
         const res = await fetch(`/api/sku-contexts/${encodeURIComponent(String(test?.sku || ""))}`);
         if (!res.ok) throw new Error("Failed to fetch sku contexts");
         return res.json();
      },
   });

   const { data: users } = useQuery<User[]>({
      queryKey: ["/api/users"],
   });
   const { data: people, isLoading: peopleLoading } = useQuery<PeopleDictionary>({
      queryKey: ["/api/dictionaries/people"],
   });

  const { register, handleSubmit, reset, watch, setValue } = useForm<any>();
  
   useEffect(() => {
    if (test) {
         const normalizedWithLegacy = normalizeVariants(test.variants, test.images);
         const normalizedWithoutLegacy = normalizeVariants(test.variants);
         const hasLegacyImages = Array.isArray(test.images) && test.images.some((url) => String(url || "").trim().length > 0);
         const hasPersistedImages = ["A", "B", "C", "D", "E"].some(
            (key) => normalizedWithoutLegacy?.[key]?.assets?.images?.[0]
         );

         if (hasLegacyImages && !hasPersistedImages) {
            apiRequest("PATCH", `/api/tests/${test.id}`, { variants: normalizedWithLegacy }).catch(() => undefined);
         }

         reset({
            ...test,
            variants: normalizedWithLegacy,
            targetMultiplier: test.targetMultiplier ?? 1.2,
            voisBenchmark: test.voisBenchmark ?? 0,
         });
    }
  }, [test, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update test");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: "Saved", description: "Test updated successfully" });
    },
  });

   const uploadMutation = useMutation({
      mutationFn: async ({ file, variant }: { file: File; variant: VariantKey }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
         const data = await res.json();
         const currentVariants = normalizeVariants(watch("variants"), test?.images);
         const nextVariants = setVariantImage(currentVariants, variant as any, data.url);

         const updateRes = await fetch(`/api/tests/${testId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variants: nextVariants }),
         });
         if (!updateRes.ok) throw new Error("Failed to update test");

         return { url: data.url, nextVariants };
    },
      onSuccess: ({ nextVariants }) => {
         setValue("variants", nextVariants);
      toast({ title: "Image Uploaded" });
    },
  });

   const watchedVariants = watch("variants");
   const normalizedVariants = useMemo(
      () => normalizeVariants(watchedVariants, test?.images),
      [watchedVariants, test?.images]
   );
   const metrics = normalizedVariants;
   const getImg = (k: "A" | "B" | "C" | "D" | "E") =>
      String(normalizedVariants?.[k]?.assets?.images?.[0] || "");
   const aiLatest = normalizedVariants?.ai?.latest ?? null;
   const aiHistory = Array.isArray(normalizedVariants?.ai?.history)
      ? normalizedVariants.ai.history
      : [];
   const hasImageA = getImg("A").trim().length > 0;
   const hasImageB = getImg("B").trim().length > 0;
  const tab = activeTab as VariantKey;
  const targetMul = watch("targetMultiplier");
  const voisVal = watch("voisBenchmark");
  
  const updateMetric = (variant: string, field: string, value: string) => {
    const newMetrics = { ...metrics };
    if (!newMetrics[variant]) newMetrics[variant] = {};
    newMetrics[variant][field] = value;
    setValue("variants", newMetrics);
  };

   const skuContextText = useMemo(() => {
      if (!skuContexts || skuContexts.length === 0) return "";
      return skuContexts.map((ctx) => {
         const label = contextKindLabels[ctx.kind] || ctx.kind;
         return `${label}:\n${ctx.content}`.trim();
      }).join("\n\n");
   }, [skuContexts]);


  if (isLoading || !test) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

   const normalizedType = normalizeTestType(test.testType);
   const isCr = normalizedType === "CR";
   const authorName = users?.find(u => u.id === test.authorId)?.name;
   const managerName = watch("manager") || test.manager || test.createdBy || authorName || user?.name || String(user?.id || "—");
    const fallbackByRole = (roleKey: "manager" | "designer" | "content") => {
       const list = users || [];
       const filtered = list.filter((u) => String(u.role || "").toLowerCase().includes(roleKey));
       return filtered.length ? filtered : list;
    };

    const managerSelectOptions = (people?.managers?.length ? people.managers : fallbackByRole("manager")) || [];
    const designerSelectOptions = (people?.designers?.length ? people.designers : fallbackByRole("designer")) || [];
    const contentSelectOptions = (people?.contentManagers?.length ? people.contentManagers : fallbackByRole("content")) || [];
   const hasManagerOptions = managerSelectOptions.length > 0;
   const hasDesignerOptions = designerSelectOptions.length > 0;
   const hasContentOptions = contentSelectOptions.length > 0;
  const metricKey = getMetricKey(test.testType);
  const labelMain = isCr ? "CR в корзину (%)" : "CTR (%)";
  const availableVariants = getAvailableVariants(test.testType);
  const valA = getValue(metrics, "A", metricKey);
   const valB = getValue(metrics, "B", metricKey);
  const valActive = getValue(metrics, tab, metricKey);
  const hasControl = valA > 0;
   const hasVariantB = valB > 0;
   const isCrMissingInputs = isCr && (!hasControl || !hasVariantB);
  const targetMulNum = parseNum(targetMul) || 1.2;
  const goalValue = calcGoal1(valA, targetMulNum);
  const progress = calcProgress(valActive, goalValue);
  const isGoalReached = goalValue > 0 && valActive >= goalValue;
  const voisNum = parseNum(voisVal);
  const hasVoisGoal = voisNum > 0;
  const voisProgress = hasVoisGoal ? calcProgress(valActive, voisNum) : 0;
  const isVoisReached = hasVoisGoal ? valActive >= voisNum : false;
  const voisDiff = hasVoisGoal ? ((valActive - voisNum) / voisNum) * 100 : 0;
  const leader = pickLeader(metrics, test.testType);
  const overallLeaderVar = leader.leaderVariant ?? "A";
  const hasAnyData = leader.hasAnyData;
   const aiDisabled = isCr ? !(hasImageA && hasImageB) : !hasImageA;
   const aiWarningText = isCr ? t("ai.warning.cr") : t("ai.warning.ctr");

   const handleGenerateAi = async () => {
    setIsAnalyzing(true);
    try {
         if (aiDisabled) {
            toast({ title: t("ai.no_images"), variant: "destructive" });
            setIsAnalyzing(false);
            return;
         }
      const typeStr = test.testType ?? "CTR";
      const variantsToScan = normalizeTestType(typeStr) === 'CR' ? ['A','B'] : ['A','B','C','D','E'];
      
         const payloadImages = variantsToScan.map((lbl) => ({
            label: lbl,
            url: getImg(lbl as VariantKey)
         })).filter(x => x.url);

      if (payloadImages.length === 0) {
        toast({ title: "No images", variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }

      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           testId,
           productName: test.productName,
           description: test.description,
           testType: typeStr,
           imagesToAnalyze: payloadImages
        })
      });

      if (!res.ok) throw new Error("AI Request Failed");
         const { insightJsonString } = await res.json();
         const jsonText = insightJsonString || "";
         const parsed = tryParseJson(jsonText);
         const latest = parsed ?? jsonText;
         const nextVariants = appendAiHistory(normalizedVariants, latest);

         setValue("variants", nextVariants);
         updateMutation.mutate({ variants: nextVariants });
         toast({ title: "AI Analysis Complete" });

    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

   const onSubmit = (data: any) => {
      const createdBy = test.createdBy || authorName || user?.name || String(user?.id || "");
      const designerFallback = data.designerGen || "";
      const { designerTech, ...rest } = data;
      updateMutation.mutate({
         ...rest,
         assignees: {
            designer: designerFallback,
            contentManager: data.contentManager || "",
         },
         createdBy: createdBy || undefined,
      });
   };

  return (
   <div className="flex flex-col h-screen bg-design-background">
      <div className="border-b px-6 py-4 flex items-center justify-between bg-design-background shrink-0 z-10 sticky top-0">
         <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                 <h2 className="text-xl font-bold tracking-tight">{test.sku}</h2>
                 <Badge variant={isCr ? "secondary" : "default"}>{normalizedType}</Badge>
                 <span className="text-xs text-slate-500">{t("card.manager")}: {managerName}</span>
                 {!hasControl && !isCr && (
                  <Badge variant="destructive" className="h-5 text-[10px] px-1.5">Нужен A (контроль)</Badge>
                 )}
                 {isCrMissingInputs && (
                  <Badge variant="destructive" className="h-5 text-[10px] px-1.5">{t("ai.warning.cr.short")}</Badge>
                 )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-[300px] truncate">{test.productName}</p>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400 mr-2">
               {updateMutation.isPending && <span className="flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> {t("common.saving")}</span>}
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
         <div className="w-[380px] border-r overflow-y-auto bg-slate-50/50 p-6 space-y-8 shrink-0">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-slate-400">Цели</Label>
               </div>
               <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <Label className="text-[10px] uppercase text-slate-500 font-bold">Мультипликатор цели</Label>
                        <div className="relative mt-1">
                           <Input 
                             type="number" step="0.1" 
                             {...register("targetMultiplier")} 
                             className="pl-8 font-mono text-sm"
                           />
                           <span className="absolute left-3 top-2.5 text-slate-400 text-xs">x</span>
                        </div>
                     </div>
                     <div>
                        <Label className="text-[10px] uppercase text-slate-500 font-bold">Бенчмарк (Vois)</Label>
                         <div className="relative mt-1">
                           <Input 
                              type="number" step="0.01"
                              {...register("voisBenchmark")} 
                              className="font-mono text-sm"
                           />
                        </div>
                     </div>
                  </div>
               </div>
            </div>

                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                           <Label className="text-xs font-bold uppercase text-slate-400">Исполнители</Label>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                           <div className="space-y-2">
                              <Label className="text-[10px] uppercase text-slate-500 font-bold">Менеджер</Label>
                              <Select
                                 value={watch("manager") || "__none__"}
                                 onValueChange={(value) =>
                                    setValue("manager", value === "__none__" ? "" : value, { shouldDirty: true })
                                 }
                              >
                                 <SelectTrigger className="h-9" disabled={!hasManagerOptions}>
                                    <SelectValue placeholder={
                                       peopleLoading
                                          ? "Загрузка..."
                                          : hasManagerOptions
                                             ? "Выберите менеджера"
                                             : "Сначала добавьте пользователей в админке"
                                    } />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="__none__">Не выбран</SelectItem>
                                    {hasManagerOptions ? (
                                      managerSelectOptions.map((u) => (
                                         <SelectItem key={u.id} value={u.name || String(u.id)}>
                                            {u.name || u.username}
                                         </SelectItem>
                                      ))
                                                      ) : (
                                                         <SelectItem value="__empty__" disabled>Сначала добавьте пользователей в админке</SelectItem>
                                                      )}
                                 </SelectContent>
                              </Select>
                           </div>

                           <div className="space-y-2">
                              <Label className="text-[10px] uppercase text-slate-500 font-bold">Дизайнер</Label>
                              <Select
                                 value={watch("designerGen") || "__none__"}
                                 onValueChange={(value) =>
                                    setValue("designerGen", value === "__none__" ? "" : value, { shouldDirty: true })
                                 }
                              >
                                 <SelectTrigger className="h-9" disabled={!hasDesignerOptions}>
                                    <SelectValue placeholder={
                                       peopleLoading
                                          ? "Загрузка..."
                                          : hasDesignerOptions
                                             ? "Выберите дизайнера"
                                             : "Сначала добавьте пользователей в админке"
                                    } />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="__none__">Не выбран</SelectItem>
                                    {hasDesignerOptions ? (
                                      designerSelectOptions.map((u) => (
                                         <SelectItem key={u.id} value={u.name || String(u.id)}>
                                            {u.name || u.username}
                                         </SelectItem>
                                      ))
                                                      ) : (
                                                         <SelectItem value="__empty__" disabled>Сначала добавьте пользователей в админке</SelectItem>
                                                      )}
                                 </SelectContent>
                              </Select>
                           </div>

                           <div className="space-y-2">
                              <Label className="text-[10px] uppercase text-slate-500 font-bold">Контент-менеджер</Label>
                              <Select
                                 value={watch("contentManager") || "__none__"}
                                 onValueChange={(value) =>
                                    setValue("contentManager", value === "__none__" ? "" : value, { shouldDirty: true })
                                 }
                              >
                                 <SelectTrigger className="h-9" disabled={!hasContentOptions}>
                                    <SelectValue placeholder={
                                       peopleLoading
                                          ? "Загрузка..."
                                          : hasContentOptions
                                             ? "Выберите контент-менеджера"
                                             : "Сначала добавьте пользователей в админке"
                                    } />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="__none__">Не выбран</SelectItem>
                                    {hasContentOptions ? (
                                      contentSelectOptions.map((u) => (
                                         <SelectItem key={u.id} value={u.name || String(u.id)}>
                                            {u.name || u.username}
                                         </SelectItem>
                                      ))
                                                      ) : (
                                                         <SelectItem value="__empty__" disabled>Сначала добавьте пользователей в админке</SelectItem>
                                                      )}
                                 </SelectContent>
                              </Select>
                           </div>
                      </div>
                  </div>

            <div className="space-y-4">
               <Label className="text-xs font-bold uppercase text-slate-400">Текущий вариант: {tab}</Label>
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-900" />
                  <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">{labelMain}</Label>
                      <Input 
                        className="text-2xl font-bold h-14 bg-slate-50 border-transparent focus:bg-white transition-colors"
                        placeholder="0.00"
                        value={metrics[tab]?.[metricKey] || ''}
                        onChange={(e) => updateMetric(tab, metricKey, e.target.value)}
                      />
                  </div>
                  {!isCr && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">В корзину</Label>
                            <Input 
                                className="h-10 bg-slate-50 border-slate-100 rounded-xl text-base font-bold"
                                value={metrics[tab]?.cart || ''}
                                onChange={e => updateMetric(tab, 'cart', e.target.value)}
                            />
                        </div>
                         <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Заказов</Label>
                            <Input 
                                className="h-10 bg-slate-50 border-slate-100 rounded-xl text-base font-bold"
                                value={metrics[tab]?.orders || ''}
                                onChange={e => updateMetric(tab, 'orders', e.target.value)}
                            />
                        </div>
                    </div>
                  )}
               </div>
            </div>
            
                  <div className="space-y-1">
                        <Label className="text-xs font-bold uppercase text-slate-400">Контекст SKU</Label>
                        <Textarea
                           value={skuContextText || "Контекст SKU не найден"}
                           readOnly
                           className="bg-slate-50 text-sm min-h-[120px]"
                        />
                  </div>
                  <div className="space-y-1">
                        <Label className="text-xs font-bold uppercase text-slate-400">Описание гипотезы</Label>
                        <Textarea {...register("description")} className="bg-white text-sm min-h-[120px]" placeholder="Описание гипотезы..." />
                  </div>
         </div>

         <div className="flex-1 overflow-y-auto bg-design-background p-8">
            <div className="max-w-3xl mx-auto space-y-10">
               <div className="grid grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Цель: анализ</div>
                             <div className="text-2xl font-black text-slate-800">
                                {isGoalReached ? "Цель достигнута" : `${Math.round(progress)}%`}
                             </div>
                          </div>
                          <div className={cn("p-2 rounded-full", isGoalReached ? "bg-green-100 text-green-600" : "bg-slate-200 text-slate-400")}>
                             <Target className="w-5 h-5" />
                          </div>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                         <div className="bg-slate-900 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-3 text-xs text-slate-500 flex justify-between">
                         <span>Текущее: {valActive}</span>
                         <span>Цель: {goalValue > 0 ? goalValue.toFixed(2) : '-'}</span>
                      </div>
                  </div>

                   <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Против бенчмарка</div>
                             <div className="text-2xl font-black text-slate-800">
                                {hasVoisGoal ? (
                                    <span className={voisDiff >= 0 ? "text-green-600" : "text-red-500"}>
                                        {voisDiff > 0 ? "+" : ""}{voisDiff.toFixed(1)}%
                                    </span>
                                ) : "N/A"}
                             </div>
                          </div>
                          <div className={cn("p-2 rounded-full", isVoisReached ? "bg-green-100 text-green-600" : "bg-slate-200 text-slate-400")}>
                             <Trophy className="w-5 h-5" />
                          </div>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                         <div className={cn("h-full transition-all duration-500", voisDiff >= 0 ? "bg-green-500" : "bg-red-400")} style={{ width: `${voisProgress}%` }} />
                      </div>
                      <div className="mt-3 text-xs text-slate-500 flex justify-between">
                         <span>Текущее: {valActive}</span>
                         <span>Бенчмарк: {voisNum || '-'}</span>
                      </div>
                  </div>
               </div>

               <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full h-auto p-1 bg-slate-100 rounded-xl grid grid-cols-6 gap-1 mb-6">
                      {availableVariants.map(v => {
                         const isLeader = v === overallLeaderVar && hasAnyData && leader.isLeaderSignificant;
                         return (
                            <TabsTrigger 
                                key={v} 
                                value={v} 
                                className={cn(
                                    "h-14 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all relative overflow-hidden border border-transparent",
                                    isLeader ? "ring-amber-400 border-amber-400 ring-2 z-10" : ""
                                )}
                            >
                                <div className="flex flex-col items-center">
                                   <span className="text-sm font-bold">{v}</span>
                                   {isLeader && <Trophy className="w-3 h-3 text-amber-500 absolute top-1 right-1" />}
                                </div>
                            </TabsTrigger>
                         )
                      })}
                  </TabsList>

                  <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                      <div className="aspect-[16/9] w-full bg-slate-50 relative group">
                                       {getImg(tab) ? (
                              <img 
                                                src={getImg(tab)} 
                                className="w-full h-full object-contain"
                              />
                          ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                 <Upload className="w-12 h-12 mb-3 opacity-20" />
                                  <span className="font-medium text-sm">Загрузить изображение для {tab}</span>
                              </div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="relative">
                                  <Button variant="secondary" className="pointer-events-none">Заменить изображение</Button>
                                  <input 
                                     type="file" 
                                     className="absolute inset-0 opacity-0 cursor-pointer"
                                     accept="image/*"
                                     onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                       uploadMutation.mutate({ file: e.target.files[0], variant: tab });
                                        }
                                     }}
                                  />
                              </div>
                          </div>
                      </div>
                  </div>
               </Tabs>
               
                      <div className="space-y-4">
                           <div className="flex items-center justify-between">
                               <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-violet-500" />
                                    {t("labels.ai")}
                               </h3>
                               <div className="flex items-center gap-2">
                                    <Button
                                       variant={aiMode === "friendly" ? "default" : "outline"}
                                       size="sm"
                                       onClick={() => setAiMode("friendly")}
                                    >
                                       {t("ai.mode.friendly")}
                                    </Button>
                                    <Button
                                       variant={aiMode === "json" ? "default" : "outline"}
                                       size="sm"
                                       onClick={() => setAiMode("json")}
                                    >
                                       {t("ai.mode.json")}
                                    </Button>
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => {
                                          if (!aiLatest) return;
                                          const payload = typeof aiLatest === "string" ? aiLatest : JSON.stringify(aiLatest, null, 2);
                                          navigator.clipboard.writeText(payload);
                                          toast({ title: t("buttons.copy_json") });
                                       }}
                                       disabled={!aiLatest}
                                    >
                                       {t("buttons.copy_json")}
                                    </Button>
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={handleGenerateAi}
                                       disabled={isAnalyzing || aiDisabled}
                                    >
                                       {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                                       {t("buttons.analyze_ai")}
                                    </Button>
                               </div>
                           </div>

                           {aiDisabled && (
                              <Badge variant="destructive" className="w-fit">
                                 {aiWarningText}
                              </Badge>
                           )}

                           <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                              {aiMode === "friendly" ? (
                                 <div className="space-y-3 text-sm text-slate-700">
                                    {!aiLatest && <div className="text-slate-400">Нет данных</div>}
                                    {typeof aiLatest === "string" && <p className="whitespace-pre-wrap">{aiLatest}</p>}
                                    {typeof aiLatest === "object" && aiLatest && (aiLatest as any).analysis?.summary && (
                                       <p className="whitespace-pre-wrap">{(aiLatest as any).analysis.summary}</p>
                                    )}
                                    {typeof aiLatest === "object" && aiLatest && !(aiLatest as any).analysis?.summary && (
                                       <pre className="text-xs bg-slate-50 p-3 rounded-xl overflow-auto">
                                          {JSON.stringify(aiLatest, null, 2)}
                                       </pre>
                                    )}
                                 </div>
                              ) : (
                                 <pre className="text-xs bg-slate-50 p-3 rounded-xl overflow-auto">
                                    {aiLatest ? (typeof aiLatest === "string" ? aiLatest : JSON.stringify(aiLatest, null, 2)) : ""}
                                 </pre>
                              )}
                           </div>

                           <div className="border border-slate-100 rounded-2xl overflow-hidden">
                              <button
                                 type="button"
                                 onClick={() => setArchiveOpen((v) => !v)}
                                 className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold"
                              >
                                 {t("ai.archive")}
                                 <span className="text-slate-400">{archiveOpen ? "−" : "+"}</span>
                              </button>
                              {archiveOpen && (
                                 <div className="px-4 pb-4 space-y-3">
                                    {aiHistory.length === 0 && <div className="text-sm text-slate-400">Архив пуст</div>}
                                    {aiHistory.map((entry, idx) => {
                                       const entryValue = entry && typeof entry === "object" && "value" in entry ? (entry as any).value : entry;
                                       const entryStamp = entry && typeof entry === "object" && "timestamp" in entry ? (entry as any).timestamp : null;
                                       return (
                                          <div key={idx} className="rounded-xl border border-slate-100 p-3 text-xs text-slate-600">
                                             <div className="mb-2 font-semibold text-slate-500">
                                                #{aiHistory.length - idx}{entryStamp ? ` · ${entryStamp}` : ""}
                                             </div>
                                             {typeof entryValue === "string" ? (
                                                <div className="whitespace-pre-wrap">{entryValue}</div>
                                             ) : (
                                                <pre className="whitespace-pre-wrap">{JSON.stringify(entryValue, null, 2)}</pre>
                                             )}
                                          </div>
                                       );
                                    })}
                                 </div>
                              )}
                           </div>
                      </div>
            </div>
         </div>
      </div>

         <div className="sticky bottom-0 z-10 border-t bg-design-background/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
               {t("buttons.close")}
            </Button>
            <Button onClick={handleSubmit(onSubmit)} className="bg-black text-white hover:bg-slate-800">
               <Save className="w-4 h-4 mr-2" /> {t("buttons.save")}
            </Button>
         </div>
    </div>
  );
}

function BrainCircuit(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
        <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
        <path d="M6 18a4 4 0 0 1-1.97-3.284" />
        <path d="M17.97 14.716A4 4 0 0 1 16 18" />
      </svg>
    )
}