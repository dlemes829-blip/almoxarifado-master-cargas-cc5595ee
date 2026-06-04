import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

// ==========================================
// 🎵 SISTEMA DE SONS
// ==========================================

const AUDIO_CONFIG = { enabled: true, volume: 0.5, muted: false };

export type SoundType = "message" | "call" | "sent" | "error" | "success" | "notification" | "call_end" | "call_connect";

export interface ActiveCall {
  from: string;
  type: "audio" | "video";
  offer: RTCSessionDescriptionInit;
  timestamp: number;
  isGroup?: boolean;
  groupRoom?: string;
}

export interface ActiveGroupCall {
  groupRoom: string;
  initiator: string;
  type: "audio" | "video";
  participants: string[];
  startedAt: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;
  private volume = 0.4;
  private ringtoneInterval: ReturnType<typeof setInterval> | null = null;
  private ringtoneOscillators: OscillatorNode[] = [];

  constructor() { this.init(); }

  private init() {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.updateVolume();
    } catch { console.warn("Web Audio API não suportada"); }
  }

  resume() { if (this.ctx?.state === "suspended") this.ctx.resume(); }
  setVolume(vol: number) { this.volume = Math.max(0, Math.min(1, vol)); this.updateVolume(); }
  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx?.currentTime || 0);
    if (muted) this.stopRingtone();
  }

  private updateVolume() { if (this.masterGain && !this.isMuted) this.masterGain.gain.setValueAtTime(this.volume, this.ctx?.currentTime || 0); }

  playMessage() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(1200, t); osc.frequency.exponentialRampToValueAtTime(1800, t + 0.05); osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.25, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain); gain.connect(this.masterGain!); osc.start(t); osc.stop(t + 0.15);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  }

  playCall() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    this.stopRingtone();
    const playPattern = () => {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const makeRing = (f1: number, f2: number, offset = 0) => {
        if (!this.ctx) return;
        [{ f: f1, vol: 0.35 }, { f: f2, vol: 0.25 }].forEach(({ f, vol }) => {
          const osc = this.ctx!.createOscillator(), gain = this.ctx!.createGain();
          osc.type = "sine"; osc.frequency.setValueAtTime(f, t + offset);
          gain.gain.setValueAtTime(0, t + offset); gain.gain.linearRampToValueAtTime(vol, t + offset + 0.02); gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.4);
          osc.connect(gain); gain.connect(this.masterGain!); osc.start(t + offset); osc.stop(t + offset + 0.4);
          this.ringtoneOscillators.push(osc);
        });
      };
      makeRing(440, 880, 0); makeRing(440, 880, 0.6);
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400, 800]);
    };
    playPattern();
    this.ringtoneInterval = setInterval(playPattern, 2000);
  }

  stopRingtone() {
    if (this.ringtoneInterval) { clearInterval(this.ringtoneInterval); this.ringtoneInterval = null; }
    this.ringtoneOscillators.forEach((osc) => { try { osc.stop(); } catch {} });
    this.ringtoneOscillators = [];
  }

  playCallEnd() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(600, t); osc.frequency.linearRampToValueAtTime(300, t + 0.3);
    gain.gain.setValueAtTime(0.3, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
    osc.connect(gain); gain.connect(this.masterGain!); osc.start(t); osc.stop(t + 0.3);
    if (navigator.vibrate) navigator.vibrate([100, 50]);
  }

  playCallConnect() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    [[600, 800, 0], [800, 1000, 0.1]].forEach(([f1, f2, offset]) => {
      const osc = this.ctx!.createOscillator(), gain = this.ctx!.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(f1, t + offset); osc.frequency.linearRampToValueAtTime(f2, t + offset + 0.15);
      gain.gain.setValueAtTime(0, t + offset); gain.gain.linearRampToValueAtTime(0.3, t + offset + 0.05); gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.2);
      osc.connect(gain); gain.connect(this.masterGain!); osc.start(t + offset); osc.stop(t + offset + 0.2);
    });
    if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
  }

  playSent() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(1500, t); osc.frequency.exponentialRampToValueAtTime(2000, t + 0.03);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.15, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    osc.connect(gain); gain.connect(this.masterGain!); osc.start(t); osc.stop(t + 0.06);
    if (navigator.vibrate) navigator.vibrate(15);
  }

  playError() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    osc.type = "sawtooth"; osc.frequency.setValueAtTime(200, t); osc.frequency.linearRampToValueAtTime(150, t + 0.3);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.3, t + 0.05); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    filter.type = "lowpass"; filter.frequency.setValueAtTime(800, t);
    osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain!); osc.start(t); osc.stop(t + 0.3);
    if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
  }

  playSuccess() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(523.25, t); osc.frequency.exponentialRampToValueAtTime(1046.5, t + 0.15);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.3, t + 0.03); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain); gain.connect(this.masterGain!); osc.start(t); osc.stop(t + 0.2);
  }

  playNotification() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator(), osc2 = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc1.type = "sine"; osc1.frequency.setValueAtTime(800, t); osc1.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    osc2.type = "triangle"; osc2.frequency.setValueAtTime(1200, t); osc2.frequency.exponentialRampToValueAtTime(900, t + 0.1);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.2, t + 0.03); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc1.connect(gain); osc2.connect(gain); gain.connect(this.masterGain!);
    osc1.start(t); osc2.start(t); osc1.stop(t + 0.2); osc2.stop(t + 0.2);
    if (navigator.vibrate) navigator.vibrate(40);
  }

  play(type: SoundType) {
    const map: Record<SoundType, () => void> = {
      message: () => this.playMessage(), call: () => this.playCall(),
      call_end: () => this.playCallEnd(), call_connect: () => this.playCallConnect(),
      sent: () => this.playSent(), error: () => this.playError(),
      success: () => this.playSuccess(), notification: () => this.playNotification(),
    };
    map[type]?.();
  }
}

