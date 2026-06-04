import { useState, useMemo } from "react";
import { useProducts } from "@/hooks/use-products";
import { useMovements } from "@/hooks/use-movements";
import { useUsers } from "@/hooks/use-users";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileBarChart, FileText, Table, Download, Calendar, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ReportType = "inventario" | "movimentacoes" | "baixo_estoque";
type ExportFormat = "pdf" | "excel";

export default function Relatorios() {
  const { data: products = [] } = useProducts();
  const { data: movements = [] } = useMovements();
  const { data: users = [] } = useUsers();
  const { toast } = useToast();
  const { sendMessage } = useWebSocket();

  const [reportType, setReportType] = useState<ReportType>("inventario");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("TODOS");

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.categoria))).sort();
    return cats;
  }, [products]);

  const getProductName = (id: number) => products.find(p => p.id === id)?.nome || `#${id}`;
  const getProductLocation = (id: number) => products.find(p => p.id === id)?.localizacao || "";
  const getUserName = (id: number) => users.find(u => u.id === id)?.username || `#${id}`;

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "TODOS") return products;
    return products.filter(p => p.categoria === selectedCategory);
  }, [products, selectedCategory]);

  const generatePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    
    const doc = new jsPDF();
    const now = new Date();
    
    doc.setFontSize(18);
    doc.text("Master Cargas Brasil", 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(now, "dd/MM/yyyy HH:mm")}`, 14, 30);
    if (selectedCategory !== "TODOS") {
      doc.text(`Categoria: ${selectedCategory}`, 14, 36);
    }

    if (reportType === "inventario") {
      doc.setFontSize(14);
      doc.text(`Relatório de Inventário${selectedCategory !== "TODOS" ? ` - ${selectedCategory}` : ""}`, 14, selectedCategory !== "TODOS" ? 46 : 42);
      
      autoTable(doc, {
        startY: selectedCategory !== "TODOS" ? 52 : 48,
        head: [["#", "Produto", "Categoria", "Endereço", "Estoque", "Unidade", "Mínimo", "Status"]],
        body: filteredProducts.map((p, i) => [
          i + 1,
          p.nome,
          p.categoria,
          p.localizacao || "-",
          p.quantidade_atual,
          p.unidade,
          p.estoque_minimo,
          p.quantidade_atual <= p.estoque_minimo ? "BAIXO" : "OK"
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [34, 120, 60] },
      });
    } else if (reportType === "movimentacoes") {
      doc.setFontSize(14);
      doc.text(`Relatório de Movimentações${selectedCategory !== "TODOS" ? ` - ${selectedCategory}` : ""}`, 14, selectedCategory !== "TODOS" ? 46 : 42);
      
      let filtered = [...movements];
      if (dateFrom) filtered = filtered.filter(m => m.data_hora && new Date(m.data_hora) >= new Date(dateFrom));
      if (dateTo) filtered = filtered.filter(m => m.data_hora && new Date(m.data_hora) <= new Date(dateTo + "T23:59:59"));
      if (selectedCategory !== "TODOS") {
        const catProductIds = new Set(filteredProducts.map(p => p.id));
        filtered = filtered.filter(m => catProductIds.has(m.produto_id));
      }

      autoTable(doc, {
        startY: selectedCategory !== "TODOS" ? 52 : 48,
        head: [["Data", "Tipo", "Produto", "Endereço", "Qtd", "Usuário"]],
        body: filtered.map(m => [
          m.data_hora ? format(new Date(m.data_hora), "dd/MM/yyyy HH:mm") : "-",
          m.tipo === "entrada" ? "ENTRADA" : "SAÍDA",
          getProductName(m.produto_id),
          getProductLocation(m.produto_id) || "-",
          m.quantidade,
          getUserName(m.usuario_id),
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [34, 120, 60] },
      });
    } else {
      doc.setFontSize(14);
      doc.text(`Relatório de Baixo Estoque${selectedCategory !== "TODOS" ? ` - ${selectedCategory}` : ""}`, 14, selectedCategory !== "TODOS" ? 46 : 42);
      
      const lowStock = filteredProducts.filter(p => p.quantidade_atual <= p.estoque_minimo);
      autoTable(doc, {
        startY: selectedCategory !== "TODOS" ? 52 : 48,
        head: [["Produto", "Categoria", "Endereço", "Estoque Atual", "Estoque Mínimo", "Diferença"]],
        body: lowStock.map(p => [
          p.nome,
          p.categoria,
          p.localizacao || "-",
          p.quantidade_atual,
          p.estoque_minimo,
          p.quantidade_atual - p.estoque_minimo,
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [180, 40, 40] },
      });
    }

    doc.save(`relatorio_${reportType}_${selectedCategory !== "TODOS" ? selectedCategory + "_" : ""}${format(now, "yyyyMMdd")}.pdf`);
    toast({ title: "Sucesso", description: "PDF gerado com sucesso!" });
  };

  const generateExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const now = new Date();

    if (reportType === "inventario") {
      const data = filteredProducts.map((p, i) => ({
        "#": i + 1,
        "Produto": p.nome,
        "Categoria": p.categoria,
        "Endereço": p.localizacao || "-",
        "Estoque": p.quantidade_atual,
        "Unidade": p.unidade,
        "Mínimo": p.estoque_minimo,
        "Status": p.quantidade_atual <= p.estoque_minimo ? "BAIXO" : "OK",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Inventário");
    } else if (reportType === "movimentacoes") {
      let filtered = [...movements];
      if (dateFrom) filtered = filtered.filter(m => m.data_hora && new Date(m.data_hora) >= new Date(dateFrom));
      if (dateTo) filtered = filtered.filter(m => m.data_hora && new Date(m.data_hora) <= new Date(dateTo + "T23:59:59"));
      if (selectedCategory !== "TODOS") {
        const catProductIds = new Set(filteredProducts.map(p => p.id));
        filtered = filtered.filter(m => catProductIds.has(m.produto_id));
      }
      
      const data = filtered.map(m => ({
        "Data": m.data_hora ? format(new Date(m.data_hora), "dd/MM/yyyy HH:mm") : "-",
        "Tipo": m.tipo === "entrada" ? "ENTRADA" : "SAÍDA",
        "Produto": getProductName(m.produto_id),
        "Endereço": getProductLocation(m.produto_id) || "-",
        "Quantidade": m.quantidade,
        "Usuário": getUserName(m.usuario_id),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    } else {
      const lowStock = filteredProducts.filter(p => p.quantidade_atual <= p.estoque_minimo);
      const data = lowStock.map(p => ({
        "Produto": p.nome,
        "Categoria": p.categoria,
        "Endereço": p.localizacao || "-",
        "Estoque Atual": p.quantidade_atual,
        "Estoque Mínimo": p.estoque_minimo,
        "Diferença": p.quantidade_atual - p.estoque_minimo,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Baixo Estoque");
    }

    XLSX.writeFile(wb, `relatorio_${reportType}_${selectedCategory !== "TODOS" ? selectedCategory + "_" : ""}${format(now, "yyyyMMdd")}.xlsx`);
    toast({ title: "Sucesso", description: "Excel gerado com sucesso!" });
  };

  const reportLabels: Record<string, string> = {
    inventario: "Inventário Completo",
    movimentacoes: "Movimentações",
    baixo_estoque: "Baixo Estoque",
  };

  const handleGenerate = () => {
    if (exportFormat === "pdf") generatePDF();
    else generateExcel();
    
    const storedUser = localStorage.getItem("user");
    const username = storedUser ? JSON.parse(storedUser).username : "Alguém";
    sendMessage("report_generated", {
      username,
      reportName: `${reportLabels[reportType]} (${exportFormat.toUpperCase()})`,
    });
  };

  const reports = [
    { id: "inventario" as ReportType, label: "Inventário Completo", desc: "Todos os produtos e quantidades", icon: Table },
    { id: "movimentacoes" as ReportType, label: "Movimentações", desc: "Entradas e saídas por período", icon: FileBarChart },
    { id: "baixo_estoque" as ReportType, label: "Baixo Estoque", desc: "Produtos abaixo do mínimo", icon: FileText },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <FileBarChart className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight italic" data-testid="text-relatorios-title">
            Gerar Relatórios
          </h1>
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            EXPORTE DADOS EM PDF OU EXCEL
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {reports.map(r => (
          <button
            key={r.id}
            data-testid={`report-type-${r.id}`}
            className={`rounded-xl p-5 border-2 text-left transition-all ${
              reportType === r.id
                ? "bg-accent/10 border-accent"
                : "bg-card border-border hover:border-accent/30"
            }`}
            onClick={() => setReportType(r.id)}
          >
            <r.icon className={`w-6 h-6 mb-2 ${reportType === r.id ? 'text-accent' : 'text-muted-foreground'}`} />
            <p className="font-bold text-foreground text-sm">{r.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Filter className="w-4 h-4" /> CATEGORIA
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "TODOS" ? "default" : "outline"}
            size="sm"
            className={`rounded-lg text-xs font-bold ${selectedCategory === "TODOS" ? 'bg-accent text-accent-foreground' : 'border-border'}`}
            onClick={() => setSelectedCategory("TODOS")}
            data-testid="cat-todos"
          >
            TODOS
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              className={`rounded-lg text-xs font-bold ${selectedCategory === cat ? 'bg-accent text-accent-foreground' : 'border-border'}`}
              onClick={() => setSelectedCategory(cat)}
              data-testid={`cat-${cat}`}
            >
              {cat}
            </Button>
          ))}
        </div>
        {selectedCategory !== "TODOS" && (
          <p className="text-[10px] text-accent font-bold uppercase tracking-wider">
            {filteredProducts.length} produtos na categoria {selectedCategory}
          </p>
        )}
      </div>

      {reportType === "movimentacoes" && (
        <div className="glass-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            <Calendar className="w-4 h-4" /> PERÍODO
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-bold">Data Início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-muted/30 border-border rounded-xl"
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-bold">Data Fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-muted/30 border-border rounded-xl"
                data-testid="input-date-to"
              />
            </div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          <Download className="w-4 h-4" /> FORMATO DE EXPORTAÇÃO
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            data-testid="format-pdf"
            className={`rounded-xl p-4 border-2 text-center transition-all ${
              exportFormat === "pdf"
                ? "bg-red-500/10 border-red-500/50 text-red-400"
                : "bg-card border-border text-muted-foreground hover:border-red-500/30"
            }`}
            onClick={() => setExportFormat("pdf")}
          >
            <FileText className="w-8 h-8 mx-auto mb-1" />
            <p className="font-bold text-sm">PDF</p>
          </button>
          <button
            data-testid="format-excel"
            className={`rounded-xl p-4 border-2 text-center transition-all ${
              exportFormat === "excel"
                ? "bg-green-500/10 border-green-500/50 text-green-400"
                : "bg-card border-border text-muted-foreground hover:border-green-500/30"
            }`}
            onClick={() => setExportFormat("excel")}
          >
            <Table className="w-8 h-8 mx-auto mb-1" />
            <p className="font-bold text-sm">Excel</p>
          </button>
        </div>
      </div>

      <Button
        className="w-full h-14 rounded-xl bg-accent text-accent-foreground font-bold uppercase tracking-wider text-lg"
        onClick={handleGenerate}
        data-testid="button-generate-report"
      >
        <Download className="w-5 h-5 mr-2" />
        GERAR RELATÓRIO
      </Button>
    </div>
  );
}
