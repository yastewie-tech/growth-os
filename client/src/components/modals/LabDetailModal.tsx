import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/lib/components/ui/dialog";
import { ScrollArea } from "@/lib/components/ui/scroll-area";
import { TestDetailView } from "@/components/laba/TestDetailView";

interface LabDetailModalProps {
  testId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabDetailModal({ testId, open, onOpenChange }: LabDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="right-0 left-auto top-0 translate-x-0 translate-y-0 h-screen w-[1024px] max-w-[100vw] rounded-none p-0 gap-0 overflow-hidden bg-design-background [&>button]:hidden">
        <DialogTitle className="sr-only">Детали теста</DialogTitle>
        <DialogDescription className="sr-only">
          Просмотр и редактирование метрик, целей и ассайнов.
        </DialogDescription>
        <ScrollArea className="h-full w-full">
          <div className="min-h-full">
            {testId && <TestDetailView testId={testId} onClose={() => onOpenChange(false)} />}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
