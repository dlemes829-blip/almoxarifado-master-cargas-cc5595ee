import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Movements from "./pages/Movements";
import History from "./pages/History";
import Users from "./pages/Users";
import Chat from "./pages/Chat";
import Solicitacoes from "./pages/Solicitacoes";
import Relatorios from "./pages/Relatorios";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeContext, useThemeProvider } from "./hooks/use-theme";
import { WebSocketProvider } from "./hooks/use-websocket";
import { GlobalCallNotification } from "./components/GlobalCallNotification";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/produtos">
        <ProtectedRoute>
          <AppLayout>
            <Products />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/movimentacoes">
        <ProtectedRoute>
          <AppLayout>
            <Movements />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/historico">
        <ProtectedRoute>
          <AppLayout>
            <History />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/solicitacoes">
        <ProtectedRoute>
          <AppLayout>
            <Solicitacoes />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/relatorios">
        <ProtectedRoute>
          <AppLayout>
            <Relatorios />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/chat">
        <ProtectedRoute>
          <AppLayout>
            <Chat />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/usuarios">
        <ProtectedRoute>
          <AppLayout>
            <Users />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route>
        <AppLayout>
          <NotFound />
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  const themeCtx = useThemeProvider();

  return (
    <ThemeContext.Provider value={themeCtx}>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <TooltipProvider>
            <Toaster />
            {/* Notificação de chamada global — aparece em qualquer página */}
            <GlobalCallNotification />
            <Router />
          </TooltipProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}

export default App;