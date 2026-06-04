import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const ROUTE_PERMISSIONS: Record<string, string> = {
  "/": "pode_ver_dashboard",
  "/produtos": "pode_ver_produtos",
  "/movimentacoes": "pode_registrar_saida",
  "/historico": "pode_ver_historico",
  "/solicitacoes": "pode_ver_produtos",
  "/relatorios": "pode_exportar_relatorio",
  "/chat": "pode_ver_chat",
  "/usuarios": "pode_gerenciar_usuarios",
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  const requiredPermission = ROUTE_PERMISSIONS[location];
  if (requiredPermission && !(user as any)[requiredPermission]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Apenas usuários autorizados pelo DEV podem acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
