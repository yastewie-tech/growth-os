import { ABTest } from "@shared/schema";
import { CATEGORY_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { t } from "@/lib/i18n/t";
import { normalizeVariants } from "@/lib/variants/normalizeVariants";
import { Sparkles, Image as ImageIcon, Trash2 } from "lucide-react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

interface SprintCardProps {
  test: ABTest;
  onClick: (test: ABTest) => void;
  onDelete?: (id: number) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

export function SprintCard({ test, onClick, onDelete, dragHandleProps }: SprintCardProps) {
  const isGold = test.tier === "Gold";
  const skuText = String(test.sku || "").replace(/\s+/g, "");
  
  // Custom styles for Express cards
  const isExpress = test.testType === "EXPRESS";
  const isNew = test.tier === "NEW"; // Only for Express
  const isStandard = test.tier === "Standart"; // Only for Express

  // Fallback color if category not found
  const categoryColor = CATEGORY_COLORS[test.category] || "#94a3b8";
  const normalizedVariants = normalizeVariants(test.variants, test.images);
  const previewImage = normalizedVariants?.A?.assets?.images?.[0] || null;

    const hasActions = !!onDelete;

    if (isExpress) {
     return (
        <div
            onClick={() => onClick(test)}
            {...dragHandleProps}
            className={cn(
              "group relative flex flex-col gap-3 p-3 rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden",
                isNew 
                   ? "bg-pink-50 border-pink-200 hover:shadow-pink-100" 
                   : "bg-slate-900 border-slate-800 text-white hover:shadow-slate-500/20"
            )}
        >
            {/* Express Badge */}
           <div className="flex justify-between items-center">
              <span className={cn("text-[10px] font-mono opacity-70", isNew ? "text-pink-900" : "text-slate-400")}>
                {skuText}
              </span>
               <Badge 
                variant="outline" 
                className={cn(
                  "h-5 rounded-[6px] text-[9px] px-1.5 uppercase tracking-wider font-extrabold border-0",
                   isNew ? "bg-pink-500 text-white" : "bg-white/20 text-white"
                )}
              >
                {isNew ? "NEW" : "STD"}
              </Badge>
           </div>

            <div className="flex gap-3 items-center">
              <div className={cn(
                "w-16 rounded-lg overflow-hidden shrink-0 border",
                isNew ? "bg-white border-pink-100" : "bg-slate-800 border-slate-700" 
              )}>
                <div className="aspect-[3/4] w-full flex items-center justify-center">
                  {previewImage ? (
                  <img src={previewImage} className="w-full h-full object-cover" alt="thumb" />
                   ) : (
                    <ImageIcon className={cn("w-5 h-5", isNew ? "text-pink-300" : "text-slate-600")} />
                   )}
                </div>
              </div>
                
                <div className="min-w-0">
                    <h4 className={cn(
                        "font-bold text-xs leading-tight line-clamp-2 mb-1",
                        isNew ? "text-pink-950" : "text-slate-100"
                    )}>
                        {test.productName}
                    </h4>
                     <div className="flex items-center gap-1.5">
                        <span 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: categoryColor }}
                        />
                        <span className={cn("text-[10px] opacity-70", isNew ? "text-pink-800" : "text-slate-400")}>
                            {test.category}
                        </span>
                    </div>
                </div>
            </div>

            {hasActions && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                title={t("buttons.delete")}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(test.id);
                }}
                className={cn(
                  "absolute bottom-3 right-3 h-9 w-9 rounded-lg text-red-600 hover:text-red-700",
                  isNew ? "bg-pink-100" : "bg-white/10"
                )}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      }

  return (
    <div
      onClick={() => onClick(test)}
      {...dragHandleProps}
      className={cn(
        "group relative flex flex-col gap-3 p-4 rounded-2xl bg-white border border-white/60 shadow-sm transition-all duration-300 hover:shadow-soft hover:-translate-y-1 cursor-pointer overflow-hidden",
        isGold && "ring-2 ring-amber-100 bg-gradient-to-br from-white to-amber-50/30"
      )}
    >
      <div
        className="-mt-4 -mx-4 px-4 h-8 flex items-center justify-between text-[10px] font-bold"
        style={{ backgroundColor: categoryColor }}
      >
        <span className="text-white drop-shadow-sm">{skuText}</span>
        {isGold && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-white/80 border border-amber-200 px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" /> GOLD
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex gap-3">
         {/* Larger preview in 3:4 ratio */}
         <div className="w-20 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
             <div className="aspect-[3/4] w-full flex items-center justify-center">
               {previewImage ? (
                   <img src={previewImage} className="w-full h-full object-cover" alt="thumb" />
               ) : (
                   <ImageIcon className="w-5 h-5 text-slate-300" />
               )}
             </div>
         </div>

         <div className="min-w-0">
            <h4 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
            {test.productName}
            </h4>
            <div className="flex items-center gap-2">
              <Badge className="h-5 px-2 text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                {test.testType?.toUpperCase() || "CTR"}
              </Badge>
            </div>
         </div>
      </div>

      {/* Footer spacer */}
      <div className="mt-auto" />

      {hasActions && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          title={t("buttons.delete")}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(test.id);
          }}
          className="absolute bottom-3 right-3 h-9 w-9 rounded-lg text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
