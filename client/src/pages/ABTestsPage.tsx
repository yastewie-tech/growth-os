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

export default function ABTestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ABTest | null>(null);

  const getVisibility = (test: ABTest) => ({
    base: test.visibility?.base === true,
    lab: test.visibility?.lab === true,
    kanban: test.visibility?.kanban === true,
  });
  const normalizeVisibility = (test: ABTest) => {
    const visibility = test.visibility && typeof test.visibility === "object" ? test.visibility : {};
    return {
      ...test,
      visibility: {
        base: visibility.base ?? true,
        lab: visibility.lab ?? false,
        kanban: visibility.kanban ?? false,
      },
    };
  };
  
  // 1. Получаем данные тестов и пользователей
  const { data: tests, isLoading: testsLoading } = useQuery<ABTest[]>({ 
    queryKey: ["/api/tests"] 
  });
  
  // Filter out EXPRESS tests from main view
  const normalizedTests = (tests || []).map(normalizeVisibility);
  const displayTests = normalizedTests.filter(t => t.testType !== "EXPRESS" && getVisibility(t).base === true);
  const sectionCounts = {
    base: normalizedTests.filter(t => t.testType !== "EXPRESS" && getVisibility(t).base === true).length || 0,
    lab: normalizedTests.filter(t => getVisibility(t).lab === true).length || 0,
    kanban: normalizedTests.filter(t => getVisibility(t).kanban === true).length || 0,
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
      toast({ title: "Moved to Laboratory", description: "Hypothesis sent to Laboratory" });
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
      await apiRequest("PATCH", `/api/tests/${id}`, {
        visibility: nextVisibility,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: t('common.done') || "Done", description: "Удалено из выбранного раздела" });
    },
  });

  const handleDelete = (id: number) => {
    const test = normalizedTests.find(t => t.id === id) || null;
    if (test) {
      setDeleteTarget(test);
      setDeleteOpen(true);
    }
  };

  const openDetail = (id: number) => {
    setSelectedTestId(id);
    setDetailOpen(true);
  };

  return (
    <AppShell 
      title={t("base.title")} 
      subtitle={t("base.subtitle")}
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
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t("base.title")}</h2>
                <p className="text-slate-500 mt-1">{t("base.subtitle")}</p>
            </div>
            
            <div className="relative w-72 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                    placeholder="Поиск гипотез..." 
                    className="w-full pl-10 pr-4 py-2 bg-white rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 shadow-sm transition-shadow"
                />
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
                      onMoveToKanban={getVisibility(test).kanban ? undefined : (id) => moveToKanbanMutation.mutate({ id, visibility: getVisibility(test) })}
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