import React, { useEffect, useState, useMemo } from "react";
import { ABTest, User } from "@shared/schema";
import { t } from "@/lib/i18n/t";
import { useAuth } from "@/lib/auth-context";
import { AiMixerModal } from "@/components/ai/AiMixerModal";
import { AiMixerResultV3, TestType } from "@/lib/ai/ai-mixer.types";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/lib/components/ui/button";
import { Input } from "@/lib/components/ui/input";
import { Textarea } from "@/lib/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/components/ui/select";
import { Badge } from "@/lib/components/ui/badge";
import { useToast } from "@/lib/components/ui/use-toast";
import { 
  ArrowLeft,
  Loader2, 
  Upload, 
  Sparkles, 
  ImagePlus, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Code2 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { normalizeVariants, setVariantImage, VariantKey } from "@/lib/variants/normalizeVariants";

interface TestEditorContentProps {
  testId: number;
  initialTest?: ABTest;
  onClose?: () => void;
  onSaved?: () => void;
}

export function TestEditorContent({ testId, initialTest, onClose, onSaved }: TestEditorContentProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [test, setTest] = useState<ABTest | null>(initialTest || null);
  const [author, setAuthor] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!initialTest);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Added missing state
  
  // State from CTREditPage
  const [editedDescription, setEditedDescription] = useState(initialTest?.description || "");
  const [editedVariants, setEditedVariants] = useState<any>(
    () => normalizeVariants(initialTest?.variants, initialTest?.images)
  );
  const [editedReferences, setEditedReferences] = useState<string[]>(initialTest?.references || []);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [showRawJson, setShowRawJson] = useState(false);
  const [aiMixerLastResult, setAiMixerLastResult] = useState<AiMixerResultV3 | null>(null);
  const [editedManager, setEditedManager] = useState(initialTest?.manager || "");
  const [editedDesignerGen, setEditedDesignerGen] = useState(initialTest?.designerGen || "");
  const [editedContentManager, setEditedContentManager] = useState(initialTest?.contentManager || "");
  const [peopleDict, setPeopleDict] = useState<
    | {
        managers: User[];
        designers: User[];
        content: User[];
      }
    | null
  >(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleUsers, setPeopleUsers] = useState<User[]>([]);

  const normalizedEditedVariants = useMemo(
    () => normalizeVariants(editedVariants),
    [editedVariants]
  );
  const funnelUrls = useMemo(() => {
    return ["B", "C", "D", "E"]
      .map((key) => normalizedEditedVariants?.[key]?.assets?.images?.[0])
      .filter((url) => typeof url === "string" && url.trim().length > 0) as string[];
  }, [normalizedEditedVariants]);
  
  const canEdit = !!user; // Simplified check
  const isCTR = test?.testType === "CTR";

  // Load test if not provided
  useEffect(() => {
    if (initialTest || !testId) return;

    let isMounted = true;
    const fetchTest = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/tests/${testId}`);
        if (!response.ok) throw new Error("Failed to load test");
        const data = await response.json();
        
        if (isMounted) {
            setTest(data);
            setEditedDescription(data.description || "");
            const normalizedWithLegacy = normalizeVariants(data.variants, data.images);
            const normalizedWithoutLegacy = normalizeVariants(data.variants);
            const hasLegacyImages = Array.isArray(data.images) && data.images.some((url: string) => String(url || "").trim().length > 0);
            const hasPersistedImages = ["A", "B", "C", "D", "E"].some(
              (key) => normalizedWithoutLegacy?.[key]?.assets?.images?.[0]
            );

            if (hasLegacyImages && !hasPersistedImages) {
              apiRequest("PATCH", `/api/tests/${data.id}`, { variants: normalizedWithLegacy }).catch(() => undefined);
            }

            setEditedVariants(normalizedWithLegacy);
            setEditedReferences(data.references || []);
          setEditedManager(data.manager || "");
          setEditedDesignerGen(data.designerGen || "");
          setEditedContentManager(data.contentManager || "");
            
            if (data.authorId) {
                fetch(`/api/users/${data.authorId}`)
                    .then(r => r.json())
                    .then(u => isMounted && setAuthor(u))
                    .catch(() => {});
            }
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchTest();
    return () => { isMounted = false; };
  }, [testId, initialTest]);

  useEffect(() => {
    let isMounted = true;
    const loadPeople = async () => {
      setPeopleLoading(true);
      try {
        const [peopleRes, usersRes] = await Promise.all([
          fetch("/api/dictionaries/people"),
          fetch("/api/users"),
        ]);

        const [peopleJson, usersJson] = await Promise.all([
          peopleRes.ok ? peopleRes.json() : null,
          usersRes.ok ? usersRes.json() : null,
        ]);

        if (isMounted) {
          if (peopleJson) {
            setPeopleDict({
              managers: Array.isArray(peopleJson.managers) ? peopleJson.managers : [],
              designers: Array.isArray(peopleJson.designers) ? peopleJson.designers : [],
              content: Array.isArray(peopleJson.content) ? peopleJson.content : [],
            });
          }
          if (Array.isArray(usersJson)) {
            setPeopleUsers(usersJson);
          }
        }
      } catch {
        if (isMounted) {
          setPeopleDict(null);
          setPeopleUsers([]);
        }
      } finally {
        if (isMounted) setPeopleLoading(false);
      }
    };
    loadPeople();
    return () => {
      isMounted = false;
    };
  }, []);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "l_default");
    const res = await fetch(`https://api.cloudinary.com/v1_1/dbo8fwicc/image/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.secure_url;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | 'funnel' | 'reference') => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const url = await uploadToCloudinary(e.target.files[i]);
        urls.push(url);
      }

      if (target === 'main') {
        setEditedVariants((prev: any) => setVariantImage(prev, "A", urls[0]));
      } else if (target === 'funnel') {
        setEditedVariants((prev: any) => {
          let next = normalizeVariants(prev);
          const order: VariantKey[] = ["B", "C", "D", "E"];
          urls.forEach((url) => {
            const emptyKey = order.find((key) => !next?.[key]?.assets?.images?.[0]);
            const targetKey = emptyKey || "E";
            next = setVariantImage(next, targetKey, url);
          });
          return next;
        });
      } else if (target === 'reference') {
        setEditedReferences(prev => [...prev, ...urls]);
      }
    } catch(e) {
      toast({ title: t('common.error'), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!test) return;
    setIsSaving(true);
    try {
      const createdBy = test.createdBy || user?.name || String(user?.id || "");
        await apiRequest("PATCH", `/api/tests/${test.id}`, {
          description: editedDescription,
          variants: normalizedEditedVariants,
        references: editedReferences,
        createdBy: createdBy || undefined,
        manager: editedManager || undefined,
        designerGen: editedDesignerGen || undefined,
        contentManager: editedContentManager || undefined,
        });
        toast({ title: t('editor.save_success') });
        if (onSaved) onSaved();
    } catch (e) {
        toast({ title: t('editor.save_error'), variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAiApplied = (result: AiMixerResultV3) => {
    setAiMixerLastResult(result);
    const first = result.items?.[0];
    if (first?.description) {
      const aiBlock = `AI: ${first.title ? `${first.title} — ` : ""}${first.description}`.trim();
      setEditedDescription((prev) => (prev ? `${prev}\n\n${aiBlock}` : aiBlock));
    }
    toast({ title: t('ai.done') });
  };

  const getStatusLabel = (value?: string) => {
    if (value === "active") return "В работе";
    if (value === "completed") return "Завершён";
    return "Черновик";
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!test) return <div className="p-8 text-center">{t('tests.not_found')}</div>;

  const testTypeLabel = String(test.testType || "CTR").toUpperCase();
  const statusLabel = getStatusLabel(test.status);
  const managerOptions = peopleDict?.managers?.length ? peopleDict.managers : peopleUsers;
  const designerOptions = peopleDict?.designers?.length ? peopleDict.designers : peopleUsers;
  const contentOptions = peopleDict?.content?.length ? peopleDict.content : peopleUsers;
  const hasManagerOptions = managerOptions.length > 0;
  const hasDesignerOptions = designerOptions.length > 0;
  const hasContentOptions = contentOptions.length > 0;

    return (
    <div className="min-h-full flex flex-col bg-design-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-design-background/95 backdrop-blur border-b border-slate-100 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              title="Назад к тестам"
              aria-label="Назад к тестам"
              onClick={onClose}
              disabled={!onClose}
              className="h-9 w-9 rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Тест #{test.id} · {testTypeLabel}</h2>
                <Badge variant="secondary" className="h-6 px-2 text-[10px] uppercase">
                  {statusLabel}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">{test.productName} · {test.platform}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Visual Assets */}
        <div className="lg:col-span-1 space-y-6">
            <SectionCard title="Визуальные материалы">
                 {/* Main Preview */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Вариант A (контроль)</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => handleFileUpload(e, 'main')} 
                        disabled={isUploading} 
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        title="Заменить изображение"
                        aria-label="Заменить изображение"
                        className="h-9 w-9 rounded-full bg-white/90 shadow-lg backdrop-blur-md"
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="relative aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group">
                    <div className="absolute top-2 left-2 z-10 bg-slate-900/90 text-white rounded-xl px-3 py-1 font-black text-sm">
                      A
                    </div>
                    <div className="absolute bottom-2 left-2 z-10 text-xs font-bold text-slate-500">
                      Контроль
                    </div>
                    {normalizedEditedVariants?.A?.assets?.images?.[0] ? (
                      <img 
                        src={normalizedEditedVariants?.A?.assets?.images?.[0]} 
                        className="w-full h-full object-cover" 
                        alt="Main"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-300">
                        <ImagePlus className="h-12 w-12 opacity-20" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Funnel Slides */}
                {!isCTR && (
                    <div className="space-y-4 pt-4 border-t border-dashed">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Слайды воронки</label>
                        <div className="relative">
                        <input 
                            type="file" 
                            multiple
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={(e) => handleFileUpload(e, 'funnel')}
                            disabled={isUploading}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Добавить слайд"
                          aria-label="Добавить слайд"
                          className="h-9 w-9 rounded-full"
                          disabled={isUploading}
                        >
                          <ImagePlus className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        {funnelUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden group">
                            <img src={url} className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  size="icon" 
                                  variant="destructive" 
                                  className="h-6 w-6 rounded-full"
                                    onClick={() => {
                                      setEditedVariants((prev: any) => {
                                        const next = normalizeVariants(prev);
                                        const key = ("BCDE".split("") as VariantKey[]).find(
                                          (k) => next?.[k]?.assets?.images?.[0] === url
                                        );
                                        if (!key) return next;
                                        return setVariantImage(next, key, "");
                                      });
                                    }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        ))}
                    </div>
                    </div>
                )}
            </SectionCard>

            <SectionCard title="Референсы и конкуренты">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {editedReferences.map((ref, i) => (
                    <div key={i} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group">
                         <img src={ref} className="w-full h-full object-cover" />
                         <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="icon" 
                              variant="destructive" 
                              className="h-6 w-6 rounded-full"
                                onClick={() => setEditedReferences(prev => prev.filter((_, idx) => idx !== i))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                         </div>
                    </div>
                  ))}
                </div>
                 <div className="relative">
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        onChange={(e) => handleFileUpload(e, "reference")}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      title="Добавить референс"
                      aria-label="Добавить референс"
                      className="w-full border-dashed h-10"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    {editedReferences.length === 0 && (
                      <div className="text-xs text-slate-400 mt-2">
                        Добавьте примеры конкурентов или удачные референсы — они пригодятся для сравнения и AI-анализа.
                      </div>
                    )}
                 </div>
            </SectionCard>
        </div>

        {/* Center/Right Column: Description & Config */}
        <div className="lg:col-span-2 space-y-6">
            <SectionCard 
                title="Гипотеза"
                action={
                  <AiMixerModal 
                    productName={test.productName}
                    productContext={editedDescription}
                    testType={test.testType as TestType}
                    images={["A", "B", "C", "D", "E"].map((key) => normalizedEditedVariants?.[key]?.assets?.images?.[0]).filter(Boolean) as string[]}
                    onCreated={(resultJson) => {
                      try {
                        const parsed = JSON.parse(resultJson) as AiMixerResultV3;
                        handleAiApplied(parsed);
                      } catch {
                        toast({ title: t('ai.error') || "Ошибка AI", variant: "destructive" });
                      }
                    }}
                    triggerLabel="AI помощь"
                    triggerVariant="outline"
                    triggerSize="sm"
                    triggerClassName="rounded-full"
                  />
                }
            >
                <Textarea 
                    value={editedDescription} 
                    onChange={e => setEditedDescription(e.target.value)} 
                    className="min-h-[200px] text-base leading-relaxed resize-y bg-slate-50 border-0 focus-visible:ring-1 focus-visible:ring-slate-200"
                  placeholder="Если мы изменим [что именно], то [какое поведение изменится], потому что [почему/триггер]."
                />
            </SectionCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <SectionCard title="Контекст теста">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">Платформа</label>
                                <div className="font-medium mt-1">{test.platform}</div>
                            </div>
                            <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">Категория</label>
                                <div className="font-medium mt-1 uppercase text-xs">{test.category}</div>
                            </div>
                        </div>
                         <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Создал</label>
                            <div className="font-medium mt-1 flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-400 to-pink-400" />
                        {author?.name || author?.username || "Неизвестно"}
                            </div>
                         </div>
                    </div>
                 </SectionCard>

                 <SectionCard title="Исполнители">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">Менеджер</label>
                        <Select
                          value={editedManager || "__none__"}
                          onValueChange={(value) => setEditedManager(value === "__none__" ? "" : value)}
                        >
                          <SelectTrigger className="mt-2 h-9" disabled={!hasManagerOptions}>
                            <SelectValue placeholder={
                              peopleLoading
                                ? "Загрузка..."
                                : hasManagerOptions
                                  ? "Выберите менеджера"
                                  : "Сначала добавьте пользователей в админке"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Не выбран</SelectItem>
                            {hasManagerOptions ? (
                              managerOptions.map((u) => (
                                <SelectItem key={u.id} value={u.name || String(u.id)}>
                                  {u.name || u.username}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__empty__" disabled>Сначала добавьте пользователей в админке</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">Дизайнер</label>
                        <Select
                          value={editedDesignerGen || "__none__"}
                          onValueChange={(value) => setEditedDesignerGen(value === "__none__" ? "" : value)}
                        >
                          <SelectTrigger className="mt-2 h-9" disabled={!hasDesignerOptions}>
                            <SelectValue placeholder={
                              peopleLoading
                                ? "Загрузка..."
                                : hasDesignerOptions
                                  ? "Выберите дизайнера"
                                  : "Сначала добавьте пользователей в админке"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Не выбран</SelectItem>
                            {hasDesignerOptions ? (
                              designerOptions.map((u) => (
                                <SelectItem key={u.id} value={u.name || String(u.id)}>
                                  {u.name || u.username}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__empty__" disabled>Сначала добавьте пользователей в админке</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">Контент-менеджер</label>
                        <Select
                          value={editedContentManager || "__none__"}
                          onValueChange={(value) => setEditedContentManager(value === "__none__" ? "" : value)}
                        >
                          <SelectTrigger className="mt-2 h-9" disabled={!hasContentOptions}>
                            <SelectValue placeholder={
                              peopleLoading
                                ? "Загрузка..."
                                : hasContentOptions
                                  ? "Выберите контент-менеджера"
                                  : "Сначала добавьте пользователей в админке"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Не выбран</SelectItem>
                            {hasContentOptions ? (
                              contentOptions.map((u) => (
                                <SelectItem key={u.id} value={u.name || String(u.id)}>
                                  {u.name || u.username}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__empty__" disabled>Сначала добавьте пользователей в админке</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                 </SectionCard>

                 {/* AI Debug Info (Hidden by default or minimalistic) */}
                 {aiMixerLastResult && (
                    <SectionCard title="AI Analysis">
                         <div className="flex items-center justify-between mb-2">
                             <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {t('ai.done')}
                             </Badge>
                             <Button variant="ghost" size="sm" onClick={() => setShowRawJson(!showRawJson)}>
                                <Code2 className="h-4 w-4" />
                             </Button>
                         </div>
                         {showRawJson && (
                             <pre className="text-[10px] bg-slate-900 text-slate-50 p-4 rounded-lg overflow-auto max-h-[200px]">
                                 {JSON.stringify(aiMixerLastResult, null, 2)}
                             </pre>
                         )}
                    </SectionCard>
                 )}
            </div>
        </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-20 bg-design-background/95 backdrop-blur border-t border-slate-100 px-8 py-4">
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('buttons.close') || "Закрыть"}</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('buttons.save') || "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