export const soundEngine = new SoundEngine();

export function configureSounds(config: { enabled?: boolean; volume?: number; muted?: boolean }) {
  if (config.enabled !== undefined) AUDIO_CONFIG.enabled = config.enabled;
  if (config.volume !== undefined) { AUDIO_CONFIG.volume = config.volume; soundEngine.setVolume(config.volume); }
  if (config.muted !== undefined) { AUDIO_CONFIG.muted = config.muted; soundEngine.setMuted(config.muted); }
}

export const setSoundsMuted = (muted: boolean) => { AUDIO_CONFIG.muted = muted; soundEngine.setMuted(muted); };
export const setSoundsVolume = (volume: number) => { AUDIO_CONFIG.volume = Math.max(0, Math.min(1, volume)); soundEngine.setVolume(AUDIO_CONFIG.volume); };

function getCurrentUsername(): string | null {
  try { const s = localStorage.getItem("user"); if (s) return JSON.parse(s).username; } catch {}
  return null;
}

function getCurrentUserId(): number | null {
  try { const s = localStorage.getItem("user"); if (s) return JSON.parse(s).id; } catch {}
  return null;
}

// ==========================================
// TIPOS
// ==========================================

export type OnlineUser = { userId: number; username: string; connectedAt: string; avatarUrl?: string };

export interface ChatMessage {
  id: string; sender: string; content: string; timestamp: string; dmTo?: string;
  type?: "text" | "image" | "solicitacao"; imageUrl?: string; readBy?: string[];
  edited?: boolean; editedAt?: string; isDeleted?: boolean;
  reactions?: Record<string, string[]>;
  replyTo?: { id: string; sender: string; content: string };
}

export interface NotificationPayload {
  id: string; type: string; title: string; message: string; sender?: string;
  timestamp: string; read: boolean; priority?: "low" | "normal" | "high" | "urgent";
  sound?: boolean; link?: string; data?: any;
}

type ChatListener = (messages: ChatMessage[]) => void;

type WebSocketContextType = {
  sendMessage: (type: string, data: any) => boolean;
  onlineUsers: OnlineUser[];
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  socket: WebSocket | null;
  typingUsers: string[];
  subscribeToChatUpdates: (listener: ChatListener) => () => void;
  unreadCount: number;
  markChatAsRead: () => void;
  markChatAsLeft: () => void;
  forceLogout: boolean;
  forceLogoutMessage: string;
  notifications: NotificationPayload[];
  unreadNotifications: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (id: string) => void;
  isConnected: boolean;
  sounds: {
    muted: boolean;
    setMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (volume: number) => void;
    play: (type: SoundType) => void;
    stopRingtone: () => void;
  };
  activeCall: ActiveCall | null;
  setActiveCall: React.Dispatch<React.SetStateAction<ActiveCall | null>>;
  // ✅ Chamada de grupo ativa (para joiners)
  activeGroupCall: ActiveGroupCall | null;
  setActiveGroupCall: React.Dispatch<React.SetStateAction<ActiveGroupCall | null>>;
  // ✅ Flag: chat está montado e gerenciando chamadas localmente
  chatIsMounted: boolean;
  setChatIsMounted: React.Dispatch<React.SetStateAction<boolean>>;
  // ✅ avatarCache: cache global de avatares, atualizado via WebSocket em tempo real
  avatarCache: Record<string, string | null>;
  requestNotificationPermission: () => Promise<boolean>;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);
