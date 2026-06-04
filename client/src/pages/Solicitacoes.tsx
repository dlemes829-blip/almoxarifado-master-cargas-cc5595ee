import { useState, useMemo } from "react";
import { useProducts } from "@/hooks/use-products";
import { useResponsaveis } from "@/hooks/use-responsaveis";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Search, Eye, Send, X, AlertTriangle, Plus, Trash2,
  Building2, ClipboardList, Package, MapPin, FileText,
  Truck, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

const DEST_SECTORS = ["RECEP.", "PORTA.", "AZ1", "AZ2", "DAF"] as const;
type DestSector = typeof DEST_SECTORS[number];

const REQUESTING_SECTORS = [
  "RECEPÇÃO", "PORTARIA", "ARMAZÉM 1", "ARMAZÉM 2", "DAF",
  "ADMINISTRATIVO", "MANUTENÇÃO", "LIMPEZA", "OPERACIONAL", "OUTRO",
] as const;

type SolicitacaoMode = "internal" | "supplier";

interface SelectedProduct {
  id: number;
  nome: string;
  unidade: string;
  localizacao: string | null;
  quantidade_atual: number;
  estoque_minimo: number;
  sectorQuantities: Record<DestSector, number>;
  supplierQuantity: number;
}

export default function Solicitacoes() {
  const { data: products = [] } = useProducts();
  const { data: responsaveis = [] } = useResponsaveis();
  const { user } = useAuth();
  const { sendMessage } = useWebSocket();
  const { toast } = useToast();

  const [mode, setMode] = useState<SolicitacaoMode>("internal");
  const [requestingSector, setRequestingSector] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [editableMessage, setEditableMessage] = useState("");

  const uniqueSectors = useMemo(() => {
    const fromResp = responsaveis.filter(r => r.ativo).map(r => r.setor);
    const all = new Set([...REQUESTING_SECTORS, ...fromResp]);
    return Array.from(all).sort();
  }, [responsaveis]);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => p.ativo);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.nome.toLowerCase().includes(term) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(term)) ||
        (p.localizacao && p.localizacao.toLowerCase().includes(term))
      );
    }
    return filtered;
  }, [products, searchTerm]);

  const isLowStock = (p: any) => p.quantidade_atual <= p.estoque_minimo;
  const isSelected = (id: number) => selectedProducts.some(sp => sp.id === id);

  const emptySectors: Record<DestSector, number> = { "RECEP.": 0, "PORTA.": 0, "AZ1": 0, "AZ2": 0, "DAF": 0 };

  const toggleProduct = (product: any) => {
    if (isSelected(product.id)) {
      setSelectedProducts(prev => prev.filter(sp => sp.id !== product.id));
    } else {
      setSelectedProducts(prev => [...prev, {
        id: product.id,
        nome: product.nome,
        unidade: product.unidade,
        localizacao: product.localizacao,
        quantidade_atual: product.quantidade_atual,
        estoque_minimo: product.estoque_minimo,
        sectorQuantities: { ...emptySectors },
        supplierQuantity: 0,
      }]);
    }
  };

  const removeProduct = (id: number) => {
    setSelectedProducts(prev => prev.filter(sp => sp.id !== id));
  };

  const updateSectorQuantity = (productId: number, sector: DestSector, value: number) => {
    setSelectedProducts(prev => prev.map(sp =>
      sp.id === productId
        ? { ...sp, sectorQuantities: { ...sp.sectorQuantities, [sector]: Math.max(0, value) } }
        : sp
    ));
  };

  const updateSupplierQuantity = (productId: number, value: number) => {
    setSelectedProducts(prev => prev.map(sp =>
      sp.id === productId ? { ...sp, supplierQuantity: Math.max(0, value) } : sp
    ));
  };

  const getRowTotal = (sp: SelectedProduct) =>
    mode === "supplier"
      ? sp.supplierQuantity
      : DEST_SECTORS.reduce((sum, s) => sum + (sp.sectorQuantities[s] || 0), 0);

  const getColumnTotal = (sector: DestSector) =>
    selectedProducts.reduce((sum, sp) => sum + (sp.sectorQuantities[sector] || 0), 0);

  const grandTotal = selectedProducts.reduce((sum, sp) => sum + getRowTotal(sp), 0);

  const generateMessage = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR");
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    if (mode === "supplier") {
      let msg = `SOLICITAÇÃO PARA FORNECEDOR\n`;
      msg += `================================\n`;
      msg += `Setor: ${requestingSector || "NÃO INFORMADO"}\n`;
      msg += `Solicitante: ${user?.username || "Sistema"}\n`;
      msg += `Data: ${dateStr}, ${timeStr}\n\n`;
      msg += `ITENS PARA REPOSIÇÃO:\n\n`;

      selectedProducts.forEach(sp => {
        if (sp.supplierQuantity === 0) return;
        msg += `- ${sp.nome} (${sp.unidade})${sp.localizacao ? ` [End. ${sp.localizacao}]` : ""}\n`;
        msg += `  Qtd Solicitada: ${sp.supplierQuantity} | Estoque Atual: ${sp.quantidade_atual}\n\n`;
      });

      msg += `================================\n`;
      msg += `Master Cargas Brasil - Almoxarifado`;
      return msg;
    }

    let msg = `SOLICITAÇÃO DE MATERIAIS\n`;
    msg += `================================\n`;
    msg += `Setor Solicitante: ${requestingSector || "NÃO INFORMADO"}\n`;
    msg += `Solicitante: ${user?.username || "Sistema"}\n`;
    msg += `Data: ${dateStr}, ${timeStr}\n\n`;
    msg += `ITENS SOLICITADOS:\n\n`;

    selectedProducts.forEach(sp => {
      const total = getRowTotal(sp);
      if (total === 0) return;
      msg += `- ${sp.nome} (${sp.unidade})${sp.localizacao ? ` [End. ${sp.localizacao}]` : ""}\n`;
      const parts: string[] = [];
      parts.push(`Total: ${total}`);
      DEST_SECTORS.forEach(s => {
        if (sp.sectorQuantities[s] > 0) {
          parts.push(`${s} ${sp.sectorQuantities[s]}`);
        }
      });
      msg += `  ${parts.join(" | ")}\n\n`;
    });

    msg += `================================\n`;
    msg += `Master Cargas Brasil - Almoxarifado`;
    return msg;
  };

  const handlePreview = () => {
    if (!requestingSector) {
      toast({ title: "Setor obrigatório", description: "Selecione o setor que está solicitando os materiais", variant: "destructive" });
      return;
    }
    if (selectedProducts.length === 0) {
      toast({ title: "Aviso", description: "Selecione pelo menos um material", variant: "destructive" });
      return;
    }
    if (grandTotal === 0) {
      toast({ title: "Aviso", description: "Preencha as quantidades antes de enviar", variant: "destructive" });
      return;
    }
    setEditableMessage(generateMessage());
    setShowPreview(true);
  };

  const handleSend = () => {
    if (!editableMessage.trim()) return;
    sendMessage("chat_message", {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sender: user?.username || "Sistema",
      content: editableMessage,
      timestamp: new Date().toISOString(),
    });
    sendMessage("solicitacao_sent", {
      username: user?.username || "Alguém",
    });
    toast({ title: "Enviado!", description: "Solicitação enviada para o chat do grupo" });
    setShowPreview(false);
    setSelectedProducts([]);
    setEditableMessage("");
    setRequestingSector("");
    setSearchTerm("");
  };



  const clearAll = () => {
    setSelectedProducts([]);
  };

  const switchMode = (newMode: SolicitacaoMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setSelectedProducts([]);
      setRequestingSector("");
      setSearchTerm("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight" data-testid="text-solicitacoes-title">
            Solicitações de Materiais
          </h1>
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            Monte a lista e envie ao grupo do almoxarifado
          </p>
        </div>
      </div>

      <div className="flex gap-2" data-testid="mode-tabs">
        <button
          onClick={() => switchMode("internal")}
          data-testid="tab-internal"
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
            mode === "internal"
              ? "bg-accent text-accent-foreground border-accent shadow-sm"
              : "bg-muted/20 text-muted-foreground border-border"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Solicitar Materiais
        </button>
        <button
          onClick={() => switchMode("supplier")}
          data-testid="tab-supplier"
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
            mode === "supplier"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-muted/20 text-muted-foreground border-border"
          }`}
        >
          <Truck className="w-4 h-4" />
          Solicitar p/ Fornecedor
        </button>
      </div>

      <Card className={`p-5 ${mode === "supplier" ? "border-blue-500/20 bg-blue-500/[0.02]" : "border-accent/15 bg-accent/[0.02]"}`} data-testid="section-sector-select">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className={`w-4 h-4 ${mode === "supplier" ? "text-blue-500" : "text-accent"}`} />
          <h2 className={`text-xs font-bold uppercase tracking-wider ${mode === "supplier" ? "text-blue-500" : "text-accent"}`}>
            {mode === "supplier" ? "Setor que Precisa de Reposição" : "Setor Solicitante"}
          </h2>
          {!requestingSector && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {uniqueSectors.map(sector => (
            <button
              key={sector}
              data-testid={`sector-btn-${sector}`}
              onClick={() => setRequestingSector(requestingSector === sector ? "" : sector)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                requestingSector === sector
                  ? mode === "supplier"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-accent text-accent-foreground border-accent shadow-sm"
                  : "bg-muted/20 text-muted-foreground border-border"
              }`}
            >
              {sector}
            </button>
          ))}
        </div>
        {requestingSector && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 ${mode === "supplier" ? "bg-blue-500/5 border border-blue-500/15" : "bg-accent/5 border border-accent/15"}`}>
            <Building2 className={`w-3.5 h-3.5 ${mode === "supplier" ? "text-blue-500" : "text-accent"}`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Setor:</span>
            <Badge className={`text-[10px] ${mode === "supplier" ? "bg-blue-600 text-white" : "bg-accent text-accent-foreground"}`}>{requestingSector}</Badge>
            <button onClick={() => setRequestingSector("")} className="ml-auto text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </Card>

      <Card className="border-border p-5" data-testid="section-product-search">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {mode === "supplier" ? "Produtos para Reposição" : "Selecionar Materiais"}
          </h2>
          {selectedProducts.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{selectedProducts.length} selecionado(s)</Badge>
          )}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, código ou endereço..."
            className="bg-muted/30 border-border rounded-xl pl-10 h-11"
            data-testid="input-search-material"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
          {filteredProducts.map(p => {
            const selected = isSelected(p.id);
            const lowStock = isLowStock(p);
            return (
              <button
                key={p.id}
                data-testid={`product-chip-${p.id}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  selected
                    ? mode === "supplier"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-accent text-accent-foreground border-accent shadow-sm"
                    : lowStock
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-muted/20 text-foreground border-border"
                }`}
                onClick={() => toggleProduct(p)}
              >
                {selected ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                <span className="truncate max-w-[180px]">{p.nome}</span>
                {lowStock && !selected && <AlertTriangle className="w-3 h-3 shrink-0" />}
                {p.localizacao && !selected && (
                  <span className="text-[9px] text-muted-foreground shrink-0">[{p.localizacao}]</span>
                )}
              </button>
            );
          })}
          {filteredProducts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 w-full text-center">Nenhum produto encontrado.</p>
          )}
        </div>
      </Card>

      {selectedProducts.length > 0 && (
        <Card className="border-border p-5" data-testid="section-spreadsheet">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground" data-testid="text-spreadsheet-title">
                {mode === "supplier" ? "LISTA DE REPOSIÇÃO" : "PLANILHA"} - {selectedProducts.length} MATERIAL(IS)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-bold" data-testid="badge-total">
                Total: {grandTotal}
              </Badge>
              <Button variant="outline" size="sm" onClick={clearAll} className="rounded-lg text-xs h-8" data-testid="button-clear">
                <Trash2 className="w-3 h-3 mr-1.5" />
                Limpar
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm" data-testid="table-spreadsheet">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-muted-foreground min-w-[200px]">Material</th>
                  {mode === "supplier" ? (
                    <>
                      <th className="text-center px-2 py-2.5 font-bold text-[10px] uppercase tracking-widest text-muted-foreground min-w-[80px]">Est. Atual</th>
                      <th className="text-center px-2 py-2.5 font-bold text-[10px] uppercase tracking-widest text-muted-foreground min-w-[80px]">Est. Mín.</th>
                      <th className="text-center px-2 py-2.5 font-bold text-[10px] uppercase tracking-widest text-blue-500 min-w-[90px]">Qtd. Solicitar</th>
                    </>
                  ) : (
                    <>
                      {DEST_SECTORS.map(s => (
                        <th key={s} className="text-center px-2 py-2.5 font-bold text-[10px] uppercase tracking-widest text-muted-foreground min-w-[72px]">{s}</th>
                      ))}
                      <th className="text-center px-2 py-2.5 font-bold text-[10px] uppercase tracking-widest text-accent min-w-[60px]">Total</th>
                    </>
                  )}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {selectedProducts.map((sp, idx) => {
                  const rowTotal = getRowTotal(sp);
                  const isEven = idx % 2 === 0;
                  return (
                    <tr key={sp.id} className={`border-b border-border/50 last:border-b-0 ${isEven ? '' : 'bg-muted/10'}`} data-testid={`row-product-${sp.id}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground text-xs leading-tight truncate max-w-[200px]" title={sp.nome}>
                          {sp.nome}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-bold">{sp.unidade}</span>
                          {sp.localizacao && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />{sp.localizacao}
                            </span>
                          )}
                          {mode === "internal" && (
                            <span className={`text-[9px] font-bold ${sp.quantidade_atual <= sp.estoque_minimo ? 'text-amber-500' : 'text-green-500'}`}>
                              Est:{sp.quantidade_atual}
                            </span>
                          )}
                        </div>
                      </td>
                      {mode === "supplier" ? (
                        <>
                          <td className="px-2 py-2 text-center">
                            <span className={`text-sm font-bold ${sp.quantidade_atual <= sp.estoque_minimo ? 'text-amber-500' : 'text-foreground'}`}>
                              {sp.quantidade_atual}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="text-sm text-muted-foreground">{sp.estoque_minimo}</span>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <Input
                              type="number"
                              min={0}
                              value={sp.supplierQuantity || ""}
                              onChange={e => updateSupplierQuantity(sp.id, parseInt(e.target.value) || 0)}
                              className="w-20 mx-auto text-center text-sm border-blue-500/30 bg-blue-500/5 rounded-lg h-9"
                              data-testid={`input-supplier-${sp.id}`}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          {DEST_SECTORS.map(sector => (
                            <td key={sector} className="px-1 py-1.5 text-center">
                              <Input
                                type="number"
                                min={0}
                                value={sp.sectorQuantities[sector] || ""}
                                onChange={e => updateSectorQuantity(sp.id, sector, parseInt(e.target.value) || 0)}
                                className="w-16 mx-auto text-center text-sm border-border bg-transparent rounded-lg h-9"
                                data-testid={`input-${sp.id}-${sector}`}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center" data-testid={`total-row-${sp.id}`}>
                            <span className={`font-bold text-sm ${rowTotal > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
                              {rowTotal}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-1 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProduct(sp.id)}
                          data-testid={`button-remove-${sp.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {mode === "internal" && (
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 border-border">
                    <td className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Totais</td>
                    {DEST_SECTORS.map(sector => (
                      <td key={sector} className="px-2 py-2.5 text-center font-bold text-foreground text-sm" data-testid={`total-col-${sector}`}>
                        {getColumnTotal(sector) || "-"}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center" data-testid="total-grand">
                      <span className="font-black text-accent text-base">{grandTotal}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
              {mode === "supplier" && (
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 border-border">
                    <td className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Total</td>
                    <td></td>
                    <td></td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="font-black text-blue-500 text-base">{grandTotal}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="grid gap-3 pt-4 grid-cols-2">
            <Button
              variant="outline"
              className="rounded-xl font-bold uppercase tracking-wider h-12 text-xs border-border"
              onClick={handlePreview}
              data-testid="button-preview-message"
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualizar Mensagem
            </Button>
            <Button
              className={`rounded-xl font-bold uppercase tracking-wider h-12 text-xs ${
                mode === "supplier" ? "bg-blue-600 text-white" : "bg-accent text-accent-foreground"
              }`}
              onClick={handlePreview}
              data-testid="button-generate-send"
            >
              <Send className="w-4 h-4 mr-2" />
              {mode === "supplier" ? "Gerar Pedido" : "Gerar e Enviar"}
            </Button>
          </div>
        </Card>
      )}

      {selectedProducts.length === 0 && (
        <Card className="border-border border-dashed p-8" data-testid="section-empty-state">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
              {mode === "supplier" ? (
                <Truck className="w-7 h-7 text-muted-foreground/40" />
              ) : (
                <ClipboardList className="w-7 h-7 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">
                {mode === "supplier" ? "Nenhum produto para reposição" : "Nenhum material selecionado"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {mode === "supplier"
                  ? "Selecione o setor e adicione os produtos que precisam de reposição"
                  : "Selecione o setor solicitante e adicione materiais usando a busca acima"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="bg-card border border-border rounded-xl max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2" data-testid="text-preview-title">
              {mode === "supplier" ? (
                <Truck className="w-5 h-5 text-blue-500" />
              ) : (
                <FileText className="w-5 h-5 text-accent" />
              )}
              {mode === "supplier" ? "Pedido para Fornecedor" : "Mensagem do Pedido"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Revise e edite a mensagem se necessário antes de enviá-la ao grupo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${mode === "supplier" ? "bg-blue-500/5 border border-blue-500/15" : "bg-accent/5 border border-accent/15"}`}>
              <Building2 className={`w-3.5 h-3.5 ${mode === "supplier" ? "text-blue-500" : "text-accent"}`} />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Setor:</span>
              <Badge className={`text-[10px] ${mode === "supplier" ? "bg-blue-600 text-white" : "bg-accent text-accent-foreground"}`}>{requestingSector}</Badge>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Itens:</span>
              <Badge variant="secondary" className="text-[10px]">{grandTotal}</Badge>
            </div>

            <Textarea
              value={editableMessage}
              onChange={e => setEditableMessage(e.target.value)}
              className="min-h-[280px] bg-muted/20 border-border rounded-xl font-mono text-xs leading-relaxed"
              data-testid="textarea-message"
            />
          </div>

          <div className="flex gap-3 mt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-11"
              onClick={() => setShowPreview(false)}
              data-testid="button-cancel-preview"
            >
              Cancelar
            </Button>
            <Button
              className={`flex-1 rounded-xl font-bold h-11 ${mode === "supplier" ? "bg-blue-600 text-white" : "bg-green-600 text-white"}`}
              onClick={handleSend}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar ao Grupo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
