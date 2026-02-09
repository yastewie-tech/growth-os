import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ABTestCard } from "@/lib/components/ab-tests/ABTestCard";
import { CreateHypothesisDialog } from "@/lib/components/ab-tests/CreateHypothesisDialog";
import type { ABTest, User } from "@shared/schema";
import { Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/components/ui/use-toast";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/i18n/t";
import { TestEditorModal } from "@/components/modals/TestEditorModal";
import { LabDetailModal } from "@/components/modals/LabDetailModal";

export default function ABTestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for modals
  const [labModalTestId, setLabModalTestId] = useState<number | null>(null);
  const [editModalTestId, setEditModalTestId] = useState<number | null>(null);

  // 1. Получаем данные тестов и пользователей
  const { data: tests, isLoading: testsLoading } = useQuery<ABTest[]>({ 
    queryKey: ["/api/tests"] 
  });
  
  const { data: users } = useQuery<User[]>({ 
    queryKey: ["/api/users"] 
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: t('common.done') || "Done", description: "Test deleted successfully" });
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Delete test?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSaved = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      setEditModalTestId(null);
  };

  return (
    <AppShell 
      title={t('base.title')} 
      activeSection='base'
      rightActions={<CreateHypothesisDialog />}
    >
      <PageContainer>
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Гипотезы</h2>
                <p className="text-slate-500 mt-1">Управление экспериментами и гипотезами</p>
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
                {tests?.map(test => (
                    <ABTestCard 
                        key={test.id} 
                        test={test} 
                        author={users?.find(u => u.id === test.authorId)}
                        onDelete={handleDelete}
                        onOpenLab={(id) => setLabModalTestId(id)}
                        onOpenEdit={(id) => setEditModalTestId(id)}
                    />
                ))}
            </div>
        )}

        {/* Modals */}
        <TestEditorModal 
            open={!!editModalTestId} 
            testId={editModalTestId} 
            onOpenChange={(v) => !v && setEditModalTestId(null)}
            onSaved={handleSaved}
        />
        
        <LabDetailModal
            open={!!labModalTestId}
            testId={labModalTestId}
            onOpenChange={(v) => !v && setLabModalTestId(null)}
        />

      </PageContainer>
    </AppShell>
  );
}
