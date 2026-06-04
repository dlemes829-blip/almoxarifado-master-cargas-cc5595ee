import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useCreateMovement } from "@/hooks/use-movements";
import { useProducts } from "@/hooks/use-products";
import { useResponsaveis } from "@/hooks/use-responsaveis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowUpRight, ArrowDownRight, Search, Camera, Minus, Plus, X, ScanBarcode,
  CheckCircle2, AlertCircle, Package, User, FileText, Loader2, Smartphone,
  Keyboard, History, ChevronDown, ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ==========================================
// UTILITÁRIOS
// ==========================================

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
// MAPAS DE CORES - CORREÇÃO DO BUG TAILWIND
// NUNCA use `bg-${cor}-500` - sempre use mapas completos
// ==========================================

const THEME_MAP = {
  saida: {
    bg: "bg-red-600",
    bgLight: "bg-red-500/10",
    bgDark: "bg-red-600/20",
    border: "border-red-500",
    borderLight: "border-red-500/20",
    borderMedium: "border-red-500/30",
    text: "text-red-500",
    textLight: "text-red-600",
    hover: "hover:bg-red-700",
    hoverLight: "hover:bg-red-500/10",
    hoverBorder: "hover:border-red-500/30",
    shadow: "shadow-red-500/20",
    shadowButton: "shadow-red-500/25",
    ring: "ring-red-500",
    gradient: "from-red-600 to-red-700",
    scanLine: "bg-red-500",
    scanShadow: "shadow-[0_0_10px_rgba(239,68,68,0.8)]",
  },
  entrada: {
    bg: "bg-green-600",
    bgLight: "bg-green-500/10",
    bgDark: "bg-green-600/20",
    border: "border-green-500",
    borderLight: "border-green-500/20",
    borderMedium: "border-green-500/30",
    text: "text-green-500",
    textLight: "text-green-600",
    hover: "hover:bg-green-700",
    hoverLight: "hover:bg-green-500/10",
    hoverBorder: "hover:border-green-500/30",
    shadow: "shadow-green-500/20",
    shadowButton: "shadow-green-500/25",
    ring: "ring-green-500",
    gradient: "from-green-600 to-green-700",
    scanLine: "bg-green-500",
    scanShadow: "shadow-[0_0_10px_rgba(34,197,94,0.8)]",
  }
} as const;

type MovementMode = "saida" | "entrada";

interface Product {
  id: number;
  nome: string;
  codigo_barras?: string;
  quantidade_atual: number;
  unidade: string;
  localizacao?: string;
  ativo: boolean;
}

interface Responsavel {
  id: number;
  nome: string;
  setor: string;
  ativo: boolean;
}

interface RecentMovement {
  id: string;
  productName: string;
  type: MovementMode;
  quantity: number;
  timestamp: number;
}

// ==========================================
// HOOK: DETECTOR DE DISPOSITIVO
// ==========================================

function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasCamera: false,
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isFirefox: false,
  });

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent;
      const width = window.innerWidth;
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || width < 768;
      const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua) || (width >= 768 && width < 1024);
      const isDesktop = !isMobile && !isTablet;
      
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isAndroid = /Android/.test(ua);
      
      const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
      const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
      const isFirefox = /Firefox/.test(ua);
      
      const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

      setDeviceInfo({
        isMobile, isTablet, isDesktop, hasCamera,
        isIOS, isAndroid, isSafari, isChrome, isFirefox
      });
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return deviceInfo;
}

// ==========================================
// COMPONENTE: SCANNER MODAL CORRIGIDO
// ==========================================

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
  mode: MovementMode;
}

