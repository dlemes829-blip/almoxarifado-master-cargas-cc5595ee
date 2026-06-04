import { useState, useMemo, useCallback } from "react";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/hooks/use-users";
import { useResponsaveis, useCreateResponsavel, useDeleteResponsavel } from "@/hooks/use-responsaveis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Trash2, Users as UsersIcon, UserCog, Package, RefreshCw, Settings2, 
  KeyRound, ShieldAlert, Zap, Loader2, Search, Filter, MoreVertical, 
  CheckCircle2, XCircle, Crown, User, Building2, ChevronRight, LayoutGrid, List
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ==========================================
// UTILITÁRIOS
// ==========================================

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
// TIPOS
// ==========================================

type PageTab = "usuarios" | "responsaveis" | "produtos";
type ViewMode = "grid" | "list";
type FilterStatus = "all" | "active" | "inactive";

interface UserFormData {
  username: string;
  password: string;
  cargo: string;
}

interface EditFormData {
  username: string;
  password: string;
  cargo: string;
  active: boolean;
  must_change_password: boolean;
  theme_preference: string;
  pode_ver_dashboard: boolean;
  pode_ver_produtos: boolean;
  pode_registrar_entrada: boolean;
  pode_registrar_saida: boolean;
  pode_ver_historico: boolean;
  pode_ver_chat: boolean;
  pode_exportar_relatorio: boolean;
  pode_gerenciar_usuarios: boolean;
}

// ==========================================
// COMPONENTE: CARD DE USUÁRIO (MOBILE)
// ==========================================

interface UserCardProps {
  user: any;
  currentUser: any;
  onEdit: (user: any) => void;
  onDelete: (userId: number, username: string) => void;
  onToggle: (userId: number, field: string, value: boolean) => void;
}

