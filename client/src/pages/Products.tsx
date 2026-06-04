import { useState, useRef, useEffect, useMemo } from "react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/use-products";
import { useCreateMovement } from "@/hooks/use-movements";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, Search, FileDown, Edit2, Box, Camera, X, ScanBarcode, 
  ArrowDownRight, LayoutGrid, List, AlertTriangle, MapPin,
  Package, ChevronLeft, ChevronRight, Filter, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { detectBarcode, getCamera } from "@/lib/barcode-scanner";

const CATEGORIAS = ["LIMPEZA", "ADMINISTRATIVO", "ALIMENTOS", "MANUTENÇÃO PREDIAL", "MANUTENÇÃO", "EPI", "DAF", "OUTROS"];
const PAGE_SIZE = 50;

export default function Products() {
  const { data: products = [], isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createMovement = useCreateMovement();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<any>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryProduct, setEntryProduct] = useState<any>(null);
  const [entryQuantity, setEntryQuantity] = useState(1);
  const [entryObservacao, setEntryObservacao] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showFormScanner, setShowFormScanner] = useState(false);
  const formVideoRef = useRef<HTMLVideoElement>(null);
  const formStreamRef = useRef<MediaStream | null>(null);
  const formScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formScannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeCategory, setActiveCategory] = useState("TODOS");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "zero">("all");

  const [formData, setFormData] = useState({
    nome: "",
    codigo_barras: "",
    categoria: "OUTROS",
    quantidade_atual: 0,
    unidade: "UN",
    localizacao: "",
    estoque_minimo: 0,
  });

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = { TODOS: products.length };
    products.forEach(p => {
      stats[p.categoria] = (stats[p.categoria] || 0) + 1;
    });
    return stats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search || 
        p.nome.toLowerCase().includes(search.toLowerCase()) || 
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(search.toLowerCase())) ||
        (p.localizacao && p.localizacao.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = activeCategory === "TODOS" || p.categoria === activeCategory;
      const matchStock = stockFilter === "all" || 
        (stockFilter === "low" && p.quantidade_atual <= p.estoque_minimo && p.quantidade_atual > 0) ||
        (stockFilter === "zero" && p.quantidade_atual === 0);
      return matchSearch && matchCategory && matchStock;
    });
  }, [products, search, activeCategory, stockFilter]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [search, activeCategory, stockFilter]);

  const totalStock = products.reduce((a, p) => a + p.quantidade_atual, 0);
  const lowStockCount = products.filter(p => p.quantidade_atual <= p.estoque_minimo).length;
  const zeroStockCount = products.filter(p => p.quantidade_atual === 0).length;

  const startScanner = async () => {
    stopScanner();
    try {
      const stream = await getCamera();
      if (!stream) {
        toast({ title: "Erro", description: "Não foi possível acessar a câmera", variant: "destructive" });
        return;
      }
      streamRef.current = stream;
      setShowScanner(true);
      scannerTimeoutRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          startBarcodeDetection();
        }
      }, 100);
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível acessar a câmera", variant: "destructive" });
    }
  };

  const startBarcodeDetection = () => {
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;
      const code = await detectBarcode(videoRef.current);
      if (code) {
        handleBarcodeDetected(code);
      }
    }, 250);
  };

  const handleBarcodeDetected = (code: string) => {
    const product = products.find(p => p.codigo_barras === code);
    if (product) {
      setSearch(product.nome);
      toast({ title: "Produto encontrado!", description: `${product.nome} - Estoque: ${product.quantidade_atual}` });
    } else {
      setSearch(code);
      toast({ title: "Código lido", description: `Código: ${code} - Produto não cadastrado` });
    }
    stopScanner();
  };

  const stopScanner = () => {
    if (scannerTimeoutRef.current) { clearTimeout(scannerTimeoutRef.current); scannerTimeoutRef.current = null; }
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    setShowScanner(false);
  };

  const startFormScanner = async () => {
    stopFormScanner();
    try {
      const stream = await getCamera();
      if (!stream) {
        toast({ title: "Erro", description: "Não foi possível acessar a câmera", variant: "destructive" });
        return;
      }
      if (!isDialogOpen) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      formStreamRef.current = stream;
      setShowFormScanner(true);
      formScannerTimeoutRef.current = setTimeout(() => {
        if (formVideoRef.current && isDialogOpen) {
          formVideoRef.current.srcObject = stream;
          formVideoRef.current.play();
          startFormBarcodeDetection();
        }
      }, 100);
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível acessar a câmera", variant: "destructive" });
    }
  };

  const startFormBarcodeDetection = () => {
    formScanIntervalRef.current = setInterval(async () => {
      if (!formVideoRef.current || formVideoRef.current.readyState !== 4) return;
      const code = await detectBarcode(formVideoRef.current);
      if (code) {
        setFormData(prev => ({ ...prev, codigo_barras: code }));
        toast({ title: "Código detectado!", description: `Código: ${code}` });
        stopFormScanner();
      }
    }, 250);
  };

  const stopFormScanner = () => {
    if (formScannerTimeoutRef.current) { clearTimeout(formScannerTimeoutRef.current); formScannerTimeoutRef.current = null; }
    if (formScanIntervalRef.current) { clearInterval(formScanIntervalRef.current); formScanIntervalRef.current = null; }
    if (formStreamRef.current) { formStreamRef.current.getTracks().forEach(track => track.stop()); formStreamRef.current = null; }
    setShowFormScanner(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      stopFormScanner();
    }
    setIsDialogOpen(open);
  };

  useEffect(() => { return () => { stopScanner(); stopFormScanner(); }; }, []);

  const handleExport = () => {
    if (!user?.pode_exportar_relatorio) {
      toast({ title: "Erro", description: "Sem permissão para exportar", variant: "destructive" });
      return;
    }
    const headers = ["ID", "Nome", "Categoria", "Qtd", "Unidade", "Localização", "Estoque Mínimo", "Status"];
    const rows = filteredProducts.map(p => [
      p.id, `"${p.nome}"`, p.categoria, p.quantidade_atual, p.unidade, `"${p.localizacao || ''}"`, p.estoque_minimo,
      p.quantidade_atual === 0 ? "ZERADO" : p.quantidade_atual <= p.estoque_minimo ? "BAIXO" : "OK"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `produtos_${activeCategory !== "TODOS" ? activeCategory + "_" : ""}${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Sucesso", description: `CSV exportado com ${filteredProducts.length} produtos` });
  };

  const handleOpenEdit = (p: any) => {
    setEditingProduct(p);
    setFormData({
      nome: p.nome, codigo_barras: p.codigo_barras || "", categoria: p.categoria,
      quantidade_atual: p.quantidade_atual, unidade: p.unidade,
      localizacao: p.localizacao || "", estoque_minimo: p.estoque_minimo,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEntry = (p: any) => {
    setEntryProduct(p);
    setEntryQuantity(1);
    setEntryObservacao("");
    setEntryDialogOpen(true);
  };

  const handleEntrySubmit = async () => {
    if (!entryProduct || entryQuantity <= 0) return;
    try {
      await createMovement.mutateAsync({
        produto_id: entryProduct.id, tipo: "entrada",
        quantidade: entryQuantity, observacao: entryObservacao || undefined,
      });
      toast({ title: "Sucesso", description: `Entrada de ${entryQuantity} ${entryProduct.unidade} registrada para ${entryProduct.nome}` });
      setEntryDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteConfirmProduct) return;
    try {
      await deleteProduct.mutateAsync(deleteConfirmProduct.id);
      toast({ title: "Sucesso", description: `Produto "${deleteConfirmProduct.nome}" excluído com sucesso.` });
      setDeleteConfirmProduct(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao excluir produto", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSubmit = { ...formData, quantidade_atual: Number(formData.quantidade_atual), estoque_minimo: Number(formData.estoque_minimo) };
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, ...dataToSubmit });
        toast({ title: "Sucesso", description: "Produto atualizado com sucesso." });
      } else {
        await createProduct.mutateAsync(dataToSubmit as any);
        toast({ title: "Sucesso", description: "Produto cadastrado com sucesso." });
      }
      stopFormScanner();
      setIsDialogOpen(false);
      setFormData({ nome: "", codigo_barras: "", categoria: "OUTROS", quantidade_atual: 0, unidade: "UN", localizacao: "", estoque_minimo: 0 });
      setEditingProduct(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const getStatusInfo = (p: any) => {
    if (p.quantidade_atual === 0) return { label: "ZERADO", color: "bg-red-500/10 text-red-500 border-red-500/20" };
    if (p.quantidade_atual <= p.estoque_minimo) return { label: "BAIXO", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
    return { label: "OK", color: "bg-green-500/10 text-green-500 border-green-500/20" };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight" data-testid="text-products-title">
            Produtos
          </h1>
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">
            {products.length} cadastrados · {totalStock.toLocaleString('pt-BR')} itens em estoque
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} variant="outline" className="border-border rounded-xl h-10 px-3 text-xs font-bold" data-testid="button-export-csv">
            <FileDown className="w-4 h-4 mr-1.5" /> CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-product" className="bg-accent text-accent-foreground rounded-xl h-10 px-4 text-xs font-bold" onClick={() => {
                setEditingProduct(null);
                setFormData({ nome: "", codigo_barras: "", categoria: "OUTROS", quantidade_atual: 0, unidade: "UN", localizacao: "", estoque_minimo: 0 });
              }}>
                <Plus className="w-4 h-4 mr-1.5" /> Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-card border border-border rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">{editingProduct ? 'Editar Produto' : 'Cadastrar Produto'}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {editingProduct ? 'Altere os dados do produto' : 'Preencha os dados para cadastrar um novo produto'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Nome do Produto *</Label>
                    <Input required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="bg-muted/30 border-border h-11 rounded-xl" data-testid="input-product-name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Código de Barras</Label>
                    <div className="flex items-center gap-2">
                      <Input value={formData.codigo_barras} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} className="bg-muted/30 border-border h-11 rounded-xl flex-1" data-testid="input-barcode" />
                      <Button type="button" variant="outline" size="icon" onClick={showFormScanner ? stopFormScanner : startFormScanner} className="shrink-0 border-border rounded-xl" data-testid="button-form-scan-barcode">
                        {showFormScanner ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                      </Button>
                    </div>
                    {showFormScanner && (
                      <div className="relative rounded-xl overflow-hidden border border-accent/50 bg-black mt-2">
                        <video ref={formVideoRef} className="w-full h-40 object-cover" playsInline muted autoPlay />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-48 h-24 border-2 border-accent rounded-lg relative">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-accent rounded-tl-md" />
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-accent rounded-tr-md" />
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-accent rounded-bl-md" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-accent rounded-br-md" />
                          </div>
                        </div>
                        <div className="absolute top-1.5 left-1.5 bg-accent text-accent-foreground px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                          <ScanBarcode className="w-3 h-3" /> ESCANEANDO...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Categoria *</Label>
                    <Select value={formData.categoria} onValueChange={v => setFormData({...formData, categoria: v})}>
                      <SelectTrigger className="bg-muted/30 border-border h-11 rounded-xl" data-testid="select-category"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">{editingProduct ? 'Quantidade Atual *' : 'Quantidade Inicial *'}</Label>
                    <Input type="number" min="0" required value={formData.quantidade_atual} onChange={e => setFormData({...formData, quantidade_atual: Number(e.target.value)})} className="bg-muted/30 border-border h-11 rounded-xl" data-testid="input-quantity" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Estoque Mínimo *</Label>
                    <Input type="number" min="0" required value={formData.estoque_minimo} onChange={e => setFormData({...formData, estoque_minimo: Number(e.target.value)})} className="bg-muted/30 border-border h-11 rounded-xl" data-testid="input-min-stock" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Unidade *</Label>
                    <Input required placeholder="UN, KG, CX" value={formData.unidade} onChange={e => setFormData({...formData, unidade: e.target.value})} className="bg-muted/30 border-border h-11 rounded-xl" data-testid="input-unit" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Localização</Label>
                    <Input placeholder="A1, B2, C3..." value={formData.localizacao} onChange={e => setFormData({...formData, localizacao: e.target.value})} className="bg-muted/30 border-border h-11 rounded-xl" data-testid="input-location" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="bg-accent text-accent-foreground font-bold px-8 rounded-xl" data-testid="button-save-product">
                    {createProduct.isPending || updateProduct.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setStockFilter(stockFilter === "all" ? "all" : "all")}
          className={`rounded-xl p-3 border text-left transition-all ${stockFilter === "all" ? "bg-blue-500/10 border-blue-500/20" : "bg-card border-border hover:border-blue-500/30"}`}
          data-testid="filter-stock-all"
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</span>
          </div>
          <p className="text-xl font-bold text-blue-400 mt-1">{products.length}</p>
        </button>
        <button
          onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}
          className={`rounded-xl p-3 border text-left transition-all ${stockFilter === "low" ? "bg-orange-500/10 border-orange-500/20" : "bg-card border-border hover:border-orange-500/30"}`}
          data-testid="filter-stock-low"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Baixo Estoque</span>
          </div>
          <p className="text-xl font-bold text-orange-400 mt-1">{lowStockCount}</p>
        </button>
        <button
          onClick={() => setStockFilter(stockFilter === "zero" ? "all" : "zero")}
          className={`rounded-xl p-3 border text-left transition-all ${stockFilter === "zero" ? "bg-red-500/10 border-red-500/20" : "bg-card border-border hover:border-red-500/30"}`}
          data-testid="filter-stock-zero"
        >
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-400" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Zerados</span>
          </div>
          <p className="text-xl font-bold text-red-400 mt-1">{zeroStockCount}</p>
        </button>
      </div>

      {showScanner && (
        <div className="relative rounded-2xl overflow-hidden border-2 border-accent/50 bg-black">
          <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-accent rounded-xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-accent rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-accent rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-accent rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-accent rounded-br-lg" />
            </div>
          </div>
          <div className="absolute top-2 left-2 bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <ScanBarcode className="w-3 h-3" /> ESCANEANDO...
          </div>
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-black/60 text-white hover:bg-black/80 rounded-full w-8 h-8" onClick={stopScanner} data-testid="button-close-scanner-products">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            data-testid="input-search-products"
            placeholder="Buscar por nome, código de barras ou endereço..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/20 border-border h-11 rounded-xl"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground" onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={showScanner ? stopScanner : startScanner}
          className="shrink-0 border-border rounded-xl"
          data-testid="button-search-scan-barcode"
        >
          {showScanner ? <X className="w-4 h-4" /> : <ScanBarcode className="w-4 h-4" />}
        </Button>
        <div className="flex items-center border border-border rounded-xl overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className={`w-10 h-10 rounded-none ${viewMode === "table" ? "bg-accent/10 text-accent" : "text-muted-foreground"}`}
            onClick={() => setViewMode("table")}
            data-testid="view-table"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`w-10 h-10 rounded-none ${viewMode === "grid" ? "bg-accent/10 text-accent" : "text-muted-foreground"}`}
            onClick={() => setViewMode("grid")}
            data-testid="view-grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider ${activeCategory === 'TODOS' ? 'bg-accent text-accent-foreground border-accent/20' : 'border-border text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveCategory('TODOS')}
          data-testid="filter-todos"
        >
          Todos ({categoryStats.TODOS || 0})
        </Button>
        {CATEGORIAS.map(cat => (
          <Button
            key={cat}
            variant="outline"
            size="sm"
            className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider ${activeCategory === cat ? 'bg-accent text-accent-foreground border-accent/20' : 'border-border text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveCategory(activeCategory === cat ? "TODOS" : cat)}
            data-testid={`filter-${cat.toLowerCase().replace(/\s/g, '-')}`}
          >
            {cat} ({categoryStats[cat] || 0})
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
          {filteredProducts.length} produtos encontrados
          {stockFilter !== "all" && <span className="text-accent ml-1">· filtro: {stockFilter === "low" ? "baixo estoque" : "zerados"}</span>}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold text-muted-foreground">{currentPage}/{totalPages}</span>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {viewMode === "table" ? (
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-muted-foreground bg-muted/30 tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Produto</th>
                  <th className="px-4 py-3 text-left font-medium">Categoria</th>
                  <th className="px-4 py-3 text-center font-medium">Estoque</th>
                  <th className="px-4 py-3 text-center font-medium">Mínimo</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Endereço</th>
                  <th className="px-4 py-3 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map(p => {
                  const status = getStatusInfo(p);
                  const pct = p.estoque_minimo > 0 ? Math.min((p.quantidade_atual / p.estoque_minimo) * 100, 100) : (p.quantidade_atual > 0 ? 100 : 0);
                  return (
                    <tr key={p.id} data-testid={`row-product-${p.id}`} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-foreground text-sm truncate max-w-[250px]">{p.nome}</p>
                          {p.codigo_barras && (
                            <p className="text-[10px] text-muted-foreground font-mono">{p.codigo_barras}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/30 px-2 py-0.5 rounded border border-border">
                          {p.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-bold ${p.quantidade_atual === 0 ? 'text-red-500' : p.quantidade_atual <= p.estoque_minimo ? 'text-orange-500' : 'text-foreground'}`}>
                            {p.quantidade_atual} <span className="text-[9px] text-muted-foreground">{p.unidade}</span>
                          </span>
                          <div className="w-16 h-1 bg-muted/30 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${p.quantidade_atual === 0 ? 'bg-red-500' : p.quantidade_atual <= p.estoque_minimo ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{p.estoque_minimo}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.localizacao ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{p.localizacao}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEntry(p)} className="w-7 h-7 rounded-lg hover:bg-green-500/10 text-green-500" data-testid={`button-entry-product-${p.id}`} title="Entrada">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(p)} className="w-7 h-7 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground" data-testid={`button-edit-product-${p.id}`} title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmProduct(p)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500" data-testid={`button-delete-product-${p.id}`} title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProducts.map(p => {
            const status = getStatusInfo(p);
            const pct = p.estoque_minimo > 0 ? Math.min((p.quantidade_atual / p.estoque_minimo) * 100, 100) : (p.quantidade_atual > 0 ? 100 : 0);
            return (
              <div key={p.id} data-testid={`card-product-${p.id}`} className="bg-card border border-border rounded-2xl p-5 hover:border-accent/30 transition-all relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-full h-1 ${p.quantidade_atual === 0 ? 'bg-red-500' : p.quantidade_atual <= p.estoque_minimo ? 'bg-orange-500' : 'bg-accent/20 group-hover:bg-accent'} transition-colors`} />
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="text-sm font-bold text-foreground uppercase truncate">{p.nome}</h3>
                    {p.codigo_barras && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{p.codigo_barras}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/30 px-2 py-0.5 rounded border border-border">{p.categoria}</span>
                  {p.localizacao && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />{p.localizacao}
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-lg font-bold ${p.quantidade_atual === 0 ? 'text-red-500' : p.quantidade_atual <= p.estoque_minimo ? 'text-orange-500' : 'text-foreground'}`}>
                      {p.quantidade_atual} <span className="text-xs text-muted-foreground">{p.unidade}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">mín: {p.estoque_minimo}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${p.quantidade_atual === 0 ? 'bg-red-500' : p.quantidade_atual <= p.estoque_minimo ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="border-t border-border pt-3 flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEntry(p)} className="h-7 rounded-lg hover:bg-green-500/10 text-green-500 text-xs font-bold" data-testid={`button-entry-product-${p.id}`}>
                    <ArrowDownRight className="w-3.5 h-3.5 mr-1" /> Entrada
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(p)} className="h-7 rounded-lg hover:bg-muted/50 text-muted-foreground text-xs font-bold" data-testid={`button-edit-product-${p.id}`}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmProduct(p)} className="h-7 w-7 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500" data-testid={`button-delete-product-grid-${p.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredProducts.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-bold">Nenhum produto encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros ou busca</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" className="rounded-xl" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
            Início
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-muted-foreground px-3">
            Página {currentPage} de {totalPages}
          </span>
          <Button variant="outline" size="sm" className="rounded-xl" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
            Fim
          </Button>
        </div>
      )}

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-green-500" /> Registrar Entrada
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Informe a quantidade de entrada</DialogDescription>
          </DialogHeader>
          {entryProduct && (
            <div className="space-y-4 mt-4">
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                <p className="font-bold text-foreground">{entryProduct.nome}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Estoque atual: {entryProduct.quantidade_atual} {entryProduct.unidade} · Endereço: {entryProduct.localizacao || 'N/A'}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Quantidade</Label>
                <Input type="number" min="1" value={entryQuantity} onChange={e => setEntryQuantity(Number(e.target.value))} className="bg-muted/30 border-border h-11 rounded-xl text-center text-lg font-bold" data-testid="input-entry-quantity" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Observação (NF, motivo...)</Label>
                <Input value={entryObservacao} onChange={e => setEntryObservacao(e.target.value)} placeholder="NF, motivo..." className="bg-muted/30 border-border h-11 rounded-xl" data-testid="input-entry-observacao" />
              </div>
              <Button onClick={handleEntrySubmit} disabled={createMovement.isPending} className="w-full h-11 bg-green-600 text-white hover:bg-green-700 font-bold rounded-xl" data-testid="button-confirm-entry">
                <Plus className="w-4 h-4 mr-2" /> CONFIRMAR ENTRADA
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmProduct} onOpenChange={(open) => { if (!open) setDeleteConfirmProduct(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" /> Excluir Produto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Esta acao nao pode ser desfeita</DialogDescription>
          </DialogHeader>
          {deleteConfirmProduct && (
            <div className="space-y-4 mt-2">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <p className="font-bold text-foreground">{deleteConfirmProduct.nome}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Categoria: {deleteConfirmProduct.categoria} · Estoque: {deleteConfirmProduct.quantidade_atual} {deleteConfirmProduct.unidade}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirmProduct(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteProduct}
                  disabled={deleteProduct.isPending}
                  className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold rounded-xl"
                  data-testid="button-confirm-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteProduct.isPending ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
