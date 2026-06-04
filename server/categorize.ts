export function categorizeProduct(nome: string): { categoria: string; estoque_minimo: number } {
  const n = nome.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (matchesLimpeza(n)) return { categoria: "LIMPEZA", estoque_minimo: getMinStockLimpeza(n) };
  if (matchesEPI(n)) return { categoria: "EPI", estoque_minimo: getMinStockEPI(n) };
  if (matchesAlimentos(n)) return { categoria: "ALIMENTOS", estoque_minimo: getMinStockAlimentos(n) };
  if (matchesAdministrativo(n)) return { categoria: "ADMINISTRATIVO", estoque_minimo: getMinStockAdmin(n) };
  if (matchesManutencaoPredial(n)) return { categoria: "MANUTENÇÃO PREDIAL", estoque_minimo: getMinStockManutPredial(n) };
  if (matchesManutencao(n)) return { categoria: "MANUTENÇÃO", estoque_minimo: getMinStockManut(n) };
  if (matchesDAF(n)) return { categoria: "DAF", estoque_minimo: 2 };

  return { categoria: "OUTROS", estoque_minimo: 2 };
}

function matchesLimpeza(n: string): boolean {
  const keywords = [
    "LIMPEZA", "MOP", "VASSOURA", "VASSOURAO", "RODO", "ESCOVA", "ESPONJA",
    "DETERGENTE", "DESINFETANTE", "AGUA SANITARIA", "SABAO ", "SABAO EM", "SAPONACEO",
    "SAPOL", "VEJA ", "LUSTRA MOVEIS", "LIMPA VIDRO", "LIMPADOR", "CERA LIQUIDA",
    "PANO DE PRATO", "PANO LIMPEZA", "SACO DE LIXO", "LIXEIRA", "CESTO DE PAPEL",
    "PAPEL HIGIENICO", "TOALHA DE PAPEL", "FOLHA DE PAPEL LIFE", "SABONETE LIQUIDO",
    "ALCOOL 70", "ALCOOL EM GEL", "GEL ANTISSEPTICO", "DESENTUPIDOR", "ESCOVAO",
    "PURO AR", "ODORIZANTE", "PASTILHA ADESIVA", "BLOCO PARA CAIXA ACOPLADA",
    "TABLETE PARA CAIXA", "MULTI INSETICIDA", "DIABO VERDE", "PULVERIZADOR",
    "BORRIFADOR", "CABO DE VASSOURA", "CABO DE RODO", "ARMACAO BRALIMPIA",
    "PA PLASTICO", "PLACA PISO MOLHADO", "PORTA PAPEL", "PORTA SABONETE",
    "FIBRA 260", "LIMPEZA LEVE", "LIMPEZA GERAL", "BIO KRISS", "BIO PISO",
    "MULTIUSO", "ESCOVA SANITARIA", "SECADOR DE MAOS", "PRENDEDOR DE ROUPAS",
    "COADOR DE CAFE", "FILME DE PVC", "GUARDANAPO", "COPO PLASTICO",
    "COPO DESCARTAVEL", "POTE RET", "VORAX", "TBI CLEANER", "DESENGRAXANTE",
    "REFIL MOP", "SUPORTE PLASTICO PARA FIBRA", "MOX PO",
    "CATALISADOR DE PISO", "LAVA LOUCAS", "LIMPA ", "PERFECT CLEAN"
  ];
  return keywords.some(k => n.includes(k));
}

function matchesEPI(n: string): boolean {
  const keywords = [
    "BOTINA", "LUVA ", "LUVAS ", "CAPACETE", "OCULOS DE SEGURANCA",
    "PROTETOR AURIC", "PROTETOR FACIAL", "PROTETOR SOLAR", "REPELENTE",
    "COLETE REFLETIVO", "CONJUNTO IMPERMEAVEL", "CONJUNTO POLIETILENO",
    "AVENTAL DE PVC", "RESPIRADOR", "CAMISETA MASTER", "CAMISETA VERDE",
    "CALCA UNIFORME", "CALCA MASTER", "SUSPENSAO PARA CAPACETE",
    "KIT PARA TRABALHO EM ALTURA", "KIT PARA CAPACETE", "KIT ACOPLADOR",
    "PLUG SILICONE", "PROTECAO INTENSIVA", "HELP HAND", "EAR MUFF",
    "ACESSORIO BRIGADA", "PROTETOR DE PARA-CHOQUE",
    "VAPORES ORGANICOS", "PFF 2", "SUPORTE PARA CAPACETE"
  ];
  return keywords.some(k => n.includes(k));
}

