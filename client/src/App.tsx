import { Switch, Route } from "wouter";
import { Toaster } from "./lib/components/ui/toaster";
import { ABTestsPageV2 } from "./pages/ABTestsPageV2";
import LoginPage from "./pages/LoginPage";
import { LabaPage } from "./pages/LabaPage";
import { KanbanPage } from "./pages/KanbanPage";
import { CTREditPage } from "./pages/CTREditPage";
import { AdminPage } from "./pages/AdminPage";
import { MetricsPage } from "./pages/MetricsPage";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { Loader2 } from "lucide-react";
import { apiRequest } from "./lib/queryClient";

// --- 1. Импортируем React Query ---
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- 2. Создаем клиент для работы с данными ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [url] = queryKey as [string];
        const response = await apiRequest("GET", url);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      },
    },
  },
});

function MainApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={ABTestsPageV2} />
      <Route path="/tests" component={ABTestsPageV2} />
      <Route path="/laba" component={LabaPage} />
      <Route path="/kanban" component={KanbanPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/metrics" component={MetricsPage} />
      <Route path="/tests/:id/edit" component={CTREditPage} />
      <Route>404 Not Found</Route>
    </Switch>
  );
}

function App() {
  return (
    // --- 3. Оборачиваем всё приложение в провайдер данных ---
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MainApp />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;