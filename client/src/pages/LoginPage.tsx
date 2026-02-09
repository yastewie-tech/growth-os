import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../lib/components/ui/card";
import { Input } from "../lib/components/ui/input";
import { Button } from "../lib/components/ui/button";
import { Label } from "../lib/components/ui/label";
import { Loader2, Lock } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(formData.username, formData.password);
      // Если успех — App.tsx сам переключит экран
    } catch (e) {
      setError("Неверное имя пользователя или пароль");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-design-background relative overflow-hidden">
      {/* Декоративный фон */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900 to-[#F5F8F7] -z-10" />
      
      <Card className="w-[380px] shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-blue-700" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Growth OS</CardTitle>
          <CardDescription>
            Войдите, чтобы управлять гипотезами
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Пользователь</Label>
              <Input 
                id="username" 
                placeholder="admin"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required 
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100 text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-900 hover:bg-blue-800" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Войти"}
            </Button>
          </form>

          <div className="mt-4 text-center text-xs text-slate-400">
            <p>Доступ только для сотрудников</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;