function matchesAlimentos(n: string): boolean {
  const keywords = [
    "ACUCAR", "CAFE ", "ADOCANTE", "AGUA MINERAL", "GARRAFA TERMICA",
    "CHALEIRA", "FILTRO DE PAPEL", "COADOR", "MICROONDAS"
  ];
  return keywords.some(k => n.includes(k));
}

function matchesAdministrativo(n: string): boolean {
  const keywords = [
    "CANETA", "LAPIS", "BORRACHA", "CLIPS", "GRAMPO", "GRAMPEADOR",
    "TESOURA", "MARCA TEXTO", "MARCADOR", "PINCEL P/ QUADRO", "PINCEL PARA QUADRO",
    "FITA CORRETIVA", "CORRETIVO", "COLA BASTAO", "SUPER BONDER",
    "FITA ADESIVA", "FITA DUPLA FACE", "FITA ECOPACK", "DUREX",
    "PASTA ", "BLOCO DE NOTAS", "PAPEL A4", "PAPEL/CARTA", "REGUA",
    "PRANCHETA", "CARIMBO", "TINTA P/ CARIMBO", "TINTA PARA CARIMBO",
    "TINTA P/CARIMBO", "REABASTECEDOR", "TINTA P/ MARCADOR",
    "APONTADOR", "ALFINETES", "EXTRATOR DE GRAMPOS", "EXTRATOR",
    "CALCULADORA", "CLAVICULARIO", "GIZ ESCOLAR", "ESTILETE",
    "MOUSE", "TECLADO", "MOUSEPAD", "IMPRESSORA",
    "CARTUCHO DE TONER", "TONER", "LASER TONER", "CILINDRO",
    "CAIXA PARA CORRESPONDENCIA", "CAIXA ARQUIVO",
    "ARQUIVO", "CARD HOLDER", "FICHARIO", "FICHEIRO",
    "APOIO ERGO", "SUPORTE PARA NOTEBOOK",
    "APLICADOR DE FITAS", "EXPOSITOR", "QUADRO DE AVISOS",
    "ENVELOPE PLASTICO", "PORTA ALVARA", "SACOLA MASTER",
    "BOBINA ETIQUETA", "RIBBON", "PAPEL MARROM", "PAPEL BRANCO",
    "CABO HDMI", "CABO DE HDMI", "CABO PARA IMPRESSORA",
    "CABO DE ALIMENTACAO", "TELEFONE FIXO",
    "FONTE DE ENERGIA", "ESTABILIZADOR", "FILTRO DE LINHA"
  ];
  return keywords.some(k => n.includes(k));
}

function matchesManutencaoPredial(n: string): boolean {
  const keywords = [
    "LAMPADA", "LED ", "PLAFON", "PAINEL LED", "REFLETOR",
    "TOMADA", "PLACA 4X", "PLACA/INTERRUPTOR", "MODULO TRAMONTINA",
    "DISJUNTOR", "CAIXA DE FORCA", "QUADRO DE DISTRIBUICAO",
    "SENSOR DE PRESENCA", "SENSOR DE BARREIRA", "RELE FOTO",
    "RELE MARGIRIUS", "BASE FOTOCELU", "ILUMINACAO EMERGENCIA",
    "CONECTOR", "FITA ISOLANTE", "FITA VEDA ROSCA",
    "CABO/REDE", "CAIXA DE PASSAGEM", "SUPORTE FIXACAO",
    "FECHADURA", "MACANE", "ABRACADEIRA",
    "TAMPA DE VASO", "REGISTRO DELTA", "SIFAO", "VALVULA TEMPORIZADA",
    "KIT PARA ACESSORIOS PARA BANHEIRO", "SIRENE",
    "CAIXA TOMADA", "CONJUNTO TOMADA", "TP MIDIA",
    "CONVERSOR DE MIDIA", "FONTE POE", "ROTEADOR",
    "EXTENSOR CONVERSOR", "RADIO COMUNICADOR",
    "ADESIVO DE SILICONE", "PU 40 SELANTE", "SELANTE",
    "TAMPA/SETOR", "COTOVELO", "PL 4X", "ENGATE PARA MANGUEIRA",
    "PONTEIRA MANGUEIRA", "CANOS", "PECAS PARA MANUTENCAO",
    "PECA PORTA", "ROLDANA"
  ];
  return keywords.some(k => n.includes(k));
}

