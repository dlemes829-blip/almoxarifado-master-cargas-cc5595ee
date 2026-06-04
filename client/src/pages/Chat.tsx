import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket, type ChatMessage } from "@/hooks/use-websocket";
import { useUsers } from "@/hooks/use-users";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send, Users, User, Hash, ArrowLeft, MessageSquare,
  ChevronDown, ImagePlus, X, Check, CheckCheck, Download,
  Loader2, Search, Phone, Video, MoreVertical, Smile, Paperclip,
  Reply, Trash2, Edit2, AlertCircle, Mic,
  Link2, Copy, PhoneOff, MicOff, VideoOff, MonitorUp, Maximize2, Minimize2,
  Bell, BellOff, Pin, Camera, ImageIcon, RefreshCw, Wifi, WifiOff, PhoneCall,
} from "lucide-react";
import { format, isToday, isYesterday, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ==========================================
// UTILITÁRIOS
// ==========================================

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

function formatDateSeparator(dateStr: string): string {
  const parts = dateStr.split("/");
  const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

function formatMessageTime(date: string | Date): string {
  return format(new Date(date), "HH:mm");
}

function isSolicitacaoMessage(content: string): boolean {
  return content.includes("SOLICITAÇÃO DE MATERIAIS") && content.includes("ITENS SOLICITADOS");
}

function parseSolicitacaoItems(content: string, products: any[]) {
  const items: { produto_id: number; quantidade: number; nome: string }[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^- (.+?) \((\w+)\)/);
    if (match) {
      const productName = match[1].trim();
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const totalMatch = lines[j].match(/Total:\s*(\d+)/);
        if (totalMatch) {
          const qty = parseInt(totalMatch[1]);
          const product = products.find((p) => p.nome.toUpperCase() === productName.toUpperCase());
          if (product && qty > 0) items.push({ produto_id: product.id, quantidade: qty, nome: productName });
          break;
        }
        if (lines[j].match(/^- /)) break;
      }
    }
  }
  return items;
}

function detectContentType(content: string): "text" | "link" {
  if (content.match(/https?:\/\/[^\s]+/)) return "link";
  return "text";
}

function extractLinks(content: string): string[] {
  return content.match(/https?:\/\/[^\s]+/g) || [];
}

// ==========================================
// TIPOS
// ==========================================

type ChatMode = "group" | "dm";
type CallType = "audio" | "video" | null;
type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended" | "reconnecting";

interface ExtendedChatMessage extends ChatMessage {
  edited?: boolean; editedAt?: string;
  replyTo?: { id: string; sender: string; content: string };
  reactions?: Record<string, string[]>;
  isDeleted?: boolean; isPinned?: boolean;
  readBy?: string[]; readAt?: string;
}

interface IncomingCallData {
  from: string; type: "audio" | "video";
  offer: RTCSessionDescriptionInit;
  isGroup?: boolean; groupRoom?: string;
}

interface GroupParticipant {
  username: string; stream: MediaStream | null;
  pc: RTCPeerConnection; isMuted?: boolean; isVideoOff?: boolean;
}

interface CallState {
  isActive: boolean; type: CallType; status: CallStatus;
  targetUser: string | null; localStream: MediaStream | null;
  remoteStream: MediaStream | null; startTime: Date | null;
  isMuted: boolean; isVideoOff: boolean; isScreenSharing: boolean;
  connectionQuality: "good" | "medium" | "poor" | "unknown";
  isRemoteVideoOff: boolean; isGroup: boolean; groupRoom: string | null;
}

// ==========================================
// PALETA
// ==========================================

const COLOR_PALETTE = {
  avatarColors: [
    "from-violet-500 to-purple-700", "from-blue-500 to-cyan-600",
    "from-pink-500 to-rose-600", "from-amber-500 to-orange-600",
    "from-teal-500 to-emerald-600", "from-indigo-500 to-blue-700",
    "from-rose-500 to-pink-700", "from-cyan-500 to-sky-600",
  ],
};

// ==========================================
// ICE SERVERS
// ==========================================
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:openrelay.metered.ca:80" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

// ==========================================
// AVATAR UPLOAD
// ==========================================

function AvatarUpload({
  username, currentAvatar, onUpload, size = "md", showStatus = false, status = "offline",
}: {
  username: string; currentAvatar?: string; onUpload: (file: File | null) => void;
  size?: "sm" | "md" | "lg" | "xl"; showStatus?: boolean; status?: "online" | "offline" | "busy";
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs", md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base", xl: "w-24 h-24 text-lg",
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
    onUpload(file);
    setIsMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const statusColor = {
    online: "bg-emerald-400 shadow-emerald-400/60",
    busy: "bg-amber-400 shadow-amber-400/60",
    offline: "bg-slate-500",
  }[status];

  return (
    <div className="relative">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="relative group focus:outline-none">
            <Avatar className={cn(sizeClasses[size], "cursor-pointer transition-all hover:scale-105 ring-2 ring-offset-2 ring-offset-background ring-transparent hover:ring-primary/50")}>
              <AvatarImage src={currentAvatar || undefined} alt={username} className="object-cover" />
              <AvatarFallback className={cn("bg-gradient-to-br font-bold text-white", COLOR_PALETTE.avatarColors[username.length % COLOR_PALETTE.avatarColors.length])}>
                {username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {showStatus && (
              <span className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card shadow-lg", statusColor, status !== "offline" && "animate-pulse")} />
            )}
            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-1/3 h-1/3 text-white" />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuItem onClick={() => cameraInputRef.current?.click()} className="cursor-pointer">
            <Camera className="w-4 h-4 mr-2" /> Tirar foto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
            <ImageIcon className="w-4 h-4 mr-2" /> Escolher da galeria
          </DropdownMenuItem>
          {currentAvatar && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onUpload(null)} className="cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Remover foto
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ==========================================
// EMOJI PICKER
// ==========================================

const EMOJI_CATEGORIES = {
  recentes: ["👍", "❤️", "😂", "🎉", "🔥", "👏", "😍", "🤔"],
  emoticons: ["😀", "😂", "🥰", "😎", "🤔", "😴", "😭", "😡", "🤯", "🥳", "😇", "🤠"],
  gestures: ["👍", "👎", "👏", "🙏", "💪", "🤝", "👋", "✌️", "🤞", "👌", "🤌", "🫡"],
  objects: ["🔥", "⚡", "💯", "⭐", "🎉", "🎁", "💡", "🔔", "📌", "✅", "❌", "⚠️"],
  symbols: ["❤️", "💔", "💙", "💚", "💛", "💜", "🖤", "🤍", "💝", "💖", "💗", "💓"],
};

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>("emoticons");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      className="absolute bottom-full right-0 mb-2 border border-white/10 rounded-2xl shadow-2xl z-50 w-72 overflow-hidden"
      style={{ background: "rgba(10,10,24,0.97)", backdropFilter: "blur(24px)" }}
    >
      <div className="flex items-center gap-1 p-2 border-b border-white/5 overflow-x-auto">
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat as keyof typeof EMOJI_CATEGORIES)}
            className={cn("p-2 rounded-lg text-lg transition-all hover:scale-110 shrink-0",
              activeCategory === cat ? "bg-violet-600/30 ring-1 ring-violet-400/40" : "hover:bg-white/10")}>
            {EMOJI_CATEGORIES[cat as keyof typeof EMOJI_CATEGORIES][0]}
          </button>
        ))}
      </div>
      <div className="p-3 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
          <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
            className="w-9 h-9 flex items-center justify-center hover:bg-violet-500/20 rounded-lg transition-all hover:scale-110 text-xl">
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ==========================================
// REACTIONS
// ==========================================

