import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { ABTestCard } from "@/lib/components/ab-tests/ABTestCard";
import { CreateHypothesisDialog } from "@/lib/components/ab-tests/CreateHypothesisDialog";
import type { ABTest, User } from "@shared/schema";
import { Search } from "lucide-react";
import { useToast } from "@/lib/components/ui/use-toast";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/i18n/t";
import { TestEditorModal } from "@/components/modals/TestEditorModal";
import { ScopedDeleteDialog, DeleteScope } from "@/components/modals/ScopedDeleteDialog";
import { Input } from "@/lib/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/components/ui/select";
import type { Product } from "@shared/schema";

export function ABTestsPageV2() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
  
  // 1. Получаем данные тестов и пользователей
  const { data: tests, isLoading: testsLoading } = useQuery<ABTest[]>({ 
    queryKey: ["/api/tests"] 
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  
  // Filter out EXPRESS tests from main view
  const productCategoryBySku = new Map(
    (products || []).map((p) => [p.sku, p.category])
  );

  const getCategoryForTest = (test: ABTest) =>
    productCategoryBySku.get(test.sku) || test.category;

  const visibleTests = tests?.filter(
    (t) => t.testType !== "EXPRESS" && (getVisibility(t).base === true || showHidden)
  ) || [];
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

  const { data: users } = useQuery<User[]>({ 
    queryKey: ["/api/users"] 
  });

  const moveToLabMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: number; visibility: { base: boolean; lab: boolean; kanban: boolean } }) => {
      const nextVisibility = { ...visibility, lab: true };
      await apiRequest("PATCH", `/api/tests/${id}`, { visibility: nextVisibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: "Moved to Laboratory", description: "Hypothesis sent to Laboratory board" });
    },
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
      toast({ title: t('common.done') || "Done", description: "Удалено из выбранного раздела" });
    },
  });

  const handleDelete = (id: number) => {
    const test = tests?.find(t => t.id === id) || null;
    if (test) {
      setDeleteTarget(test);
      setDeleteOpen(true);
    }
  };

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: number; visibility: { base: boolean; lab: boolean; kanban: boolean } }) => {
      await apiRequest("PATCH", `/api/tests/${id}`, { visibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
    },
  });

  const openDetail = (id: number) => {
    setSelectedTestId(id);
    setDetailOpen(true);
  };

  return (
    <AppShell 
      title={t("base.title") || "База"} 
      subtitle={t("base.subtitle") || "Гипотезы и подготовка"}
      activeSection='base'
      sectionCounts={sectionCounts}
      helpContent={[
        "Создавайте гипотезы и отправляйте их в Лабораторию или Канбан.",
        "Карточка может находиться сразу в нескольких разделах.",
      ]}
      rightActions={
        <div className="flex items-center gap-3">
          <CreateHypothesisDialog />
        </div>
      }
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("filters.search_placeholder")}
                className="h-9 pl-9"
              />
            </div>
          </div>
        </div>

        {/* Grid */}
        {testsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="aspect-[3/4] bg-white rounded-3xl animate-pulse shadow-sm border border-slate-100" />
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-[420px]">
                {displayTests?.map(test => (
                    <ABTestCard 
                        key={test.id} 
                        test={test} 
                        author={users?.find(u => u.id === test.authorId)}
                          onDelete={handleDelete}
                        onMoveToLab={getVisibility(test).lab ? undefined : (id) => moveToLabMutation.mutate({ id, visibility: getVisibility(test) })}
                      hidden={getVisibility(test).base !== true}
                      hiddenToggleLabel={getVisibility(test).base !== true ? t("unhide.base") : t("hide.base")}
                      onToggleHidden={(nextHidden) => {
                        const current = getVisibility(test);
                        toggleVisibilityMutation.mutate({
                          id: test.id,
                          visibility: { ...current, base: !nextHidden },
                        });
                      }}
                        onOpenDetail={openDetail}
                    />
                ))}
            </div>
        )}

      </PageContainer>

      <TestEditorModal
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

export default ABTestsPageV2;