export { WebSocketContext };

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const value = useWebSocketProvider();
  return React.createElement(WebSocketContext.Provider, { value }, children);
}

export function useWebSocketProvider(): WebSocketContextType {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [soundsMuted, setSoundsMutedState] = useState(false);
  const [forceLogout, setForceLogout] = useState(false);
  const [forceLogoutMessage, setForceLogoutMessage] = useState("");

  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [activeGroupCall, setActiveGroupCall] = useState<ActiveGroupCall | null>(null);
  // ✅ Flag para evitar dupla notificação quando Chat.tsx já está gerenciando
  const [chatIsMounted, setChatIsMounted] = useState(false);

  // ✅ avatarCache: mapa username → URL (ou null se removido)
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});

  const chatListenersRef = useRef<Set<ChatListener>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const isOnChatPageRef = useRef(false);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { soundEngine.setMuted(soundsMuted); }, [soundsMuted]);

  const notifyListeners = useCallback((msgs: ChatMessage[]) => { chatListenersRef.current.forEach((fn) => fn(msgs)); }, []);
  const subscribeToChatUpdates = useCallback((listener: ChatListener) => { chatListenersRef.current.add(listener); return () => chatListenersRef.current.delete(listener); }, []);
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") return (await Notification.requestPermission()) === "granted";
    return false;
  }, []);

  // ==========================================
  // HANDLER DE MENSAGENS WEBSOCKET
  // ==========================================
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data);
      const currentUser = getCurrentUsername();
      const eventType = parsed.event || parsed.type;

      switch (eventType) {
        case "online_users": {
          const users = parsed.data || [];
          setOnlineUsers(users);
          setAvatarCache((prev) => {
            const next = { ...prev };
            (users as OnlineUser[]).forEach((u) => {
              if (u.avatarUrl !== undefined) next[u.username] = u.avatarUrl || null;
            });
            return next;
          });
          break;
        }

        case "identified":
          if (parsed.data?.unreadNotifications > 0) setUnreadNotifications(parsed.data.unreadNotifications);
          if (parsed.data?.notifications) setNotifications(parsed.data.notifications);
          reconnectDelay.current = 1000;
          break;

        case "chat_message": {
          const msg = parsed.data;
          if (!msg) break;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const updated = [...prev, msg];
            notifyListeners(updated);
            if (!isOnChatPageRef.current && msg.sender !== currentUser) {
              setUnreadCount((c) => c + 1);
              soundEngine.play("message");
              if (Notification.permission === "granted") {
                new Notification(`💬 ${msg.sender}`, {
                  body: msg.content?.substring(0, 100) || "Nova mensagem",
                  icon: "/favicon.ico", tag: "chat-msg",
                });
              }
            }
            return updated;
          });
          break;
        }

        case "chat_history":
          setChatMessages(parsed.data || []);
          notifyListeners(parsed.data || []);
          break;

        case "message_deleted":
          if (parsed.data?.messageId)
            setChatMessages((prev) => prev.map((m) => m.id === parsed.data.messageId
              ? { ...m, isDeleted: true, content: "Mensagem excluída", imageUrl: undefined, reactions: {} } : m));
          break;

        case "message_edited":
          if (parsed.data?.messageId)
            setChatMessages((prev) => prev.map((m) => m.id === parsed.data.messageId
              ? { ...m, content: parsed.data.newContent, edited: true, editedAt: parsed.data.editedAt || new Date().toISOString() } : m));
          break;

        case "message_reaction":
          if (parsed.data?.messageId)
            setChatMessages((prev) => prev.map((m) => m.id === parsed.data.messageId
              ? { ...m, reactions: parsed.data.reactions || {} } : m));
          break;

        case "messages_read":
        case "read_receipt":
          setChatMessages((prev) => prev.map((m) => {
            if (parsed.data?.messageIds?.includes(m.id)) {
              const readBy = new Set(m.readBy || []);
              readBy.add(parsed.data.readBy || parsed.data.username);
              return { ...m, readBy: Array.from(readBy) };
            }
            return m;
          }));
          break;

        case "typing": {
          if (!parsed.data?.username) break;
          const typer = parsed.data.username;
          const existing = typingTimeoutsRef.current.get(typer);
          if (existing) clearTimeout(existing);
          if (parsed.data.isTyping !== false) {
            setTypingUsers((prev) => prev.includes(typer) ? prev : [...prev, typer]);
            const timeout = setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u !== typer));
              typingTimeoutsRef.current.delete(typer);
            }, 3500);
            typingTimeoutsRef.current.set(typer, timeout);
          } else {
            setTypingUsers((prev) => prev.filter((u) => u !== typer));
            typingTimeoutsRef.current.delete(typer);
          }
          break;
        }

        case "notification": {
          if (!parsed.data) break;
          const notif = parsed.data as NotificationPayload;
          setNotifications((prev) => [notif, ...prev].slice(0, 100));
          if (!notif.read) setUnreadNotifications((prev) => prev + 1);

          const selfTypes = ["chat_message", "report_generated", "solicitacao"];
          const isSelf = notif.sender === currentUser || (currentUser && notif.message?.startsWith(currentUser + " ") && selfTypes.includes(notif.type));

          if (!isSelf) {
            if (notif.priority === "urgent" || notif.priority === "high") soundEngine.play("notification");
            else if (notif.sound !== false) soundEngine.play("message");

            const notifTitles: Record<string, string> = {
              user_login: "Login", user_create: "Novo Usuário", user_update: "Usuário Alterado",
              user_delete: "Usuário Excluído", product_create: "Novo Produto", product_edit: "Produto Editado",
              product_delete: "Produto Excluído", movement_entry: "Entrada Registrada", movement_exit: "Saída Registrada",
              chat_message: "Nova Mensagem", report_generated: "Relatório Gerado", solicitacao: "Solicitação de Materiais",
              responsavel_create: "Novo Responsável", call_incoming: "📞 Chamada Recebida",
              call_ended: "Chamada Encerrada", call_missed: "Chamada Perdida",
            };

            toast({
              title: notifTitles[notif.type] || "Notificação",
              description: notif.message,
              variant: notif.priority === "urgent" ? "destructive" : "default",
              duration: notif.type === "call_incoming" ? 10000 : 5000,
            });
          }
          break;
        }

        case "notifications_updated":
          if (parsed.data?.notifications) setNotifications(parsed.data.notifications);
          if (parsed.data?.unreadCount !== undefined) setUnreadNotifications(parsed.data.unreadCount);
          break;

        case "product_updated":
          queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
          queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
          break;

        case "force_logout":
          setForceLogout(true);
          setForceLogoutMessage(parsed.data?.message || "Sessão encerrada");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          soundEngine.play("error");
          break;

        // ✅ AVATAR ATUALIZADO — broadcast para todos em tempo real
        case "user_avatar_updated": {
          const { username: avatarUsername, avatarUrl: newAvatarUrl } = parsed.data || {};
          if (!avatarUsername) break;
          setAvatarCache((prev) => ({ ...prev, [avatarUsername]: newAvatarUrl || null }));
          setOnlineUsers((prev) => prev.map((u) =>
            u.username === avatarUsername ? { ...u, avatarUrl: newAvatarUrl || undefined } : u
          ));
          if (avatarUsername === currentUser) {
            try {
              const stored = localStorage.getItem("user");
              if (stored) {
                const user = JSON.parse(stored);
                user.avatar_url = newAvatarUrl || null;
                localStorage.setItem("user", JSON.stringify(user));
              }
            } catch {}
          }
          queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
          if (avatarUsername !== currentUser) {
            toast({ title: "Foto atualizada", description: `${avatarUsername} ${newAvatarUrl ? "atualizou" : "removeu"} a foto de perfil`, duration: 3000 });
          }
          break;
        }

        // ✅ WEBRTC OFFER — só set activeCall se chat NÃO está montado
        // Se Chat.tsx estiver montado, ele vai capturar via seu próprio listener
        case "webrtc_offer": {
          const from = parsed.data?.from;
          if (!from || from === currentUser) break;
          soundEngine.play("call");
          // ✅ Sempre seta activeCall — Chat.tsx vai limpar se estiver montado
          setActiveCall({
            from,
            type: parsed.data.type || "audio",
            offer: parsed.data.offer,
            timestamp: Date.now(),
            isGroup: parsed.data.isGroup,
            groupRoom: parsed.data.groupRoom,
          });
          if (Notification.permission === "granted") {
            new Notification(`📞 ${from} está chamando`, {
              body: parsed.data.isGroup ? "Chamada em grupo" : parsed.data.type === "video" ? "Chamada de vídeo" : "Chamada de voz",
              icon: "/favicon.ico", requireInteraction: true, tag: "incoming-call",
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
          break;
        }

        // ✅ Grupo em chamada ativa (para permitir join)
        case "group_call_started": {
          const { groupRoom, initiator, type: callType, participants } = parsed.data || {};
          if (!groupRoom || initiator === currentUser) break;
          setActiveGroupCall({ groupRoom, initiator, type: callType || "audio", participants: participants || [], startedAt: Date.now() });
          break;
        }

        case "group_call_ended": {
          const { groupRoom } = parsed.data || {};
          setActiveGroupCall((prev) => {
            if (prev?.groupRoom === groupRoom || !groupRoom) return null;
            return prev;
          });
          break;
        }

        case "group_call_participant_joined": {
          const { groupRoom, username: joinedUser } = parsed.data || {};
          setActiveGroupCall((prev) => {
            if (!prev || prev.groupRoom !== groupRoom) return prev;
            return { ...prev, participants: [...new Set([...prev.participants, joinedUser])] };
          });
          break;
        }

        case "webrtc_end":
          soundEngine.stopRingtone();
          soundEngine.play("call_end");
          setActiveCall(null);
          break;

        case "webrtc_reject":
          soundEngine.stopRingtone();
          setActiveCall(null);
          break;

        case "webrtc_answer":
        case "webrtc_ice_candidate":
        case "webrtc_camera_toggle":
        case "webrtc_audio_toggle":
        case "pong":
          break;

        case "error":
          console.error("WebSocket error:", parsed.data?.message);
          break;

        default:
          break;
      }
    } catch (err) { console.error("Erro ao parsear mensagem WS:", err); }
  }, [toast, queryClient, notifyListeners]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      reconnectDelay.current = 1000;
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          ws.send(JSON.stringify({ type: "identify", data: { userId: user.id, username: user.username } }));
        } catch (e) { console.error("Erro ao identificar usuário:", e); }
      }
    };

    ws.onmessage = handleWebSocketMessage;

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const delay = Math.min(reconnectDelay.current, 30000);
      reconnectDelay.current = Math.min(delay * 1.5, 30000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => { ws.close(); };
    wsRef.current = ws;
  }, [handleWebSocketMessage]);

  const sendMessage = useCallback((type: string, data: any): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
      if (type === "chat_message") soundEngine.play("sent");
      return true;
    }
    console.warn("WebSocket não conectado:", type);
    return false;
  }, []);

  const markChatAsRead = useCallback(() => {
    isOnChatPageRef.current = true;
    setUnreadCount(0);
    const currentUser = getCurrentUsername();
    const currentUserId = getCurrentUserId();
    if (currentUser && wsRef.current?.readyState === WebSocket.OPEN) {
      setChatMessages((prev) => {
        const unreadIds = prev
          .filter((m) => m.sender !== currentUser && !(m.readBy || []).includes(currentUser))
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          wsRef.current?.send(JSON.stringify({
            type: "mark_read",
            data: { messageIds: unreadIds, username: currentUser, userId: currentUserId },
          }));
        }
        return prev;
      });
    }
  }, []);

  const markChatAsLeft = useCallback(() => { isOnChatPageRef.current = false; }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadNotifications((prev) => Math.max(0, prev - 1));
    sendMessage("mark_notification_read", { notificationId: id });
  }, [sendMessage]);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadNotifications(0);
    sendMessage("mark_notification_read", { markAll: true });
  }, [sendMessage]);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const notif = prev.find((n) => n.id === id);
      if (notif && !notif.read) setUnreadNotifications((n) => Math.max(0, n - 1));
      return prev.filter((n) => n.id !== id);
    });
    sendMessage("delete_notification", { notificationId: id });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      typingTimeoutsRef.current.forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current.clear();
    };
  }, [connect]);

  return {
    sendMessage, onlineUsers, chatMessages, setChatMessages,
    socket: wsRef.current,
    typingUsers, subscribeToChatUpdates,
    unreadCount, markChatAsRead, markChatAsLeft,
    forceLogout, forceLogoutMessage,
    notifications, unreadNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotification,
    isConnected,
    sounds: {
      muted: soundsMuted,
      setMuted: setSoundsMutedState,
      volume: AUDIO_CONFIG.volume,
      setVolume: (v: number) => { AUDIO_CONFIG.volume = v; soundEngine.setVolume(v); },
      play: (type: SoundType) => soundEngine.play(type),
      stopRingtone: () => soundEngine.stopRingtone(),
    },
    activeCall, setActiveCall,
    activeGroupCall, setActiveGroupCall,
    chatIsMounted, setChatIsMounted,
    avatarCache,
    requestNotificationPermission,
  };
}

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error("useWebSocket must be used within a WebSocketProvider");
  return context;
}