function MessageReactions({ reactions, currentUser, onReact }: {
  reactions: Record<string, string[]>; currentUser: string; onReact: (emoji: string) => void;
}) {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(reactions).map(([emoji, users]) => {
        const hasReacted = users.includes(currentUser);
        return (
          <motion.button key={emoji} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
            onClick={() => onReact(emoji)}
            className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all",
              hasReacted
                ? "bg-violet-500/20 text-violet-300 border border-violet-400/40 shadow-sm shadow-violet-500/20"
                : "bg-white/5 hover:bg-white/10 border border-white/10")}
            title={users.join(", ")}>
            <span>{emoji}</span>
            <span className="font-bold">{users.length}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ==========================================
// CONTEXT MENU
// ==========================================

function MessageContextMenu({ isOpen, position, onClose, onReply, onDelete, onCopy, onReact, onPin, onEdit, isMe, hasText, isPinned, isDeleted }: {
  isOpen: boolean; position: { x: number; y: number }; onClose: () => void;
  onReply: () => void; onDelete?: () => void; onCopy?: () => void;
  onReact: (emoji: string) => void; onPin?: () => void; onEdit?: () => void;
  isMe: boolean; hasText: boolean; isPinned?: boolean; isDeleted?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || isDeleted) return null;

  const quickReactions = ["👍", "❤️", "😂", "🎉", "🔥", "😮"];
  const safeX = Math.min(position.x, window.innerWidth - 220);
  const safeY = Math.min(position.y, window.innerHeight - 260);

  return (
    <motion.div ref={menuRef}
      initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }} transition={{ duration: 0.12 }}
      style={{ position: "fixed", left: safeX, top: safeY, zIndex: 1000, background: "rgba(10,10,24,0.98)", backdropFilter: "blur(24px)" }}
      className="border border-white/10 rounded-2xl shadow-2xl py-1.5 min-w-[210px] overflow-hidden">
      <div className="flex items-center justify-around px-3 py-2 border-b border-white/8 mb-1">
        {quickReactions.map((emoji) => (
          <button key={emoji} onClick={() => { onReact(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all hover:scale-125 text-lg">
            {emoji}
          </button>
        ))}
      </div>
      {[
        { show: true, onClick: () => { onReply(); onClose(); }, icon: <Reply className="w-4 h-4" />, label: "Responder" },
        { show: !!onPin, onClick: () => { onPin?.(); onClose(); }, icon: <Pin className={cn("w-4 h-4", isPinned && "fill-current text-amber-400")} />, label: isPinned ? "Desfixar" : "Fixar mensagem" },
        { show: hasText, onClick: () => { onCopy?.(); onClose(); }, icon: <Copy className="w-4 h-4" />, label: "Copiar texto" },
        { show: hasText && isMe && !!onEdit, onClick: () => { onEdit?.(); onClose(); }, icon: <Edit2 className="w-4 h-4" />, label: "Editar mensagem" },
      ].filter(a => a.show).map((action, i) => (
        <button key={i} onClick={action.onClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-all text-left">
          <span className="text-white/40">{action.icon}</span> {action.label}
        </button>
      ))}
      {isMe && onDelete && (
        <>
          <div className="my-1 h-px bg-white/5 mx-3" />
          <button onClick={() => { onDelete(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-500/10 transition-all text-left text-red-400">
            <Trash2 className="w-4 h-4" /> Excluir mensagem
          </button>
        </>
      )}
    </motion.div>
  );
}

// ==========================================
// READ STATUS
// ==========================================

function ReadStatus({ msg, currentUser, chatMode }: {
  msg: ExtendedChatMessage; currentUser: any; chatMode: ChatMode;
}) {
  const isMe = msg.sender === currentUser?.username;
  if (!isMe) return null;
  const readBy = (msg.readBy || []).filter((u) => u !== currentUser?.username);
  const isRead = readBy.length > 0;
  const readCount = readBy.length;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex items-center ml-1 cursor-help">
            <motion.span initial={false} animate={isRead ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 0.3 }}>
              {isRead
                ? <CheckCheck className="w-3.5 h-3.5 text-cyan-400" strokeWidth={2.5} />
                : <Check className="w-3.5 h-3.5 text-white/25" strokeWidth={2} />}
            </motion.span>
            {readCount > 1 && chatMode === "group" && (
              <span className="absolute -top-2 -right-2.5 min-w-[16px] h-4 px-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {readCount}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-popover/95 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isRead ? "bg-cyan-400" : "bg-amber-400 animate-pulse")} />
            <span className="text-xs">{isRead ? `Visto por ${readBy.slice(0, 3).join(", ")}` : "Enviado"}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ==========================================
// CONNECTION QUALITY
// ==========================================

function ConnectionQualityIndicator({ quality }: { quality: "good" | "medium" | "poor" | "unknown" }) {
  const config = {
    good: { icon: Wifi, color: "text-emerald-400", label: "Ótima conexão" },
    medium: { icon: Wifi, color: "text-amber-400", label: "Conexão média" },
    poor: { icon: WifiOff, color: "text-red-400", label: "Conexão ruim" },
    unknown: { icon: Wifi, color: "text-white/20", label: "Verificando..." },
  };
  const { icon: Icon, color, label } = config[quality];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", color)}>
            <Icon className="w-4 h-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent><span className="text-xs">{label}</span></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ==========================================
// GROUP PARTICIPANT TILE
// ==========================================

function GroupParticipantTile({ participant }: { participant: GroupParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && participant.stream) videoRef.current.srcObject = participant.stream;
  }, [participant.stream]);
  const hasVideo = !!participant.stream?.getVideoTracks().length && !participant.isVideoOff;
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/5">
      <video ref={videoRef} autoPlay playsInline className={cn("w-full h-full object-cover", hasVideo ? "block" : "hidden")} />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
            {participant.username.substring(0, 2).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-white/70 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
        style={{ background: "rgba(0,0,0,0.6)" }}>
        {participant.isMuted && <MicOff className="w-3 h-3 text-red-400" />}
        {participant.username}
      </div>
    </div>
  );
}

// ==========================================
// CALL INTERFACE
// ==========================================

function CallInterface({
  callState, onEndCall, onToggleMute, onToggleVideo, onToggleScreenShare,
  currentUser, targetUser, groupParticipants,
}: {
  callState: CallState; onEndCall: () => void; onToggleMute: () => void;
  onToggleVideo: () => void; onToggleScreenShare: () => void;
  currentUser: any; targetUser: string; groupParticipants?: Map<string, GroupParticipant>;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = callState.localStream || null; }, [callState.localStream]);
  useEffect(() => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = callState.remoteStream || null; }, [callState.remoteStream]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callState.status === "connected" && callState.startTime) {
      interval = setInterval(() => setCallDuration(Math.floor((Date.now() - callState.startTime!.getTime()) / 1000)), 1000);
    }
    return () => clearInterval(interval);
  }, [callState.status, callState.startTime]);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const statusText = {
    calling: "Chamando...", ringing: "Recebendo chamada...",
    connected: formatDuration(callDuration), reconnecting: "Reconectando...",
    idle: "", ended: "Encerrada",
  }[callState.status] || "";

  const showRemoteVideo = callState.type === "video" && !!callState.remoteStream && !callState.isRemoteVideoOff;
  const showLocalVideo = callState.type === "video" && !!callState.localStream && !callState.isVideoOff;
  const participants = groupParticipants ? Array.from(groupParticipants.values()) : [];
  const isGroup = callState.isGroup && participants.length > 0;

  if (isMinimized) {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-6 right-6 z-[200] rounded-2xl shadow-2xl p-4 w-72 border border-white/10"
        style={{ background: "rgba(8,8,20,0.97)", backdropFilter: "blur(24px)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                {isGroup ? <Users className="w-5 h-5" /> : targetUser.substring(0, 2).toUpperCase()}
              </div>
              {callState.status === "connected" && (
                <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#080814]" />
              )}
            </div>
            <div>
              <p className="text-white text-sm font-bold">{isGroup ? "Chamada em Grupo" : targetUser}</p>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-mono", callState.status === "connected" ? "text-emerald-400" : "text-white/40")}>{statusText}</span>
                {callState.status === "connected" && <ConnectionQualityIndicator quality={callState.connectionQuality} />}
              </div>
            </div>
          </div>
          <button onClick={() => setIsMinimized(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onToggleMute} className={cn("p-3 rounded-xl transition-all", callState.isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
            {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          {callState.type === "video" && (
            <button onClick={onToggleVideo} className={cn("p-3 rounded-xl transition-all", callState.isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
              {callState.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}
          <button onClick={onEndCall} className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all">
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex flex-col" style={{ background: "#040410" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative flex items-center justify-between p-5 z-10"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold ring-2 ring-white/10">
            {isGroup ? <Users className="w-6 h-6" /> : targetUser.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{isGroup ? `Chamada em Grupo (${participants.length + 1})` : targetUser}</h3>
            <div className="flex items-center gap-2">
              {callState.status === "reconnecting" ? (
                <div className="flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <RefreshCw className="w-3 h-3 text-amber-400" />
                  </motion.div>
                  <span className="text-amber-400 text-sm">Reconectando...</span>
                </div>
              ) : (
                <>
                  <motion.div animate={{ opacity: callState.status === "connected" ? [1, 0.3, 1] : 1 }} transition={{ duration: 1.5, repeat: Infinity }}
                    className={cn("w-2 h-2 rounded-full", callState.status === "connected" ? "bg-emerald-400" : "bg-white/30")} />
                  <span className="text-white/60 text-sm font-mono">{statusText}</span>
                </>
              )}
              {callState.status === "connected" && <ConnectionQualityIndicator quality={callState.connectionQuality} />}
            </div>
          </div>
        </div>
        <button onClick={() => setIsMinimized(true)} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all">
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-4 z-10">
        {isGroup ? (
          <div className={cn("w-full h-full grid gap-3",
            participants.length === 1 ? "grid-cols-2" :
            participants.length <= 3 ? "grid-cols-2" : "grid-cols-3")}>
            <div className="relative rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/5">
              <video ref={localVideoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover scale-x-[-1]", showLocalVideo ? "block" : "hidden")} />
              {!showLocalVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
                    {currentUser?.username?.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-white/70 text-[10px] bg-black/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                {callState.isMuted && <MicOff className="w-3 h-3 text-red-400" />} Você
              </div>
            </div>
            {participants.map((p) => <GroupParticipantTile key={p.username} participant={p} />)}
          </div>
        ) : (
          <div className="relative w-full max-w-5xl aspect-video bg-black/40 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5">
            <video ref={remoteVideoRef} autoPlay playsInline className={cn("w-full h-full object-cover", showRemoteVideo ? "block" : "hidden")} />
            {!showRemoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <motion.div animate={callState.status === "calling" ? { scale: [1, 1.06, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-28 h-28 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-600/20 flex items-center justify-center text-white text-4xl font-black ring-2 ring-white/10">
                  {targetUser.substring(0, 2).toUpperCase()}
                </motion.div>
                <p className="text-white/30 text-sm">
                  {callState.status === "calling" && "Aguardando resposta..."}
                  {callState.status === "connected" && callState.type === "video" && callState.isRemoteVideoOff && "Câmera remota desligada"}
                  {callState.status === "connected" && callState.type === "audio" && "Chamada de voz ativa"}
                  {callState.status === "reconnecting" && "Reconectando..."}
                </p>
              </div>
            )}
            {callState.status === "connected" && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 ring-white/10"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-white text-xs font-bold tracking-wider">AO VIVO</span>
              </div>
            )}
          </div>
        )}

        {!isGroup && callState.type === "video" && (
          <motion.div drag dragMomentum={false}
            className="absolute bottom-8 right-8 w-44 aspect-video bg-black/60 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 cursor-move z-10">
            <video ref={localVideoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover scale-x-[-1]", showLocalVideo ? "block" : "hidden")} />
            {!showLocalVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <VideoOff className="w-8 h-8 text-white/30" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-white/50 text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.5)" }}>Você</div>
          </motion.div>
        )}
      </div>

      <div className="relative p-6 z-10" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.5), transparent)" }}>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {[
            { onClick: onToggleMute, active: callState.isMuted, icon: callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />, label: callState.isMuted ? "Ativar mic" : "Silenciar" },
            ...(callState.type === "video" ? [{ onClick: onToggleVideo, active: callState.isVideoOff, icon: callState.isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />, label: callState.isVideoOff ? "Ligar câmera" : "Câmera off" }] : []),
          ].map((btn, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={btn.onClick}
                className={cn("p-4 rounded-2xl transition-all shadow-lg",
                  btn.active ? "bg-red-500 text-white shadow-red-500/30" : "text-white hover:bg-white/20")}
                style={!btn.active ? { background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" } : {}}>
                {btn.icon}
              </motion.button>
              <span className="text-white/30 text-xs">{btn.label}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} onClick={onEndCall}
              className="p-5 rounded-2xl bg-gradient-to-r from-red-500 to-red-700 text-white shadow-2xl shadow-red-600/40">
              <PhoneOff className="w-7 h-7" />
            </motion.button>
            <span className="text-white/30 text-xs">Encerrar</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onToggleScreenShare}
              className={cn("p-4 rounded-2xl transition-all shadow-lg",
                callState.isScreenSharing ? "bg-emerald-500 text-white shadow-emerald-500/30" : "text-white hover:bg-white/20")}
              style={!callState.isScreenSharing ? { background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" } : {}}>
              <MonitorUp className="w-6 h-6" />
            </motion.button>
            <span className="text-white/30 text-xs">{callState.isScreenSharing ? "Parar tela" : "Comp. tela"}</span>
          </div>
        </div>
        <p className="text-center text-white/15 text-xs mt-4 tracking-wide">
          {callState.type === "video" ? "📹 Chamada de vídeo" : "🎙️ Chamada de voz"} • 🔒 Criptografada
        </p>
      </div>
    </motion.div>
  );
}

// ==========================================
// MESSAGE BUBBLE
// ==========================================

function MessageBubble({
  msg, isMe, showAvatar, showName, isConsecutive, senderColor, avatarBgColor,
  currentUser, chatMode, canBulkExit, onBulkExit, bulkExitLoading,
  onImageClick, onReply, onDelete, onEdit, onReact, onPin, isPinned, userAvatar,
}: {
  msg: ExtendedChatMessage; isMe: boolean; showAvatar: boolean; showName: boolean;
  isConsecutive: boolean; senderColor: string; avatarBgColor: string; currentUser: any;
  chatMode: ChatMode; canBulkExit: boolean; onBulkExit: (msgId: string, content: string) => void;
  bulkExitLoading: string | null; onImageClick: (url: string) => void;
  onReply: (msg: ExtendedChatMessage) => void; onDelete?: (msgId: string) => void;
  onEdit?: (msgId: string, content: string) => void; onReact: (msgId: string, emoji: string) => void;
  onPin?: (msgId: string) => void; isPinned?: boolean; userAvatar?: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);

  const isSolicitacao = isSolicitacaoMessage(msg.content);
  const isImage = msg.type === "image" && msg.imageUrl;
  const isDeleted = msg.isDeleted;
  const contentType = detectContentType(msg.content);
  const links = extractLinks(msg.content);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== msg.content) onEdit?.(msg.id, editContent);
    setIsEditing(false);
  };

  if (isDeleted) {
    return (
      <div className={cn("flex", isConsecutive ? "mt-0.5" : "mt-4", isMe ? "justify-end" : "justify-start")}>
        {!isMe && <div className="w-10 mr-3 shrink-0" />}
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl italic text-xs text-white/20 border border-white/5"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          <Trash2 className="w-3 h-3" /> Mensagem excluída
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className={cn("flex", isMe ? "justify-end" : "justify-start", isConsecutive ? "mt-0.5" : "mt-4")}>
        {!isMe && <div className="w-10 mr-3 shrink-0" />}
        <div className={cn("max-w-[75%] sm:max-w-[60%] w-full rounded-2xl overflow-hidden",
          isMe ? "bg-gradient-to-br from-violet-600 to-blue-600" : "border border-white/10")}
          style={!isMe ? { background: "rgba(255,255,255,0.07)" } : {}}>
          <div className="p-3">
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-transparent border-0 resize-none outline-none text-sm text-white placeholder:text-white/40"
              rows={2} autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                if (e.key === "Escape") { setIsEditing(false); setEditContent(msg.content); }
              }} />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button onClick={() => { setIsEditing(false); setEditContent(msg.content); }}
                className="text-xs opacity-50 hover:opacity-100 px-3 py-1 rounded-full hover:bg-white/10 transition-all">Cancelar</button>
              <button onClick={handleEditSubmit}
                className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn("flex group", isConsecutive ? "mt-0.5" : "mt-4", isMe ? "justify-end" : "justify-start")}
      onContextMenu={handleContextMenu}>

      {!isMe && (
        <div className="w-10 mr-3 flex-shrink-0 self-end">
          {showAvatar ? (
            <Avatar className="w-10 h-10 ring-1 ring-white/10">
              <AvatarImage src={userAvatar || undefined} alt={msg.sender} className="object-cover" />
              <AvatarFallback className={cn("text-xs font-bold bg-gradient-to-br text-white", COLOR_PALETTE.avatarColors[msg.sender.length % COLOR_PALETTE.avatarColors.length])}>
                {msg.sender.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : <div className="w-10" />}
        </div>
      )}

      <div className={cn("max-w-[75%] sm:max-w-[60%] relative", isMe ? "items-end" : "items-start")}>
        {showName && (
          <p className={cn("text-[11px] font-bold mb-1 ml-1 uppercase tracking-wide", senderColor)}>{msg.sender}</p>
        )}

        {msg.replyTo && (
          <div className={cn("mb-1.5 px-3 py-2 rounded-xl text-xs border-l-2",
            isMe ? "border-white/30 text-white/60" : "border-violet-400/60 text-white/50")}
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <p className="font-bold truncate mb-0.5">{msg.replyTo.sender}</p>
            <p className="truncate opacity-70">{msg.replyTo.content.substring(0, 80)}</p>
          </div>
        )}

        <div className={cn(
          "relative rounded-2xl overflow-hidden transition-shadow shadow-sm group-hover:shadow-md",
          isMe
            ? chatMode === "dm"
              ? "bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-600 text-white rounded-br-sm"
              : "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-br-sm"
            : "text-white rounded-bl-sm border border-white/8",
          !isMe && "bg-[rgba(255,255,255,0.07)]",
          isPinned && "ring-2 ring-amber-400/40",
        )}>
          {isPinned && <div className="absolute top-2 right-8 text-amber-400 opacity-60"><Pin className="w-3 h-3 fill-current" /></div>}

          <div className={cn("absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all z-10", showMenu && "opacity-100")}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const r = (e.target as HTMLElement).getBoundingClientRect();
                setMenuPosition({ x: r.left, y: r.bottom + 4 });
                setShowMenu(!showMenu);
              }}
              className={cn("p-1.5 rounded-lg transition-colors backdrop-blur-sm",
                isMe ? "hover:bg-black/20" : "hover:bg-white/15")}>
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>

          <AnimatePresence>
            {showMenu && (
              <MessageContextMenu
                isOpen={showMenu} position={menuPosition} onClose={() => setShowMenu(false)}
                onReply={() => onReply(msg)}
                onDelete={isMe ? () => onDelete?.(msg.id) : undefined}
                onCopy={() => navigator.clipboard.writeText(msg.content)}
                onReact={(emoji) => onReact(msg.id, emoji)}
                onPin={onPin ? () => onPin(msg.id) : undefined}
                onEdit={isMe && !isImage ? () => setIsEditing(true) : undefined}
                isMe={isMe} hasText={!isImage && !isSolicitacao} isPinned={isPinned} isDeleted={isDeleted}
              />
            )}
          </AnimatePresence>

          {isImage ? (
            <div className="p-1.5 cursor-pointer" onClick={() => onImageClick(msg.imageUrl!)}>
              <div className="relative">
                {!imageLoaded && (
                  <div className="absolute inset-0 animate-pulse rounded-xl flex items-center justify-center min-h-[120px]"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    <ImagePlus className="w-8 h-8 text-white/20" />
                  </div>
                )}
                <motion.img whileHover={{ scale: 1.02 }} src={msg.imageUrl} alt="Imagem"
                  className="rounded-xl max-w-[300px] max-h-[350px] object-cover w-full"
                  loading="lazy" onLoad={() => setImageLoaded(true)} />
              </div>
            </div>
          ) : isSolicitacao ? (
            <div className="px-4 py-3 max-w-[340px]">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Solicitação de Materiais</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words leading-relaxed font-mono opacity-80 pr-6">{msg.content}</pre>
              {chatMode === "group" && canBulkExit && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={(e) => { e.stopPropagation(); onBulkExit(msg.id, msg.content); }}
                  disabled={bulkExitLoading === msg.id}
                  className="mt-3 w-full bg-gradient-to-r from-red-500 to-red-600 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl h-10 flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20">
                  {bulkExitLoading === msg.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</> : <><Download className="w-4 h-4" /> Baixar do Estoque</>}
                </motion.button>
              )}
            </div>
          ) : (
            <div className="px-4 py-2.5">
              {contentType === "link" ? (
                <div className="space-y-1.5 pr-6">
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  {links.map((link, idx) => (
                    <a key={idx} href={link} target="_blank" rel="noopener noreferrer"
                      className={cn("flex items-center gap-2 p-2 rounded-lg text-xs break-all transition-all",
                        isMe ? "bg-black/15 hover:bg-black/25" : "hover:bg-white/5")}
                      style={!isMe ? { background: "rgba(255,255,255,0.04)" } : {}}
                      onClick={(e) => e.stopPropagation()}>
                      <Link2 className="w-3 h-3 shrink-0 opacity-60" />{link}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed pr-6">{msg.content}</p>
              )}
              {msg.edited && <span className="text-[10px] opacity-40 ml-1">(editado)</span>}
            </div>
          )}

          <div className={cn("flex items-center justify-end gap-1 px-3 pb-2", isMe ? "text-white/50" : "text-white/30")}>
            <span className="text-[10px] select-none tabular-nums">{formatMessageTime(msg.timestamp)}</span>
            <ReadStatus msg={msg} currentUser={currentUser} chatMode={chatMode} />
          </div>
        </div>

        <MessageReactions reactions={msg.reactions || {}} currentUser={currentUser?.username} onReact={(emoji) => onReact(msg.id, emoji)} />
      </div>
    </motion.div>
  );
}

// ==========================================
// TYPING INDICATOR
// ==========================================

function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;
  const text = users.length === 1 ? `${users[0]} está digitando`
    : users.length === 2 ? `${users[0]} e ${users[1]} estão digitando`
    : `${users[0]} e mais ${users.length - 1} estão digitando`;

  return (
    <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: 8, height: 0 }} transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-5 py-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl rounded-bl-sm border border-white/8"
        style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="flex gap-1 items-end">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              className="w-1.5 h-1.5 bg-gradient-to-r from-violet-400 to-blue-400 rounded-full" />
          ))}
        </div>
        <span className="text-[11px] text-white/30 ml-1 italic">{text}...</span>
      </div>
    </motion.div>
  );
}

// ==========================================
// CHAT INPUT
// ==========================================

function ChatInput({ value, onChange, onSubmit, onImageSelect, replyingTo, onCancelReply, disabled, chatMode, dmTarget, onTyping }: {
  value: string; onChange: (value: string) => void; onSubmit: () => void; onImageSelect: () => void;
  replyingTo: ExtendedChatMessage | null; onCancelReply: () => void; disabled?: boolean;
  chatMode: ChatMode; dmTarget: string | null; onTyping?: () => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleChange = (v: string) => {
    onChange(v);
    onTyping?.();
  };

  return (
    <div className="border-t border-white/5 shrink-0" style={{ background: "rgba(6,6,18,0.9)", backdropFilter: "blur(16px)" }}>
      <AnimatePresence>
        {replyingTo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-1 h-8 bg-gradient-to-b from-violet-400 to-blue-400 rounded-full shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-violet-300">↩ Respondendo a {replyingTo.sender}</p>
                <p className="text-xs text-white/25 truncate">{replyingTo.content.substring(0, 70)}{replyingTo.content.length > 70 && "..."}</p>
              </div>
            </div>
            <button onClick={onCancelReply} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors ml-2 shrink-0">
              <X className="w-4 h-4 text-white/30 hover:text-white/60" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex items-end gap-2 px-4 py-3">
        <Button type="button" variant="ghost" size="icon"
          className="rounded-xl w-10 h-10 text-white/25 hover:text-white/60 hover:bg-white/5 transition-all shrink-0"
          onClick={onImageSelect}>
          <Paperclip className="w-5 h-5" />
        </Button>

        <div className="relative flex-1">
          <textarea ref={textareaRef} value={value} onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
            placeholder={chatMode === "dm" ? `Mensagem para ${dmTarget}...` : "Mensagem para o grupo..."}
            disabled={disabled} rows={1}
            className="w-full border border-white/8 rounded-2xl px-4 py-3 pr-12 text-sm resize-none max-h-32 outline-none text-white placeholder:text-white/20 transition-all focus:border-violet-400/30 focus:ring-2 focus:ring-violet-400/10"
            style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="absolute right-2 bottom-2">
            <Button type="button" variant="ghost" size="icon"
              className="rounded-xl w-8 h-8 text-white/25 hover:text-white/60 hover:bg-white/5 transition-all"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              <Smile className="w-5 h-5" />
            </Button>
            <AnimatePresence>
              {showEmojiPicker && (
                <EmojiPicker onSelect={(emoji) => { handleChange(value + emoji); setShowEmojiPicker(false); }} onClose={() => setShowEmojiPicker(false)} />
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.div whileTap={{ scale: 0.92 }}>
          <Button type="submit" disabled={!value.trim() || disabled}
            className="rounded-xl h-10 w-10 p-0 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-30 shrink-0 shadow-lg shadow-violet-600/25 transition-all border-0">
            {disabled ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </motion.div>
      </form>
    </div>
  );
}

// ==========================================
// CHAT PRINCIPAL
// ==========================================

export default function Chat() {
  const { user: currentUser } = useAuth();
  const {
    onlineUsers, chatMessages, setChatMessages, sendMessage,
    markChatAsRead, typingUsers, socket, sounds,
    avatarCache,
    // ✅ activeCall global — compartilhado com GlobalCallNotification
    activeCall, setActiveCall,
  } = useWebSocket();
  const { data: allUsers = [] } = useUsers();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("group");
  const [dmTarget, setDmTarget] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkExitLoading, setBulkExitLoading] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ExtendedChatMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [products, setProducts] = useState<any[]>([]);

  // ✅ incomingCall local — sincronizado com activeCall global via useEffect
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  const [callState, setCallState] = useState<CallState>({
    isActive: false, type: null, status: "idle", targetUser: null,
    localStream: null, remoteStream: null, startTime: null,
    isMuted: false, isVideoOff: false, isScreenSharing: false,
    connectionQuality: "unknown", isRemoteVideoOff: false, isGroup: false, groupRoom: null,
  });

  const [groupParticipants, setGroupParticipants] = useState<Map<string, GroupParticipant>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const groupPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTargetRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidatesQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const groupRoomRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((d) => setProducts(d)).catch(() => {});
    }
  }, []);

  // ✅ Sync: quando GlobalCallNotification é exibido em outra página e o usuário
  // navega para o chat, o activeCall ainda está no contexto — reflete localmente
  useEffect(() => {
    if (activeCall) {
      setIncomingCall({
        from: activeCall.from,
        type: activeCall.type,
        offer: activeCall.offer,
        isGroup: activeCall.isGroup,
        groupRoom: activeCall.groupRoom,
      });
    } else {
      setIncomingCall(null);
    }
  }, [activeCall]);

  // ✅ Resposta pendente: usuário clicou "Atender" em outra página
  // e foi redirecionado para cá via GlobalCallNotification
  useEffect(() => {
    const handlePendingCall = () => {
      try {
        const raw = localStorage.getItem("pending_call_answer");
        if (!raw) return;
        localStorage.removeItem("pending_call_answer");
        const data = JSON.parse(raw);
        if (Date.now() - data.answeredAt > 30000) return;
        const callData: IncomingCallData = {
          from: data.from, type: data.type,
          offer: data.offer, isGroup: data.isGroup, groupRoom: data.groupRoom,
        };
        setTimeout(() => answerCall(callData), 400);
      } catch {}
    };

    handlePendingCall();
    window.addEventListener("answer_pending_call", handlePendingCall);
    return () => window.removeEventListener("answer_pending_call", handlePendingCall);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================
  // AVATAR UPLOAD
  // ==========================================
  const handleAvatarUpload = useCallback(async (username: string, file: File | null) => {
    const token = localStorage.getItem("token");
    if (!file) {
      try {
        const userId = allUsers.find((u) => u.username === username)?.id;
        if (userId) {
          await fetch(`/api/users/${userId}/avatar`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        }
        toast({ title: "Foto de perfil removida" });
      } catch { toast({ title: "Erro ao remover foto", variant: "destructive" }); }
      return;
    }
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/users/avatar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      if (!res.ok) throw new Error("Upload falhou");
      // ✅ Não precisa setar estado local — WS broadcast `user_avatar_updated` faz o sync
      toast({ title: "✅ Foto atualizada!", description: "Todos os usuários já viram a nova foto." });
    } catch { toast({ title: "Erro", description: "Falha ao atualizar foto", variant: "destructive" }); }
  }, [allUsers, toast]);

  // ==========================================
  // QUALIDADE
  // ==========================================
  const startQualityMonitor = useCallback(() => {
    if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current);
    qualityIntervalRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rtt = 0, packetsLost = 0, packetsReceived = 0;
        stats.forEach((r) => {
          if (r.type === "remote-inbound-rtp") { rtt = r.roundTripTime || 0; packetsLost += r.packetsLost || 0; }
          if (r.type === "inbound-rtp") packetsReceived += r.packetsReceived || 0;
        });
        const lossRate = packetsReceived > 0 ? packetsLost / (packetsLost + packetsReceived) : 0;
        const quality: "good" | "medium" | "poor" = rtt > 0.3 || lossRate > 0.1 ? "poor" : rtt > 0.15 || lossRate > 0.05 ? "medium" : "good";
        setCallState((prev) => ({ ...prev, connectionQuality: quality }));
      } catch {}
    }, 3000);
  }, []);

  const stopQualityMonitor = useCallback(() => {
    if (qualityIntervalRef.current) { clearInterval(qualityIntervalRef.current); qualityIntervalRef.current = null; }
  }, []);

  // ==========================================
  // FLUSH ICE CANDIDATES
  // ==========================================
  const flushIceCandidatesFor = useCallback(async (pc: RTCPeerConnection, key: string) => {
    if (!pc || !pc.remoteDescription) return;
    const queue = iceCandidatesQueueRef.current.get(key) || [];
    const remaining: RTCIceCandidateInit[] = [];
    for (const candidate of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch { remaining.push(candidate); }
    }
    iceCandidatesQueueRef.current.set(key, remaining);
  }, []);

  // ==========================================
  // END CALL
  // ==========================================
  const endCall = useCallback((reason?: string) => {
    stopQualityMonitor();
    sounds.stopRingtone();

    groupPeerConnectionsRef.current.forEach((pc, username) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "webrtc_end", data: { target: username, reason: reason || "ended" } }));
      }
      try { pc.close(); } catch {}
    });
    groupPeerConnectionsRef.current.clear();
    setGroupParticipants(new Map());
    groupRoomRef.current = null;

    if (callTargetRef.current && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "webrtc_end", data: { target: callTargetRef.current, reason: reason || "ended" } }));
    }

    const pc = peerConnectionRef.current;
    if (pc) {
      try {
        pc.getSenders().forEach((s) => { try { if (s.track) pc.removeTrack(s); } catch {} });
        pc.getTransceivers().forEach((t) => { try { t.stop(); } catch {} });
        pc.close();
      } catch {}
      pc.onicecandidate = null; pc.oniceconnectionstatechange = null;
      pc.ontrack = null; pc.onnegotiationneeded = null; pc.onconnectionstatechange = null;
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => { t.stop(); t.enabled = false; });
      localStreamRef.current = null;
    }

    iceCandidatesQueueRef.current.clear();
    callTargetRef.current = null;
    reconnectAttemptRef.current = 0;
    sounds.play("call_end");
    // ✅ Limpar contexto global também
    setActiveCall(null);
    setIncomingCall(null);

    setCallState({
      isActive: false, type: null, status: "idle", targetUser: null,
      localStream: null, remoteStream: null, startTime: null,
      isMuted: false, isVideoOff: false, isScreenSharing: false,
      connectionQuality: "unknown", isRemoteVideoOff: false, isGroup: false, groupRoom: null,
    });
  }, [socket, stopQualityMonitor, sounds, setActiveCall]);

  // ==========================================
  // CREATE PEER CONNECTION (1:1)
  // ==========================================
  const createPeerConnection = useCallback((): RTCPeerConnection => {
    if (peerConnectionRef.current) {
      const old = peerConnectionRef.current;
      old.onicecandidate = null; old.oniceconnectionstatechange = null;
      old.ontrack = null; old.onnegotiationneeded = null; old.onconnectionstatechange = null;
      try { old.close(); } catch {}
      peerConnectionRef.current = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS, iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle", rtcpMuxPolicy: "require",
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.readyState === WebSocket.OPEN && callTargetRef.current) {
        socket.send(JSON.stringify({
          type: "webrtc_ice_candidate",
          data: { target: callTargetRef.current, candidate: event.candidate },
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      switch (state) {
        case "connected": case "completed":
          reconnectAttemptRef.current = 0;
          sounds.play("call_connect");
          setCallState((prev) => ({ ...prev, status: "connected", startTime: prev.startTime || new Date(), connectionQuality: "good" }));
          startQualityMonitor();
          if (callTargetRef.current) flushIceCandidatesFor(pc, callTargetRef.current);
          break;
        case "disconnected":
          setCallState((prev) => ({ ...prev, status: "reconnecting" }));
          setTimeout(() => { if (peerConnectionRef.current?.iceConnectionState === "disconnected") peerConnectionRef.current.restartIce(); }, 3000);
          break;
        case "failed":
          if (reconnectAttemptRef.current < 3) {
            reconnectAttemptRef.current++;
            setCallState((prev) => ({ ...prev, status: "reconnecting" }));
            pc.restartIce();
          } else {
            toast({ title: "Chamada encerrada", description: "Não foi possível reconectar", variant: "destructive" });
            endCall();
          }
          break;
        case "closed": stopQualityMonitor(); break;
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      setCallState((prev) => ({ ...prev, remoteStream }));
      remoteStream.getVideoTracks().forEach((track) => {
        const update = () => setCallState((prev) => ({ ...prev, isRemoteVideoOff: !track.enabled || track.muted }));
        track.onmute = update; track.onunmute = update; track.onended = update; update();
      });
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, startQualityMonitor, stopQualityMonitor, sounds, toast, endCall, flushIceCandidatesFor]);

  // ==========================================
  // CREATE GROUP PEER CONNECTION
  // ==========================================
  const createGroupPeerConnection = useCallback((targetUsername: string): RTCPeerConnection => {
    const existing = groupPeerConnectionsRef.current.get(targetUsername);
    if (existing) { try { existing.close(); } catch {} }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "webrtc_ice_candidate",
          data: { target: targetUsername, candidate: event.candidate, groupRoom: groupRoomRef.current },
        }));
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      setGroupParticipants((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetUsername);
        next.set(targetUsername, existing ? { ...existing, stream } : { username: targetUsername, stream, pc });
        return next;
      });
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        setCallState((prev) => ({ ...prev, status: "connected", startTime: prev.startTime || new Date() }));
        startQualityMonitor();
        flushIceCandidatesFor(pc, targetUsername);
      }
      if (state === "failed") pc.restartIce();
    };

    groupPeerConnectionsRef.current.set(targetUsername, pc);
    return pc;
  }, [socket, startQualityMonitor, flushIceCandidatesFor]);

  // ==========================================
  // START CALL (1:1)
  // ==========================================
  const startCall = useCallback(async (type: "audio" | "video", targetUser: string) => {
    if (callState.isActive) { toast({ title: "Chamada em andamento" }); return; }
    if (!socket || socket.readyState !== WebSocket.OPEN) { toast({ title: "Sem conexão", variant: "destructive" }); return; }
    if (!targetUser || targetUser === currentUser?.username) return;
    if (!onlineUsers.some(u => u.username === targetUser)) {
      toast({ title: "Usuário offline", description: `${targetUser} não está disponível`, variant: "destructive" }); return;
    }

    let callType = type;
    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 },
          video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" } : false,
        });
      } catch (mediaErr: any) {
        if (callType === "video" && mediaErr.name === "NotAllowedError") {
          toast({ title: "Câmera não disponível", description: "Chamada de áudio apenas..." });
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
          callType = "audio";
        } else throw mediaErr;
      }

      localStreamRef.current = stream;
      callTargetRef.current = targetUser;
      setCallState({ isActive: true, type: callType, status: "calling", targetUser, localStream: stream, remoteStream: null, startTime: null, isMuted: false, isVideoOff: false, isScreenSharing: false, connectionQuality: "unknown", isRemoteVideoOff: false, isGroup: false, groupRoom: null });

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" });
      await pc.setLocalDescription(offer);

      sounds.play("call");
      socket.send(JSON.stringify({ type: "webrtc_offer", data: { target: targetUser, offer: pc.localDescription, type: callType, from: currentUser?.username } }));
    } catch (err: any) {
      const errorMap: Record<string, string> = { NotAllowedError: "Permissão negada.", NotFoundError: "Câmera/microfone não encontrado.", NotReadableError: "Dispositivo em uso.", SecurityError: "HTTPS necessário." };
      toast({ title: "Erro ao iniciar chamada", description: errorMap[err.name] || err.message, variant: "destructive" });
      endCall("error");
    }
  }, [callState.isActive, socket, currentUser, onlineUsers, sounds, toast, createPeerConnection, endCall]);

  // ==========================================
  // START GROUP CALL
  // ==========================================
  const startGroupCall = useCallback(async (type: "audio" | "video") => {
    if (callState.isActive) { toast({ title: "Chamada em andamento" }); return; }
    if (!socket || socket.readyState !== WebSocket.OPEN) { toast({ title: "Sem conexão", variant: "destructive" }); return; }
    const onlineOthers = onlineUsers.filter(u => u.username !== currentUser?.username);
    if (onlineOthers.length === 0) { toast({ title: "Ninguém online" }); return; }

    let callType = type;
    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
      } catch (err: any) {
        if (callType === "video" && err.name === "NotAllowedError") {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          callType = "audio";
        } else throw err;
      }

      const groupRoom = `group-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      groupRoomRef.current = groupRoom;
      localStreamRef.current = stream;
      callTargetRef.current = "Grupo";

      setCallState({ isActive: true, type: callType, status: "calling", targetUser: "Grupo", localStream: stream, remoteStream: null, startTime: null, isMuted: false, isVideoOff: false, isScreenSharing: false, connectionQuality: "unknown", isRemoteVideoOff: false, isGroup: true, groupRoom });
      sounds.play("call");

      for (const user of onlineOthers) {
        const pc = createGroupPeerConnection(user.username);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" });
        await pc.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "webrtc_offer", data: { target: user.username, offer: pc.localDescription, type: callType, from: currentUser?.username, isGroup: true, groupRoom } }));
        setGroupParticipants((prev) => { const next = new Map(prev); next.set(user.username, { username: user.username, stream: null, pc }); return next; });
      }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar chamada em grupo", description: err.message, variant: "destructive" });
      endCall("error");
    }
  }, [callState.isActive, socket, currentUser, onlineUsers, sounds, toast, createGroupPeerConnection, endCall]);

  // ==========================================
  // ANSWER CALL
  // ==========================================
  const answerCall = useCallback(async (callData: IncomingCallData) => {
    if (callState.isActive) {
      socket?.send(JSON.stringify({ type: "webrtc_reject", data: { target: callData.from, reason: "busy" } }));
      setIncomingCall(null);
      setActiveCall(null);
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) { setIncomingCall(null); setActiveCall(null); return; }

    setIncomingCall(null);
    setActiveCall(null);
    sounds.stopRingtone();

    let callType = callData.type;
    const isGroup = callData.isGroup || false;

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === "video",
        });
      } catch (permError: any) {
        if (callType === "video" && permError.name === "NotAllowedError") {
          toast({ title: "Permissão de câmera negada", description: "Chamada de áudio apenas..." });
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          callType = "audio";
        } else throw permError;
      }

      localStreamRef.current = stream;
      callTargetRef.current = callData.from;

      let pc: RTCPeerConnection;
      if (isGroup && callData.groupRoom) {
        groupRoomRef.current = callData.groupRoom;
        pc = createGroupPeerConnection(callData.from);
        setGroupParticipants((prev) => { const next = new Map(prev); next.set(callData.from, { username: callData.from, stream: null, pc }); return next; });
      } else {
        pc = createPeerConnection();
      }

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      await flushIceCandidatesFor(pc, callData.from);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.send(JSON.stringify({
        type: "webrtc_answer",
        data: { target: callData.from, answer: pc.localDescription, type: callType, from: currentUser?.username, isGroup, groupRoom: callData.groupRoom },
      }));

      setCallState({ isActive: true, type: callType, status: "connected", targetUser: callData.from, localStream: stream, remoteStream: null, startTime: new Date(), isMuted: false, isVideoOff: false, isScreenSharing: false, connectionQuality: "unknown", isRemoteVideoOff: false, isGroup, groupRoom: callData.groupRoom || null });
      startQualityMonitor();
      sounds.play("call_connect");
    } catch (err: any) {
      const errorMessages: Record<string, string> = { NotAllowedError: "Permissão negada.", NotFoundError: "Câmera/microfone não encontrado.", NotReadableError: "Dispositivo em uso." };
      toast({ title: "Erro ao atender chamada", description: errorMessages[err.name] || err.message, variant: "destructive" });
      endCall("error");
    }
  }, [callState.isActive, createPeerConnection, createGroupPeerConnection, socket, toast, flushIceCandidatesFor, startQualityMonitor, sounds, endCall, currentUser, setActiveCall]);

  // ==========================================
  // REJECT CALL
  // ==========================================
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    sounds.stopRingtone();
    socket?.send(JSON.stringify({ type: "webrtc_reject", data: { target: incomingCall.from, reason: "rejected" } }));
    setIncomingCall(null);
    setActiveCall(null); // ✅ Limpa contexto global
  }, [incomingCall, socket, sounds, setActiveCall]);

  // ==========================================
  // WEBSOCKET LISTENER
  // ==========================================
  useEffect(() => {
    if (!socket) return;
    const handleMessage = async (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        const eventType = parsed.event || parsed.type;

        switch (eventType) {
          case "message_deleted": {
            const { messageId } = parsed.data || {};
            if (!messageId) break;
            setChatMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isDeleted: true, content: "Mensagem excluída", imageUrl: undefined, reactions: {} } : m));
            break;
          }
          case "message_edited": {
            const { messageId: editId, newContent } = parsed.data || {};
            if (!editId) break;
            setChatMessages((prev) => prev.map((m) => m.id === editId ? { ...m, content: newContent, edited: true } : m));
            break;
          }
          case "message_reaction": {
            const { messageId: reactionId, reactions } = parsed.data || {};
            if (!reactionId) break;
            setChatMessages((prev) => prev.map((m) => m.id === reactionId ? { ...m, reactions } : m));
            break;
          }

          // ✅ webrtc_offer: seta no contexto global (GlobalCallNotification mostra em qualquer página)
          // e também localmente caso o usuário já esteja no chat
          case "webrtc_offer": {
            const from = parsed.data?.from;
            if (!from || from === currentUser?.username) break;
            sounds.play("call");
            const callData: IncomingCallData = { from, type: parsed.data.type || "audio", offer: parsed.data.offer, isGroup: parsed.data.isGroup, groupRoom: parsed.data.groupRoom };
            // ✅ Atualiza contexto global — GlobalCallNotification já vai mostrar
            setActiveCall({ from, type: parsed.data.type || "audio", offer: parsed.data.offer, timestamp: Date.now(), isGroup: parsed.data.isGroup, groupRoom: parsed.data.groupRoom });
            // Seta local também para o Chat lidar com a resposta
            setIncomingCall(callData);
            if (Notification.permission === "granted") {
              new Notification(`📞 ${from} está chamando`, { body: callData.isGroup ? "Chamada em grupo" : callData.type === "video" ? "Chamada de vídeo" : "Chamada de voz", icon: "/favicon.ico", requireInteraction: true, tag: "incoming-call" });
            }
            break;
          }

          // ✅ webrtc_answer: verifica grupo PRIMEIRO, depois 1:1
          case "webrtc_answer": {
            const answer = parsed.data?.answer;
            const from = parsed.data?.from;
            if (!answer) break;

            const groupPc = from ? groupPeerConnectionsRef.current.get(from) : null;
            if (groupPc) {
              if (groupPc.signalingState === "have-local-offer") {
                await groupPc.setRemoteDescription(new RTCSessionDescription(answer));
                await flushIceCandidatesFor(groupPc, from);
                setCallState((prev) => ({ ...prev, status: "connected", startTime: prev.startTime || new Date() }));
                startQualityMonitor();
              }
            } else {
              const pc = peerConnectionRef.current;
              if (!pc) break;
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                await flushIceCandidatesFor(pc, callTargetRef.current || "");
              }
            }
            break;
          }

          // ✅ ICE candidate com fila por peer
          case "webrtc_ice_candidate": {
            if (!parsed.data?.candidate) break;
            const from = parsed.data?.from;
            const groupRoom = parsed.data?.groupRoom;
            const targetPc = (groupRoom || from) && groupPeerConnectionsRef.current.has(from || "")
              ? groupPeerConnectionsRef.current.get(from || "")
              : peerConnectionRef.current;
            if (!targetPc) break;
            const key = from || callTargetRef.current || "";
            if (targetPc.remoteDescription) {
              try { await targetPc.addIceCandidate(new RTCIceCandidate(parsed.data.candidate)); } catch {}
            } else {
              if (!iceCandidatesQueueRef.current.has(key)) iceCandidatesQueueRef.current.set(key, []);
              iceCandidatesQueueRef.current.get(key)!.push(parsed.data.candidate);
            }
            break;
          }

          case "webrtc_end": {
            sounds.stopRingtone();
            const from = parsed.data?.from;
            if (from && groupPeerConnectionsRef.current.has(from)) {
              const pc = groupPeerConnectionsRef.current.get(from);
              try { pc?.close(); } catch {}
              groupPeerConnectionsRef.current.delete(from);
              setGroupParticipants((prev) => { const next = new Map(prev); next.delete(from); return next; });
              toast({ title: `${from} saiu da chamada` });
            } else {
              endCall();
              setIncomingCall(null);
              setActiveCall(null); // ✅
              toast({ title: "Chamada encerrada" });
            }
            break;
          }

          case "webrtc_reject": {
            sounds.stopRingtone();
            endCall();
            setIncomingCall(null);
            setActiveCall(null); // ✅
            toast({ title: "Chamada recusada" });
            break;
          }

          case "webrtc_camera_toggle": {
            if (parsed.data?.from === currentUser?.username) break;
            const isOff = !parsed.data?.videoEnabled;
            const from = parsed.data?.from;
            if (from && groupPeerConnectionsRef.current.has(from)) {
              setGroupParticipants((prev) => { const next = new Map(prev); const p = next.get(from); if (p) next.set(from, { ...p, isVideoOff: isOff }); return next; });
            } else {
              setCallState((prev) => ({ ...prev, isRemoteVideoOff: isOff }));
            }
            break;
          }

          case "webrtc_audio_toggle": {
            if (parsed.data?.from === currentUser?.username) break;
            const from = parsed.data?.from;
            const audioEnabled = parsed.data?.audioEnabled;
            if (from && groupPeerConnectionsRef.current.has(from)) {
              setGroupParticipants((prev) => { const next = new Map(prev); const p = next.get(from); if (p) next.set(from, { ...p, isMuted: !audioEnabled }); return next; });
            }
            break;
          }

          default: break;
        }
      } catch {}
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, currentUser, endCall, toast, setChatMessages, flushIceCandidatesFor, sounds, startQualityMonitor, setActiveCall]);

  // ==========================================
  // TYPING
  // ==========================================
  const sendTyping = useCallback(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.send(JSON.stringify({ type: "typing", data: { isTyping: true, target: chatMode === "dm" ? dmTarget : undefined } }));
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket?.send(JSON.stringify({ type: "typing", data: { isTyping: false, target: chatMode === "dm" ? dmTarget : undefined } }));
    }, 2500);
  }, [socket, currentUser, chatMode, dmTarget]);

  // ==========================================
  // CHAT
  // ==========================================
  useEffect(() => { markChatAsRead(); }, []);

  const scrollToBottom = useCallback((force?: boolean) => {
    if (force || isAtBottomRef.current) {
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: force ? "auto" : "smooth" }));
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 120;
    isAtBottomRef.current = atBottom;
    setShowScrollDown(!atBottom);
  }, []);

  const filteredMessages = useMemo(() => {
    let messages = chatMessages;
    if (chatMode === "group") messages = chatMessages.filter((m) => !m.dmTo);
    else if (dmTarget && currentUser) messages = chatMessages.filter((m) =>
      (m.sender === currentUser.username && m.dmTo === dmTarget) ||
      (m.sender === dmTarget && m.dmTo === currentUser.username)
    );
    return messages as ExtendedChatMessage[];
  }, [chatMessages, chatMode, dmTarget, currentUser]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filteredMessages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [filteredMessages, searchQuery]);

  useEffect(() => { scrollToBottom(); }, [filteredMessages, scrollToBottom]);
  useEffect(() => { markChatAsRead(); }, [filteredMessages, markChatAsRead]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Apenas imagens são permitidas", variant: "destructive" }); return; }
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Imagem muito grande (máximo 10MB)", variant: "destructive" }); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, [toast]);

  const clearImagePreview = useCallback(() => {
    setImagePreview(null); setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && !imageFile) || !currentUser) return;
    let imageUrl: string | undefined;
    if (imageFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", imageFile);
        const token = localStorage.getItem("token");
        const res = await fetch("/api/chat/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
        if (!res.ok) throw new Error("Upload falhou");
        const data = await res.json();
        imageUrl = data.url;
      } catch { toast({ title: "Falha ao enviar imagem", variant: "destructive" }); setUploading(false); return; }
      setUploading(false);
    }
    const content = input.trim();
    const msg: ExtendedChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sender: currentUser.username, content: content || (imageUrl ? "[Imagem]" : ""),
      timestamp: new Date().toISOString(), type: imageUrl ? "image" : "text", imageUrl,
    };
    if (replyingTo) msg.replyTo = { id: replyingTo.id, sender: replyingTo.sender, content: replyingTo.content.substring(0, 100) };
    if (chatMode === "dm" && dmTarget) msg.dmTo = dmTarget;
    sendMessage("chat_message", msg);
    setInput(""); setReplyingTo(null); clearImagePreview();
    isAtBottomRef.current = true; scrollToBottom(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
  }, [input, imageFile, currentUser, chatMode, dmTarget, replyingTo, sendMessage, clearImagePreview, scrollToBottom, toast]);

  const handleReaction = useCallback((msgId: string, emoji: string) => {
    socket?.send(JSON.stringify({ type: "message_reaction", data: { messageId: msgId, emoji, user: currentUser?.username } }));
  }, [socket, currentUser]);

  const handleDelete = useCallback((msgId: string) => {
    if (confirm("Excluir esta mensagem?")) socket?.send(JSON.stringify({ type: "delete_message", data: { messageId: msgId } }));
  }, [socket]);

  const handleEdit = useCallback((msgId: string, newContent: string) => {
    socket?.send(JSON.stringify({ type: "edit_message", data: { messageId: msgId, newContent } }));
  }, [socket]);

  const handlePin = useCallback((msgId: string) => {
    setPinnedMessages((prev) => {
      const n = new Set(prev);
      if (n.has(msgId)) { n.delete(msgId); toast({ title: "Mensagem desfixada" }); }
      else { n.add(msgId); toast({ title: "📌 Mensagem fixada" }); }
      return n;
    });
  }, [toast]);

  const handleBulkExit = useCallback(async (msgId: string, content: string) => {
    const items = parseSolicitacaoItems(content, products);
    if (items.length === 0) { toast({ title: "Não foi possível identificar os itens", variant: "destructive" }); return; }
    setBulkExitLoading(msgId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/movements/bulk-exit", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: items.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })), observacao: "Baixa via solicitação no chat" }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Erro"); }
      const result = await res.json();
      toast({ title: "✅ Sucesso", description: `${result.processed} produto(s) baixados` });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    setBulkExitLoading(null);
  }, [products, queryClient, toast]);

  const groupedMessages = useMemo(() => {
    return filteredMessages.reduce<{ date: string; msgs: ExtendedChatMessage[] }[]>((groups, msg) => {
      const date = format(new Date(msg.timestamp), "dd/MM/yyyy");
      const last = groups[groups.length - 1];
      if (last && last.date === date) last.msgs.push(msg);
      else groups.push({ date, msgs: [msg] });
      return groups;
    }, []);
  }, [filteredMessages]);

  const sortedOtherUsers = useMemo(() => {
    return allUsers.filter((u) => u.username !== currentUser?.username && u.active)
      .sort((a, b) => {
        const aO = onlineUsers.some((u) => u.username === a.username);
        const bO = onlineUsers.some((u) => u.username === b.username);
        if (aO && !bO) return -1; if (!aO && bO) return 1;
        return a.username.localeCompare(b.username);
      });
  }, [allUsers, currentUser, onlineUsers]);

  const unreadDmCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!currentUser) return counts;
    chatMessages.forEach((m) => { if (m.dmTo === currentUser.username && m.sender !== currentUser.username) counts[m.sender] = (counts[m.sender] || 0) + 1; });
    return counts;
  }, [chatMessages, currentUser]);

  const isOnline = useCallback((username: string) => onlineUsers.some((u) => u.username === username), [onlineUsers]);
  const openDm = useCallback((username: string) => {
    setDmTarget(username); setChatMode("dm"); setShowMobileSidebar(false);
    isAtBottomRef.current = true; setTimeout(() => scrollToBottom(true), 100);
  }, [scrollToBottom]);
  const goToGroup = useCallback(() => { setChatMode("group"); setDmTarget(null); setShowMobileSidebar(false); isAtBottomRef.current = true; }, []);

  const senderColors = useMemo(() => {
    const palette = ["text-violet-400", "text-emerald-400", "text-blue-400", "text-rose-400", "text-amber-400", "text-teal-400", "text-indigo-400", "text-pink-400", "text-cyan-400", "text-orange-400"];
    const map: Record<string, string> = {};
    Array.from(new Set(chatMessages.map((m) => m.sender))).forEach((s, i) => { map[s] = palette[i % palette.length]; });
    return map;
  }, [chatMessages]);

  const avatarBgColors = useMemo(() => {
    const palette = ["bg-violet-500/20 text-violet-300", "bg-emerald-500/20 text-emerald-300", "bg-blue-500/20 text-blue-300", "bg-rose-500/20 text-rose-300", "bg-amber-500/20 text-amber-300", "bg-teal-500/20 text-teal-300"];
    const map: Record<string, string> = {};
    Array.from(new Set(chatMessages.map((m) => m.sender))).forEach((u, i) => { map[u] = palette[i % palette.length]; });
    return map;
  }, [chatMessages]);

  const canBulkExit = currentUser && ((currentUser as any).pode_registrar_saida || currentUser.username === "DEV");

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newMuted = !callState.isMuted;
    stream.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
    setCallState((prev) => ({ ...prev, isMuted: newMuted }));
    if (socket?.readyState === WebSocket.OPEN && callTargetRef.current) {
      socket.send(JSON.stringify({ type: "webrtc_audio_toggle", data: { target: callTargetRef.current, audioEnabled: !newMuted, from: currentUser?.username, groupRoom: groupRoomRef.current } }));
    }
  }, [callState.isMuted, socket, currentUser]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newVideoOff = !callState.isVideoOff;
    stream.getVideoTracks().forEach((t) => { t.enabled = !newVideoOff; });
    setCallState((prev) => ({ ...prev, isVideoOff: newVideoOff }));
    if (socket?.readyState === WebSocket.OPEN && callTargetRef.current) {
      socket.send(JSON.stringify({ type: "webrtc_camera_toggle", data: { target: callTargetRef.current, videoEnabled: !newVideoOff, from: currentUser?.username, groupRoom: groupRoomRef.current } }));
    }
  }, [callState.isVideoOff, socket, currentUser]);

  const toggleScreenShare = useCallback(async () => {
    if (callState.isScreenSharing) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: callState.type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, audio: true });
        const pc = peerConnectionRef.current;
        if (pc) { const sender = pc.getSenders().find((s) => s.track?.kind === "video"); const newVideo = newStream.getVideoTracks()[0]; if (sender && newVideo) await sender.replaceTrack(newVideo); }
        localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
        localStreamRef.current = newStream;
        setCallState((prev) => ({ ...prev, isScreenSharing: false, localStream: newStream }));
      } catch { toast({ title: "Não foi possível voltar para a câmera", variant: "destructive" }); }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const pc = peerConnectionRef.current;
        if (pc) { const sender = pc.getSenders().find((s) => s.track?.kind === "video"); const screenTrack = screenStream.getVideoTracks()[0]; if (sender && screenTrack) { await sender.replaceTrack(screenTrack); screenTrack.onended = () => toggleScreenShare(); } }
        setCallState((prev) => ({ ...prev, isScreenSharing: true }));
      } catch (err: any) { if (err.name !== "NotAllowedError") toast({ title: "Não foi possível compartilhar a tela", variant: "destructive" }); }
    }
  }, [callState.isScreenSharing, callState.type, toast]);

  // ==========================================
  // SIDEBAR
  // ==========================================
  const SidebarPanel = useCallback(() => (
    <div className="flex flex-col h-full" style={{ background: "rgba(5,5,15,0.99)" }}>
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <AvatarUpload
            username={currentUser?.username || ""}
            currentAvatar={avatarCache[currentUser?.username || ""] || undefined}
            onUpload={(file) => handleAvatarUpload(currentUser?.username || "", file)}
            size="lg" showStatus status="online"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{currentUser?.username}</h2>
            <p className="text-xs text-white/30 flex items-center gap-1.5 mt-0.5">
              <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Online
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Conversas</h3>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/15">
            {onlineUsers.length} online
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
          <Input placeholder="Buscar conversa..."
            className="pl-9 h-9 text-sm border border-white/5 text-white placeholder:text-white/15 focus:border-violet-400/30"
            style={{ background: "rgba(255,255,255,0.04)" }}
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.05) transparent" }}>
        {/* Grupo */}
        <button onClick={goToGroup}
          className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
            chatMode === "group" ? "ring-1 ring-violet-400/20" : "hover:bg-white/3")}
          style={chatMode === "group" ? { background: "rgba(139,92,246,0.1)" } : {}}>
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0",
            chatMode === "group" ? "bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg shadow-violet-500/30" : "bg-white/6")}>
            <Hash className="w-5 h-5 text-white" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">Geral Almoxarifado</p>
            <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              {onlineUsers.length} participantes
            </p>
          </div>
        </button>

        {/* Chamada em grupo */}
        {chatMode === "group" && (
          <div className="px-1 py-2 flex gap-1.5">
            <button onClick={() => startGroupCall("audio")} disabled={callState.isActive}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 border border-emerald-400/15 hover:border-emerald-400/35 transition-all disabled:opacity-30 hover:bg-emerald-400/5"
              style={{ background: "rgba(16,185,129,0.06)" }}>
              <PhoneCall className="w-3.5 h-3.5" /> Voz Grupo
            </button>
            <button onClick={() => startGroupCall("video")} disabled={callState.isActive}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-violet-300 border border-violet-400/15 hover:border-violet-400/35 transition-all disabled:opacity-30 hover:bg-violet-400/5"
              style={{ background: "rgba(139,92,246,0.06)" }}>
              <Video className="w-3.5 h-3.5" /> Vídeo Grupo
            </button>
          </div>
        )}

        <div className="px-3 pt-4 pb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Diretas</p>
          <span className="text-[10px] text-white/15">{sortedOtherUsers.length}</span>
        </div>

        {sortedOtherUsers.map((u) => {
          const online = isOnline(u.username);
          const isActive = chatMode === "dm" && dmTarget === u.username;
          const unread = unreadDmCounts[u.username] || 0;
          const avatar = avatarCache[u.username] || undefined; // ✅ tempo real

          return (
            <button key={u.id} onClick={() => openDm(u.username)}
              className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                isActive ? "ring-1 ring-violet-400/20" : "hover:bg-white/3")}
              style={isActive ? { background: "rgba(139,92,246,0.1)" } : {}}>
              <div className="relative shrink-0">
                <Avatar className={cn("w-11 h-11 border-2 transition-all", isActive ? "border-violet-400/30" : "border-white/5")}>
                  <AvatarImage src={avatar} className="object-cover" />
                  <AvatarFallback className={cn("text-xs font-bold text-white bg-gradient-to-br", COLOR_PALETTE.avatarColors[u.username.length % COLOR_PALETTE.avatarColors.length])}>
                    {u.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 shadow-sm",
                  online ? "bg-emerald-400 border-[#050515] animate-pulse shadow-emerald-400/50" : "bg-gray-600/80 border-[#050515]")} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{u.username}</p>
                <p className={cn("text-xs mt-0.5", online ? "text-emerald-400" : "text-white/20")}>
                  {online ? "● Online" : "○ Offline"}
                </p>
              </div>
              {unread > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-violet-500/30 animate-pulse shrink-0">
                  {unread}
                </span>
              )}
            </button>
          );
        })}

        {sortedOtherUsers.length === 0 && (
          <div className="px-3 py-10 text-center">
            <Users className="w-10 h-10 text-white/8 mx-auto mb-2" />
            <p className="text-xs text-white/15">Nenhum usuário disponível</p>
          </div>
        )}
      </div>
    </div>
  ), [chatMode, dmTarget, goToGroup, isOnline, onlineUsers, openDm, sortedOtherUsers, searchQuery, unreadDmCounts, currentUser, avatarCache, handleAvatarUpload, callState.isActive, startGroupCall]);

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <>
      {/* ✅ IncomingCallNotification LOCAL — apenas quando já está no chat
          O GlobalCallNotification (no App root) cuida das outras páginas */}
      <AnimatePresence>
        {incomingCall && (
          <IncomingCallNotificationLocal
            callData={incomingCall}
            onAnswer={() => answerCall(incomingCall)}
            onReject={rejectCall}
            isCallActive={callState.isActive}
          />
        )}
      </AnimatePresence>

      <div className="h-[calc(100vh-100px)] flex overflow-hidden rounded-2xl border border-white/8 shadow-2xl"
        style={{ background: "rgba(5,5,15,0.99)" }}>
        <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.avif" onChange={handleImageSelect} className="hidden" />

        <AnimatePresence>
          {callState.isActive && (
            <CallInterface callState={callState} onEndCall={endCall}
              onToggleMute={toggleMute} onToggleVideo={toggleVideo} onToggleScreenShare={toggleScreenShare}
              currentUser={currentUser} targetUser={callState.targetUser!}
              groupParticipants={callState.isGroup ? groupParticipants : undefined} />
          )}
        </AnimatePresence>

        {/* Sidebar Desktop */}
        <div className="w-[300px] border-r border-white/5 flex-col shrink-0 hidden md:flex">
          <SidebarPanel />
        </div>

        {/* Sidebar Mobile */}
        <AnimatePresence>
          {showMobileSidebar && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 md:hidden" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
                onClick={() => setShowMobileSidebar(false)} />
              <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-[300px] border-r border-white/5 shadow-2xl md:hidden">
                <SidebarPanel />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Imagem ampliada */}
        <AnimatePresence>
          {enlargedImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.97)", backdropFilter: "blur(8px)" }}
              onClick={() => setEnlargedImage(null)}>
              <motion.img initial={{ scale: 0.88 }} animate={{ scale: 1 }} exit={{ scale: 0.88 }}
                src={enlargedImage} alt="Ampliada" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
              <button className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                onClick={() => setEnlargedImage(null)}>
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Área Principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-white/5 shrink-0"
            style={{ background: "rgba(6,6,18,0.95)", backdropFilter: "blur(16px)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="md:hidden">
                <Button variant="ghost" size="icon" className="rounded-xl text-white/40 hover:text-white hover:bg-white/5"
                  onClick={() => chatMode === "dm" ? goToGroup() : setShowMobileSidebar(true)}>
                  {chatMode === "dm" ? <ArrowLeft className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </Button>
              </div>
              {chatMode === "dm" && dmTarget ? (
                <Avatar className="w-10 h-10 ring-1 ring-white/10 shrink-0">
                  <AvatarImage src={avatarCache[dmTarget] || undefined} className="object-cover" />
                  <AvatarFallback className={cn("text-sm font-bold text-white bg-gradient-to-br", COLOR_PALETTE.avatarColors[dmTarget.length % COLOR_PALETTE.avatarColors.length])}>
                    {dmTarget.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shrink-0">
                  <Hash className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white truncate">{chatMode === "group" ? "Geral Almoxarifado" : dmTarget}</h1>
                <p className="text-[11px] text-white/25 flex items-center gap-1.5">
                  {chatMode === "group"
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />{onlineUsers.length} online</>
                    : <><span className={cn("w-1.5 h-1.5 rounded-full inline-block", isOnline(dmTarget || "") ? "bg-emerald-400 animate-pulse" : "bg-white/15")} />{isOnline(dmTarget || "") ? "Online" : "Offline"}</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon"
                className={cn("rounded-xl transition-all text-white/30 hover:text-white hover:bg-white/5", isSearchOpen && "text-violet-400 bg-violet-400/10")}
                onClick={() => setIsSearchOpen(!isSearchOpen)}>
                <Search className="w-4 h-4" />
              </Button>
              {chatMode === "dm" && dmTarget && (
                <>
                  <Button variant="ghost" size="icon" className="rounded-xl text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-400/10 transition-all"
                    onClick={() => startCall("audio", dmTarget)} disabled={callState.isActive}>
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-xl text-violet-400/60 hover:text-violet-300 hover:bg-violet-400/10 transition-all"
                    onClick={() => startCall("video", dmTarget)} disabled={callState.isActive}>
                    <Video className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="rounded-xl text-white/25 hover:text-white/50 hover:bg-white/5 transition-all"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}>
                {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Busca */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="border-b border-white/5 overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="px-4 py-3 flex items-center gap-3">
                  <Search className="w-4 h-4 text-white/20 shrink-0" />
                  <input type="text" placeholder="Buscar mensagens..."
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/15"
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
                  {searchQuery && <span className="text-xs text-white/20 shrink-0">{searchResults.length} resultado(s)</span>}
                  <Button variant="ghost" size="sm" className="text-white/30 hover:text-white text-xs shrink-0"
                    onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}>Fechar</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fixadas */}
          {pinnedMessages.size > 0 && (
            <div className="border-b border-white/5 px-4 py-2 flex items-center gap-2 shrink-0"
              style={{ background: "rgba(251,191,36,0.04)" }}>
              <Pin className="w-3 h-3 fill-current text-amber-400/70" />
              <span className="text-xs text-amber-400/70">{pinnedMessages.size} mensagem(ns) fixada(s)</span>
            </div>
          )}

          {/* Mensagens */}
          <div className="relative flex-1 overflow-hidden">
            <div ref={scrollRef} onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto px-4 sm:px-5 py-4"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.04) transparent" }}>

              {filteredMessages.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full gap-5 text-center">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center ring-1 ring-white/8"
                    style={{ background: "rgba(139,92,246,0.08)" }}>
                    <MessageSquare className="w-9 h-9 text-violet-400/40" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-white/50">{chatMode === "group" ? "Bem-vindo ao chat!" : `Conversa com ${dmTarget}`}</p>
                    <p className="text-sm text-white/20">Envie uma mensagem para começar</p>
                  </div>
                </motion.div>
              )}

              {groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
                    <span className="text-[11px] font-semibold text-white/20 px-3 py-1 rounded-full border border-white/5"
                      style={{ background: "rgba(255,255,255,0.025)" }}>
                      {formatDateSeparator(group.date)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
                  </div>

                  <div className="space-y-0.5">
                    {group.msgs.map((msg, idx) => {
                      const isMe = msg.sender === currentUser?.username;
                      const prevMsg = group.msgs[idx - 1];
                      const timeGap = prevMsg && differenceInMinutes(new Date(msg.timestamp), new Date(prevMsg.timestamp)) > 5;
                      const isConsecutive = idx > 0 && prevMsg?.sender === msg.sender && !timeGap;
                      const showAvatar = !isMe && (!isConsecutive || timeGap);
                      const userAvatar = avatarCache[msg.sender] || undefined; // ✅ tempo real

                      return (
                        <MessageBubble key={msg.id} msg={msg} isMe={isMe}
                          showAvatar={showAvatar} showName={!isMe && showAvatar}
                          isConsecutive={isConsecutive}
                          senderColor={senderColors[msg.sender]} avatarBgColor={avatarBgColors[msg.sender]}
                          currentUser={currentUser} chatMode={chatMode} canBulkExit={!!canBulkExit}
                          onBulkExit={handleBulkExit} bulkExitLoading={bulkExitLoading}
                          onImageClick={setEnlargedImage} onReply={setReplyingTo}
                          onDelete={handleDelete} onEdit={handleEdit} onReact={handleReaction}
                          onPin={chatMode === "group" ? handlePin : undefined}
                          isPinned={pinnedMessages.has(msg.id)} userAvatar={userAvatar} />
                      );
                    })}
                  </div>
                </div>
              ))}

              <AnimatePresence>
                {typingUsers.filter(u => u !== currentUser?.username).length > 0 && (
                  <TypingIndicator users={typingUsers.filter(u => u !== currentUser?.username)} />
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} className="h-2" />
            </div>

            <AnimatePresence>
              {showScrollDown && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-4 right-5">
                  <Button variant="secondary" size="icon"
                    onClick={() => { isAtBottomRef.current = true; scrollToBottom(true); }}
                    className="rounded-full shadow-xl w-10 h-10 border border-white/10 text-white/50 hover:text-white transition-all hover:scale-105"
                    style={{ background: "rgba(12,12,28,0.92)" }}>
                    <ChevronDown className="w-5 h-5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Preview de imagem */}
          <AnimatePresence>
            {imagePreview && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="px-4 py-3 border-t border-white/5 shrink-0" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-white/10" />
                    <button onClick={clearImagePreview}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Pronto para enviar</p>
                    <p className="text-xs text-white/25 truncate max-w-[200px]">{imageFile?.name}</p>
                  </div>
                  <Button size="sm" onClick={() => handleSend()} disabled={uploading}
                    className="bg-gradient-to-r from-violet-600 to-blue-600 border-0 text-white shadow-lg">
                    {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Enviando</> : <><Send className="w-3.5 h-3.5 mr-1.5" /> Enviar</>}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ChatInput value={input} onChange={setInput} onSubmit={handleSend}
            onImageSelect={() => fileInputRef.current?.click()}
            replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)}
            disabled={uploading} chatMode={chatMode} dmTarget={dmTarget} onTyping={sendTyping} />
        </div>
      </div>
    </>
  );
}

// ==========================================
// NOTIFICAÇÃO LOCAL (apenas quando está no chat)
// — versão compacta, sem timer, pois o GlobalCallNotification
//   já cuida de outras páginas
// ==========================================

function IncomingCallNotificationLocal({
  callData, onAnswer, onReject, isCallActive,
}: {
  callData: IncomingCallData; onAnswer: () => void; onReject: () => void; isCallActive?: boolean;
}) {
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    if (isCallActive) { onReject(); return; }
    const timeout = setTimeout(() => onReject(), 30000);
    return () => clearTimeout(timeout);
  }, [isCallActive, onReject]);

  const isVideo = callData.type === "video";

  return (
    <motion.div
      initial={{ opacity: 0, y: -100, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -100, scale: 0.85 }}
      transition={{ type: "spring", damping: 20, stiffness: 280 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[360px] max-w-[95vw]"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(8,8,22,0.98) 0%, rgba(12,12,32,0.97) 100%)", backdropFilter: "blur(32px)" }}>
        <div className={cn("h-1.5 w-full", isVideo ? "bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-400" : "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400")} />
        <div className="p-5 flex items-center gap-4">
          <div className="relative shrink-0">
            {[0.4, 0.9].map((delay, i) => (
              <motion.div key={i} animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeOut" }}
                className={cn("absolute inset-0 rounded-xl", isVideo ? "bg-violet-500/30" : "bg-emerald-500/30")} />
            ))}
            <div className={cn("relative w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-black",
              isVideo ? "bg-gradient-to-br from-violet-500 to-blue-600" : "bg-gradient-to-br from-emerald-500 to-teal-600")}>
              {callData.from.substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate">{callData.from}</p>
            <motion.p animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
              className="text-white/40 text-xs mt-0.5">
              {isVideo ? "Chamada de vídeo" : "Chamada de voz"}
            </motion.p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onReject}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center shadow-lg shadow-red-500/40 hover:scale-105 transition-transform">
              <PhoneOff className="w-5 h-5" />
            </button>
            <button onClick={() => { setIsAnswering(true); onAnswer(); }}
              className={cn("w-12 h-12 rounded-xl text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform",
                isVideo ? "bg-gradient-to-br from-violet-500 to-blue-600 shadow-violet-500/40" : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/40")}>
              {isAnswering ? <Loader2 className="w-5 h-5 animate-spin" /> : isVideo ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}