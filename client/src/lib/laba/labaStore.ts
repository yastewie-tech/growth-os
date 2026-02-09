export const LABA_STORAGE_KEY = "growth_os_laba_ids";

export interface LabaStore {
  ids: number[];
  add: (id: number) => void;
  remove: (id: number) => void;
  getAll: () => number[];
  has: (id: number) => boolean;
}

export const labaStore: LabaStore = {
  ids: JSON.parse(localStorage.getItem(LABA_STORAGE_KEY) || "[]"),

  add: (id: number) => {
    const current = labaStore.getAll();
    if (!current.includes(id)) {
      const next = [...current, id];
      localStorage.setItem(LABA_STORAGE_KEY, JSON.stringify(next));
      labaStore.ids = next;
    }
  },

  remove: (id: number) => {
    const current = labaStore.getAll();
    const next = current.filter((x) => x !== id);
    localStorage.setItem(LABA_STORAGE_KEY, JSON.stringify(next));
    labaStore.ids = next;
  },

  getAll: () => {
    return JSON.parse(localStorage.getItem(LABA_STORAGE_KEY) || "[]").map(Number);
  },

  has: (id: number) => {
    return labaStore.getAll().includes(id);
  }
};
