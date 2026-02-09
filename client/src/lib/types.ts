// --- КОНСТАНТЫ БИЗНЕСА (Твои настройки) ---

export const CATEGORY_COLORS: Record<string, string> = {
  "oral care": "#c0b0f0", // Нежный фиолетовый
  "hair": "#406090",      // Глубокий синий
  "body": "#404030",      // Темно-оливковый
  "make-up": "#f0f0e0",   // Светло-бежевый
  "face": "#70c0d0",      // Бирюзовый
};

export const CATEGORIES = ["oral care", "hair", "body", "make-up", "face"];
export const PLATFORMS = ["WB", "Ozon"];
export const TEST_TYPES = ["CTR", "CR", "Rich"];

// Типы для AI генерации (на будущее)
export interface VariantItem {
  title: string;
  visual: string;
  text: string;
  badge?: string;
}

export interface AiResponse {
  analysis: string;
  items: VariantItem[];
}

// --- СИСТЕМНЫЕ ТИПЫ (Пользователи и Роли) ---

export type UserRole = "admin" | "manager" | "designer" | "content" | "content_manager" | "user" | "member";

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  email?: string | null;
  isAdmin?: boolean;
  isActive?: boolean;
}

// --- ТИП КАРТОЧКИ ТЕСТА ---

export interface TestItem {
  id: number;
  productName: string;
  sku: string;
  status: string; // idea, running, ready, done
  testType: string;
  tier: string;
  category: string;
  platform: string;
  description?: string;
  authorId?: number; // ID создателя
}