function UserCard({ user, currentUser, onEdit, onDelete, onToggle }: UserCardProps) {
  const isDev = user.username === "DEV";
  const isCurrentUser = user.username === currentUser?.username;
  
  const cargoColors: Record<string, string> = {
    "Dev": "bg-purple-500/10 text-purple-500 border-purple-500/20",
    "Admin": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Usuário Comum": "bg-muted text-muted-foreground border-border",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-border rounded-2xl p-4 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold",
            isDev ? "bg-purple-500/20 text-purple-500" : "bg-accent/20 text-accent"
          )}>
            {user.username.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              {user.username}
              {isDev && <Crown className="w-4 h-4 text-purple-500" />}
              {isCurrentUser && <Badge variant="secondary" className="text-[10px]">Você</Badge>}
            </h3>
            <Badge variant="outline" className={cn("text-[10px] mt-1", cargoColors[user.cargo || "Usuário Comum"])}>
              {user.cargo || "Admin"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => onEdit(user)}>
            <Settings2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          {!isDev && (
            <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive/60 hover:text-destructive" onClick={() => onDelete(user.id, user.username)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Status</p>
          <div className="flex items-center gap-2 mt-1">
            <Switch 
              checked={user.active ?? false} 
              onCheckedChange={v => onToggle(user.id, "active", v)}
              disabled={isDev}
            />
            <span className={user.active ? "text-green-500 font-medium" : "text-muted-foreground"}>
              {user.active ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Saída</p>
          <div className="flex items-center gap-2 mt-1">
            {isDev ? (
              <span className="text-xs font-bold text-purple-500">SEMPRE</span>
            ) : (
              <>
                <Switch 
                  checked={user.pode_registrar_saida ?? false} 
                  onCheckedChange={v => onToggle(user.id, "pode_registrar_saida", v)}
                />
                <span className={user.pode_registrar_saida ? "text-green-500" : "text-muted-foreground"}>
                  {user.pode_registrar_saida ? "Sim" : "Não"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTE: CARD DE RESPONSÁVEL
// ==========================================

function ResponsavelCard({ responsavel, onDelete }: { responsavel: any; onDelete: (id: number) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h4 className="font-bold text-foreground uppercase">{responsavel.nome}</h4>
          <Badge variant="secondary" className="text-[10px] mt-1">
            {responsavel.setor}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={responsavel.ativo ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}>
          {responsavel.ativo ? "ATIVO" : "INATIVO"}
        </Badge>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-8 h-8 text-destructive/60 hover:text-destructive"
          onClick={() => onDelete(responsavel.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTE: ESTATÍSTICAS RÁPIDAS
// ==========================================

function QuickStats({ users, responsaveis }: { users: any[]; responsaveis: any[] }) {
  const stats = useMemo(() => [
    { label: "Total Usuários", value: users.length, icon: UsersIcon, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Ativos", value: users.filter(u => u.active).length, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Inativos", value: users.filter(u => !u.active).length, icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Responsáveis", value: responsaveis.length, icon: Building2, color: "text-purple-500", bg: "bg-purple-500/10" },
  ], [users, responsaveis]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
        >
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
            <stat.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL: USERS v2.0
// ==========================================

export default function Users() {
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const { data: users = [] } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { data: responsaveis = [] } = useResponsaveis();
  const createResponsavel = useCreateResponsavel();
  const deleteResponsavel = useDeleteResponsavel();
  const { toast } = useToast();

  // Estados
  const [activeTab, setActiveTab] = useState<PageTab>("usuarios");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  
  const [userForm, setUserForm] = useState<UserFormData>({ 
    username: "", 
    password: "", 
    cargo: "Usuário Comum" 
  });
  
  const [respForm, setRespForm] = useState({ nome: "", setor: "LIMPEZA" });
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [kickingAll, setKickingAll] = useState(false);

  const [editForm, setEditForm] = useState<EditFormData>({
    username: "", password: "", cargo: "Usuário Comum", active: true,
    must_change_password: false, theme_preference: "dark",
    pode_ver_dashboard: false, pode_ver_produtos: false,
    pode_registrar_entrada: false, pode_registrar_saida: false,
    pode_ver_historico: false, pode_ver_chat: false,
    pode_exportar_relatorio: false, pode_gerenciar_usuarios: false,
  });

  // Filtros memoizados
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.cargo || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === "all" ? true :
                          filterStatus === "active" ? u.active :
                          !u.active;
      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, filterStatus]);

  // Handlers otimizados
  const handleCreateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!userForm.username || !userForm.password) {
        throw new Error("Preencha todos os campos");
      }
      
      await createUser.mutateAsync({
        username: userForm.username.toUpperCase(),
        password: userForm.password,
        cargo: userForm.cargo,
        active: true,
        must_change_password: true,
        pode_ver_dashboard: true,
        pode_ver_produtos: true,
        pode_registrar_entrada: true,
        pode_registrar_saida: true,
        pode_ver_historico: false,
        pode_ver_chat: true,
        pode_exportar_relatorio: false,
        pode_gerenciar_usuarios: false,
      });
      
      toast({ title: "✅ Sucesso", description: "Usuário cadastrado com sucesso" });
      setUserForm({ username: "", password: "", cargo: "Usuário Comum" });
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    }
  }, [userForm, createUser, toast]);

  const openEditDialog = useCallback((u: any) => {
    setEditingUser(u);
    setEditForm({
      username: u.username,
      password: "",
      cargo: u.cargo || "Usuário Comum",
      active: u.active ?? true,
      must_change_password: u.must_change_password ?? false,
      theme_preference: u.theme_preference || "dark",
      pode_ver_dashboard: u.pode_ver_dashboard ?? false,
      pode_ver_produtos: u.pode_ver_produtos ?? false,
      pode_registrar_entrada: u.pode_registrar_entrada ?? false,
      pode_registrar_saida: u.pode_registrar_saida ?? false,
      pode_ver_historico: u.pode_ver_historico ?? false,
      pode_ver_chat: u.pode_ver_chat ?? false,
      pode_exportar_relatorio: u.pode_exportar_relatorio ?? false,
      pode_gerenciar_usuarios: u.pode_gerenciar_usuarios ?? false,
    });
    setEditDialogOpen(true);
  }, []);

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = { ...editForm };
      if (!data.password) delete data.password;
      
      await updateUser.mutateAsync({ id: editingUser.id, ...data });
      toast({ title: "✅ Sucesso", description: "Usuário atualizado" });
      setEditDialogOpen(false);
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    }
  }, [editForm, editingUser, updateUser, toast]);

  const handleCreateResponsavel = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!respForm.nome) throw new Error("Preencha o nome");
      
      await createResponsavel.mutateAsync({ 
        nome: respForm.nome.toUpperCase(), 
        setor: respForm.setor 
      });
      
      toast({ title: "✅ Sucesso", description: "Responsável cadastrado" });
      setRespForm({ nome: "", setor: "LIMPEZA" });
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    }
  }, [respForm, createResponsavel, toast]);

  const handleToggleUser = useCallback(async (userId: number, field: string, value: boolean) => {
    try {
      await updateUser.mutateAsync({ id: userId, [field]: value });
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    }
  }, [updateUser, toast]);

  const handleDeleteUser = useCallback(async (userId: number, username: string) => {
    if (username === "DEV") {
      toast({ title: "⚠️ Aviso", description: "Não é possível excluir o usuário DEV", variant: "destructive" });
      return;
    }
    
    if (!confirm(`Tem certeza que deseja excluir o usuário ${username}?`)) return;
    
    try {
      await deleteUser.mutateAsync(userId);
      toast({ title: "✅ Sucesso", description: "Usuário excluído" });
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    }
  }, [deleteUser, toast]);

  const handleKickAll = useCallback(async () => {
    if (!confirm("Isso desconectará TODOS os usuários online. Continuar?")) return;
    
    setKickingAll(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/kick-all", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          message: "Sua sessão foi encerrada pelo DEV. Faça login novamente." 
        }),
      });
      
      if (!res.ok) throw new Error("Erro ao derrubar usuários");
      toast({ title: "✅ Sucesso", description: "Todos os usuários foram desconectados" });
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally {
      setKickingAll(false);
    }
  }, [toast]);

  const canKick = currentUser && ((currentUser as any).pode_gerenciar_usuarios || currentUser.username === "DEV");

  const pageTabs = [
    { id: "usuarios" as PageTab, label: "Usuários", icon: UsersIcon, count: users.length },
    { id: "responsaveis" as PageTab, label: "Responsáveis", icon: UserCog, count: responsaveis.length },
    { id: "produtos" as PageTab, label: "Produtos", icon: Package, count: null },
  ];

  const setores = ["LIMPEZA", "ADMINISTRATIVO", "RH", "DAF", "MANUT.", "OPERACIONAL"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header Moderno */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
              Gerenciamento
            </h1>
            <p className="text-muted-foreground mt-1">
              Administre usuários, responsáveis e configurações do sistema
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {canKick && (
              <Button
                variant="outline"
                className="border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/15 rounded-xl font-bold text-xs uppercase tracking-wider"
                onClick={handleKickAll}
                disabled={kickingAll}
              >
                {kickingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                <span className="hidden sm:inline">Derrubar Todos</span>
                <span className="sm:hidden">Kick All</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              className="border-destructive/50 text-destructive hover:bg-destructive/10 rounded-xl"
              onClick={() => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" })}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Resetar Sistema</span>
            </Button>
          </div>
        </motion.div>

        {/* Estatísticas */}
        <QuickStats users={users} responsaveis={responsaveis} />

        {/* Tabs Modernas */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-1.5"
        >
          <div className="flex gap-1">
            {pageTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== null && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {tab.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* CONTEÚDO: USUÁRIOS */}
        {activeTab === "usuarios" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          >
            {/* Formulário de Criação */}
            <div className="xl:col-span-1">
              <div className="bg-card border border-border rounded-2xl p-6 sticky top-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Novo Usuário</h2>
                    <p className="text-xs text-muted-foreground">Crie uma nova conta de acesso</p>
                  </div>
                </div>
                
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Nome de Usuário
                    </Label>
                    <Input 
                      value={userForm.username} 
                      onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                      placeholder="ex: JOAO.SILVA"
                      className="bg-muted/30 border-0 rounded-xl h-12 uppercase"
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Senha Inicial
                    </Label>
                    <Input 
                      type="password" 
                      value={userForm.password} 
                      onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="bg-muted/30 border-0 rounded-xl h-12"
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Cargo / Perfil
                    </Label>
                    <Select 
                      value={userForm.cargo} 
                      onValueChange={v => setUserForm({ ...userForm, cargo: v })}
                    >
                      <SelectTrigger className="bg-muted/30 border-0 rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Usuário Comum">👤 Usuário Comum</SelectItem>
                        <SelectItem value="Admin">🛡️ Administrador</SelectItem>
                        <SelectItem value="Dev">👑 Desenvolvedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={createUser.isPending} 
                    className="w-full bg-accent text-accent-foreground font-bold rounded-xl h-12 mt-2"
                  >
                    {createUser.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Criar Usuário</>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Lista de Usuários */}
            <div className="xl:col-span-2 space-y-4">
              {/* Barra de Ferramentas */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-11 bg-card border-border rounded-xl h-12"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filterStatus} onValueChange={(v: FilterStatus) => setFilterStatus(v)}>
                    <SelectTrigger className="w-[140px] bg-card border-border rounded-xl h-12">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="bg-card border border-border rounded-xl p-1 flex">
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      )}
                    >
                      <List className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      )}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista/Grid de Usuários */}
              <AnimatePresence mode="popLayout">
                {viewMode === "grid" ? (
                  <motion.div 
                    layout
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    {filteredUsers.map(user => (
                      <UserCard
                        key={user.id}
                        user={user}
                        currentUser={currentUser}
                        onEdit={openEditDialog}
                        onDelete={handleDeleteUser}
                        onToggle={handleToggleUser}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div layout className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold">Usuário</th>
                            <th className="px-4 py-3 text-left font-bold hidden sm:table-cell">Cargo</th>
                            <th className="px-4 py-3 text-center font-bold">Status</th>
                            <th className="px-4 py-3 text-center font-bold hidden md:table-cell">Saída</th>
                            <th className="px-4 py-3 text-center font-bold">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence>
                            {filteredUsers.map((u, idx) => {
                              const isDev = u.username === "DEV";
                              return (
                                <motion.tr 
                                  key={u.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 20 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                                        isDev ? "bg-purple-500/20 text-purple-500" : "bg-accent/20 text-accent"
                                      )}>
                                        {u.username.charAt(0)}
                                      </div>
                                      <div>
                                        <p className="font-bold text-foreground uppercase">{u.username}</p>
                                        {isDev && <Badge className="text-[10px] bg-purple-500/10 text-purple-500">DEV</Badge>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                    {u.cargo || "Admin"}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Switch 
                                      checked={u.active ?? false} 
                                      onCheckedChange={v => handleToggleUser(u.id, "active", v)}
                                      disabled={isDev}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center hidden md:table-cell">
                                    {isDev ? (
                                      <span className="text-xs font-bold text-purple-500">SEMPRE</span>
                                    ) : (
                                      <Switch 
                                        checked={u.pode_registrar_saida ?? false} 
                                        onCheckedChange={v => handleToggleUser(u.id, "pode_registrar_saida", v)}
                                      />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="w-8 h-8" 
                                        onClick={() => openEditDialog(u)}
                                      >
                                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                                      </Button>
                                      {!isDev && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="w-8 h-8 text-destructive/60 hover:text-destructive"
                                          onClick={() => handleDeleteUser(u.id, u.username)}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                    {filteredUsers.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Nenhum usuário encontrado</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* CONTEÚDO: RESPONSÁVEIS */}
        {activeTab === "responsaveis" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          >
            {/* Formulário */}
            <div className="xl:col-span-1">
              <div className="bg-card border border-border rounded-2xl p-6 sticky top-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Novo Responsável</h2>
                    <p className="text-xs text-muted-foreground">Cadastre um novo responsável/setor</p>
                  </div>
                </div>
                
                <form onSubmit={handleCreateResponsavel} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Nome Completo
                    </Label>
                    <Input 
                      value={respForm.nome} 
                      onChange={e => setRespForm({ ...respForm, nome: e.target.value })}
                      placeholder="ex: CARLOS MENDES"
                      className="bg-muted/30 border-0 rounded-xl h-12 uppercase"
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Setor
                    </Label>
                    <Select 
                      value={respForm.setor} 
                      onValueChange={v => setRespForm({ ...respForm, setor: v })}
                    >
                      <SelectTrigger className="bg-muted/30 border-0 rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {setores.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={createResponsavel.isPending} 
                    className="w-full bg-accent text-accent-foreground font-bold rounded-xl h-12 mt-2"
                  >
                    {createResponsavel.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Cadastrar Responsável</>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Lista */}
            <div className="xl:col-span-2">
              <motion.div 
                layout
                className="grid grid-cols-1 gap-3"
              >
                <AnimatePresence>
                  {responsaveis.map((r, idx) => (
                    <ResponsavelCard
                      key={r.id}
                      responsavel={r}
                      onDelete={async (id) => {
                        await deleteResponsavel.mutateAsync(id);
                        toast({ title: "Sucesso", description: "Responsável excluído" });
                      }}
                    />
                  ))}
                </AnimatePresence>
                {responsaveis.length === 0 && (
                  <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum responsável cadastrado</p>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* CONTEÚDO: PRODUTOS */}
        {activeTab === "produtos" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-12 text-center"
          >
            <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-accent" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Gerenciamento de Produtos</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Acesse a área completa de produtos para gerenciar estoque, cadastros e movimentações.
            </p>
            <Button 
              size="lg"
              className="rounded-xl px-8"
              onClick={() => navigate("/produtos")}
            >
              Ir para Produtos
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* DIALOG DE EDIÇÃO */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl bg-card border border-border rounded-2xl p-0 overflow-hidden max-h-[90vh]">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-xl font-bold flex items-center gap-3 text-foreground">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <UserCog className="w-5 h-5 text-accent" />
                </div>
                <div>
                  Editar Usuário
                  <p className="text-sm font-normal text-muted-foreground">{editingUser?.username}</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <Tabs defaultValue="base" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-xl border border-border w-full mb-6">
                  <TabsTrigger value="base" className="flex-1 rounded-lg data-[state=active]:bg-accent data-[state=active]:text-accent-foreground font-bold text-xs uppercase">
                    Informações
                  </TabsTrigger>
                  <TabsTrigger value="perms" className="flex-1 rounded-lg data-[state=active]:bg-accent data-[state=active]:text-accent-foreground font-bold text-xs uppercase">
                    Permissões
                  </TabsTrigger>
                  <TabsTrigger value="config" className="flex-1 rounded-lg data-[state=active]:bg-accent data-[state=active]:text-accent-foreground font-bold text-xs uppercase">
                    Configurações
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="base" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Username
                      </Label>
                      <Input 
                        value={editForm.username} 
                        onChange={e => setEditForm({...editForm, username: e.target.value})}
                        className="bg-muted/30 border-0 rounded-xl h-12"
                        disabled={editingUser?.username === 'DEV'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Nova Senha (opcional)
                      </Label>
                      <Input 
                        type="password" 
                        value={editForm.password} 
                        onChange={e => setEditForm({...editForm, password: e.target.value})}
                        placeholder="Deixe em branco para manter"
                        className="bg-muted/30 border-0 rounded-xl h-12"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Cargo
                    </Label>
                    <Select 
                      value={editForm.cargo} 
                      onValueChange={v => setEditForm({...editForm, cargo: v})}
                    >
                      <SelectTrigger className="bg-muted/30 border-0 rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Usuário Comum">👤 Usuário Comum</SelectItem>
                        <SelectItem value="Admin">🛡️ Administrador</SelectItem>
                        <SelectItem value="Dev">👑 Desenvolvedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="perms" className="space-y-3">
                  <div className="bg-muted/30 border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries({
                      pode_ver_dashboard: "📊 Acesso Dashboard",
                      pode_ver_produtos: "📦 Acesso Produtos",
                      pode_registrar_entrada: "⬇️ Lançar Entradas",
                      pode_registrar_saida: "⬆️ Lançar Saídas",
                      pode_ver_historico: "📜 Ver Histórico",
                      pode_ver_chat: "💬 Acesso Chat",
                      pode_exportar_relatorio: "📈 Gerar Relatórios",
                      pode_gerenciar_usuarios: "⚙️ Gerenciar Usuários",
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between bg-background/60 p-3 rounded-xl border border-border">
                        <Label htmlFor={`edit-${key}`} className="text-sm font-medium cursor-pointer">{label}</Label>
                        <Switch 
                          id={`edit-${key}`} 
                          checked={(editForm as any)[key]} 
                          onCheckedChange={v => setEditForm({...editForm, [key]: v})} 
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="config" className="space-y-4">
                  <div className="flex items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                        <KeyRound className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Forçar Troca de Senha</p>
                        <p className="text-xs text-muted-foreground">Usuário deve alterar senha no próximo login</p>
                      </div>
                    </div>
                    <Switch 
                      checked={editForm.must_change_password} 
                      onCheckedChange={v => setEditForm({...editForm, must_change_password: v})} 
                    />
                  </div>
                  
                  <div className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border",
                    editForm.active 
                      ? "bg-green-500/5 border-green-500/20" 
                      : "bg-destructive/5 border-destructive/20"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        editForm.active ? "bg-green-500/10" : "bg-destructive/10"
                      )}>
                        <ShieldAlert className={cn("w-5 h-5", editForm.active ? "text-green-500" : "text-destructive")} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Conta Ativa</p>
                        <p className={cn("text-xs", editForm.active ? "text-green-500" : "text-destructive")}>
                          {editForm.active ? "Usuário pode acessar o sistema" : "Acesso ao sistema bloqueado"}
                        </p>
                      </div>
                    </div>
                    <Switch 
                      checked={editForm.active} 
                      onCheckedChange={v => setEditForm({...editForm, active: v})} 
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end pt-4 border-t border-border gap-3">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateUser.isPending} 
                  className="bg-accent text-accent-foreground font-bold px-8 rounded-xl"
                >
                  {updateUser.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}