function matchesManutencao(n: string): boolean {
  const keywords = [
    "TINTA ACRILICA", "TINTA PARA DEMARCACAO", "ACRILICO FOSCO",
    "THINNER", "DILUENTE", "PRIMER", "CORANTE",
    "ROLO PARA PINTURA", "ROLO DE PINTURA", "PINCEL ATLAS",
    "SUPORTE PARA ROLO", "ESPATULA",
    "ELETRODO", "ARAME FINO", "ABRACADEIRA METAL",
    "FILTRO DE AR", "PNEU PARA CARRINHO", "CAMARA DE AR",
    "OLEO LUBRIFICANTE", "FLUIDO", "CABO METALICO",
    "CABO ESTR", "ESTICADOR", "EXTENSAO TELESCOPICA",
    "MANOPOLA", "MINI DISJUNTOR", "AUTOTRANSFORMADOR",
    "FONTE CARREGADOR"
  ];
  return keywords.some(k => n.includes(k));
}

function matchesDAF(n: string): boolean {
  const keywords = [
    "BOBINAS VARIOS MODELOS / DAF", "DAF"
  ];
  return n.includes("/ DAF") || n.includes("DAF /") || n === "DAF";
}

function getMinStockLimpeza(n: string): number {
  if (n.includes("SACO DE LIXO")) return 5;
  if (n.includes("PAPEL HIGIENICO")) return 3;
  if (n.includes("DESINFETANTE") || n.includes("AGUA SANITARIA")) return 2;
  if (n.includes("DETERGENTE") || n.includes("SABAO ")) return 3;
  if (n.includes("ALCOOL")) return 3;
  if (n.includes("VASSOURA") || n.includes("VASSOURAO") || n.includes("RODO")) return 2;
  if (n.includes("MOP") || n.includes("MOX")) return 2;
  if (n.includes("ESPONJA")) return 5;
  if (n.includes("PANO")) return 3;
  if (n.includes("COPO")) return 3;
  if (n.includes("GUARDANAPO")) return 3;
  return 2;
}

function getMinStockEPI(n: string): number {
  if (n.includes("BOTINA")) return 3;
  if (n.includes("LUVA")) return 3;
  if (n.includes("CAPACETE")) return 2;
  if (n.includes("OCULOS")) return 3;
  if (n.includes("PROTETOR SOLAR") || n.includes("REPELENTE")) return 2;
  if (n.includes("COLETE")) return 2;
  return 2;
}

function getMinStockAlimentos(n: string): number {
  if (n.includes("CAFE")) return 3;
  if (n.includes("ACUCAR")) return 2;
  if (n.includes("AGUA MINERAL")) return 5;
  return 2;
}

function getMinStockAdmin(n: string): number {
  if (n.includes("CANETA") || n.includes("LAPIS")) return 5;
  if (n.includes("PAPEL A4")) return 3;
  if (n.includes("CLIPS") || n.includes("GRAMPO")) return 3;
  if (n.includes("FITA ADESIVA") || n.includes("DUREX")) return 3;
  if (n.includes("TONER") || n.includes("CARTUCHO")) return 2;
  return 2;
}

function getMinStockManutPredial(n: string): number {
  if (n.includes("LAMPADA") || n.includes("LED")) return 5;
  if (n.includes("TOMADA")) return 3;
  if (n.includes("FITA ISOLANTE")) return 3;
  return 2;
}

function getMinStockManut(n: string): number {
  if (n.includes("TINTA") || n.includes("THINNER")) return 2;
  if (n.includes("ROLO") || n.includes("PINCEL")) return 3;
  return 2;
}
