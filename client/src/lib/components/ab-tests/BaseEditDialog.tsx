import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/lib/components/ui/dialog";
import { Input } from "@/lib/components/ui/input";
import { Label } from "@/lib/components/ui/label";
import { Textarea } from "@/lib/components/ui/textarea";
import { AbTest } from "@shared/schema";
import { SmartHypothesisViewer } from "./SmartHypothesisViewer";
import { Button } from "@/lib/components/ui/button";
import { UploadCloud } from "lucide-react";
import { normalizeVariants } from "@/lib/variants/normalizeVariants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: AbTest;
}

export function BaseEditDialog({ open, onOpenChange, test }: Props) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<AbTest>({ defaultValues: test });
  const normalizedVariants = normalizeVariants(test.variants, test.images);
  const previewImages = ["A", "B", "C", "D", "E"]
    .map((key) => normalizedVariants?.[key]?.assets?.images?.[0])
    .filter((url) => typeof url === "string" && url.trim().length > 0) as string[];

  useEffect(() => {
    reset(test);
  }, [test, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<AbTest>) => {
      await fetch(`/api/ab-tests/${test.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
      onOpenChange(false);
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    
    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    const { url } = await res.json();
    updateMutation.mutate({ imgAUrl: url });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden bg-white rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="font-light text-xl">
            Редактирование SKU <span className="font-bold">{test.sku}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
               <div>
                 <Label className="text-xs text-slate-400 uppercase">Название продукта</Label>
                 <Input {...register("productName")} className="mt-1 font-medium text-lg border-transparent px-0 hover:border-slate-200 focus:border-slate-200 rounded-none transition-all" />
               </div>
               <div>
                 <Label className="text-xs text-slate-400 uppercase">Описание</Label>
                 <Textarea {...register("description")} className="mt-1 min-h-[100px] bg-slate-50 border-none resize-none font-light" />
               </div>
               
               <SmartHypothesisViewer test={test} />
            </div>

            <div className="col-span-1 space-y-4">
               {/* Горизонтальный вывод всех изображений */}
               {previewImages.length > 0 && (
                 <div className="flex flex-row gap-3 mb-2">
                   {previewImages.map((url: string, idx: number) => (
                     <div key={idx} className="aspect-[3/4] w-20 bg-slate-100 rounded-xl overflow-hidden relative">
                       <img src={url} alt="image" className="w-full h-full object-cover" />
                     </div>
                   ))}
                 </div>
               )}
               {/* Одиночное изображение (старый вариант) */}
              <div className="aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden relative group">
                {test.imgAUrl ? <img src={test.imgAUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300">Нет изображения</div>}
                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                     <UploadCloud className="w-6 h-6" />
                     <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
               </div>
               
               {/* Metrics - Goal removed as requested */}
               <div className="p-3 bg-slate-50 rounded-lg">
                 <Label className="text-[10px] text-slate-400 uppercase">Текущая метрика</Label>
                 <Input type="number" step="0.01" {...register("metricCurrent", { valueAsNumber: true })} className="h-8 bg-white" />
               </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
          <Button onClick={handleSubmit((d) => updateMutation.mutate(d))} className="bg-slate-900 text-white">Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}