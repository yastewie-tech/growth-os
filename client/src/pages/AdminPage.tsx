import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/lib/components/ui/button";
import { Input } from "@/lib/components/ui/input";
import { Textarea } from "@/lib/components/ui/textarea";
import { Label } from "@/lib/components/ui/label";
import { Badge } from "@/lib/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/lib/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import type { Product, SkuContext, User } from "@shared/schema";
import {
  Archive,
  FileUp,
  Pencil,
  RotateCcw,
  Shield,
  Trash2,
  UserPlus,
  UserX,
} from "lucide-react";

const roleOptions = [
  { value: "user", label: "Пользователь" },
  { value: "manager", label: "Менеджер" },
  { value: "designer", label: "Дизайнер" },
  { value: "content_manager", label: "Контент-менеджер" },
  { value: "admin", label: "Администратор" },
];

const contextKinds = [
  { id: "base", label: "База (описание товара)" },
  { id: "category_rules", label: "Правила категории" },
  { id: "brand_tone", label: "Тон бренда" },
  { id: "do_dont", label: "Можно / нельзя" },
  { id: "insights_history", label: "История инсайтов" },
  { id: "custom", label: "Другое" },
];

const buildQuery = (base: string, params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${base}?${query}` : base;
};

const parseTabular = (text: string) => {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length === 0) return [] as Array<Record<string, string>>;

  const delimiter = rows[0].includes("\t") ? "\t" : ",";
  const headerCells = rows[0].split(delimiter).map((cell) => cell.trim().toLowerCase());
  const hasHeader = headerCells.includes("sku") && (headerCells.includes("product_name") || headerCells.includes("productname"));

  const mapRow = (cells: string[], header?: string[]) => {
    if (!header) {
      return {
        sku: cells[0] || "",
        product_name: cells[1] || "",
        category: cells[2] || "",
        platform: cells[3] || "",
      };
    }

    const lookup = (key: string) => {
      const index = header.indexOf(key);
      return index >= 0 ? (cells[index] || "") : "";
    };

    return {
      sku: lookup("sku"),
      product_name: lookup("product_name") || lookup("productname"),
      category: lookup("category"),
      platform: lookup("platform"),
    };
  };

  const dataRows = rows.slice(hasHeader ? 1 : 0);
  return dataRows.map((line) => mapRow(line.split(delimiter).map((cell) => cell.trim()), hasHeader ? headerCells : undefined));
};

const ConfirmDialog = ({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel,
}: {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) => (
  <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
        <Button onClick={onConfirm}>{confirmLabel || "Подтвердить"}</Button>
      </div>
    </DialogContent>
  </Dialog>
);

export function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isAdmin = Boolean(user?.isAdmin || user?.role === "admin");

  useEffect(() => {
    if (user && !isAdmin) setLocation("/");
  }, [user, isAdmin, setLocation]);

  const [userSearch, setUserSearch] = useState("");
  const [userActive, setUserActive] = useState("active");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    name: "",
    role: "user",
    isAdmin: false,
    isActive: true,
    password: "",
  });
  const [userDeactivate, setUserDeactivate] = useState<User | null>(null);

  const usersQuery = useQuery<User[]>({
    queryKey: ["/api/admin/users", userSearch, userActive],
    queryFn: async () => {
      const url = buildQuery("/api/admin/users", {
        q: userSearch || undefined,
        active: userActive === "all" ? undefined : userActive === "active" ? "true" : "false",
      });
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      email: "",
      name: "",
      role: "user",
      isAdmin: false,
      isActive: true,
      password: "",
    });
    setUserModalOpen(true);
  };

  const openEditUser = (target: User) => {
    setEditingUser(target);
    setUserForm({
      email: target.email || "",
      name: target.name || "",
      role: target.role || "user",
      isAdmin: Boolean(target.isAdmin || target.role === "admin"),
      isActive: target.isActive !== false,
      password: "",
    });
    setUserModalOpen(true);
  };

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        email: userForm.email,
        name: userForm.name,
        role: userForm.role,
        is_admin: userForm.isAdmin,
        is_active: userForm.isActive,
      };
      if (userForm.password) payload.password = userForm.password;

      if (editingUser) {
        const res = await apiRequest("PATCH", `/api/admin/users/${editingUser.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/admin/users", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserModalOpen(false);
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (target: User) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${target.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserDeactivate(null);
    },
  });

  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("all");
  const [productActive, setProductActive] = useState("active");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    sku: "",
    productName: "",
    category: "",
    platform: "",
    isActive: true,
  });
  const [productDeactivate, setProductDeactivate] = useState<Product | null>(null);
  const [productImportOpen, setProductImportOpen] = useState(false);
  const [productImportMode, setProductImportMode] = useState("upsert");
  const [productImportText, setProductImportText] = useState("");
  const [productImportFile, setProductImportFile] = useState<File | null>(null);
  const [productImportResult, setProductImportResult] = useState<any | null>(null);

  const productsQuery = useQuery<Product[]>({
    queryKey: ["/api/admin/products", productSearch, productCategory, productActive],
    queryFn: async () => {
      const url = buildQuery("/api/admin/products", {
        q: productSearch || undefined,
        category: productCategory === "all" ? undefined : productCategory,
        active: productActive === "all" ? undefined : productActive === "active" ? "true" : "false",
      });
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const categoryOptions = useMemo(() => {
    const values = (productsQuery.data || []).map((p) => p.category).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [productsQuery.data]);

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({ sku: "", productName: "", category: "", platform: "", isActive: true });
    setProductModalOpen(true);
  };

  const openEditProduct = (target: Product) => {
    setEditingProduct(target);
    setProductForm({
      sku: target.sku,
      productName: target.productName,
      category: target.category,
      platform: target.platform || "",
      isActive: target.isActive !== false,
    });
    setProductModalOpen(true);
  };

  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sku: productForm.sku,
        product_name: productForm.productName,
        category: productForm.category,
        platform: productForm.platform || null,
        is_active: productForm.isActive,
      };
      if (editingProduct) {
        const res = await apiRequest("PATCH", `/api/admin/products/${editingProduct.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/admin/products", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setProductModalOpen(false);
    },
  });

  const deactivateProductMutation = useMutation({
    mutationFn: async (target: Product) => {
      const res = await apiRequest("DELETE", `/api/admin/products/${target.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setProductDeactivate(null);
    },
  });

  const importProductsMutation = useMutation({
    mutationFn: async () => {
      let items: Array<Record<string, string>> = [];
      if (productImportFile) {
        const text = await productImportFile.text();
        const parsed = JSON.parse(text) as Array<Record<string, string>>;
        items = parsed;
      } else {
        items = parseTabular(productImportText);
      }

      const res = await apiRequest("POST", "/api/admin/products/import", {
        mode: productImportMode,
        items,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setProductImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
  });

  const [skuSearch, setSkuSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<SkuContext | null>(null);
  const [contextForm, setContextForm] = useState({
    sku: "",
    title: "",
    kind: "base",
    content: "",
    isActive: true,
  });
  const [contextArchiveTarget, setContextArchiveTarget] = useState<SkuContext | null>(null);
  const [contextImportOpen, setContextImportOpen] = useState(false);
  const [contextImportText, setContextImportText] = useState("");
  const [contextImportFile, setContextImportFile] = useState<File | null>(null);
  const [contextImportSku, setContextImportSku] = useState("");
  const [contextImportResult, setContextImportResult] = useState<any | null>(null);

  const contextsQuery = useQuery<SkuContext[]>({
    queryKey: ["/api/admin/sku-contexts", skuSearch, includeArchived],
    queryFn: async () => {
      const url = buildQuery("/api/admin/sku-contexts", {
        sku: skuSearch || undefined,
        includeArchived: includeArchived ? "true" : undefined,
      });
      const res = await apiRequest("GET", url);
      return res.json();
    },
    retry: false,
  });

  const openCreateContext = () => {
    setEditingContext(null);
    setContextForm({ sku: skuSearch, title: "", kind: "base", content: "", isActive: true });
    setContextModalOpen(true);
  };

  const openEditContext = (target: SkuContext) => {
    setEditingContext(target);
    setContextForm({
      sku: target.sku,
      title: target.title,
      kind: target.kind,
      content: target.content,
      isActive: target.isActive !== false,
    });
    setContextModalOpen(true);
  };

  const saveContextMutation = useMutation({
    mutationFn: async () => {
      const kindLabel = contextKinds.find((k) => k.id === contextForm.kind)?.label || contextForm.kind;
      const payload = {
        sku: contextForm.sku,
        title: editingContext?.title || kindLabel,
        kind: contextForm.kind,
        content: contextForm.content,
        is_active: contextForm.isActive,
      };

      if (editingContext) {
        const res = await apiRequest("PATCH", `/api/admin/sku-contexts/${editingContext.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/admin/sku-contexts", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sku-contexts"], exact: false });
      contextsQuery.refetch();
      setContextModalOpen(false);
    },
  });

  const archiveContextMutation = useMutation({
    mutationFn: async (target: SkuContext) => {
      const res = await apiRequest("PATCH", `/api/admin/sku-contexts/${target.id}`, {
        archived_at: target.archivedAt ? null : new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sku-contexts"], exact: false });
      contextsQuery.refetch();
      setContextArchiveTarget(null);
    },
  });

  const importContextsMutation = useMutation({
    mutationFn: async () => {
      let payloadSku = contextImportSku.trim();
      let items: Array<Record<string, string>> = [];

      if (contextImportFile) {
        const text = await contextImportFile.text();
        const parsed = JSON.parse(text) as { sku?: string; items?: Array<Record<string, string>> };
        payloadSku = payloadSku || (parsed.sku || "");
        items = parsed.items || [];
      } else if (contextImportText.trim()) {
        const parsed = JSON.parse(contextImportText) as { sku?: string; items?: Array<Record<string, string>> };
        payloadSku = payloadSku || (parsed.sku || "");
        items = parsed.items || [];
      }

      const res = await apiRequest("POST", "/api/admin/sku-contexts/import", {
        sku: payloadSku,
        items,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setContextImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sku-contexts"], exact: false });
      contextsQuery.refetch();
    },
  });

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <AppShell title="Админ-панель" subtitle="Нет доступа">
        <PageContainer>
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-500">
            Нет доступа
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Админ-панель"
      subtitle="Пользователи, продукты и контексты"
      rightActions={
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation("/")}
        >
          <Shield className="h-4 w-4" />
          В базу
        </Button>
      }
    >
      <PageContainer>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SectionCard
            title="Пользователи"
            subtitle="Каталог команды, роли и активность"
            action={
              <Button size="sm" className="gap-2" onClick={openCreateUser}>
                <UserPlus className="h-4 w-4" />
                Добавить пользователя
              </Button>
            }
          >
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Поиск по имени или email"
                className="h-9"
              />
              <Select value={userActive} onValueChange={setUserActive}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Активность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="inactive">Отключенные</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              {contextsQuery.isError && (
                <div className="px-3 py-3 text-sm text-red-600">
                  Не удалось загрузить контексты. Проверьте доступ и перезагрузите страницу.
                </div>
              )}
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-500">
                <div className="col-span-4">Email</div>
                <div className="col-span-3">Имя</div>
                <div className="col-span-2">Роль</div>
                <div className="col-span-1">Админ</div>
                <div className="col-span-1">Активен</div>
                <div className="col-span-1 text-right">Действия</div>
              </div>
              <div className="divide-y">
                {(usersQuery.data || []).map((u) => (
                  <div key={u.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                    <div className="col-span-4 truncate">{u.email || "—"}</div>
                    <div className="col-span-3 truncate">{u.name}</div>
                    <div className="col-span-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {u.role || "user"}
                      </Badge>
                    </div>
                    <div className="col-span-1 text-center">{u.isAdmin || u.role === "admin" ? "Да" : "—"}</div>
                    <div className="col-span-1 text-center">{u.isActive === false ? "Нет" : "Да"}</div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Редактировать"
                        onClick={() => openEditUser(u)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        title="Отключить"
                        onClick={() => setUserDeactivate(u)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(usersQuery.data || []).length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-slate-400">Пользователей нет</div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Продукты"
            subtitle="Каталог SKU и категории"
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setProductImportOpen(true)}>
                  <FileUp className="h-4 w-4" />
                  Массовое добавление
                </Button>
                <Button size="sm" className="gap-2" onClick={openCreateProduct}>
                  <UserPlus className="h-4 w-4" />
                  Добавить продукт
                </Button>
              </div>
            }
          >
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Поиск по SKU или названию"
                className="h-9"
              />
              <Select value={productCategory} onValueChange={setProductCategory}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={productActive} onValueChange={setProductActive}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Активность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="inactive">Отключенные</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-500">
                <div className="col-span-2">SKU</div>
                <div className="col-span-4">Название</div>
                <div className="col-span-2">Категория</div>
                <div className="col-span-2">Платформа</div>
                <div className="col-span-1">Активен</div>
                <div className="col-span-1 text-right">Действия</div>
              </div>
              <div className="divide-y">
                {(productsQuery.data || []).map((p) => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                    <div className="col-span-2 font-mono text-xs truncate">{p.sku}</div>
                    <div className="col-span-4 truncate">{p.productName}</div>
                    <div className="col-span-2 truncate">{p.category}</div>
                    <div className="col-span-2 truncate">{p.platform || "—"}</div>
                    <div className="col-span-1 text-center">{p.isActive === false ? "Нет" : "Да"}</div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Редактировать"
                        onClick={() => openEditProduct(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        title="Отключить"
                        onClick={() => setProductDeactivate(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(productsQuery.data || []).length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-slate-400">Товаров нет</div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Контексты SKU для AI"
            subtitle="База знаний по SKU"
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setContextImportOpen(true)}>
                  <FileUp className="h-4 w-4" />
                  Импорт контекстов
                </Button>
                <Button size="sm" className="gap-2" onClick={openCreateContext}>
                  <UserPlus className="h-4 w-4" />
                  Добавить контекст
                </Button>
              </div>
            }
          >
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <Input
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="Поиск по SKU"
                className="h-9"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="h-4 w-4"
                />
                Показывать архив
              </label>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-500">
                <div className="col-span-2">SKU</div>
                <div className="col-span-3">Заголовок</div>
                <div className="col-span-3">Тип</div>
                <div className="col-span-2">Описание</div>
                <div className="col-span-1">Активен</div>
                <div className="col-span-1 text-right">Действия</div>
              </div>
              <div className="divide-y">
                {(contextsQuery.data || []).map((ctx) => (
                  <div key={ctx.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                    <div className="col-span-2 font-mono text-xs truncate">{ctx.sku}</div>
                    <div className="col-span-3 truncate">{ctx.title}</div>
                    <div className="col-span-3">
                      <Badge variant="secondary" className="text-[10px]">
                        {contextKinds.find((k) => k.id === ctx.kind)?.label || ctx.kind}
                      </Badge>
                    </div>
                    <div className="col-span-2 truncate text-slate-500">{ctx.content}</div>
                    <div className="col-span-1 text-center">{ctx.isActive === false ? "Нет" : "Да"}</div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Редактировать"
                        onClick={() => openEditContext(ctx)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={ctx.archivedAt ? "Восстановить" : "Архивировать"}
                        onClick={() => setContextArchiveTarget(ctx)}
                      >
                        {ctx.archivedAt ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {(contextsQuery.data || []).length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-slate-400">Контекстов нет</div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </PageContainer>

      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Редактировать пользователя" : "Добавить пользователя"}</DialogTitle>
            <DialogDescription>Заполните данные и сохраните изменения.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveUserMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={userForm.email}
                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@company.ru"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Имя и фамилия"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={userForm.role} onValueChange={(value) => setUserForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Роль" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={userForm.isAdmin}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, isAdmin: e.target.checked }))}
                />
                Администратор
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={userForm.isActive}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Активен
              </label>
            </div>
            <div className="space-y-2">
              <Label>Пароль (опционально)</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Оставьте пустым, чтобы не менять"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUserModalOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={saveUserMutation.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Редактировать продукт" : "Добавить продукт"}</DialogTitle>
            <DialogDescription>Заполните данные SKU и сохраните.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveProductMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={productForm.sku}
                onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={productForm.productName}
                onChange={(e) => setProductForm((prev) => ({ ...prev, productName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Категория</Label>
              <Input
                value={productForm.category}
                onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Платформа</Label>
              <Input
                value={productForm.platform}
                onChange={(e) => setProductForm((prev) => ({ ...prev, platform: e.target.value }))}
                placeholder="WB / Ozon / Web"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={productForm.isActive}
                onChange={(e) => setProductForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Активен
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProductModalOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={saveProductMutation.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={productImportOpen} onOpenChange={setProductImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Массовое добавление</DialogTitle>
            <DialogDescription>Вставьте CSV/TSV или загрузите JSON.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Режим</Label>
              <Select value={productImportMode} onValueChange={setProductImportMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Режим" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upsert">Обновлять и добавлять</SelectItem>
                  <SelectItem value="insert_only">Только добавлять (пропускать дубли)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CSV/TSV (sku,product_name,category,platform)</Label>
              <Textarea
                value={productImportText}
                onChange={(e) => setProductImportText(e.target.value)}
                placeholder="sku,product_name,category,platform"
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <Label>JSON файл</Label>
              <Input
                type="file"
                accept="application/json"
                onChange={(e) => setProductImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {productImportResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <div>Создано: {productImportResult.created || 0}</div>
                <div>Обновлено: {productImportResult.updated || 0}</div>
                <div>Пропущено: {productImportResult.skipped || 0}</div>
                {(productImportResult.errors || []).length > 0 && (
                  <div className="mt-2">
                    <div className="font-semibold">Ошибки:</div>
                    <ul className="list-disc pl-4">
                      {productImportResult.errors.map((err: any, idx: number) => (
                        <li key={idx}>Строка {err.index + 1}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProductImportOpen(false)}>Закрыть</Button>
              <Button
                onClick={() => importProductsMutation.mutate()}
                disabled={importProductsMutation.isPending}
              >
                Импортировать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contextModalOpen} onOpenChange={setContextModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingContext ? "Редактировать контекст" : "Добавить контекст"}</DialogTitle>
            <DialogDescription>Контекст будет привязан к SKU.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveContextMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={contextForm.sku}
                onChange={(e) => setContextForm((prev) => ({ ...prev, sku: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={contextForm.kind} onValueChange={(value) => setContextForm((prev) => ({ ...prev, kind: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Тип" />
                </SelectTrigger>
                <SelectContent>
                  {contextKinds.map((kind) => (
                    <SelectItem key={kind.id} value={kind.id}>{kind.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Контент</Label>
              <Textarea
                value={contextForm.content}
                onChange={(e) => setContextForm((prev) => ({ ...prev, content: e.target.value }))}
                className="min-h-[140px]"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={contextForm.isActive}
                onChange={(e) => setContextForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Активен
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setContextModalOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={saveContextMutation.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={contextImportOpen} onOpenChange={setContextImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Импорт контекстов</DialogTitle>
            <DialogDescription>
              {"Загрузите JSON вида {\"sku\":\"...\",\"items\":[...]}"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>SKU (если нет в JSON)</Label>
              <Input value={contextImportSku} onChange={(e) => setContextImportSku(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>JSON</Label>
              <Textarea
                value={contextImportText}
                onChange={(e) => setContextImportText(e.target.value)}
                className="min-h-[140px]"
              />
            </div>
            <div className="space-y-2">
              <Label>JSON файл</Label>
              <Input
                type="file"
                accept="application/json"
                onChange={(e) => setContextImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {contextImportResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <div>Создано: {contextImportResult.created || 0}</div>
                <div>Пропущено: {contextImportResult.skipped || 0}</div>
                {(contextImportResult.errors || []).length > 0 && (
                  <div className="mt-2">
                    <div className="font-semibold">Ошибки:</div>
                    <ul className="list-disc pl-4">
                      {contextImportResult.errors.map((err: any, idx: number) => (
                        <li key={idx}>Строка {err.index + 1}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setContextImportOpen(false)}>Закрыть</Button>
              <Button
                onClick={() => importContextsMutation.mutate()}
                disabled={importContextsMutation.isPending}
              >
                Импортировать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(userDeactivate)}
        title="Отключить пользователя"
        description={userDeactivate ? `Отключить ${userDeactivate.name}?` : undefined}
        onCancel={() => setUserDeactivate(null)}
        onConfirm={() => userDeactivate && deactivateUserMutation.mutate(userDeactivate)}
        confirmLabel="Отключить"
      />

      <ConfirmDialog
        open={Boolean(productDeactivate)}
        title="Отключить продукт"
        description={productDeactivate ? `Отключить ${productDeactivate.productName}?` : undefined}
        onCancel={() => setProductDeactivate(null)}
        onConfirm={() => productDeactivate && deactivateProductMutation.mutate(productDeactivate)}
        confirmLabel="Отключить"
      />

      <ConfirmDialog
        open={Boolean(contextArchiveTarget)}
        title={contextArchiveTarget?.archivedAt ? "Восстановить контекст" : "Архивировать контекст"}
        description={contextArchiveTarget ? `Контекст: ${contextArchiveTarget.title}` : undefined}
        onCancel={() => setContextArchiveTarget(null)}
        onConfirm={() => contextArchiveTarget && archiveContextMutation.mutate(contextArchiveTarget)}
        confirmLabel={contextArchiveTarget?.archivedAt ? "Восстановить" : "Архивировать"}
      />
    </AppShell>
  );
}

export default AdminPage;
