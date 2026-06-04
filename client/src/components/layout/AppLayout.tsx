import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket, useWebSocketProvider, WebSocketContext } from "@/hooks/use-websocket";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, Package, ArrowUpRight, 
  History, MessageSquare, Users, LogOut, Menu, KeyRound, Sun, Moon,
  ClipboardList, FileBarChart, Lock, ShieldAlert, RefreshCw,
  Phone, PhoneOff, Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ChangePasswordModal from "@/components/ChangePasswordModal";

const ALL_NAV_ITEMS = [
  { href: "/", label: "Painel", icon: LayoutDashboard, permission: "pode_ver_dashboard" },
  { href: "/produtos", label: "Produtos", icon: Package, permission: "pode_ver_produtos" },
  { href: "/movimentacoes", label: "Reg. Saída", icon: ArrowUpRight, permission: "pode_registrar_saida" },
  { href: "/historico", label: "Histórico", icon: History, permission: "pode_ver_historico" },
  { href: "/solicitacoes", label: "Solicitações", icon: ClipboardList, permission: "pode_ver_produtos" },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart, permission: "pode_exportar_relatorio" },
  { href: "/chat", label: "Bater Papo", icon: MessageSquare, permission: "pode_ver_chat" },
  { href: "/usuarios", label: "Usuários", icon: Users, permission: "pode_gerenciar_usuarios" },
];

