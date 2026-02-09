import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ABTest, User } from "@shared/schema";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { apiRequest } from "@/lib/queryClient";
import { t } from "@/lib/i18n/t";
import { Loader2 } from "lucide-react";
import { ABTestCard } from "@/lib/components/ab-tests/ABTestCard";
import { useToast } from "@/lib/components/ui/use-toast";
import { LabDetailModal } from "@/components/modals/LabDetailModal";
import { ScopedDeleteDialog, DeleteScope } from "@/components/modals/ScopedDeleteDialog";
import { Input } from "@/lib/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/components/ui/select";
import type { Product } from "@shared/schema";

export function LabaPage() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ABTest | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showHidden, setShowHidden] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const getVisibility = (test: ABTest) => ({
    base: test.visibility?.base ?? true,
    lab: test.visibility?.lab ?? false,
    kanban: test.visibility?.kanban ?? false,
  });

  const normalizeCategory = (input: any) => {
    const raw = String(input ?? "").trim();
    if (!raw) return "uncategorized";
    const lower = raw.toLowerCase();

    if (lower === "oral" || lower === "oralcare" || lower === "oral care" || lower === "smile") return "oral care";
    if (lower === "makeup" || lower === "make-up" || lower === "make up") return "make-up";
    if (lower === "body") return "body";
    if (lower === "face") return "face";
    if (lower === "hair") return "hair";
    return raw;
  };

  const { data: tests, isLoading } = useQuery<ABTest[]>({ 
    queryKey: ["/api/tests"] 
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: users } = useQuery<User[]>({ 
    queryKey: ["/api/users"] 
  });

  const moveToKanbanMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: number; visibility: { base: boolean; lab: boolean; kanban: boolean } }) => {
      const nextVisibility = { ...visibility, kanban: true };
      await apiRequest("PATCH", `/api/tests/${id}`, {
        visibility: nextVisibility,
        sprint: "backlog",
        status: "backlog"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: "Moved to Kanban", description: "Hypothesis sent to Kanban board" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, scope, visibility }: { id: number; scope: DeleteScope; visibility: { base: boolean; lab: boolean; kanban: boolean } }) => {
      const nextVisibility = { ...visibility, [scope]: false };
      await apiRequest("PATCH", `/api/tests/${id}`, { visibility: nextVisibility });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
       toast({ title: "Removed", description: "Removed from selected section" });
    }
  });

  const openDetail = (id: number) => {
    setSelectedTestId(id);
    setDetailOpen(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testIdParam = params.get("testId");
    if (!testIdParam) return;
    const parsedId = Number(testIdParam);
    if (!Number.isFinite(parsedId)) return;
    setSelectedTestId(parsedId);
    setDetailOpen(true);
  }, [location]);

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: number; visibility: { base: boolean; lab: boolean; kanban: boolean } }) => {
      await apiRequest("PATCH", `/api/tests/${id}`, { visibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
    },
  });

  const productCategoryBySku = new Map(
    (products || []).map((p) => [p.sku, p.category])
  );

  const getCategoryForTest = (test: ABTest) =>
    productCategoryBySku.get(test.sku) || test.category;

  const visibleTests = tests?.filter(t => getVisibility(t).lab === true || showHidden) || [];
  const scopeFiltered = visibleTests;
  const catalogCategories = (products || []).map((p) => normalizeCategory(p.category));
  const categoryOptions = Array.from(
    new Set([
      ...scopeFiltered.map(t => normalizeCategory(getCategoryForTest(t))),
      ...catalogCategories,
    ])
  ).sort();
  const displayTests = scopeFiltered.filter((t) => {
    const matchesCategory = categoryFilter === "all" || normalizeCategory(getCategoryForTest(t)) === categoryFilter;
    const haystack = `${t.sku} ${t.productName}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const sectionCounts = {
    base: tests?.filter(t => t.testType !== "EXPRESS" && getVisibility(t).base !== false).length || 0,
    lab: tests?.filter(t => getVisibility(t).lab === true).length || 0,
    kanban: tests?.filter(t => getVisibility(t).kanban === true).length || 0,
  };

  const onSwitchSection = (s: "base" | "lab" | "kanban") => {
    const target =
      s === "base" ? "/" :
      s === "lab" ? "/laba" :
      "/kanban";

    if (location !== target) setLocation(target);
  };

  return (
    <AppShell
      title={t("laba.title") || "Лаборатория"}
      subtitle={t("laba.subtitle") || "Метрики, цели, лидеры и AI-вывод"}
      activeSection="lab"
      sectionCounts={sectionCounts}
      helpContent={[
        "Работайте с метриками, целями и AI-анализом для вариантов.",
        "Открывайте карточки из Канбана и Базы здесь.",
      ]}
      onSwitchSection={onSwitchSection}
    >
       <PageContainer>
          <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px]">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("filters.category")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filters.all")}</SelectItem>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                />
                {t("filters.show_hidden")}
              </label>

              <div className="relative min-w-[240px] flex-1">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("filters.search_placeholder")}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
             <div className="flex justify-center items-center h-64 text-slate-400">
               <Loader2 className="w-8 h-8 animate-spin" />
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-[420px]">
                {displayTests?.map(test => (
                      <ABTestCard 
                          key={test.id}
                          test={test} 
                          author={users?.find(u => u.id === test.authorId)}
                          onDelete={(id) => {
                            const target = tests?.find(t => t.id === id) || null;
                            if (target) {
                              setDeleteTarget(target);
                              setDeleteOpen(true);
                            }
                          }}
                          onMoveToKanban={getVisibility(test).kanban ? undefined : (id) => moveToKanbanMutation.mutate({ id, visibility: getVisibility(test) })}
                          hidden={getVisibility(test).lab !== true}
                          hiddenToggleLabel={getVisibility(test).lab !== true ? t("unhide.laba") : t("hide.laba")}
                          onToggleHidden={(nextHidden) => {
                            const current = getVisibility(test);
                            toggleVisibilityMutation.mutate({
                              id: test.id,
                              visibility: { ...current, lab: !nextHidden },
                            });
                          }}
                          onOpenDetail={openDetail}
                      />
                ))}
                {displayTests?.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    Нет карточек в Лаборатории. Отправьте из Базы.
                  </div>
                )}
            </div>
          )}
       </PageContainer>

       <LabDetailModal
         testId={selectedTestId}
         open={detailOpen}
         onOpenChange={(open) => {
           setDetailOpen(open);
           if (!open) setSelectedTestId(null);
         }}
       />

       <ScopedDeleteDialog
         open={deleteOpen}
         onOpenChange={setDeleteOpen}
         availableScopes={deleteTarget ? getVisibility(deleteTarget) : undefined}
         testName={deleteTarget?.productName}
         onConfirm={(scope) => {
           if (!deleteTarget) return;
           deleteMutation.mutate({
             id: deleteTarget.id,
             scope,
             visibility: getVisibility(deleteTarget),
           });
           setDeleteOpen(false);
         }}
       />
    </AppShell>
  );
}

export default LabaPage;

