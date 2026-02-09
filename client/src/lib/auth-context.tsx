import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "./types";
import { useToast } from "./components/ui/use-toast";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Загрузка при старте
  const { toast } = useToast();

  // При загрузке страницы проверяем, есть ли сохраненный юзер в localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("growth_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      console.log("Ответ сервера:", res);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Ошибка входа:", errorText);
        throw new Error("Ошибка входа: " + errorText);
      }

      const userData = await res.json();
      console.log("userData:", userData);

      setUser(userData);
      localStorage.setItem("growth_user", JSON.stringify(userData));
      toast({ title: `Добро пожаловать, ${userData.name}!` });
    } catch (error) {
      toast({ title: "Ошибка", description: "Неверный логин или пароль", variant: "destructive" });
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("growth_user");
    window.location.reload(); // Перезагружаем страницу для чистоты
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}