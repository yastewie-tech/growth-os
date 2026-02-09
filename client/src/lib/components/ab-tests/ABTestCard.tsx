// Добавляем расширение .tsx, чтобы Vite не гадал
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { useMemo, useState } from "react";

import { 
  ArrowUpRight,
  FlaskConical, 
  Eye,
  EyeOff,
  Send,
  Trash2,
  Image as ImageIcon 
} from "lucide-react";
import type { ABTest, User } from "@shared/schema";
import { normalizeVariants } from "@/lib/variants/normalizeVariants";
import { t } from "@/lib/i18n/t";

interface ABTestCardProps {
  test: ABTest;
  author?: User;
  onDelete?: (id: number) => void;
  onMoveToLab?: (id: number) => void;
  onMoveToKanban?: (id: number) => void;
  onOpenDetail?: (id: number) => void;
  hidden?: boolean;
  onToggleHidden?: (nextHidden: boolean) => void;
  hiddenToggleLabel?: string;
}

export function ABTestCard({
  test,
  author,
  onDelete,
  onMoveToLab,
  onMoveToKanban,
  onOpenDetail,
  hidden,
  onToggleHidden,
  hiddenToggleLabel,
}: ABTestCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const normalizedVariants = useMemo(
    () => normalizeVariants(test.variants, test.images),
    [test.variants, test.images]
  );
  const previewImage = normalizedVariants?.A?.assets?.images?.[0] || null;

  const presence = {
    base: test.visibility?.base ?? true,
    lab: test.visibility?.lab ?? false,
    kanban: test.visibility?.kanban ?? false,
  };

  const canOpen = !!onOpenDetail;

  const managerName = test.createdBy || author?.name || "—";

  return (
    <div
      className={
        "group relative overflow-hidden rounded-3xl bg-white shadow-soft transition-all duration-300 hover:shadow-lg h-full flex flex-col" +
        (hidden ? " opacity-60" : "")
      }
      onClick={() => onOpenDetail?.(test.id)}
      role={onOpenDetail ? "button" : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onOpenDetail) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(test.id);
        }
      }}
    >
      {/* 1. БОЛЬШОЕ ФОТО (Bento Style) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
        {previewImage && !imageError ? (
          <img 
            src={previewImage} 
            alt={test.productName} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 bg-slate-50">
            <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">
              {t("tests.no_image")}
            </span>
          </div>
        )}
        
        {/* Gradient Overlay for Text Readability if needed, or status badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status Pills Floating on Image */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <Badge className="bg-white/90 text-design-text backdrop-blur-md border-none shadow-sm text-[10px] font-bold px-2 py-0.5 hover:bg-white">
            {test.platform}
          </Badge>
          <Badge className={`border-none shadow-sm text-[10px] font-bold px-2 py-0.5 ${
             test.testType.toLowerCase() === 'ctr' ? 'bg-design-lavender text-design-text' : 'bg-design-pink text-design-text'
          }`}>
             {test.testType.toUpperCase()}
          </Badge>
        </div>

        <div className="absolute top-3 right-3">
           <Badge className="bg-black/40 backdrop-blur-md text-white border-none font-mono text-[10px]">
             #{test.sku}
           </Badge>
        </div>
      </div>

      {/* 2. ИНФОРМАЦИЯ (Editorial Layout) */}
      <div className="flex-1 p-4 flex flex-col">
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-design-text-muted mb-1 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              test.category.includes('body') ? 'bg-emerald-400' : 'bg-blue-400'
            }`} />
            {test.category}
          </div>
          <div className="mb-2 flex items-center gap-2">
            {presence.base && (
              <Badge className="h-5 px-1.5 text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                {t("nav.base")}
              </Badge>
            )}
            {presence.lab && (
              <Badge className="h-5 px-1.5 text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                {t("nav.laba")}
              </Badge>
            )}
            {presence.kanban && (
              <Badge className="h-5 px-1.5 text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                {t("nav.kanban")}
              </Badge>
            )}
            {hidden && (
              <Badge className="h-5 px-1.5 text-[10px] bg-slate-200 text-slate-600 border border-slate-300">
                {t("card.hidden")}
              </Badge>
            )}
          </div>
          <h3 className="font-bold text-base leading-tight text-design-text group-hover:text-black transition-colors line-clamp-2">
            {test.productName}
          </h3>
        </div>

        {/* Action Bar */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
           <div className="flex items-center gap-2">
             <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                {author?.name?.charAt(0) || "U"}
             </div>
             <span className="text-xs text-design-text-muted font-medium">
               {managerName}
             </span>
           </div>

           <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                title={t("buttons.open")}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.(test.id);
                }}
                disabled={!canOpen}
                className="h-8 w-8 rounded-lg"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Button>

              {onMoveToLab && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("buttons.send_to_laba")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveToLab(test.id);
                  }}
                  className="h-8 w-8 rounded-lg"
                >
                  <FlaskConical className="h-4 w-4" />
                </Button>
              )}

              {onMoveToKanban && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("buttons.send_to_kanban")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveToKanban(test.id);
                  }}
                  className="h-8 w-8 rounded-lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="icon"
                title={t("buttons.delete")}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(test.id);
                }}
                className="h-8 w-8 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              {onToggleHidden && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={hiddenToggleLabel || t("card.hidden")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHidden(!hidden);
                  }}
                  className="h-8 w-8 rounded-lg"
                >
                  {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}