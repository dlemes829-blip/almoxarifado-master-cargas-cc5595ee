import { useState, useMemo } from "react";
import { useHistory } from "@/hooks/use-history";
import { useMovements } from "@/hooks/use-movements";
import { useProducts } from "@/hooks/use-products";
import { useUsers } from "@/hooks/use-users";
import { useResponsaveis } from "@/hooks/use-responsaveis";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Clock, Filter, TrendingUp, TrendingDown, Activity, Users } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewMode = "status_usuarios" | "fluxo";

export default function History() {
  const { data: movements = [] } = useMovements();
  const { data: historyLogs = [] } = useHistory();
  const { data: products = [] } = useProducts();
  const { data: users = [] } = useUsers();
  const { data: responsaveis = [] } = useResponsaveis();

  const [viewMode, setViewMode] = useState<ViewMode>("status_usuarios");
  const [searchCode, setSearchCode] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterResp, setFilterResp] = useState("all");
  const [filterModule, setFilterModule] = useState("all");

  const getProductName = (id: number) => products.find(p => p.id === id)?.nome || `#${id}`;
  const getUserName = (id: number) => users.find(u => u.id === id)?.username || `#${id}`;

  const totalEntries = movements.filter(m => m.tipo === "entrada");
  const totalExits = movements.filter(m => m.tipo === "saida");
  const totalEntriesItems = totalEntries.reduce((a, m) => a + m.quantidade, 0);
  const totalExitsItems = totalExits.reduce((a, m) => a + m.quantidade, 0);

  const userMovementStats = useMemo(() => {
    const stats: Record<number, { username: string; entries: number; exits: number; entriesItems: number; exitsItems: number; lastAction: Date | null }> = {};
    movements.forEach(m => {
      if (!stats[m.usuario_id]) {
        stats[m.usuario_id] = { username: getUserName(m.usuario_id), entries: 0, exits: 0, entriesItems: 0, exitsItems: 0, lastAction: null };
      }
      if (m.tipo === "entrada") {
        stats[m.usuario_id].entries++;
        stats[m.usuario_id].entriesItems += m.quantidade;
      } else {
        stats[m.usuario_id].exits++;
        stats[m.usuario_id].exitsItems += m.quantidade;
      }
      const date = m.data_hora ? new Date(m.data_hora) : null;
      if (date && (!stats[m.usuario_id].lastAction || date > stats[m.usuario_id].lastAction!)) {
        stats[m.usuario_id].lastAction = date;
      }
    });
    return Object.values(stats).sort((a, b) => (b.entries + b.exits) - (a.entries + a.exits));
  }, [movements, users]);

  const filtered = useMemo(() => {
    return movements.filter(m => {
      if (searchCode) {
        const product = products.find(p => p.id === m.produto_id);
        if (!product) return false;
        const match = product.nome.toLowerCase().includes(searchCode.toLowerCase()) ||
          (product.codigo_barras && product.codigo_barras.toLowerCase().includes(searchCode.toLowerCase()));
        if (!match) return false;
      }
      if (filterType !== "all" && m.tipo !== filterType) return false;
      if (filterResp !== "all" && m.responsavel_id !== Number(filterResp)) return false;
      return true;
    });
  }, [movements, products, searchCode, filterType, filterResp]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof filtered }[] = [];
    const groupMap = new Map<string, typeof filtered>();
    
    filtered.forEach(m => {
      const date = m.data_hora ? new Date(m.data_hora) : new Date();
      let label: string;
      if (isToday(date)) label = "HOJE";
      else if (isYesterday(date)) label = "ONTEM";
      else label = format(date, "dd/MM/yyyy");
      
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(m);
    });

    groupMap.forEach((items, label) => {
      groups.push({ label, items });
    });
    return groups;
  }, [filtered]);

  const stats = [
    { label: "ENTRADAS", value: totalEntries.length, icon: ArrowUpRight, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
    { label: "SAÍDAS", value: totalExits.length, icon: ArrowDownRight, color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "ITENS ENTRADA", value: `+${totalEntriesItems}`, icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
    { label: "ITENS SAÍDA", value: `-${totalExitsItems}`, icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight italic" data-testid="text-history-title">
            Histórico de Fluxo
          </h1>
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            {movements.length} REGISTROS NO TOTAL
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={viewMode === "status_usuarios" ? "default" : "outline"}
          className={`rounded-full px-5 font-bold text-xs ${viewMode === "status_usuarios" ? "bg-accent text-accent-foreground" : "border-border"}`}
          onClick={() => setViewMode("status_usuarios")}
          data-testid="tab-status-usuarios"
        >
          <Users className="w-4 h-4 mr-2" /> Status de Movimento por Usuários
        </Button>
        <Button
          variant={viewMode === "fluxo" ? "default" : "outline"}
          className={`rounded-full px-5 font-bold text-xs ${viewMode === "fluxo" ? "bg-accent text-accent-foreground" : "border-border"}`}
          onClick={() => setViewMode("fluxo")}
          data-testid="tab-fluxo"
        >
          <Activity className="w-4 h-4 mr-2" /> Fluxo de Estoque
        </Button>
      </div>

      {viewMode === "status_usuarios" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((s, i) => (
              <div key={i} className={`${s.bg} border rounded-xl p-4 flex items-center gap-3`} data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, '-')}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-bold tracking-wider mb-3">
              <Filter className="w-4 h-4" /> FILTRAR POR MÓDULO
            </div>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="bg-muted/30 border-border rounded-xl w-full md:w-1/3" data-testid="select-filter-audit-module">
                <SelectValue placeholder="Todos os Módulos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Módulos</SelectItem>
                {Array.from(new Set(historyLogs.map(l => l.modulo))).filter(Boolean).map(mod => (
                  <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="glass-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-medium">#</th>
                    <th className="px-6 py-4 font-medium">Usuário</th>
                    <th className="px-6 py-4 font-medium text-center">Entradas</th>
                    <th className="px-6 py-4 font-medium text-center">Itens Entrada</th>
                    <th className="px-6 py-4 font-medium text-center">Saídas</th>
                    <th className="px-6 py-4 font-medium text-center">Itens Saída</th>
                    <th className="px-6 py-4 font-medium text-center">Total Mov.</th>
                    <th className="px-6 py-4 font-medium">Última Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {userMovementStats.map((u, i) => (
                    <tr key={i} data-testid={`row-user-status-${i}`} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center font-black text-accent text-xs border border-accent/20">
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-bold text-foreground uppercase">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-green-500/10 text-green-500 font-bold text-xs px-2.5 py-1 rounded-full">{u.entries}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-green-500 font-bold">+{u.entriesItems}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-orange-500/10 text-orange-500 font-bold text-xs px-2.5 py-1 rounded-full">{u.exits}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-orange-500 font-bold">-{u.exitsItems}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-accent/10 text-accent font-bold text-xs px-2.5 py-1 rounded-full">{u.entries + u.exits}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {u.lastAction ? format(u.lastAction, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </td>
                    </tr>
                  ))}
                  {userMovementStats.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        Nenhum registro de movimentação encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {historyLogs.length > 0 && (
            <div className="glass-card rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" /> LOG DE AUDITORIA DO SISTEMA
                  <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold">{historyLogs.length}</span>
                </h3>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from(new Set(historyLogs.map(l => l.modulo))).filter(Boolean).map(mod => (
                    <span key={mod} className="px-2 py-0.5 rounded bg-accent/10 text-[9px] text-accent font-bold border border-accent/20">
                      {mod}
                    </span>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground sticky top-0">
                    <tr>
                      <th className="px-6 py-3 font-medium">Data / Hora</th>
                      <th className="px-6 py-3 font-medium">Usuário</th>
                      <th className="px-6 py-3 font-medium">Módulo</th>
                      <th className="px-6 py-3 font-medium">Ação</th>
                      <th className="px-6 py-3 font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLogs
                      .filter(log => filterModule === "all" || log.modulo === filterModule)
                      .slice(0, 50)
                      .map((log) => {
                        const moduleColors: Record<string, string> = {
                          "Auth": "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          "Produtos": "bg-green-500/10 text-green-400 border-green-500/20",
                          "Movimentações": "bg-orange-500/10 text-orange-400 border-orange-500/20",
                          "Usuários": "bg-purple-500/10 text-purple-400 border-purple-500/20",
                          "Sistema": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                        };
                        const modColor = moduleColors[log.modulo || ""] || "bg-muted/50 text-muted-foreground border-border";
                        return (
                          <tr key={log.id} data-testid={`row-audit-${log.id}`} className="border-b border-border hover:bg-muted/20 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap text-muted-foreground text-xs">
                              {format(new Date(log.data_hora!), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </td>
                            <td className="px-6 py-3 font-medium text-foreground text-xs">{log.usuario}</td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${modColor}`}>
                                {log.modulo}
                              </span>
                            </td>
                            <td className="px-6 py-3 font-medium text-foreground text-xs">{log.acao}</td>
                            <td className="px-6 py-3 text-muted-foreground text-xs max-w-[300px] truncate">{log.descricao}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === "fluxo" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((s, i) => (
              <div key={i} className={`${s.bg} border rounded-xl p-4 flex items-center gap-3`} data-testid={`stat-fluxo-${s.label.toLowerCase().replace(/\s/g, '-')}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-bold tracking-wider">
              <Filter className="w-4 h-4" /> FILTROS
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                placeholder="Pesquisar código..."
                value={searchCode}
                onChange={e => setSearchCode(e.target.value)}
                className="bg-muted/30 border-border rounded-xl"
                data-testid="input-search-history"
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="bg-muted/30 border-border rounded-xl" data-testid="select-filter-type">
                  <SelectValue placeholder="Todos os Tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterResp} onValueChange={setFilterResp}>
                <SelectTrigger className="bg-muted/30 border-border rounded-xl" data-testid="select-filter-resp">
                  <SelectValue placeholder="Todos os Responsáveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Responsáveis</SelectItem>
                  {responsaveis.map(r => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-6">
            {grouped.map((group, gi) => (
              <div key={gi}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full">{group.items.length}</span>
                </div>
                <div className="space-y-2">
                  {group.items.map(m => {
                    const isEntrada = m.tipo === "entrada";
                    const date = m.data_hora ? new Date(m.data_hora) : new Date();
                    return (
                      <div
                        key={m.id}
                        data-testid={`history-item-${m.id}`}
                        className={`glass-card rounded-xl border ${isEntrada ? 'border-green-500/10' : 'border-orange-500/10'} p-4 flex items-center justify-between hover:bg-muted/10 transition-colors`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEntrada ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                            {isEntrada ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{getProductName(m.produto_id)}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                isEntrada ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                              }`}>
                                {isEntrada ? '+' : '-'}{m.quantidade} {isEntrada ? 'Entrada' : 'Saída'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>{isEntrada ? 'Abastecimento' : 'Retirada'}</span>
                              <Activity className="w-3 h-3" />
                              <span>{getUserName(m.usuario_id)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${isEntrada ? 'text-green-500' : 'text-red-500'}`}>
                            {format(date, "HH:mm")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(date, "dd/MM")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum registro encontrado.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
