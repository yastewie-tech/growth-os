import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/lib/components/ui/dialog";
import { ScrollArea } from "@/lib/components/ui/scroll-area";
import { TestEditorContent } from "@/components/modals/TestEditorContent";

interface TestEditorModalProps {
  testId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function TestEditorModal({ testId, open, onOpenChange, onSaved }: TestEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="right-0 left-auto top-0 translate-x-0 translate-y-0 h-screen w-[1024px] max-w-[100vw] rounded-none p-0 gap-0 overflow-hidden bg-design-background [&>button]:hidden">
        <DialogTitle className="sr-only">Редактор теста</DialogTitle>
        <DialogDescription className="sr-only">
          Редактирование гипотезы, изображений и параметров теста.
        </DialogDescription>
        <ScrollArea className="h-full w-full">
          <div className="min-h-full">
            {testId && (
              <TestEditorContent 
                testId={testId} 
                onClose={() => onOpenChange(false)}
                onSaved={onSaved}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
