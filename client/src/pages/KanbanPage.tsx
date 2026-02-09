import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/components/ui/use-toast";
import type { ABTest } from "@shared/schema";
import { KanbanBoard } from "@/components/laba/KanbanBoard";
import { AppShell } from "@/components/layout/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { LabDetailModal } from "@/components/modals/LabDetailModal";
import { t } from "@/lib/i18n/t";
import { ScopedDeleteDialog, DeleteScope } from "@/components/modals/ScopedDeleteDialog";

export function KanbanPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ABTest | null>(null);

  const getVisibility = (test: ABTest) => ({
    base: test.visibility?.base ?? true,
    lab: test.visibility?.lab ?? false,
    kanban: test.visibility?.kanban ?? false,
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

  const { data: tests, isLoading } = useQuery<ABTest[]>({ 
    queryKey: ["/api/tests"] 
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ id, sprint, status }: { id: number, sprint: string, status: string }) => {
       await apiRequest("PATCH", `/api/tests/${id}`, { sprint, status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tests"] }),
  });

  const reorderTaskMutation = useMutation({
    mutationFn: async ({ id, position }: { id: number, position: number }) => {
       await apiRequest("PATCH", `/api/tests/${id}`, { position });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tests"] }),
  });

  const sendToLabMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: number; visibility: { base: boolean; lab: boolean; kanban: boolean } }) => {
      const nextVisibility = { ...visibility, lab: true };
      await apiRequest("PATCH", `/api/tests/${id}`, { visibility: nextVisibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: "Sent to Laboratory", description: "Card is now available in Laboratory" });
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
      toast({ title: "Removed", description: "Removed from selected section" });
    },
  });

  const handleSelect = (t: ABTest) => {
    setSelectedTestId(t.id);
    setDetailOpen(true);
  };

  const normalizedTests = (tests || []).map(normalizeVisibility);
  const displayTests = normalizedTests.filter(t => getVisibility(t).kanban === true);
  const sectionCounts = {
    base: normalizedTests.filter(t => t.testType !== "EXPRESS" && getVisibility(t).base === true).length || 0,
    lab: normalizedTests.filter(t => getVisibility(t).lab === true).length || 0,
    kanban: normalizedTests.filter(t => getVisibility(t).kanban === true).length || 0,
  };

  return (
    <AppShell
      title={t("kanban.title") || "Канбан"}
      subtitle={t("kanban.subtitle") || "Спринты и статусы"}
      activeSection="kanban"
      sectionCounts={sectionCounts}
      helpContent={[
        "Планируйте работу по спринтам и статусам.",
        "Карточки можно отправлять в Лабораторию для анализа.",
      ]}
    >
       <div className="h-[calc(100vh-80px)] w-full overflow-hidden">
          {isLoading ? (
             <div className="flex justify-center items-center h-full text-slate-400">
               <Loader2 className="w-8 h-8 animate-spin" />
             </div>
          ) : (
            <KanbanBoard 
               tests={displayTests || []} 
               onSelect={handleSelect}
               onMoveTask={(id, sprint, status) => moveTaskMutation.mutate({ id, sprint, status })}
               onReorderTask={(id, pos) => reorderTaskMutation.mutate({ id, position: pos })}
              onDeleteTask={(id) => {
                const target = normalizedTests.find(t => t.id === id) || null;
                if (target) {
                  setDeleteTarget(target);
                  setDeleteOpen(true);
                }
              }}
              onSendToLab={(id) => {
                const test = normalizedTests.find(t => t.id === id);
                if (test) sendToLabMutation.mutate({ id, visibility: getVisibility(test) });
              }}
            />
          )}
       </div>

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

export default KanbanPage;