function ForceLogoutScreen({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="w-24 h-24 mx-auto rounded-2xl bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center"
        >
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </motion.div>
        <div className="space-y-3">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-black text-white uppercase tracking-wider"
          >
            Sessão Encerrada
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-gray-400 text-sm leading-relaxed"
          >
            {message}
          </motion.p>
        </div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-12 px-8 text-sm uppercase tracking-wider"
            data-testid="button-reload-after-kick"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar Página
          </Button>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-[10px] text-gray-600 uppercase tracking-wider font-bold"
        >
          Master Cargas Brasil · Almoxarifado
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const wsContext = useWebSocketProvider();

  useEffect(() => {
    if (location === "/chat") {
      wsContext.markChatAsRead();
    } else {
      wsContext.markChatAsLeft();
    }
  }, [location]);

  if (wsContext.forceLogout) {
    return <ForceLogoutScreen message={wsContext.forceLogoutMessage} />;
  }

  if (!user) return <>{children}</>;

  const hasPermission = (perm: string) => (user as any)[perm] === true;

  const handleNavClick = (item: typeof ALL_NAV_ITEMS[0], e: React.MouseEvent) => {
    if (!hasPermission(item.permission)) {
      e.preventDefault();
      toast({
        title: "Acesso Restrito",
        description: "Apenas usuários autorizados pelo DEV podem acessar esta página.",
        variant: "destructive",
      });
    }
  };

  const NavLinks = () => (
    <div className="flex flex-col gap-1 p-4">
      {ALL_NAV_ITEMS.map((item) => {
        const isActive = location === item.href;
        const allowed = hasPermission(item.permission);
        const showBadge = item.href === "/chat" && wsContext.unreadCount > 0 && location !== "/chat";
        return (
          <Link key={item.href} href={allowed ? item.href : "#"} onClick={(e: any) => handleNavClick(item, e)}>
            <div data-testid={`nav-link-${item.href.replace('/', '') || 'dashboard'}`} className={`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer group relative
              ${isActive && allowed
                ? "bg-accent/10 border border-accent/20 text-accent font-bold" 
                : allowed
                  ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  : "text-muted-foreground/40 cursor-not-allowed"
              }
            `}>
              <item.icon className={`w-5 h-5 ${isActive && allowed ? "text-accent" : allowed ? "text-muted-foreground group-hover:text-foreground" : "text-muted-foreground/30"} transition-colors`} />
              <span className="text-xs uppercase tracking-widest flex-1">{item.label}</span>
              {showBadge && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse" data-testid="badge-unread-chat">
                  {wsContext.unreadCount > 99 ? "99+" : wsContext.unreadCount}
                </span>
              )}
              {!allowed && <Lock className="w-3 h-3 text-muted-foreground/30" />}
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <WebSocketContext.Provider value={wsContext}>
    <div className="min-h-screen flex bg-background">

      {/* ✅ NOTIFICAÇÃO GLOBAL DE CHAMADA RECEBIDA (funciona em qualquer página) */}
      <AnimatePresence>
        {wsContext.incomingCall && (
          <motion.div
            initial={{ opacity: 0, y: -120, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -120, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed top-4 right-4 z-[9998] bg-card border border-border rounded-2xl shadow-2xl p-5 w-80"
          >
            {/* Pulso de fundo animado */}
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl bg-green-500/5 pointer-events-none"
            />

            <div className="flex items-center gap-3 mb-4">
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center">
                  {wsContext.incomingCall.type === "video"
                    ? <Video className="w-7 h-7 text-green-500" />
                    : <Phone className="w-7 h-7 text-green-500" />
                  }
                </div>
                {/* Anel pulsante */}
                <motion.div
                  animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-green-500/50"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-foreground text-base truncate">
                  {wsContext.incomingCall.from}
                </p>
                <p className="text-sm text-muted-foreground">
                  {wsContext.incomingCall.type === "video"
                    ? "📹 Chamada de vídeo"
                    : "📞 Chamada de voz"
                  }
                </p>
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider mt-0.5 animate-pulse">
                  Chamando...
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              {/* Atender: navega para /chat e sinaliza para o Chat.tsx atender */}
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold"
                onClick={() => {
                  // Navega para o chat — o Chat.tsx vai detectar incomingCall e atender
                  setLocation("/chat");
                }}
              >
                <Phone className="w-4 h-4 mr-2" />
                Atender
              </Button>

              {/* Recusar: rejeita direto sem entrar no chat */}
              <Button
                variant="destructive"
                className="flex-1 font-bold"
                onClick={() => {
                  wsContext.socket?.send(JSON.stringify({
                    type: "webrtc_reject",
                    data: { target: wsContext.incomingCall!.from }
                  }));
                  wsContext.setIncomingCall(null);
                }}
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                Recusar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card">
        <div className="p-6 pb-8">
          <div className="space-y-1">
            <h1 className="font-display text-xl font-black text-foreground leading-none tracking-wide uppercase">
              <span className="text-accent">Master</span> Cargas
            </h1>
            <p className="text-[10px] text-accent font-bold tracking-[0.25em] uppercase">Brasil</p>
            <p className="text-[8px] text-muted-foreground font-bold tracking-[0.15em] uppercase mt-1.5 pt-1.5 border-t border-border/50">
              Transporte · Logística · Serviços
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-border bg-card sticky top-0 z-50">
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-card border-r-border p-0 flex flex-col">
                <div className="p-6 pb-8">
                  <div className="space-y-1">
                    <h1 className="font-display text-xl font-black text-foreground leading-none tracking-wide uppercase">
                      <span className="text-accent">Master</span> Cargas
                    </h1>
                    <p className="text-[10px] text-accent font-bold tracking-[0.25em] uppercase">Brasil</p>
                    <p className="text-[8px] text-muted-foreground font-bold tracking-[0.15em] uppercase mt-1.5 pt-1.5 border-t border-border/50">
                      Transporte · Logística · Serviços
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <h1 className="md:hidden font-display text-sm font-black text-foreground leading-none tracking-wide uppercase">
            <span className="text-accent">Master</span> Cargas
            <span className="block text-[8px] text-accent mt-0.5 font-bold tracking-[0.2em] uppercase">Brasil</span>
          </h1>

          <div className="hidden md:block" />

          <div className="flex items-center gap-2">
            <Button
              data-testid="button-en"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 rounded-lg border-accent/30 bg-accent/5 text-accent hover:bg-accent/15 hover:text-accent font-bold text-[10px] tracking-wider transition-all duration-300"
              onClick={() => toast({ 
                description: "Esta funcionalidade está em desenvolvimento e será liberada em breve. Aguarde atualização do DEV.",
              })}
            >
              EN
            </Button>

            <Button
              data-testid="button-toggle-theme"
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={() => setShowChangePassword(true)}
              data-testid="button-change-password"
            >
              <KeyRound className="w-4 h-4" />
            </Button>

            <div className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l border-border">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center font-black text-accent text-xs border border-accent/20">
                {user.username.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-foreground uppercase tracking-wider truncate">{user.username}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{(user as any).cargo || 'Admin'}</p>
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout} 
              className="w-9 h-9 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10" 
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>

      <ChangePasswordModal 
        open={showChangePassword} 
        onOpenChange={setShowChangePassword}
        forced={false}
      />
    </div>
    </WebSocketContext.Provider>
  );
}
