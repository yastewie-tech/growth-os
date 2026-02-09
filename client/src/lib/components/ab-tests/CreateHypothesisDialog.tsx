import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "../ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { Plus, X, Search, Pencil, ArrowLeft, Upload, Loader2, Trash2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import type { InsertABTest, User, Product } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { normalizeVariants, setVariantImage, VariantKey } from "@/lib/variants/normalizeVariants";

// --- НАСТРОЙКИ CLOUDINARY ---
const CLOUDINARY_CLOUD_NAME = "dbo8fwicc"; 
const CLOUDINARY_PRESET = "l_default"; // Ваш пресет

const CATEGORIES = ["oral care", "hair", "body", "make-up", "face"];

export function CreateHypothesisDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // --- СОСТОЯНИЯ ---
  const [skuSearch, setSkuSearch] = useState(""); 
  const [showSkuList, setShowSkuList] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  
  // Состояния для картинок
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 1. Грузим данные
  const { data: productsList } = useQuery<Product[]>({ 
    queryKey: ["/api/products"],
    queryFn: async () => (await apiRequest("GET", "/api/products")).json()
  });

  const { data: usersList } = useQuery<User[]>({ 
    queryKey: ["/api/users"],
    queryFn: async () => (await apiRequest("GET", "/api/users")).json()
  });

  const filteredProducts = useMemo(() => {
    if (!productsList) return [];
    if (!skuSearch) return productsList;
    const lower = skuSearch.toLowerCase();
    return productsList.filter(p => 
      p.sku.includes(lower) || p.productName.toLowerCase().includes(lower)
    );
  }, [productsList, skuSearch]);

  const { register, handleSubmit, setValue, reset, watch } = useForm<InsertABTest>({
    defaultValues: {
      sku: "", productName: "", category: "", platform: "wb",
      testType: "ctr", status: "backlog", description: "", authorId: undefined,
      images: [], 
    },
  });

  const skuRegister = register("sku", { required: true });

  // Следим за типом теста для лимитов
  const currentTestType = watch("testType");

  // --- ЗАГРУЗКА В CLOUDINARY ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Проверка лимитов
    const maxFiles = currentTestType === "ctr" ? 1 : 10;
    if (imageUrls.length + files.length > maxFiles) {
      alert(`Для типа ${currentTestType.toUpperCase()} можно загрузить максимум ${maxFiles} фото.`);
      return;
    }

    setIsUploading(true);
    const uploaded = [...imageUrls];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_PRESET);

        // Прямой запрос к Cloudinary (без нашего бэкенда)
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: "POST", body: formData }
        );
        
        if (!res.ok) throw new Error("Ошибка загрузки");
        
        const data = await res.json();
        uploaded.push(data.secure_url);
      }
      setImageUrls(uploaded);
      setValue("images", uploaded); // Сохраняем ссылки в форму
    } catch (error) {
      console.error(error);
      alert("Ошибка загрузки. Проверьте консоль.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (indexToRemove: number) => {
    const newImages = imageUrls.filter((_, idx) => idx !== indexToRemove);
    setImageUrls(newImages);
    setValue("images", newImages);
  };

  // Выбор товара из списка
  const selectProduct = (product: Product) => {
    setValue("sku", product.sku);
    setValue("productName", product.productName);
    setValue("category", product.category);
    setSkuSearch(`${product.sku} — ${product.productName}`);
    setShowSkuList(false);
  };

  const toggleMode = () => {
    setIsManualMode(!isManualMode);
    // Сброс полей
    setSkuSearch("");
    setValue("sku", "");
    setValue("productName", "");
    setValue("category", "");
  };

  useEffect(() => {
    if (!isManualMode) return;
    const sku = skuSearch.trim();
    if (!sku) return;

    const handler = window.setTimeout(async () => {
      try {
        setLookupLoading(true);
        const res = await fetch(`/api/products/lookup?sku=${encodeURIComponent(sku)}`);
        if (!res.ok) {
          setLookupLoading(false);
          return;
        }
        const product = (await res.json()) as Product | null;
        if (product) {
          setValue("sku", product.sku);
          setValue("productName", product.productName);
          setValue("category", product.category);
        }
      } catch {
        // ignore lookup errors
      } finally {
        setLookupLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(handler);
  }, [isManualMode, skuSearch, setValue]);

  const createTestMutation = useMutation({
    mutationFn: async (data: InsertABTest) => {
      let variants = normalizeVariants({});
      const variantKeys: VariantKey[] = ["A", "B", "C", "D", "E"];
      variantKeys.forEach((key, idx) => {
        const url = imageUrls[idx];
        if (url) variants = setVariantImage(variants, key, url);
      });
      const payload = { 
        ...data, 
        authorId: Number(data.authorId),
        variants,
        createdBy: user?.name || String(user?.id || ""),
        assignees: { designer: "", contentManager: "" },
        visibility: { base: true, lab: false, kanban: false },
      };
      const res = await apiRequest("POST", "/api/tests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      setOpen(false);
      reset();
      setSkuSearch("");
      setImageUrls([]);
      setIsManualMode(false);
      alert("Гипотеза успешно создана!");
    },
    onError: () => {
      alert("Ошибка создания. Проверьте, заполнены ли обязательные поля.");
    },
  });

  const onSubmit = (data: InsertABTest) => createTestMutation.mutate(data);

  // Updated Styling classes used inside the form, if any remain, but we will mostly rely on Tailwind classes directly
  const inputClass = "w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-design-text focus:outline-none focus:ring-2 focus:ring-black/10 transition-all";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-design-text-muted mb-2";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-black text-white hover:bg-slate-800 shadow-soft rounded-full px-6 h-10 font-bold tracking-tight">
          <Plus className="h-4 w-4" /> Новая гипотеза
        </Button>
      </DialogTrigger>
      
      {/* Increased width and added padding for visual hierarchy */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none bg-white">
        
        {/* HEADER */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-8 py-6 flex items-center justify-between">
           <div>
             <DialogTitle className="text-2xl font-bold tracking-tight text-design-text">
               Создать гипотезу
             </DialogTitle>
             <DialogDescription className="text-sm text-design-text-muted">Запуск нового эксперимента</DialogDescription>
           </div>
           {/* Close is automatic via DialogPrimitive, but we ensure clear spacing */}
        </div>

        <div className="p-8 space-y-8">
            <div className="mb-6 flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-sm font-medium text-design-text-muted">
                {!isManualMode ? "Выбор из базы" : "Ручной ввод"}
              </span>
              <button 
                type="button" 
                onClick={toggleMode} 
                className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
              >
                {!isManualMode ? (
                  <><Pencil className="h-3.5 w-3.5" /> Ввести вручную</>
                ) : (
                  <><ArrowLeft className="h-3.5 w-3.5" /> Назад к поиску</>
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* --- ПОИСК ИЛИ РУЧНОЙ ВВОД --- */}
              {!isManualMode ? (
                // АВТО-РЕЖИМ
                <div className="relative">
                  <label className={labelClass}>Выберите товар</label>
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="SKU или Название..."
                      className={inputClass}
                      value={skuSearch}
                      onChange={(e) => {
                        setSkuSearch(e.target.value);
                        setShowSkuList(true);
                      }}
                      onFocus={() => setShowSkuList(true)}
                    />
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                  {showSkuList && filteredProducts.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border rounded shadow-lg max-h-48 overflow-y-auto mt-1">
                      {filteredProducts.map((p) => (
                        <li key={p.id} onClick={() => selectProduct(p)} className="p-2 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer text-sm border-b">
                          <span className="font-bold">{p.sku}</span> — {p.productName}
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Скрытые поля */}
                  <input type="hidden" {...register("sku", { required: true })} />
                  <input type="hidden" {...register("productName", { required: true })} />
                  <input type="hidden" {...register("category", { required: true })} />
                </div>
              ) : (
                // РУЧНОЙ РЕЖИМ
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded border mb-4">
                  <div className="mb-2">
                    <label className={labelClass}>SKU (Артикул)</label>
                    <div className="relative">
                      <input
                        {...skuRegister}
                        placeholder="123456"
                        className={inputClass}
                        onChange={(e) => {
                          skuRegister.onChange(e);
                          setSkuSearch(e.target.value);
                        }}
                      />
                      {lookupLoading && (
                        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className={labelClass}>Название товара</label>
                    <input {...register("productName", { required: true })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Категория</label>
                    {/* Выпадающий список категорий */}
                    <select {...register("category", { required: true })} className={inputClass}>
                      <option value="">Выберите категорию</option>
                      {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className={labelClass}>Платформа</label>
                   <select {...register("platform")} className={inputClass}>
                     <option value="wb">Wildberries</option>
                     <option value="ozon">Ozon</option>
                   </select>
                 </div>
                 <div>
                    <label className={labelClass}>Тип теста</label>
                    <select {...register("testType")} className={inputClass}>
                        <option value="ctr">Превью (CRT)</option>
                        <option value="cr">Воронка (CR)</option>
                        <option value="rich">Рич-контент</option>
                    </select>
                  </div>
              </div>

              {/* --- БЛОК ЗАГРУЗКИ --- */}
              <div className="mb-4 mt-2">
                <label className={labelClass}>
                  Изображения 
                  <span className="text-gray-400 font-normal ml-2">
                    ({currentTestType === 'ctr' ? 'Макс. 1' : 'Макс. 10'})
                  </span>
                </label>
                
                {/* Сетка превью */}
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="relative group aspect-square border rounded overflow-hidden">
                        <img src={url} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {index === 0 && (
                          <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] text-center py-1">
                            Превью
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Кнопка загрузки */}
                <div className="flex items-center gap-2">
                  <label className={`
                    flex items-center justify-center px-4 py-2 border border-dashed border-blue-300 rounded cursor-pointer 
                    hover:bg-blue-50 transition-colors w-full
                    ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
                  `}>
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2 text-blue-600" />
                        <span className="text-blue-600 font-medium">Загрузить фото</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      multiple={currentTestType !== 'ctr'} 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>
              {/* --------------------------- */}

              <div>
                <label className={labelClass}>Создатель</label>
                <select {...register("authorId")} className={inputClass} required>
                  <option value="">Выберите сотрудника</option>
                  {usersList?.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-3">
                <label className={labelClass}>Описание</label>
                <textarea
                  {...register("description")}
                  placeholder="Суть гипотезы..."
                  className={inputClass}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-8">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="px-6 rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTestMutation.isPending || isUploading}
                  className="px-8 rounded-xl bg-black text-white hover:bg-slate-800 shadow-soft"
                >
                  {createTestMutation.isPending ? "Creating..." : "Create Hypothesis"}
                </Button>
              </div>
            </form>
          </div>
      </DialogContent>
    </Dialog>
  );
}