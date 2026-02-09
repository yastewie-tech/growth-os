import { Dialog, DialogContent, DialogTitle } from "@/lib/components/ui/dialog";
import { Button } from "@/lib/components/ui/button";
import { t } from "@/lib/i18n/t";

export type DeleteScope = "base" | "lab" | "kanban";

interface ScopedDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: DeleteScope) => void;
  availableScopes?: { base?: boolean; lab?: boolean; kanban?: boolean };
  testName?: string;
}

export function ScopedDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  availableScopes,
  testName,
}: ScopedDeleteDialogProps) {
  const scopeEnabled = {
    base: availableScopes?.base !== false,
    lab: availableScopes?.lab !== false,
    kanban: availableScopes?.kanban !== false,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-lg font-semibold">
          {t("delete.title")}
        </DialogTitle>
        {testName && (
          <div className="text-sm text-slate-500">{testName}</div>
        )}
        <div className="mt-3 text-sm text-slate-500">{t("delete.note")}</div>
        <div className="mt-5 grid gap-2">
          <Button
            variant="destructive"
            disabled={!scopeEnabled.base}
            onClick={() => onConfirm("base")}
          >
            {t("delete.from_base")}
          </Button>
          <Button
            variant="destructive"
            disabled={!scopeEnabled.lab}
            onClick={() => onConfirm("lab")}
          >
            {t("delete.from_laba")}
          </Button>
          <Button
            variant="destructive"
            disabled={!scopeEnabled.kanban}
            onClick={() => onConfirm("kanban")}
          >
            {t("delete.from_kanban")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
