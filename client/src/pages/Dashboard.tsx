import { useDashboardStats } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { 
  Package, Layers, ArrowUpRight, ArrowDownRight, AlertTriangle,
  Users, TrendingUp, TrendingDown, Activity, Clock, Wifi, WifiOff,
  MapPin, BarChart3, ShieldAlert, Trophy, Medal, Award, Zap,
  CheckCircle2, XCircle, Crown, Star, Flame, Sparkles, Target,
  ArrowRight, Box, CircleDot, Edit3, LogIn, FileText, UserPlus, Trash2,
  Timer, Phone, MessageCircle, Code2, ExternalLink, Calendar, AlertCircle,
  Github, Linkedin, Mail, Rocket, Heart,
  // ÍCONES ADICIONAIS DO DEVELOPERCONTACTCARD:
  Copy, Check, Globe, Terminal,
  // ÍCONES ADICIONAIS DO USERPREFERENCES:
  Bell, Moon, Wrench, Search, Smartphone, Eye, Lock, Database,
  // ÍCONES DO RELEASE NOTES:
  LayoutDashboard, X,
  // ÍCONES DO DEVELOPERCONTACTCARD SIMPLIFICADO:
  Headphones, Info, Newspaper, ChevronUp
} from "lucide-react";
import { format, differenceInSeconds, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ==========================================
// CONFIGURAÇÕES DE ANIMAÇÃO REFINADAS
// ==========================================

// Easing functions Apple-style (curvas de aceleração naturais)
const ease = {
  smooth: [0.4, 0, 0.2, 1],      // Padrão suave
  bounce: [0.68, -0.55, 0.265, 1.55], // Leve bounce
  snappy: [0.25, 0.46, 0.45, 0.94],   // Resposta rápida
  gentle: [0.22, 1, 0.36, 1],    // Entrada suave, saída rápida
  spring: { type: "spring", stiffness: 400, damping: 30 }
};

// Container com stagger mais refinado
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
      ease: ease.smooth
    }
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.05, staggerDirection: -1 }
  }
};

// Item com spring mais natural
const item = {
  hidden: { 
    opacity: 0, 
    y: 24, 
    scale: 0.96,
    filter: "blur(4px)"
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 20,
      mass: 0.8
    }
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.98,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: ease.smooth }
  }
};

// Animação de pulso mais sutil (Apple-style breathing)
const pulseAnimation = {
  scale: [1, 1.02, 1],
  opacity: [1, 0.95, 1],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut",
    times: [0, 0.5, 1]
  }
};

// Fade suave para transições de página
const fadeTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: ease.gentle }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    transition: { duration: 0.25, ease: ease.smooth }
  }
};

// Scale para modais/dropdowns
const scaleIn = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 25 }
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.15 }
  }
};

// Slide para notificações/toasts
const slideIn = {
  hidden: { opacity: 0, x: 50, scale: 0.9 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 }
  }
};

// Hover suave para cards/botões
const hoverScale = {
  scale: 1.02,
  transition: { duration: 0.2, ease: ease.snappy }
};

const tapScale = {
  scale: 0.98,
  transition: { duration: 0.1 }
};

// Stagger customizável
const createStagger = (delay = 0.05, delayChildren = 0.1) => ({
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: delay, delayChildren }
  }
});

// ==========================================
// USO EXEMPLO
// ==========================================
/*
<motion.div variants={container} initial="hidden" animate="show">
  {items.map((item) => (
    <motion.div key={item.id} variants={item}>
      {item.content}
    </motion.div>
  ))}
</motion.div>

<motion.div
  animate={pulseAnimation}
  className="status-indicator"
/>

<motion.button
  whileHover={hoverScale}
  whileTap={tapScale}
>
  Clique aqui
</motion.button>
*/
// ==========================================
// CORES DAS CATEGORIAS
// ==========================================
const CATEGORY_COLORS: Record<string, { bar: string; text: string; bg: string; dot: string; gradient: string }> = {
  "LIMPEZA": { 
    bar: "bg-cyan-500", 
    text: "text-cyan-400", 
    bg: "bg-cyan-500/10", 
    dot: "bg-cyan-400",
    gradient: "from-cyan-500 to-blue-500"
  },
  "ADMINISTRATIVO": { 
    bar: "bg-blue-500", 
    text: "text-blue-400", 
    bg: "bg-blue-500/10", 
    dot: "bg-blue-400",
    gradient: "from-blue-500 to-indigo-500"
  },
  "ALIMENTOS": { 
    bar: "bg-amber-500", 
    text: "text-amber-400", 
    bg: "bg-amber-500/10", 
    dot: "bg-amber-400",
    gradient: "from-amber-500 to-orange-500"
  },
  "MANUTENÇÃO PREDIAL": { 
    bar: "bg-orange-500", 
    text: "text-orange-400", 
    bg: "bg-orange-500/10", 
    dot: "bg-orange-400",
    gradient: "from-orange-500 to-red-500"
  },
  "MANUTENÇÃO": { 
    bar: "bg-yellow-600", 
    text: "text-yellow-500", 
    bg: "bg-yellow-500/10", 
    dot: "bg-yellow-500",
    gradient: "from-yellow-500 to-amber-600"
  },
  "EPI": { 
    bar: "bg-red-500", 
    text: "text-red-400", 
    bg: "bg-red-500/10", 
    dot: "bg-red-400",
    gradient: "from-red-500 to-rose-600"
  },
  "DAF": { 
    bar: "bg-violet-500", 
    text: "text-violet-400", 
    bg: "bg-violet-500/10", 
    dot: "bg-violet-400",
    gradient: "from-violet-500 to-purple-600"
  },
  "OUTROS": { 
    bar: "bg-slate-500", 
    text: "text-slate-400", 
    bg: "bg-slate-500/10", 
    dot: "bg-slate-400",
    gradient: "from-slate-500 to-gray-600"
  },
};

// ==========================================
// COMPONENTE: RELEASE NOTES BANNER v2.0
// Agora oculto por padrão, aparece ao clicar no botão flutuante
// ==========================================

function ReleaseNotesButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'features' | 'fixes' | 'improvements'>('features');
  const [hasNewUpdate, setHasNewUpdate] = useState(true); // Controla o badge "Novo"

  // Dados das Notas de Atualização
  const releaseNotes = {
    version: "v3.0",
    date: "07 de Abril de 2026",
    features: [
      { title: "Chat em Tempo Real", desc: "Comunicação instantânea entre usuários do sistema", icon: MessageCircle },
      { title: "Dashboard Premium", desc: "Nova interface com animações fluidas e visual moderno", icon: LayoutDashboard },
      { title: "Relatórios Avançados", desc: "Exportação de dados em PDF e Excel com gráficos", icon: FileText },
      { title: "Notificações Push", desc: "Alertas em tempo real de movimentações importantes", icon: AlertCircle },
      { title: "Modo Escuro Aprimorado", desc: "Tema dark com contraste otimizado para longas sessões", icon: Moon },
    ],
    fixes: [
      { title: "Correção de Cache", desc: "Resolvido problema de dados desatualizados no ranking", icon: CheckCircle2 },
      { title: "Estabilidade do WebSocket", desc: "Reconexão automática em caso de queda de conexão", icon: Wifi },
      { title: "Performance de Busca", desc: "Otimização na consulta de produtos com grande volume", icon: Search },
      { title: "Validação de Formulários", desc: "Corrigidos bugs na validação de campos obrigatórios", icon: ShieldAlert },
    ],
    improvements: [
      { title: "Velocidade de Carregamento", desc: "Redução de 60% no tempo de inicialização", icon: Zap },
      { title: "Responsividade Mobile", desc: "Melhor adaptação para tablets e smartphones", icon: Smartphone },
      { title: "Acessibilidade", desc: "Suporte completo a leitores de tela e navegação por teclado", icon: Eye },
      { title: "Segurança", desc: "Criptografia aprimorada nos dados sensíveis", icon: Lock },
      { title: "Backup Automático", desc: "Snapshots do banco de dados a cada 6 horas", icon: Database },
    ]
  };

  const getTabIcon = (tab: string) => {
    switch(tab) {
      case 'features': return Sparkles;
      case 'fixes': return Wrench;
      case 'improvements': return TrendingUp;
      default: return CircleDot;
    }
  };

  const getTabColor = (tab: string) => {
    switch(tab) {
      case 'features': return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
      case 'fixes': return 'text-green-400 border-green-500/50 bg-green-500/10';
      case 'improvements': return 'text-purple-400 border-purple-500/50 bg-purple-500/10';
      default: return 'text-muted-foreground';
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setHasNewUpdate(false); // Marca como visualizado
  };

  return (
    <>
      {/* Botão Flutuante - Sempre visível no canto inferior esquerdo */}
      <motion.button
        onClick={handleOpen}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-3 px-5 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 border border-indigo-400/30 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all group"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Newspaper className="w-5 h-5 text-white" />
        </motion.div>
        <span className="text-sm font-bold text-white hidden sm:block">Novidades</span>
        
        {/* Badge "Novo" pulsante */}
        {hasNewUpdate && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-background"
          >
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-red-500 rounded-full"
            />
            <span className="relative z-10">1</span>
          </motion.span>
        )}

        {/* Efeito de brilho */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-white/0 via-white/20 to-white/0"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
      </motion.button>

      {/* Modal/Card de Release Notes */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Card Principal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-x-4 top-[5%] md:inset-auto md:top-[10%] md:left-1/2 md:-translate-x-1/2 md:w-[800px] md:max-w-[90vw] z-50 max-h-[85vh] overflow-hidden"
            >
              <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 shadow-2xl max-h-full overflow-y-auto">
                {/* Efeitos de fundo */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(99,102,241,0.05)_50%)] bg-[size:100%_4px] opacity-30 pointer-events-none" />
                <motion.div
                  className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl"
                  animate={{ scale: [1, 1.3, 1], x: [0, 20, 0], y: [0, -20, 0] }}
                  transition={{ duration: 10, repeat: Infinity }}
                />
                <motion.div
                  className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl"
                  animate={{ scale: [1, 1.3, 1], x: [0, -20, 0], y: [0, 20, 0] }}
                  transition={{ duration: 12, repeat: Infinity, delay: 2 }}
                />
                
                {/* Header */}
                <div className="relative z-10 p-6 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-transparent to-purple-500/10 sticky top-0 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center shadow-lg shadow-indigo-500/20"
                      >
                        <Rocket className="w-7 h-7 text-indigo-300" />
                        <motion.div
                          className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-950"
                          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </motion.div>
                      <div>
                        <h4 className="text-2xl font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                          <Sparkles className="w-6 h-6 text-yellow-400" />
                          Release Notes
                          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-sm ml-2 px-3 py-1">
                            {releaseNotes.version}
                          </Badge>
                        </h4>
                        <p className="text-sm text-indigo-400/60 font-medium mt-1">
                          Lançado em {releaseNotes.date}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="text-indigo-400/60 hover:text-indigo-300 hover:bg-indigo-500/10 h-10 w-10 p-0 rounded-xl"
                    >
                      <X className="w-6 h-6" />
                    </Button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-3 mt-6">
                    {(['features', 'fixes', 'improvements'] as const).map((tab) => {
                      const TabIcon = getTabIcon(tab);
                      const labels = { features: 'Novidades', fixes: 'Correções', improvements: 'Melhorias' };
                      
                      return (
                        <motion.button
                          key={tab}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveTab(tab)}
                          className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 border
                            ${activeTab === tab 
                              ? getTabColor(tab)
                              : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-300'
                            }
                          `}
                        >
                          <TabIcon className="w-4 h-4" />
                          {labels[tab]}
                          <Badge className={`
                            text-xs px-2 py-0.5 ml-1
                            ${activeTab === tab ? 'bg-white/20' : 'bg-white/5 text-slate-500'}
                          `}>
                            {releaseNotes[tab].length}
                          </Badge>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Conteúdo das Tabs */}
                <div className="relative z-10 p-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {releaseNotes[activeTab].map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 20, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: idx * 0.08, type: "spring", stiffness: 300 }}
                          whileHover={{ scale: 1.02, y: -3 }}
                          className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 p-5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer"
                        >
                          {/* Glow no hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/10 group-hover:to-purple-500/5 transition-all duration-500" />
                          
                          <div className="relative z-10">
                            <div className="flex items-start gap-4">
                              <motion.div
                                whileHover={{ rotate: 360, scale: 1.1 }}
                                transition={{ duration: 0.5 }}
                                className={`
                                  w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border
                                  ${activeTab === 'features' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                    activeTab === 'fixes' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                    'bg-purple-500/10 border-purple-500/20 text-purple-400'}
                                `}
                              >
                                <item.icon className="w-6 h-6" />
                              </motion.div>
                              
                              <div className="flex-1 min-w-0">
                                <h5 className="text-base font-black text-slate-200 uppercase tracking-wider leading-tight group-hover:text-indigo-300 transition-colors">
                                  {item.title}
                                </h5>
                                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Efeito de brilho no hover */}
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                            initial={{ x: "-100%" }}
                            whileHover={{ x: "100%" }}
                            transition={{ duration: 0.6 }}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Footer */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8 flex items-center justify-center gap-4"
                  >
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-bold cursor-pointer hover:from-indigo-500/30 hover:to-purple-500/30 transition-all"
                    >
                      <Zap className="w-5 h-5" />
                      <span>Sistema atualizado e otimizado</span>
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </motion.div>
                    
                    <span className="text-xs text-slate-500 font-medium">
                      Última atualização: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </motion.div>
                </div>
                
                {/* Cantos decorativos */}
                <div className="absolute top-4 left-4 w-3 h-3 border-l-2 border-t-2 border-indigo-500/30" />
                <div className="absolute top-4 right-4 w-3 h-3 border-r-2 border-t-2 border-indigo-500/30" />
                <div className="absolute bottom-4 left-4 w-3 h-3 border-l-2 border-b-2 border-indigo-500/30" />
                <div className="absolute bottom-4 right-4 w-3 h-3 border-r-2 border-b-2 border-indigo-500/30" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export { ReleaseNotesButton };

// ==========================================
// COMPONENTE: ESTATÍSTICA CARD
// ==========================================
function StatCard({ stat, index }: { stat: any; index: number }) {
  const Icon = stat.icon;
  
  return (
    <motion.div
      variants={item}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Card className={`${stat.cardCls} p-5 relative overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-${stat.valueCls.split('-')[1]}-500/10`} data-testid={stat.id}>
        {/* Glow effect no hover */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${stat.glow || 'from-transparent'} to-transparent`} />
        
        <div className="relative z-10">
          <div className={`w-12 h-12 rounded-xl ${stat.iconCls} border flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            <Icon className="w-6 h-6" />
          </div>
          
          <motion.p 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 + 0.3, type: "spring" }}
            className={`text-3xl font-black ${stat.valueCls} tracking-tight leading-none`}
          >
            {stat.value}
          </motion.p>
          
          <p className="text-[11px] text-muted-foreground uppercase font-black tracking-wider mt-2">{stat.label}</p>
          
          {stat.sub && (
            <motion.p 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + 0.5 }}
              className={`text-xs ${stat.valueCls} font-bold mt-1 opacity-70`}
            >
              {stat.sub}
            </motion.p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ==========================================
// COMPONENTE: RANKING ITEM
// ==========================================
function RankingItem({ rank, index, maxMov, user, isTop3 }: any) {
  const style = isTop3 ? [
    { border: "border-yellow-500/40", bg: "bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-yellow-600/5", iconBg: "bg-gradient-to-br from-yellow-500/30 to-amber-500/20", iconColor: "text-yellow-300", nameColor: "text-yellow-300", barColor: "from-yellow-500 to-amber-400", glow: "shadow-yellow-500/20" },
    { border: "border-slate-400/25", bg: "bg-gradient-to-br from-slate-400/10 via-slate-500/5 to-slate-600/5", iconBg: "bg-gradient-to-br from-slate-400/25 to-slate-500/15", iconColor: "text-slate-300", nameColor: "text-slate-300", barColor: "from-slate-400 to-slate-300", glow: "shadow-slate-400/20" },
    { border: "border-amber-600/25", bg: "bg-gradient-to-br from-amber-700/10 via-orange-600/5 to-amber-500/5", iconBg: "bg-gradient-to-br from-amber-600/25 to-orange-500/15", iconColor: "text-amber-400", nameColor: "text-amber-400", barColor: "from-amber-600 to-orange-400", glow: "shadow-amber-600/20" },
  ][index] : null;

  const RankIcon = isTop3 ? [Crown, Medal, Award][index] : null;
  const totalMov = rank.entries + rank.exits;
  const pct = maxMov > 0 ? (totalMov / maxMov) * 100 : 0;
  const isCurrentUser = user?.username === rank.username;

  if (isTop3) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.15, type: "spring", stiffness: 150, damping: 15 }}
        whileHover={{ y: -5, scale: 1.02 }}
        className={`relative rounded-2xl border-2 ${style?.border} ${style?.bg} ${isCurrentUser ? 'ring-2 ring-accent/30 ring-offset-2 ring-offset-background' : ''} overflow-hidden shadow-lg ${style?.glow}`}
        data-testid={`ranking-${index}`}
      >
        {/* Background shine */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
        
        <div className="p-6 relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <motion.div 
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className={`w-14 h-14 rounded-xl ${style?.iconBg} flex items-center justify-center shrink-0 relative border border-white/10 shadow-inner`}
            >
              {index === 0 ? (
                <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}>
                  <RankIcon className={`w-7 h-7 ${style?.iconColor}`} />
                </motion.div>
              ) : (
                <RankIcon className={`w-6 h-6 ${style?.iconColor}`} />
              )}
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center text-xs font-black text-foreground shadow-lg"
              >
                {index + 1}
              </motion.span>
            </motion.div>
            
            <div className="flex-1 min-w-0">
              <p className={`text-lg font-black uppercase tracking-wider ${style?.nameColor} truncate`}>{rank.username}</p>
              {isCurrentUser && (
                <Badge className="bg-accent/20 text-accent text-[10px] px-2 py-0.5 mt-1 border-0 font-black">VOCÊ</Badge>
              )}
            </div>
            
            {index === 0 && (
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Flame className="w-6 h-6 text-orange-400" />
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="text-center bg-black/20 backdrop-blur-sm rounded-xl py-3 border border-white/5"
            >
              <p className="text-xl font-black text-green-400 leading-none">{rank.entries}</p>
              <p className="text-[9px] text-green-400/60 uppercase font-bold tracking-widest mt-1">Entradas</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="text-center bg-black/20 backdrop-blur-sm rounded-xl py-3 border border-white/5"
            >
              <p className="text-xl font-black text-red-400 leading-none">{rank.exits}</p>
              <p className="text-[9px] text-red-400/60 uppercase font-bold tracking-widest mt-1">Saídas</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="text-center bg-black/20 backdrop-blur-sm rounded-xl py-3 border border-white/5"
            >
              <p className="text-xl font-black text-accent leading-none">{rank.totalItems}</p>
              <p className="text-[9px] text-accent/60 uppercase font-bold tracking-widest mt-1">Itens</p>
            </motion.div>
          </div>

          <div>
            <div className="h-3 bg-black/20 rounded-full overflow-hidden border border-white/5">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${style?.barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.5, delay: index * 0.2, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center font-bold">{totalMov} movimentações</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Ranking 4+ (lista compacta)
  const pos = index + 4;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,0.05)" }}
      className={`flex items-center gap-4 rounded-xl px-4 py-3 border transition-all ${
        isCurrentUser ? 'bg-accent/5 border-accent/20' : 'bg-muted/5 border-border/15'
      }`}
      data-testid={`ranking-${index}`}
    >
      <span className="text-sm font-black text-muted-foreground w-8 text-center">#{pos}</span>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center shrink-0 text-sm font-black text-muted-foreground border border-border/20">
        {rank.username.substring(0, 2).toUpperCase()}
      </div>
      <span className="text-sm font-bold text-foreground uppercase flex-1">{rank.username}</span>
      {isCurrentUser && <Badge className="bg-accent/20 text-accent text-[10px] px-2 py-0 border-0">VOCÊ</Badge>}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-green-400 font-bold flex items-center gap-1">
          {rank.entries} <TrendingUp className="w-3 h-3" />
        </span>
        <span className="text-red-400 font-bold flex items-center gap-1">
          {rank.exits} <TrendingDown className="w-3 h-3" />
        </span>
        <span className="text-accent font-bold">{rank.totalItems} itens</span>
      </div>
    </motion.div>
  );
}

function DeveloperContactCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Botão flutuante minimalista - sempre visível */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-neutral-900 border border-white/10 shadow-2xl flex items-center justify-center group hover:border-emerald-500/30 transition-colors"
      >
        <Headphones className="w-6 h-6 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
      </motion.button>

      {/* Modal/Card - só aparece quando isOpen = true */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-24 right-6 z-50 w-80"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Code2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Daniel Dev</h3>
                      <p className="text-xs text-neutral-500">Suporte Técnico</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-white hover:bg-white/5"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Conteúdo */}
                <div className="p-5 space-y-4">
                  <p className="text-sm text-neutral-400">
                    Precisa de ajuda? Entre em contato para suporte, customizações ou novas funcionalidades.
                  </p>

                  {/* WhatsApp */}
                  <a
                    href="https://wa.me/5542998529317"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors group"
                  >
                    <Phone className="w-5 h-5 text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-400">WhatsApp</p>
                      <p className="text-xs text-emerald-400/60">(42) 99852-9317</p>
                    </div>
                  </a>

                  {/* Mensagem direta */}
                  <a
                    href="https://wa.me/5542998529317?text=Olá! Preciso de suporte técnico."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5 text-neutral-400" />
                    <span className="text-sm font-medium text-neutral-300">Enviar mensagem</span>
                  </a>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5">
                  <p className="text-[10px] text-neutral-600 text-center">
                    Resposta em até 30 minutos
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export { DeveloperContactCard };

// ==========================================
// COMPONENTE PRINCIPAL: DASHBOARD v3.0 PREMIUM
// Animações fluidas, efeitos visuais avançados, layout imersivo
// ==========================================
export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { user } = useAuth();
  const { onlineUsers } = useWebSocket();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebratedRef = useRef(false);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  // Memoização dos dados computados
  const rankingList = useMemo(() => (stats as any)?.rankingList || [], [stats]);
  const isUserTop1 = useMemo(() => 
    rankingList.length > 0 && user && rankingList[0]?.username === user.username, 
  [rankingList, user]);

  const categoryData = useMemo(() => 
    stats?.categoryBreakdown ? 
      Object.entries(stats.categoryBreakdown as Record<string, { count: number; stock: number }>)
        .sort((a, b) => b[1].stock - a[1].stock) : [],
  [stats]);

  const maxCatStock = useMemo(() => 
    categoryData.length > 0 ? Math.max(...categoryData.map(([, v]) => v.stock)) : 1,
  [categoryData]);

  const totalCatStock = useMemo(() => 
    categoryData.reduce((a, [, v]) => a + v.stock, 0),
  [categoryData]);

  const zeroProducts = useMemo(() => 
    (stats?.lowStockList || []).filter((p: any) => p.quantidade_atual === 0).length,
  [stats]);

  const lowButNotZero = useMemo(() => 
    (stats?.lowStock || 0) - zeroProducts,
  [stats, zeroProducts]);

  const okProducts = useMemo(() => 
    (stats?.totalProducts || 0) - (stats?.lowStock || 0),
  [stats]);

  const saldoHoje = useMemo(() => 
    (stats?.entriesItemsToday || 0) - (stats?.exitsItemsToday || 0),
  [stats]);

  // Efeitos
  useEffect(() => {
    if (user && (user as any).must_change_password) {
      const alreadyChanged = sessionStorage.getItem("password_changed");
      if (!alreadyChanged) setShowPasswordChange(true);
    }
  }, [user]);

  useEffect(() => {
    if (isUserTop1 && !celebratedRef.current && !isLoading) {
      celebratedRef.current = true;
      setShowCelebration(true);
      if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 150]);
      const timer = setTimeout(() => setShowCelebration(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isUserTop1, isLoading]);

  // Dados das estatísticas com efeitos de glow dinâmicos
  const statsData = useMemo(() => [
    { 
      icon: Package, 
      value: stats?.totalProducts || 0, 
      label: "PRODUTOS", 
      cardCls: "border-blue-500/20 hover:border-blue-500/50", 
      iconCls: "text-blue-400 bg-blue-500/10 border-blue-500/15", 
      valueCls: "text-blue-400",
      glow: "shadow-[0_0_30px_rgba(59,130,246,0.3)]",
      id: "stat-produtos",
      desc: "Total cadastrado"
    },
    { 
      icon: Layers, 
      value: (stats?.totalStock || 0).toLocaleString('pt-BR'), 
      label: "EM ESTOQUE", 
      cardCls: "border-emerald-500/20 hover:border-emerald-500/50", 
      iconCls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/15", 
      valueCls: "text-emerald-400",
      glow: "shadow-[0_0_30px_rgba(16,185,129,0.3)]",
      id: "stat-estoque-total",
      desc: "Unidades disponíveis"
    },
    { 
      icon: ArrowDownRight, 
      value: stats?.entriesToday || 0, 
      label: "ENTRADAS HOJE", 
      cardCls: "border-green-500/20 hover:border-green-500/50", 
      iconCls: "text-green-400 bg-green-500/10 border-green-500/15", 
      valueCls: "text-green-400",
      glow: "shadow-[0_0_30px_rgba(34,197,94,0.3)]",
      id: "stat-entradas-hoje", 
      sub: `+${stats?.entriesItemsToday || 0} itens` 
    },
    { 
      icon: ArrowUpRight, 
      value: stats?.exitsToday || 0, 
      label: "LANÇAMENTOS", 
      cardCls: "border-red-500/20 hover:border-red-500/50", 
      iconCls: "text-red-400 bg-red-500/10 border-red-500/15", 
      valueCls: "text-red-400",
      glow: "shadow-[0_0_30px_rgba(239,68,68,0.3)]",
      id: "stat-saidas-hoje", 
      sub: `-${stats?.exitsItemsToday || 0} itens` 
    },
    { 
      icon: AlertTriangle, 
      value: stats?.lowStock || 0, 
      label: "RISCO FALTA", 
      cardCls: "border-orange-500/20 hover:border-orange-500/50", 
      iconCls: "text-orange-400 bg-orange-500/10 border-orange-500/15", 
      valueCls: "text-orange-400",
      glow: "shadow-[0_0_30px_rgba(249,115,22,0.3)]",
      id: "stat-risco-de-falta", 
      sub: zeroProducts > 0 ? `${zeroProducts} zerados` : undefined 
    },
    { 
      icon: Users, 
      value: onlineUsers.length, 
      label: "ONLINE", 
      cardCls: "border-purple-500/20 hover:border-purple-500/50", 
      iconCls: "text-purple-400 bg-purple-500/10 border-purple-500/15", 
      valueCls: "text-purple-400",
      glow: "shadow-[0_0_30px_rgba(168,85,247,0.3)]",
      id: "stat-online-agora",
      desc: "Usuários ativos"
    },
  ], [stats, zeroProducts, onlineUsers.length]);

  // Componente de Stat Card Premium
  const StatCard = ({ stat, index }: { stat: typeof statsData[0], index: number }) => {
    const Icon = stat.icon;
    const isHovered = hoveredStat === stat.id;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.05, type: "spring", stiffness: 300 }}
        whileHover={{ scale: 1.03, y: -5 }}
        onHoverStart={() => setHoveredStat(stat.id)}
        onHoverEnd={() => setHoveredStat(null)}
        className={`
          relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm
          p-4 cursor-pointer transition-all duration-300 ${stat.cardCls}
          ${isHovered ? stat.glow : ''}
        `}
        data-testid={stat.id}
      >
        {/* Background glow on hover */}
        <motion.div
          className={`absolute inset-0 opacity-0 ${isHovered ? 'opacity-100' : ''} transition-opacity duration-500`}
          style={{
            background: `radial-gradient(circle at 50% 50%, ${stat.valueCls.includes('blue') ? 'rgba(59,130,246,0.15)' : stat.valueCls.includes('emerald') ? 'rgba(16,185,129,0.15)' : stat.valueCls.includes('green') ? 'rgba(34,197,94,0.15)' : stat.valueCls.includes('red') ? 'rgba(239,68,68,0.15)' : stat.valueCls.includes('orange') ? 'rgba(249,115,22,0.15)' : 'rgba(168,85,247,0.15)'}, transparent 70%)`
          }}
        />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <motion.div 
              animate={isHovered ? { rotate: [0, -10, 10, 0], scale: 1.1 } : {}}
              transition={{ duration: 0.5 }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center border ${stat.iconCls}`}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
            {stat.sub && (
              <Badge variant="outline" className="text-[10px] font-bold border-white/10">
                {stat.sub}
              </Badge>
            )}
          </div>
          
          <motion.div
            animate={isHovered ? { scale: 1.05 } : {}}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <p className={`text-3xl font-black tabular-nums ${stat.valueCls} drop-shadow-lg`}>
              {stat.value}
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mt-1">
              {stat.label}
            </p>
            {stat.desc && (
              <p className="text-[9px] text-muted-foreground/50 mt-0.5">{stat.desc}</p>
            )}
          </motion.div>
        </div>
        
        {/* Corner accent */}
        <div className={`absolute bottom-2 right-2 w-2 h-2 rounded-full opacity-40 ${stat.valueCls.replace('text-', 'bg-')}`} />
      </motion.div>
    );
  };

  // Loading state premium
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]" />
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `conic-gradient(from 0deg, transparent, rgba(34,197,94,0.1), transparent 30%)`
          }}
        />
        
        <div className="text-center space-y-6 relative z-10">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }} 
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 blur-2xl bg-accent/40 rounded-full animate-pulse" />
            <Sparkles className="w-20 h-20 text-accent mx-auto relative z-10" />
          </motion.div>
          
          <div className="space-y-2">
            <motion.p 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-muted-foreground font-bold uppercase tracking-[0.3em] text-sm"
            >
              Carregando Painel
            </motion.p>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scaleY: [0.5, 1.5, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1 h-4 bg-accent/60 rounded-full"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <motion.div 
      variants={container} 
      initial="hidden" 
      animate="show" 
      className="space-y-8 max-w-[1600px] mx-auto relative"
    >
      {/* Background ambient effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-96 h-96 bg-accent/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Botão de Release Notes Flutuante */}
      <ReleaseNotesButton />

      {/* Celebração #1 - Melhorada */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            <motion.div 
              animate={{ boxShadow: ["0 0 20px rgba(234,179,8,0.5)", "0 0 40px rgba(234,179,8,0.8)", "0 0 20px rgba(234,179,8,0.5)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 text-black px-10 py-5 rounded-3xl shadow-2xl flex items-center gap-5 border-4 border-yellow-300/50 relative overflow-hidden"
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              
              <motion.div 
                animate={{ rotate: [0, -15, 15, -15, 15, 0], scale: [1, 1.3, 1, 1.3, 1] }} 
                transition={{ duration: 1.5, repeat: 1 }}
                className="relative z-10"
              >
                <Trophy className="w-12 h-12 text-yellow-900" />
              </motion.div>
              
              <div className="relative z-10 text-center">
                <p className="text-2xl font-black uppercase tracking-wider text-yellow-950">Você é o #1!</p>
                <p className="text-sm font-bold text-yellow-900/80">Líder do ranking de movimentações</p>
              </div>
              
              <motion.div 
                animate={{ rotate: [0, 15, -15, 15, -15, 0], scale: [1, 1.3, 1, 1.3, 1] }} 
                transition={{ duration: 1.5, repeat: 1, delay: 0.2 }}
                className="relative z-10"
              >
                <Star className="w-10 h-10 text-yellow-900 fill-yellow-900" />
              </motion.div>
            </motion.div>
            
            {/* Confetti particles effect */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, y: 0, scale: 0 }}
                animate={{ 
                  opacity: 0, 
                  y: 100 + Math.random() * 50, 
                  x: (Math.random() - 0.5) * 200,
                  scale: 1,
                  rotate: Math.random() * 360
                }}
                transition={{ duration: 1.5, delay: 0.5 + i * 0.1 }}
                className="absolute top-full left-1/2 w-3 h-3 rounded-full bg-yellow-400"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Premium */}
      <motion.div variants={item} className="relative z-10">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-5">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-accent/30 blur-xl rounded-2xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/40 to-accent/10 border-2 border-accent/40 flex items-center justify-center shadow-lg shadow-accent/20">
                <span className="text-2xl font-black text-accent">{user?.username?.substring(0, 2).toUpperCase()}</span>
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background"
              />
            </motion.div>
            
            <div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight"
                data-testid="text-greeting"
              >
                {greeting},{" "}
                <span className="text-accent bg-gradient-to-r from-accent to-accent/60 bg-clip-text text-transparent">
                  {user?.username}
                </span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-muted-foreground mt-2 flex items-center gap-2 font-medium"
              >
                <Clock className="w-4 h-4 text-accent/60" />
                {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span className="text-accent/60 font-mono">{format(now, "HH:mm")}</span>
              </motion.p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {onlineUsers.length > 0 ? (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-2.5"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Wifi className="w-5 h-5 text-green-400" />
                </motion.div>
                <span className="text-sm font-black text-green-400 uppercase tracking-wider">
                  {onlineUsers.length} Online
                </span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-2 bg-muted/10 border border-border/30 rounded-2xl px-4 py-2.5">
                <WifiOff className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Offline</span>
              </div>
            )}
            
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 5).map((ou, i) => (
                <motion.div 
                  key={`${ou.userId}-${i}`}
                  initial={{ opacity: 0, scale: 0, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.2, zIndex: 10 }}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-card to-muted border-2 border-background flex items-center justify-center text-[10px] font-black text-foreground shadow-lg cursor-pointer"
                  title={ou.username}
                  data-testid={`online-user-${ou.userId}`}
                >
                  {ou.username.substring(0, 2).toUpperCase()}
                </motion.div>
              ))}
              {onlineUsers.length > 5 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-9 h-9 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground"
                >
                  +{onlineUsers.length - 5}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative z-10">
        
        {/* Coluna Esquerda - Conteúdo Principal */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Stats Grid Premium */}
          <motion.div variants={item}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {statsData.map((stat, idx) => (
                <StatCard key={stat.id} stat={stat} index={idx} />
              ))}
            </div>
          </motion.div>

          {/* Ranking - Design Melhorado */}
          {rankingList.length > 0 && (
            <motion.div variants={item}>
              <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.03] via-transparent to-amber-500/[0.02] p-0 overflow-hidden relative" data-testid="section-ranking">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-yellow-500/[0.08] to-transparent rounded-bl-full pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.2)_50%)] bg-[size:100%_4px] opacity-10" />
                
                <div className="p-6 pb-4 relative">
                  <div className="flex items-center gap-4 mb-6">
                    <motion.div 
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                      className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/30 to-amber-500/20 flex items-center justify-center border-2 border-yellow-500/30 shadow-lg shadow-yellow-500/10"
                    >
                      <Trophy className="w-7 h-7 text-yellow-400" />
                      <motion.div
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full"
                      />
                    </motion.div>
                    <div className="flex-1">
                      <h2 className="text-xl font-black uppercase tracking-wider text-yellow-400 flex items-center gap-2" data-testid="text-ranking-title">
                        Classificação ADM
                        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}>
                          <Flame className="w-5 h-5 text-orange-400" />
                        </motion.div>
                      </h2>
                      <p className="text-sm text-muted-foreground">Ranking de movimentações do almoxarifado</p>
                    </div>
                    <Badge variant="secondary" className="text-sm font-bold px-4 py-1.5 border-yellow-500/10 bg-yellow-500/10 text-yellow-400">
                      {rankingList.reduce((a: number, r: any) => a + r.entries + r.exits, 0)} mov.
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {rankingList.slice(0, 3).map((rank, i) => (
                      <RankingItem 
                        key={i} 
                        rank={rank} 
                        index={i} 
                        maxMov={rankingList[0].entries + rankingList[0].exits} 
                        user={user}
                        isTop3={true}
                      />
                    ))}
                  </div>

                  {rankingList.length > 3 && (
                    <div className="mt-4 space-y-2">
                      {rankingList.slice(3).map((rank, i) => (
                        <RankingItem 
                          key={i + 3} 
                          rank={rank} 
                          index={i} 
                          maxMov={0} 
                          user={user}
                          isTop3={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Atividade Geral - Melhorada */}
          <motion.div variants={item}>
            <Card className="border-accent/25 bg-gradient-to-br from-accent/[0.03] via-transparent to-transparent p-0 overflow-hidden relative" data-testid="section-activity-general">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
              
              <div className="p-6 pb-4 border-b border-accent/10">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <motion.div 
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-14 h-14 rounded-2xl bg-accent/15 border-2 border-accent/25 flex items-center justify-center shadow-lg shadow-accent/10"
                    >
                      <Activity className="w-7 h-7 text-accent" />
                    </motion.div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wider text-accent flex items-center gap-2" data-testid="text-activity-general-title">
                        Atividade Geral
                        <Sparkles className="w-5 h-5 text-accent/60" />
                      </h2>
                      <p className="text-sm text-muted-foreground">Todas as alterações do sistema hoje - Zera às 00:00</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm font-bold px-4 py-1.5 border-accent/20 text-accent bg-accent/5">
                    {(stats?.todayActivity || []).length} registros hoje
                  </Badge>
                </div>
              </div>

              {/* Ranking de Atividades */}
              {(stats?.todayActivity || []).length > 0 && (() => {
                const userCounts: Record<string, number> = {};
                for (const act of (stats?.todayActivity || [])) {
                  const u = (act as any).usuario;
                  if (u && u !== 'SISTEMA') userCounts[u] = (userCounts[u] || 0) + 1;
                }
                const sorted = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
                const maxCount = sorted[0]?.[1] || 1;
                
                const RANK_MEDAL_COLORS = [
                  { bg: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', bar: 'from-yellow-500 to-amber-400', icon: Crown },
                  { bg: 'bg-gradient-to-r from-slate-400/15 to-slate-500/5', border: 'border-slate-400/20', text: 'text-slate-300', bar: 'from-slate-400 to-slate-300', icon: Medal },
                  { bg: 'bg-gradient-to-r from-amber-600/15 to-orange-500/5', border: 'border-amber-600/20', text: 'text-amber-400', bar: 'from-amber-600 to-orange-400', icon: Award },
                ];

                return (
                  <div className="px-6 py-4 border-b border-accent/10 bg-accent/[0.02]">
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <h3 className="text-sm font-black uppercase tracking-widest text-yellow-400">Ranking ADM - Atividades Hoje</h3>
                    </div>
                    <div className="space-y-2">
                      {sorted.map(([username, count], i) => {
                        const pct = (count / maxCount) * 100;
                        const medalStyle = RANK_MEDAL_COLORS[i] || { bg: 'bg-muted/5', border: 'border-border/15', text: 'text-muted-foreground', bar: 'from-accent/60 to-accent/30', icon: CircleDot };
                        const MedalIcon = medalStyle.icon;
                        const isCurrentUser = user?.username === username;
                        
                        return (
                          <motion.div
                            key={username}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            whileHover={{ scale: 1.02, x: 5 }}
                            className={`flex items-center gap-4 rounded-xl px-4 py-3 border ${medalStyle.bg} ${medalStyle.border} ${isCurrentUser ? 'ring-1 ring-accent/30 shadow-lg shadow-accent/10' : ''}`}
                            data-testid={`activity-rank-${i}`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${i < 3 ? medalStyle.bg : 'bg-muted/10'}`}>
                              {i < 3 ? (
                                <MedalIcon className={`w-5 h-5 ${medalStyle.text}`} />
                              ) : (
                                <span className="text-sm font-black text-muted-foreground">#{i + 1}</span>
                              )}
                            </div>
                            <span className={`text-sm font-black uppercase tracking-wider ${i < 3 ? medalStyle.text : 'text-foreground'} min-w-[80px]`}>{username}</span>
                            {isCurrentUser && <Badge className="bg-accent/20 text-accent text-[10px] px-2 py-0 border-0 font-black">VOCÊ</Badge>}
                            <div className="flex-1 h-2.5 bg-black/10 rounded-full overflow-hidden border border-white/5">
                              <motion.div
                                className={`h-full rounded-full bg-gradient-to-r ${medalStyle.bar}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                              />
                            </div>
                            <span className={`text-lg font-black ${i < 3 ? medalStyle.text : 'text-accent'} tabular-nums min-w-[40px] text-right`}>{count}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Lista de Atividades */}
              <div className="p-6">
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
                  {(stats?.todayActivity || []).length > 0 ? (
                    (stats?.todayActivity || []).map((act: any, idx: number) => {
                      const getModuleStyle = (modulo: string) => {
                        switch (modulo) {
                          case 'Auth': return { icon: LogIn, bg: 'bg-blue-500/10 border-blue-500/15', iconColor: 'text-blue-400', badgeBg: 'bg-blue-500/15 text-blue-400 border-blue-500/20' };
                          case 'Produtos': return { icon: Package, bg: 'bg-green-500/10 border-green-500/15', iconColor: 'text-green-400', badgeBg: 'bg-green-500/15 text-green-400 border-green-500/20' };
                          case 'Movimentações': return { icon: ArrowRight, bg: 'bg-orange-500/10 border-orange-500/15', iconColor: 'text-orange-400', badgeBg: 'bg-orange-500/15 text-orange-400 border-orange-500/20' };
                          case 'Usuários': return { icon: UserPlus, bg: 'bg-purple-500/10 border-purple-500/15', iconColor: 'text-purple-400', badgeBg: 'bg-purple-500/15 text-purple-400 border-purple-500/20' };
                          case 'Sistema': return { icon: Zap, bg: 'bg-cyan-500/10 border-cyan-500/15', iconColor: 'text-cyan-400', badgeBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' };
                          default: return { icon: Activity, bg: 'bg-muted/10 border-border/15', iconColor: 'text-muted-foreground', badgeBg: 'bg-muted/15 text-muted-foreground border-border/20' };
                        }
                      };
                      const style = getModuleStyle(act.modulo);
                      const ModIcon = style.icon;
                      
                      return (
                        <motion.div
                          key={act.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,0.05)", scale: 1.01 }}
                          className="flex items-center gap-4 rounded-xl px-4 py-3 border border-border/10 transition-all bg-transparent hover:border-accent/20 cursor-pointer"
                          data-testid={`activity-${act.id}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${style.bg}`}>
                            <ModIcon className={`w-5 h-5 ${style.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-foreground truncate">{act.acao}</p>
                              <Badge className={`text-[10px] px-2 py-0 font-black border ${style.badgeBg}`}>
                                {act.modulo}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{act.descricao}</p>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <span className="text-xs font-bold text-accent">{act.usuario}</span>
                            {act.data_hora && (
                              <span className="text-xs text-muted-foreground font-medium">{format(new Date(act.data_hora), "HH:mm")}</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-16"
                    >
                      <Activity className="w-16 h-16 text-muted-foreground/15 mx-auto mb-4" />
                      <p className="text-base text-muted-foreground font-bold">Nenhuma atividade registrada hoje</p>
                      <p className="text-sm text-muted-foreground/60 mt-1">As atividades aparecerão aqui ao longo do dia</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Baixo Estoque - Melhorado */}
          <motion.div variants={item}>
            <Card className="border-red-500/30 bg-gradient-to-br from-red-500/[0.05] via-orange-500/[0.02] to-transparent p-0 overflow-hidden relative" data-testid="section-low-stock">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-bl-full" />
              
              <div className="p-6 pb-4 border-b border-red-500/15 bg-red-500/[0.02]">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <motion.div 
                      animate={zeroProducts > 0 ? { rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.5, repeat: zeroProducts > 0 ? Infinity : 0, repeatDelay: 3 }}
                      className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500/30 flex items-center justify-center relative shadow-lg shadow-red-500/10"
                    >
                      <ShieldAlert className="w-8 h-8 text-red-400" />
                      {(stats?.lowStock || 0) > 0 && (
                        <motion.span 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-xs font-black text-white flex items-center justify-center shadow-lg shadow-red-500/30 border-2 border-background"
                        >
                          {stats?.lowStock}
                        </motion.span>
                      )}
                    </motion.div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wider text-red-400 flex items-center gap-2" data-testid="text-low-stock-title">
                        Produtos com Risco de Falta
                        {(stats?.lowStock || 0) > 0 && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <AlertTriangle className="w-5 h-5 text-orange-400" />
                          </motion.div>
                        )}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">Estoque abaixo do mínimo definido</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {zeroProducts > 0 && (
                      <Badge variant="destructive" className="text-sm font-bold px-3 py-1 animate-pulse" data-testid="badge-zerados-count">
                        {zeroProducts} zerados
                      </Badge>
                    )}
                    {lowButNotZero > 0 && (
                      <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/20 text-sm font-bold px-3 py-1" data-testid="badge-low-count">
                        {lowButNotZero} baixo estoque
                      </Badge>
                    )}
                  </div>
                </div>

                {(stats?.lowStock || 0) > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                      { icon: CheckCircle2, color: 'green', value: okProducts, label: 'OK', bg: 'bg-green-500/5', border: 'border-green-500/10', text: 'text-green-400' },
                      { icon: AlertTriangle, color: 'orange', value: lowButNotZero, label: 'Baixo', bg: 'bg-orange-500/5', border: 'border-orange-500/10', text: 'text-orange-400' },
                      { icon: XCircle, color: 'red', value: zeroProducts, label: 'Zerados', bg: 'bg-red-500/5', border: 'border-red-500/10', text: 'text-red-400' },
                      { icon: Target, color: 'accent', value: stats?.activeUsers || 0, label: 'Usuários', bg: 'bg-accent/5', border: 'border-accent/10', text: 'text-accent' }
                    ].map((item, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`${item.bg} ${item.border} border rounded-xl px-4 py-3 flex items-center gap-3`}
                      >
                        <item.icon className={`w-6 h-6 ${item.text} shrink-0`} />
                        <div>
                          <p className={`text-2xl font-black ${item.text} leading-none`}>{item.value}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">{item.label}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                  {(stats?.lowStockList || []).length > 0 ? (
                    (stats?.lowStockList || []).map((p: any, idx: number) => {
                      const pct = p.estoque_minimo > 0 ? Math.min((p.quantidade_atual / p.estoque_minimo) * 100, 100) : 0;
                      const isZero = p.quantidade_atual === 0;
                      
                      return (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          whileHover={{ x: 5, backgroundColor: isZero ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)", scale: 1.01 }}
                          className={`flex items-center gap-4 rounded-xl px-4 py-3.5 border transition-all cursor-pointer ${
                            isZero ? 'bg-red-500/[0.04] border-red-500/20' : 'bg-transparent border-border/10 hover:border-orange-500/20'
                          }`}
                          data-testid={`low-stock-${p.id}`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${isZero ? 'bg-red-500/15 border-red-500/20' : 'bg-orange-500/10 border-orange-500/15'}`}>
                            {isZero ? <XCircle className="w-6 h-6 text-red-400" /> : <AlertTriangle className="w-6 h-6 text-orange-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-foreground truncate">{p.nome}</p>
                              {isZero && (
                                <Badge variant="destructive" className="text-[10px] px-2 py-0 font-black animate-pulse" data-testid={`badge-zerado-${p.id}`}>ZERADO</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex-1 h-3 bg-muted/20 rounded-full overflow-hidden max-w-[200px] border border-white/5">
                                <motion.div
                                  className={`h-full rounded-full ${isZero ? 'bg-red-500' : pct < 50 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(pct, 3)}%` }}
                                  transition={{ duration: 0.5, delay: idx * 0.02 }}
                                />
                              </div>
                              <span className={`text-base font-black shrink-0 ${isZero ? 'text-red-400' : 'text-orange-400'}`}>
                                {p.quantidade_atual}/{p.estoque_minimo}
                              </span>
                              <span className="text-xs text-muted-foreground font-bold bg-muted/30 px-2 py-0.5 rounded">{p.unidade}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 hidden sm:flex flex-col items-end gap-1.5">
                            <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground font-bold">
                              {p.categoria || 'SEM CATEGORIA'}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium">
                              Última mov: {p.ultima_movimentacao ? format(new Date(p.ultima_movimentacao), "dd/MM/yy") : 'Nunca'}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-16"
                    >
                      <CheckCircle2 className="w-16 h-16 text-green-500/30 mx-auto mb-4" />
                      <p className="text-base text-muted-foreground font-bold">Todos os produtos estão com estoque adequado</p>
                      <p className="text-sm text-muted-foreground/60 mt-1">Nenhum item abaixo do mínimo definido</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Gráfico de Categorias - Melhorado */}
          {categoryData.length > 0 && (
            <motion.div variants={item}>
              <Card className="border-accent/25 bg-gradient-to-br from-accent/[0.03] via-transparent to-transparent p-0 overflow-hidden relative" data-testid="section-categories">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
                <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-bl-full" />
                
                <div className="p-6 pb-4 border-b border-accent/10">
                  <div className="flex items-center gap-4">
                    <motion.div 
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-14 h-14 rounded-2xl bg-accent/15 border-2 border-accent/25 flex items-center justify-center shadow-lg shadow-accent/10"
                    >
                      <BarChart3 className="w-7 h-7 text-accent" />
                    </motion.div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wider text-accent flex items-center gap-2" data-testid="text-categories-title">
                        Distribuição por Categoria
                        <Sparkles className="w-5 h-5 text-accent/60" />
                      </h2>
                      <p className="text-sm text-muted-foreground">Análise de estoque por categoria de produto</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-4">
                    {categoryData.map(([category, data], idx) => {
                      const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS["OUTROS"];
                      const pct = maxCatStock > 0 ? (data.stock / maxCatStock) * 100 : 0;
                      const totalPct = totalCatStock > 0 ? (data.stock / totalCatStock) * 100 : 0;
                      
                      return (
                        <motion.div
                          key={category}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ scale: 1.01, x: 5 }}
                          className="group relative"
                        >
                          <div className="flex items-center gap-4 mb-2">
                            <motion.div 
                              whileHover={{ scale: 1.3 }}
                              className={`w-3 h-3 rounded-full ${colors.dot} shadow-lg`} 
                            />
                            <span className={`text-sm font-black uppercase tracking-wider ${colors.text} min-w-[140px]`}>
                              {category}
                            </span>
                            <div className="flex-1 h-5 bg-muted/20 rounded-full overflow-hidden border border-white/5 relative group-hover:border-white/10 transition-colors">
                              <motion.div
                                className={`h-full rounded-full bg-gradient-to-r ${colors.gradient}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: idx * 0.1, ease: "easeOut" }}
                              />
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              />
                            </div>
                            <div className="text-right min-w-[100px]">
                              <span className={`text-lg font-black ${colors.text} tabular-nums`}>
                                {data.stock.toLocaleString('pt-BR')}
                              </span>
                              <span className="text-xs text-muted-foreground font-bold ml-1">
                                ({totalPct.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground pl-7">
                            <span className="font-medium">{data.count} produtos</span>
                            <span className="font-bold opacity-60">Média: {data.count > 0 ? Math.floor(data.stock / data.count) : 0} un/prod</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Resumo */}
                  <div className="mt-6 pt-6 border-t border-border/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { value: categoryData.length, label: 'Categorias', color: 'accent' },
                      { value: totalCatStock.toLocaleString('pt-BR'), label: 'Total Itens', color: 'blue' },
                      { value: categoryData.length > 0 ? Math.floor(totalCatStock / categoryData.reduce((a, [, v]) => a + v.count, 0)) : 0, label: 'Média/Prod', color: 'green' },
                      { value: categoryData.length > 0 ? categoryData[0][0] : '-', label: 'Maior Categ.', color: 'purple', isText: true }
                    ].map((item, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ scale: 1.05, y: -2 }}
                        className={`text-center p-4 rounded-xl bg-${item.color}-500/5 border border-${item.color}-500/10`}
                      >
                        <p className={`text-2xl font-black text-${item.color}-400 ${item.isText ? 'text-sm truncate' : ''}`}>{item.value}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">{item.label}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Coluna Direita - Sidebar Premium */}
        <div className="xl:col-span-4 space-y-6 relative z-10">
          
          {/* Card do Desenvolvedor */}
          <DeveloperContactCard />

          {/* Saldo do Dia - Melhorado */}
          <motion.div variants={item}>
            <Card className={`
              border-2 p-6 relative overflow-hidden
              ${saldoHoje >= 0 ? 'border-green-500/30 bg-green-500/[0.03]' : 'border-red-500/30 bg-red-500/[0.03]'}
            `}>
              <div className={`
                absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl 
                ${saldoHoje >= 0 ? 'from-green-500/10' : 'from-red-500/10'} 
                to-transparent rounded-bl-full
              `} />
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-30" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center border
                      ${saldoHoje >= 0 ? 'bg-green-500/15 border-green-500/25' : 'bg-red-500/15 border-red-500/25'}
                    `}
                  >
                    <Activity className={`w-6 h-6 ${saldoHoje >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                  </motion.div>
                  <div>
                    <h3 className={`
                      text-lg font-black uppercase tracking-wider
                      ${saldoHoje >= 0 ? 'text-green-400' : 'text-red-400'}
                    `}>
                      Saldo Hoje
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">Entradas - Saídas</p>
                  </div>
                </div>

                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="text-center py-4"
                >
                  <motion.span 
                    animate={{ 
                      textShadow: saldoHoje >= 0 
                        ? ["0 0 10px rgba(74,222,128,0.5)", "0 0 20px rgba(74,222,128,0.8)", "0 0 10px rgba(74,222,128,0.5)"]
                        : ["0 0 10px rgba(248,113,113,0.5)", "0 0 20px rgba(248,113,113,0.8)", "0 0 10px rgba(248,113,113,0.5)"]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`
                      text-5xl font-black tabular-nums
                      ${saldoHoje >= 0 ? 'text-green-400' : 'text-red-400'}
                    `}
                  >
                    {saldoHoje > 0 ? '+' : ''}{saldoHoje}
                  </motion.span>
                  <p className="text-sm text-muted-foreground font-bold mt-2 uppercase tracking-wider">
                    {saldoHoje >= 0 ? 'Superávit de Estoque' : 'Déficit de Estoque'}
                  </p>
                </motion.div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="text-center p-3 rounded-xl bg-green-500/10 border border-green-500/20"
                  >
                    <p className="text-xl font-black text-green-400">{stats?.entriesItemsToday || 0}</p>
                    <p className="text-[10px] text-green-400/70 uppercase font-bold tracking-wider">Entradas</p>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="text-center p-3 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <p className="text-xl font-black text-red-400">{stats?.exitsItemsToday || 0}</p>
                    <p className="text-[10px] text-red-400/70 uppercase font-bold tracking-wider">Saídas</p>
                  </motion.div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Status do Sistema - Melhorado */}
          <motion.div variants={item}>
            <Card className="border-accent/25 bg-gradient-to-br from-accent/[0.03] to-transparent p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-bl-full" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 rounded-xl bg-accent/15 border-2 border-accent/25 flex items-center justify-center"
                  >
                    <Zap className="w-6 h-6 text-accent" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-wider text-accent">Status do Sistema</h3>
                    <p className="text-xs text-muted-foreground font-medium">Informações técnicas</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: CheckCircle2, label: 'WebSocket', status: 'CONECTADO', color: 'green', animate: true },
                    { icon: CheckCircle2, label: 'API REST', status: 'ONLINE', color: 'blue', animate: false },
                    { icon: Users, label: 'Usuários Ativos', value: stats?.activeUsers || 0, color: 'purple', animate: false },
                    { icon: Clock, label: 'Uptime', value: '99.9%', color: 'orange', animate: false }
                  ].map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className={`flex items-center justify-between p-3 rounded-xl bg-${item.color}-500/5 border border-${item.color}-500/10`}
                    >
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={item.animate ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <item.icon className={`w-4 h-4 text-${item.color}-400`} />
                        </motion.div>
                        <span className="text-sm font-bold text-foreground">{item.label}</span>
                      </div>
                      {item.status ? (
                        <Badge className={`bg-${item.color}-500/15 text-${item.color}-400 border-${item.color}-500/20 text-xs font-black`}>
                          {item.status}
                        </Badge>
                      ) : (
                        <span className={`text-sm font-black text-${item.color}-400`}>{item.value}</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Versão */}
          <motion.div 
            variants={item} 
            className="text-center p-4 rounded-2xl bg-muted/5 border border-border/10"
          >
            <p className="text-xs text-muted-foreground/50 font-medium">
              Sistema de Almoxarifado v3.0 • {format(new Date(), "yyyy")}
            </p>
            <p className="text-[10px] text-muted-foreground/30 mt-1">
              
            </p>
          </motion.div>
        </div>
      </div>

      {/* Modal de Alterar Senha */}
      <ChangePasswordModal 
        open={showPasswordChange} 
        onOpenChange={setShowPasswordChange} 
      />
    </motion.div>
  );
}