function ScannerModal({ isOpen, onClose, onDetect, mode }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");

  const theme = THEME_MAP[mode];

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    setError(null);
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Navegador não suporta câmera");
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsScanning(true);
      
      scanIntervalRef.current = setInterval(() => {
        // Placeholder para detecção real - integrar com Quagga2/ZXing
      }, 200);

    } catch (err: any) {
      console.error("Erro câmera:", err);
      setError(err.message || "Erro ao acessar câmera");
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(startScanning, 300);
      return () => {
        clearTimeout(timer);
        stopScanning();
      };
    } else {
      stopScanning();
    }
  }, [isOpen, startScanning, stopScanning]);

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onDetect(manualInput.trim());
      setManualInput("");
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", theme.bgDark)}>
            <ScanBarcode className={cn("w-5 h-5", theme.text)} />
          </div>
          <div>
            <h2 className="text-white font-bold">Escanear Código</h2>
            <p className="text-white/60 text-sm">Posicione o código de barras na área indicada</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 rounded-full w-10 h-10"
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Área do Scanner */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {isScanning && !error ? (
          <div className={cn(
            "relative w-full max-w-lg aspect-[4/3] bg-black rounded-2xl overflow-hidden border-2",
            theme.borderMedium
          )}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className={cn("absolute inset-8 border-2 rounded-2xl", theme.borderMedium)}>
                <div className={cn("absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl", theme.border)} />
                <div className={cn("absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl", theme.border)} />
                <div className={cn("absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl", theme.border)} />
                <div className={cn("absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl", theme.border)} />
              </div>
              
              {/* Linha de scan */}
              <motion.div
                animate={{ top: ["20%", "80%", "20%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className={cn("absolute left-8 right-8 h-0.5", theme.scanLine, theme.scanShadow)}
              />
              
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white/80 text-sm font-medium bg-black/50 inline-block px-4 py-2 rounded-full">
                  Alinhe o código de barras dentro da moldura
                </p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center p-8">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">Câmera indisponível</h3>
            <p className="text-white/60 mb-6 max-w-sm">{error}</p>
            
            <div className="bg-white/10 rounded-2xl p-6 max-w-sm w-full">
              <Label className="text-white/80 text-sm mb-2 block">Digite o código manualmente:</Label>
              <div className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Código de barras..."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  autoFocus
                />
                <Button onClick={handleManualSubmit} className={theme.bg}>
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <p className="text-white/60">Iniciando câmera...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-black/50 backdrop-blur-md border-t border-white/10">
        <div className="flex items-center justify-center gap-6 text-white/60 text-sm">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span>Mantenha estável</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span>Boa iluminação</span>
          </div>
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            <span>ou digite manualmente</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTE: CARD DE PRODUTO CORRIGIDO
// ==========================================

function ProductCard({ 
  product, 
  mode, 
  onClear 
}: { 
  product: Product; 
  mode: MovementMode; 
  onClear: () => void;
}) {
  const theme = THEME_MAP[mode];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("rounded-2xl p-4", theme.bgLight, theme.borderLight)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Package className={cn("w-4 h-4", theme.text)} />
            <span className={cn("text-xs font-bold uppercase", theme.text)}>
              Produto Selecionado
            </span>
          </div>
          <h3 className="font-bold text-foreground text-lg truncate">{product.nome}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="font-medium">Estoque:</span>
              <span className={cn(
                "font-bold",
                product.quantidade_atual <= 5 ? "text-red-500" : "text-green-600"
              )}>
                {product.quantidade_atual} {product.unidade}
              </span>
            </span>
            {product.localizacao && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Local:</span>
                {product.localizacao}
              </span>
            )}
            {product.codigo_barras && (
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {product.codigo_barras}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onClear}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTE: HISTÓRICO RÁPIDO
// ==========================================

function QuickHistory({ 
  movements, 
  onRepeat 
}: { 
  movements: RecentMovement[];
  onRepeat: (movement: RecentMovement) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (movements.length === 0) return null;

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Movimentações Recentes</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {movements.length}
          </span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
              {movements.map((mov) => {
                const movTheme = THEME_MAP[mov.type];
                return (
                  <button
                    key={mov.id}
                    onClick={() => onRepeat(mov)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", movTheme.bgLight, movTheme.text)}>
                        {mov.type === "saida" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm truncate max-w-[150px]">{mov.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(mov.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-sm">{mov.quantity} un</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL: MOVE

// ==========================================
// COMPONENTE PRINCIPAL: MOVEMENTS v2.0
// ==========================================

export default function Movements() {
  const { data: products = [] } = useProducts();
  const { data: responsaveis = [] } = useResponsaveis();
  const createMovement = useCreateMovement();
  const { toast } = useToast();
  const deviceInfo = useDeviceInfo();

  // Estados
  const [mode, setMode] = useState<MovementMode>("saida");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [responsavelId, setResponsavelId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Memoização de produtos filtrados
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const search = productSearch.toLowerCase();
    return products.filter(p => 
      p.ativo && (
        p.nome.toLowerCase().includes(search) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(search))
      )
    ).slice(0, 10); // Limitar a 10 resultados para performance
  }, [productSearch, products]);

  const selectedProduct = useMemo(() => 
    products.find(p => p.id === selectedProductId),
    [selectedProductId, products]
  );

  const isSaida = mode === "saida";
  const accentColor = isSaida ? "red" : "green";

  // Handlers otimizados
  const handleBarcodeDetect = useCallback((code: string) => {
    // Procurar produto pelo código
    const product = products.find(p => p.codigo_barras === code);
    
    if (product) {
      setSelectedProductId(product.id);
      setProductSearch(product.nome);
      toast({ 
        title: "✅ Produto encontrado!", 
        description: product.nome,
        duration: 2000
      });
      // Focar no input de quantidade após scan
      setTimeout(() => quantityInputRef.current?.focus(), 100);
    } else {
      setProductSearch(code);
      toast({ 
        title: "⚠️ Código não cadastrado", 
        description: `Código ${code} não encontrado no sistema`,
        variant: "destructive",
        duration: 3000
      });
    }
    setShowScanner(false);
  }, [products, toast]);

  const resetForm = useCallback(() => {
    setSelectedProductId(null);
    setProductSearch("");
    setQuantidade(1);
    setResponsavelId("");
    setObservacao("");
    searchInputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedProductId) {
      toast({ title: "Erro", description: "Selecione um produto", variant: "destructive" });
      return;
    }
    if (quantidade <= 0) {
      toast({ title: "Erro", description: "Quantidade inválida", variant: "destructive" });
      return;
    }
    if (isSaida && !responsavelId) {
      toast({ title: "Erro", description: "Selecione um responsável", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createMovement.mutateAsync({
        produto_id: selectedProductId,
        tipo: mode,
        quantidade,
        responsavel_id: isSaida && responsavelId ? Number(responsavelId) : undefined,
        observacao: observacao || undefined,
      });

      // Adicionar ao histórico
      const newMovement: RecentMovement = {
        id: Date.now().toString(),
        productName: selectedProduct?.nome || "Produto",
        type: mode,
        quantity: quantidade,
        timestamp: Date.now()
      };
      setRecentMovements(prev => [newMovement, ...prev].slice(0, 5));

      toast({
        title: "✅ Sucesso!",
        description: isSaida ? "Saída registrada com sucesso" : "Entrada registrada com sucesso",
        duration: 3000
      });
      
      resetForm();
    } catch (err: any) {
      toast({ 
        title: "❌ Erro", 
        description: err.message || "Falha ao registrar movimentação", 
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedProductId, quantidade, mode, isSaida, responsavelId, observacao, selectedProduct, createMovement, toast, resetForm]);

  const handleRepeatMovement = useCallback((mov: RecentMovement) => {
    const product = products.find(p => p.nome === mov.productName);
    if (product) {
      setMode(mov.type);
      setSelectedProductId(product.id);
      setProductSearch(product.nome);
      setQuantidade(mov.quantity);
      toast({ title: "Movimentação carregada", description: `Repetindo: ${mov.productName}` });
    }
  }, [products, toast]);

  // Efeito de focus inicial
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC fecha scanner
      if (e.key === 'Escape' && showScanner) {
        setShowScanner(false);
      }
      // Ctrl/Cmd + Enter envia formulário
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && selectedProductId) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showScanner, selectedProductId, handleSubmit]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-safe">
      {/* Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <ScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onDetect={handleBarcodeDetect}
            mode={mode}
          />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header Responsivo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
            isSaida ? 'bg-red-600/20' : 'bg-green-600/20'
          )}>
            {isSaida
              ? <ArrowUpRight className="w-7 h-7 text-red-500" />
              : <ArrowDownRight className="w-7 h-7 text-green-500" />
            }
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">
              {isSaida ? "Saída de Materiais" : "Entrada de Materiais"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground uppercase font-bold tracking-wider">
              {isSaida ? "Retirada do Estoque" : "Abastecimento do Estoque"}
            </p>
          </div>
        </motion.div>

        {/* Seletor de Modo */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            className={cn(
              "rounded-2xl p-4 border-2 text-center font-bold uppercase tracking-wider text-sm transition-all duration-200",
              "active:scale-95 touch-manipulation",
              mode === "entrada"
                ? "bg-green-500/10 border-green-500 text-green-600 shadow-lg shadow-green-500/20"
                : "bg-card border-border text-muted-foreground hover:border-green-500/30 hover:bg-green-500/5"
            )}
            onClick={() => { setMode("entrada"); resetForm(); }}
          >
            <ArrowDownRight className="w-6 h-6 mx-auto mb-2" />
            <span className="hidden sm:inline">Entrada</span>
            <span className="sm:hidden">Entrada</span>
          </button>
          <button
            className={cn(
              "rounded-2xl p-4 border-2 text-center font-bold uppercase tracking-wider text-sm transition-all duration-200",
              "active:scale-95 touch-manipulation",
              mode === "saida"
                ? "bg-red-500/10 border-red-500 text-red-600 shadow-lg shadow-red-500/20"
                : "bg-card border-border text-muted-foreground hover:border-red-500/30 hover:bg-red-500/5"
            )}
            onClick={() => { setMode("saida"); resetForm(); }}
          >
            <ArrowUpRight className="w-6 h-6 mx-auto mb-2" />
            <span className="hidden sm:inline">Saída</span>
            <span className="sm:hidden">Saída</span>
          </button>
        </motion.div>

        {/* Histórico Rápido */}
        <QuickHistory movements={recentMovements} onRepeat={handleRepeatMovement} />

        {/* Formulário Principal */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "bg-card rounded-3xl border-2 shadow-xl overflow-hidden",
            isSaida ? 'border-red-500/20' : 'border-green-500/20'
          )}
        >
          <div className="p-4 sm:p-6 space-y-6">
            
            {/* Busca de Produto */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Package className="w-3 h-3" />
                Produto
              </Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  value={selectedProduct ? selectedProduct.nome : productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setSelectedProductId(null);
                  }}
                  placeholder="Nome ou código de barras..."
                  className="bg-muted/50 border-0 rounded-2xl pl-12 pr-14 h-14 text-base"
                  disabled={!!selectedProduct}
                />
                
                {/* Botão da câmera (se disponível) */}
                {(deviceInfo.hasCamera || true) && ( // '|| true' para sempre mostrar em dev
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl transition-colors",
                      isSaida 
                        ? 'text-red-500 hover:bg-red-500/10' 
                        : 'text-green-500 hover:bg-green-500/10'
                    )}
                    onClick={() => setShowScanner(true)}
                    title="Escanear código de barras"
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {/* Dropdown de resultados */}
              <AnimatePresence>
                {filteredProducts.length > 0 && !selectedProductId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-card border border-border rounded-2xl mt-2 overflow-hidden shadow-lg"
                  >
                    <div className="max-h-56 overflow-y-auto">
                      {filteredProducts.map((p, idx) => (
                        <button
                          key={p.id}
                          className={cn(
                            "w-full text-left px-4 py-3 flex items-center justify-between transition-colors",
                            idx !== filteredProducts.length - 1 && "border-b border-border/50",
                            "hover:bg-muted/50 active:bg-muted"
                          )}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setProductSearch(p.nome);
                            setTimeout(() => quantityInputRef.current?.focus(), 100);
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-foreground text-sm truncate">{p.nome}</p>
                            {p.codigo_barras && (
                              <p className="text-xs text-muted-foreground font-mono">{p.codigo_barras}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-xs font-medium text-muted-foreground">
                              Est: <span className={cn(
                                "font-bold",
                                p.quantidade_atual <= 5 ? "text-red-500" : "text-green-600"
                              )}>{p.quantidade_atual}</span> {p.unidade}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Card do produto selecionado */}
              <AnimatePresence mode="wait">
                {selectedProduct && (
                  <ProductCard 
                    product={selectedProduct} 
                    mode={mode} 
                    onClear={() => { setSelectedProductId(null); setProductSearch(""); }}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Grid de Quantidade e Responsável */}
            <div className={cn(
              "grid gap-4",
              isSaida ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
            )}>
              {/* Quantidade */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Quantidade
                </Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      ref={quantityInputRef}
                      type="number"
                      min="1"
                      value={quantidade}
                      onChange={e => setQuantidade(Math.max(1, Number(e.target.value)))}
                      className="bg-muted/50 border-0 rounded-2xl h-14 text-center text-2xl font-bold"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                      <button
                        onClick={() => setQuantidade(q => q + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-muted-foreground uppercase shrink-0">
                    {selectedProduct?.unidade || "UNID"}
                  </span>
                </div>
              </div>

              {/* Responsável (apenas saída) */}
              {isSaida && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="w-3 h-3" />
                    Responsável / Destino
                  </Label>
                  <Select value={responsavelId} onValueChange={setResponsavelId}>
                    <SelectTrigger className="bg-muted/50 border-0 rounded-2xl h-14">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {responsaveis.filter(r => r.ativo).map(r => (
                        <SelectItem key={r.id} value={r.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{r.nome}</span>
                            <span className="text-xs text-muted-foreground">{r.setor}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Observação (opcional)
              </Label>
              <Input
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder={isSaida ? "Motivo da saída, NF, etc..." : "NF de entrada, lote, etc..."}
                className="bg-muted/50 border-0 rounded-2xl h-14"
              />
            </div>

            {/* Botão de Submit */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedProductId || (isSaida && !responsavelId)}
              className={cn(
                "w-full h-16 rounded-2xl font-bold uppercase tracking-wider text-lg border-2 transition-all duration-200",
                "active:scale-[0.98] touch-manipulation",
                isSaida
                  ? "bg-red-600 hover:bg-red-700 border-red-500 text-white shadow-lg shadow-red-500/25 disabled:shadow-none"
                  : "bg-green-600 hover:bg-green-700 border-green-500 text-white shadow-lg shadow-green-500/25 disabled:shadow-none",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {isSaida ? <ArrowUpRight className="w-5 h-5 mr-2" /> : <ArrowDownRight className="w-5 h-5 mr-2" />}
                  Confirmar {isSaida ? "Saída" : "Entrada"}
                </>
              )}
            </Button>

            {/* Dica de atalho */}
            <p className="text-center text-xs text-muted-foreground">
              Pressione <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl</kbd> + <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Enter</kbd> para confirmar rapidamente
            </p>
          </div>
        </motion.div>

        {/* Info de compatibilidade (apenas em desenvolvimento) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground/50 text-center space-y-1">
            <p>Device: {deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop'}</p>
            <p>Camera: {deviceInfo.hasCamera ? 'Disponível' : 'Indisponível'}</p>
            <p>Browser: {deviceInfo.isChrome ? 'Chrome' : deviceInfo.isSafari ? 'Safari' : deviceInfo.isFirefox ? 'Firefox' : 'Outro'}</p>
          </div>
        )}
      </div>
    </div>
  );
}