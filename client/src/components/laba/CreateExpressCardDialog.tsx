import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/lib/components/ui/dialog";
import { Button } from "@/lib/components/ui/button";
import { Label } from "@/lib/components/ui/label";
import { Input } from "@/lib/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo, useRef } from "react";
import { Plus, Loader2, Upload, Image as ImageIcon, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/components/ui/select";
import { useToast } from "@/lib/components/ui/use-toast";
import { Product } from "@shared/schema";
import { ScrollArea } from "@/lib/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

// Type definition for Express Card
type ExpressType = "Standart" | "NEW";

export function CreateExpressCardDialog() {
   const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<ExpressType>("Standart");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Products Query
  const { data: productsData, isLoading: productsLoading } = useQuery<Product[]>({
     queryKey: ["/api/products"],
     enabled: open, 
  });

  const handleProductSelect = (prod: Product) => {
      setSku(prod.sku);
     setProductName(prod.productName);
      setCategory(prod.category);
  };

  const filteredProducts = useMemo(() => {
     if (!productsData) return [];
     const search = sku.toLowerCase();
     if (!search) return productsData;
     return productsData.filter(p => 
        p.sku.toLowerCase().includes(search) || 
        p.productName.toLowerCase().includes(search)
    );
  }, [productsData, sku]);

  // Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Direct fetch because apiRequest is JSON optimized usually, though we could use it if tweaked.
      // Using standard fetch for multipart
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.url);
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
       console.error(error);
       toast({ title: "Upload failed", variant: "destructive" });
    } finally {
       setIsUploading(false);
       // Reset input
       if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
         const variants = {
            assets: {
               images: data.imageUrl ? { A: data.imageUrl } : {},
            },
         };
      const payload = {
        sku: data.sku,
        productName: data.productName,
        category: data.category,
        platform: "Express",
        testType: "EXPRESS", 
        tier: data.type, 
            variants,
        status: "backlog",
            createdBy: user?.name || String(user?.id || ""),
            assignees: { designer: "", contentManager: "" },
            visibility: { base: false, lab: false, kanban: true },
      };
      
      const res = await apiRequest("POST", "/api/tests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      setOpen(false);
      resetForm();
         toast({ title: "Экспресс-карта создана" });
    },
    onError: () => {
      toast({ title: "Failed to create card", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setSku("");
    setProductName("");
    setCategory("");
    setType("Standart");
    setImageUrl("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ sku, productName, category, type, imageUrl });
  };
    
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
          <Plus className="w-4 h-4" />
               Экспресс-карта
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
               <DialogTitle>Создать экспресс-карту</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          <div className="space-y-2">
                  <Label>Выберите товар (поиск по SKU/названию)</Label>
            <div className="relative border rounded-lg p-2 bg-slate-50 min-h-[120px]">
               {productsLoading ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
               ) : (
                  <>
                    <Input 
                     placeholder="Поиск по товарам..." 
                        className="mb-2 h-8 text-xs bg-white"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                    />
                    <ScrollArea className="h-[120px]">
                        <div className="flex flex-col gap-1">
                            {filteredProducts.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleProductSelect(p)}
                                    className={`text-left text-xs px-2 py-1.5 rounded hover:bg-slate-200 truncate ${sku === p.sku ? "bg-blue-100 text-blue-800 font-bold" : "text-slate-600"}`}
                                >
                                    <span className="font-mono mr-2">{p.sku}</span>
                                    {p.productName}
                                </button>
                            ))}
                            {filteredProducts.length === 0 && (
                              <div className="text-xs text-slate-400 p-2 text-center">Ничего не найдено</div>
                            )}
                        </div>
                    </ScrollArea>
                  </>
               )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Выбранный SKU</Label>
                <Input value={sku} readOnly className="bg-slate-100 font-mono text-xs" />
             </div>
             <div className="space-y-2">
                <Label>Категория</Label>
                <Input value={category} readOnly className="bg-slate-100 text-xs" />
             </div>
          </div>
          
          <div className="space-y-2">
                  <Label>Название товара</Label>
            <Input value={productName} readOnly className="bg-slate-100" />
          </div>

          <div className="space-y-2">
                  <Label>Тип</Label>
            <div className="flex gap-4">
               <button
                  type="button"
                  onClick={() => setType("Standart")}
                  className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-bold transition-all",
                      type === "Standart" 
                      ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-200" 
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
               >
                  Standart
               </button>
               <button
                  type="button"
                  onClick={() => setType("NEW")}
                  className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-bold transition-all",
                      type === "NEW" 
                      ? "bg-pink-500 text-white border-pink-500 ring-2 ring-pink-200" 
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
               >
                  NEW
               </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Image (Upload from Computer)</Label>
            <div className="flex gap-3 items-start">
               {imageUrl ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                      <button 
                         type="button"
                         onClick={() => setImageUrl("")}
                         className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      >
                         <X className="w-5 h-5" />
                      </button>
                  </div>
               ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors text-slate-400 hover:text-blue-500"
                  >
                     {isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                     ) : (
                        <>
                           <Upload className="w-5 h-5" />
                           <span className="text-[10px] font-bold">Upload</span>
                        </>
                     )}
                  </div>
               )}

               <div className="flex-1 space-y-2">
                   <div className="text-xs text-slate-400 leading-snug">
                      Click the box on the left to upload a file from your computer. 
                      Supports PNG, JPG, WEBP.
                   </div>
                   {/* Hidden File Input */}
                   <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileChange}
                   />
                   
                   {/* Fallback URL input if needed */}
                   <Input 
                        value={imageUrl} 
                        onChange={(e) => setImageUrl(e.target.value)} 
                        placeholder="Or paste image URL..." 
                        className="text-xs h-8"
                    />
               </div>
            </div>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={createMutation.isPending || !sku || !productName}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Card
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}


