import { db } from "./db";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { storage } from "./storage";
import { api } from "@shared/routes";
import { changePasswordSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";
const MAX_CHAT_HISTORY = 200;
const MAX_NOTIFICATIONS_PER_USER = 100;

const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_CHAT_IMAGE_SIZE: 10 * 1024 * 1024,
  ALLOWED_MIMETYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"] as const,
} as const;

type NotificationType =
  | "chat_message" | "chat_mention" | "user_login" | "user_logout"
  | "user_create" | "user_update" | "user_delete" | "product_create"
  | "product_edit" | "product_delete" | "movement_entry" | "movement_exit"
  | "movement_bulk" | "responsavel_create" | "report_generated"
  | "solicitacao" | "call_incoming" | "call_missed" | "call_ended"
  | "system" | "alert";

type Priority = "low" | "normal" | "high" | "urgent";
type CallType = "audio" | "video";
type CallStatus = "calling" | "connected" | "ended";

interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  sender?: string;
  targetUser?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
  priority: Priority;
  sound?: boolean;
  link?: string;
}

interface OnlineUserData {
  userId: number;
  username: string;
  normalizedUsername: string;
  connectedAt: string;
  lastSeen: string;
  avatarUrl?: string;
}

interface CallInfo {
  caller: string;
  callerNorm: string;
  target: string;
  targetNorm: string;
  type: CallType;
  startTime: Date;
  status: CallStatus;
  isGroup?: boolean;
  groupRoom?: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  dmTo?: string;
  type?: "text" | "image" | "solicitacao";
  imageUrl?: string;
  readBy: string[];
  edited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  reactions: Record<string, string[]>;
  replyTo?: { id: string; sender: string; content: string };
}

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string };
}

// ==========================================
// UPLOAD MANAGER
// ==========================================

class UploadManager {
  private avatarsDir: string;
  private chatImagesDir: string;

  constructor() {
    this.avatarsDir = path.join(process.cwd(), "uploads", "avatars");
    this.chatImagesDir = path.join(process.cwd(), "uploads", "chat");
    [this.avatarsDir, this.chatImagesDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  getAvatarStorage() {
    return multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, this.avatarsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `avatar-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
      },
    });
  }

  getChatImageStorage() {
    return multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, this.chatImagesDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `chat-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
      },
    });
  }

  fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    if (UPLOAD_CONFIG.ALLOWED_MIMETYPES.includes(file.mimetype as any)) cb(null, true);
    else cb(new Error(`Tipo não permitido: ${file.mimetype}`));
  }

  deleteFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); return true; }
      return false;
    } catch { return false; }
  }

  getAvatarPath(filename: string): string {
    return path.join(this.avatarsDir, filename);
  }

  validateFilename(filename: string): boolean {
    return !filename.includes("..") && !filename.includes("/") && !filename.includes("\\");
  }
}

const uploadManager = new UploadManager();

const avatarUpload = multer({
  storage: uploadManager.getAvatarStorage(),
  fileFilter: uploadManager.fileFilter.bind(uploadManager),
  limits: { fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE },
});

const chatImageUpload = multer({
  storage: uploadManager.getChatImageStorage(),
  fileFilter: uploadManager.fileFilter.bind(uploadManager),
  limits: { fileSize: UPLOAD_CONFIG.MAX_CHAT_IMAGE_SIZE },
});

// ==========================================
// NOTIFICATION MANAGER
// ==========================================

class NotificationManager {
  private notifications = new Map<number, NotificationPayload[]>();

  constructor(
    private wss: WebSocketServer,
    private onlineUsers: Map<WebSocket, OnlineUserData>,
    private userSocketMap: Map<string, WebSocket>
  ) {}

  private generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  create(type: NotificationType, title: string, message: string, options: { sender?: string; targetUser?: string; data?: Record<string, unknown>; priority?: Priority; sound?: boolean; link?: string } = {}): NotificationPayload {
    return { id: this.generateId(), type, title, message, sender: options.sender, targetUser: options.targetUser, data: options.data, timestamp: new Date().toISOString(), read: false, priority: options.priority || "normal", sound: options.sound ?? false, link: options.link };
  }

  addToUser(userId: number, notification: NotificationPayload): void {
    if (!this.notifications.has(userId)) this.notifications.set(userId, []);
    const list = this.notifications.get(userId)!;
    list.unshift(notification);
    if (list.length > MAX_NOTIFICATIONS_PER_USER) list.pop();
    const sock = this.findUserSocket(userId);
    if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ event: "notification", data: notification }));
  }

  broadcast(notification: NotificationPayload, excludeUserId?: number): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const ud = this.onlineUsers.get(client);
      if (!ud || ud.userId === excludeUserId) return;
      this.addToUser(ud.userId, { ...notification });
    });
  }

  sendToUser(username: string, notification: NotificationPayload): void {
    const norm = username.toLowerCase().trim();
    const ud = Array.from(this.onlineUsers.values()).find((u) => u.normalizedUsername === norm);
    if (ud) this.addToUser(ud.userId, notification);
    const sock = this.userSocketMap.get(norm);
    if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ event: "notification", data: notification }));
  }

  getUnreadCount = (userId: number) => (this.notifications.get(userId) || []).filter((n) => !n.read).length;
  getUserNotifications = (userId: number) => this.notifications.get(userId) || [];

  markAsRead(userId: number, notificationId?: string, markAll = false): void {
    const list = this.notifications.get(userId);
    if (!list) return;
    if (markAll) list.forEach((n) => (n.read = true));
    else if (notificationId) { const n = list.find((x) => x.id === notificationId); if (n) n.read = true; }
  }

  clearUserNotification(userId: number, notificationId: string): void {
    const list = this.notifications.get(userId);
    if (!list) return;
    this.notifications.set(userId, list.filter((n) => n.id !== notificationId));
  }

  clearAllUserNotifications = (userId: number) => this.notifications.set(userId, []);

  private findUserSocket(userId: number): WebSocket | undefined {
    for (const [ws, ud] of this.onlineUsers.entries()) if (ud.userId === userId) return ws;
  }
}

// ==========================================
// CALL MANAGER
// ==========================================

class CallManager {
  private activeCalls = new Map<string, CallInfo>();
  private iceCandidatesBuffer = new Map<string, Array<{ candidate: unknown; from: string }>>();
  private groupRooms = new Map<string, Set<string>>();

  constructor(
    private notificationManager: NotificationManager,
    private userSocketMap: Map<string, WebSocket>,
    private onlineUsers: Map<WebSocket, OnlineUserData>
  ) {}

  private generateCallId = (u1: string, u2: string) => [u1, u2].map((x) => x.toLowerCase().trim()).sort().join("_");

  findCallByUser(username: string): { callId: string; callInfo: CallInfo } | null {
    const norm = username.toLowerCase().trim();
    for (const [id, info] of this.activeCalls)
      if (info.callerNorm === norm || info.targetNorm === norm) return { callId: id, callInfo: info };
    return null;
  }

  isUserInCall = (username: string) => this.findCallByUser(username) !== null;

  createCall(caller: string, target: string, type: CallType, offer: unknown, isGroup = false, groupRoom?: string): { success: boolean; error?: string; callId?: string } {
    if (this.isUserInCall(caller)) return { success: false, error: "Você já está em uma chamada" };
    const callerNorm = caller.toLowerCase().trim();
    const targetNorm = target.toLowerCase().trim();
    const callId = this.generateCallId(caller, target);
    this.activeCalls.set(callId, { caller, callerNorm, target, targetNorm, type, startTime: new Date(), status: "calling", isGroup, groupRoom });
    this.iceCandidatesBuffer.set(targetNorm, []);
    const targetSock = this.userSocketMap.get(targetNorm);
    if (targetSock?.readyState === WebSocket.OPEN) {
      targetSock.send(JSON.stringify({ event: "webrtc_offer", data: { offer, from: caller, type, callId, isGroup, groupRoom } }));
      this.notificationManager.sendToUser(target, this.notificationManager.create("call_incoming", `📞 Chamada ${type === "video" ? "de Vídeo" : "de Voz"}${isGroup ? " em Grupo" : ""}`, `${caller} está chamando você`, { sender: caller, priority: "urgent", sound: true, data: { callType: type, from: caller, callId, isCall: true, isGroup, groupRoom } }));
      if (isGroup && groupRoom) {
        if (!this.groupRooms.has(groupRoom)) this.groupRooms.set(groupRoom, new Set());
        this.groupRooms.get(groupRoom)!.add(callerNorm);
        this.groupRooms.get(groupRoom)!.add(targetNorm);
      }
      return { success: true, callId };
    }
    this.activeCalls.delete(callId);
    this.iceCandidatesBuffer.delete(targetNorm);
    this.notificationManager.sendToUser(caller, this.notificationManager.create("call_missed", "📵 Chamada Não Atendida", `${target} está offline`, { priority: "normal", sender: target }));
    return { success: false, error: "Usuário offline" };
  }

  answerCall(answerer: string, callerUsername: string, answer: unknown, callId?: string): void {
    const callerNorm = callerUsername.toLowerCase().trim();
    const answererNorm = answerer.toLowerCase().trim();
    const realCallId = callId || this.generateCallId(answerer, callerUsername);
    const info = this.activeCalls.get(realCallId);
    if (info) info.status = "connected";
    const callerSock = this.userSocketMap.get(callerNorm);
    if (callerSock?.readyState === WebSocket.OPEN)
      callerSock.send(JSON.stringify({ event: "webrtc_answer", data: { answer, from: answerer, callId: realCallId } }));
    const buffered = this.iceCandidatesBuffer.get(answererNorm) || [];
    if (buffered.length > 0) {
      const answererSock = this.userSocketMap.get(answererNorm);
      if (answererSock?.readyState === WebSocket.OPEN)
        buffered.forEach(({ candidate, from }) => answererSock.send(JSON.stringify({ event: "webrtc_ice_candidate", data: { candidate, from } })));
    }
    this.iceCandidatesBuffer.delete(answererNorm);
    this.iceCandidatesBuffer.set(callerNorm, []);
  }

  addIceCandidate(sender: string, target: string, candidate: unknown): void {
    const targetNorm = target.toLowerCase().trim();
    const targetSock = this.userSocketMap.get(targetNorm);
    const call = this.findCallByUser(sender);
    const isBeforeAnswer = call?.callInfo.status === "calling";
    if (!targetSock || targetSock.readyState !== WebSocket.OPEN || isBeforeAnswer) {
      if (!this.iceCandidatesBuffer.has(targetNorm)) this.iceCandidatesBuffer.set(targetNorm, []);
      this.iceCandidatesBuffer.get(targetNorm)!.push({ candidate, from: sender });
      return;
    }
    targetSock.send(JSON.stringify({ event: "webrtc_ice_candidate", data: { candidate, from: sender } }));
  }

  relay(sender: string, target: string, event: string, data: unknown): void {
    const targetSock = this.userSocketMap.get(target.toLowerCase().trim());
    if (targetSock?.readyState === WebSocket.OPEN) targetSock.send(JSON.stringify({ event, data }));
  }

  relayToGroup(sender: string, groupRoom: string, event: string, data: unknown): void {
    const room = this.groupRooms.get(groupRoom);
    if (!room) return;
    const senderNorm = sender.toLowerCase().trim();
    room.forEach((username) => {
      if (username === senderNorm) return;
      const sock = this.userSocketMap.get(username);
      if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ event, data }));
    });
  }

  endCall(username: string, reason = "Chamada encerrada"): void {
    const found = this.findCallByUser(username);
    if (!found) return;
    const { callId, callInfo } = found;
    const duration = Math.floor((Date.now() - callInfo.startTime.getTime()) / 1000);
    [callInfo.caller, callInfo.target].forEach((participant) => {
      if (participant.toLowerCase().trim() === username.toLowerCase().trim()) return;
      const sock = this.userSocketMap.get(participant.toLowerCase().trim());
      if (sock?.readyState === WebSocket.OPEN)
        sock.send(JSON.stringify({ event: "webrtc_end", data: { reason, by: username, duration, callType: callInfo.type, from: username } }));
      this.notificationManager.sendToUser(participant, this.notificationManager.create("call_ended", "Chamada Encerrada", `${username} encerrou a chamada (${duration}s)`, { sender: username, priority: "normal", data: { duration } }));
    });
    if (callInfo.groupRoom) {
      const room = this.groupRooms.get(callInfo.groupRoom);
      if (room) { room.delete(username.toLowerCase().trim()); if (room.size === 0) this.groupRooms.delete(callInfo.groupRoom); }
    }
    this.iceCandidatesBuffer.delete(callInfo.callerNorm);
    this.iceCandidatesBuffer.delete(callInfo.targetNorm);
    this.activeCalls.delete(callId);
  }

  rejectCall(rejecter: string, target: string, reason?: string, callId?: string): void {
    const realCallId = callId || this.generateCallId(rejecter, target);
    const info = this.activeCalls.get(realCallId);
    if (info) { this.activeCalls.delete(realCallId); this.iceCandidatesBuffer.delete(info.callerNorm); this.iceCandidatesBuffer.delete(info.targetNorm); }
    const targetSock = this.userSocketMap.get(target.toLowerCase().trim());
    if (targetSock?.readyState === WebSocket.OPEN)
      targetSock.send(JSON.stringify({ event: "webrtc_reject", data: { reason: reason || "Chamada recusada", by: rejecter } }));
    this.notificationManager.sendToUser(target, this.notificationManager.create("call_missed", "📵 Chamada Recusada", `${rejecter} recusou sua chamada`, { priority: "normal", sender: rejecter }));
  }

  getActiveCallsCount = () => this.activeCalls.size;
  endAllCalls = (reason = "Sistema em manutenção") => { for (const info of this.activeCalls.values()) this.endCall(info.caller, reason); };
}

// ==========================================
// CHAT MANAGER
// ==========================================

class ChatManager {
  private history: ChatMessage[] = [];
  private messageReads = new Map<string, Set<string>>();

  constructor(private wss: WebSocketServer, private onlineUsers: Map<WebSocket, OnlineUserData>, private maxHistory = MAX_CHAT_HISTORY) {}

  addMessage(message: ChatMessage): void {
    this.history.push(message);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  deleteMessage(messageId: string, userId: number, username: string, isAdmin: boolean): { success: boolean; error?: string; isPermanent?: boolean } {
    const idx = this.history.findIndex((m) => m.id === messageId);
    if (idx === -1) return { success: false, error: "Mensagem não encontrada" };
    const msg = this.history[idx];
    if (msg.sender !== username && !isAdmin) return { success: false, error: "Sem permissão" };
    if (isAdmin && msg.sender !== username) { this.history.splice(idx, 1); this.messageReads.delete(messageId); return { success: true, isPermanent: true }; }
    this.history[idx] = { ...msg, isDeleted: true, content: "Mensagem excluída", imageUrl: undefined, reactions: {}, replyTo: undefined };
    return { success: true, isPermanent: false };
  }

  editMessage(messageId: string, newContent: string, username: string): { success: boolean; error?: string; editedAt?: string } {
    const idx = this.history.findIndex((m) => m.id === messageId);
    if (idx === -1) return { success: false, error: "Mensagem não encontrada" };
    const msg = this.history[idx];
    if (msg.isDeleted) return { success: false, error: "Não é possível editar mensagem excluída" };
    if (msg.sender !== username) return { success: false, error: "Apenas o autor pode editar" };
    const editedAt = new Date().toISOString();
    this.history[idx] = { ...msg, content: newContent, edited: true, editedAt };
    return { success: true, editedAt };
  }

  addReaction(messageId: string, emoji: string, user: string): Record<string, string[]> | null {
    const idx = this.history.findIndex((m) => m.id === messageId);
    if (idx === -1 || this.history[idx].isDeleted) return null;
    const msg = this.history[idx];
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const i = msg.reactions[emoji].indexOf(user);
    if (i === -1) msg.reactions[emoji].push(user);
    else { msg.reactions[emoji].splice(i, 1); if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji]; }
    return msg.reactions;
  }

  markAsRead(messageIds: string[], username: string): void {
    messageIds.forEach((id) => { if (!this.messageReads.has(id)) this.messageReads.set(id, new Set()); this.messageReads.get(id)!.add(username); });
  }

  getHistoryWithReads(): ChatMessage[] {
    return this.history.map((msg) => ({ ...msg, readBy: this.messageReads.has(msg.id) ? Array.from(this.messageReads.get(msg.id)!) : [] }));
  }

  getHistory = () => [...this.history];
  broadcast = (event: string, data: unknown, exclude?: WebSocket) => this.wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN && c !== exclude) c.send(JSON.stringify({ event, data })); });
  broadcastToAll = (event: string, data: unknown) => this.wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ event, data })); });
}

// ==========================================
// MIDDLEWARES
// ==========================================

const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) { res.sendStatus(401); return; }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) { res.sendStatus(403); return; }
    (req as AuthenticatedRequest).user = user as { id: number; username: string };
    next();
  });
};

const handleZodError = (err: unknown, res: Response): void => {
  if (err instanceof z.ZodError) { res.status(400).json({ message: err.errors[0]?.message || "Dados inválidos" }); return; }
  throw err;
};

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// ==========================================
// REGISTER ROUTES
// ==========================================

export function registerRoutes(httpServer: Server, app: Express): Server {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const onlineUsers = new Map<WebSocket, OnlineUserData>();
  const userSocketMap = new Map<string, WebSocket>();

  const notificationManager = new NotificationManager(wss, onlineUsers, userSocketMap);
  const callManager = new CallManager(notificationManager, userSocketMap, onlineUsers);
  const chatManager = new ChatManager(wss, onlineUsers);

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const broadcastToAll = (event: string, data: unknown) => {
    wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ event, data })); });
  };

  const broadcastOnlineUsers = () => {
    const unique = Array.from(new Map(Array.from(onlineUsers.values()).map((u) => [u.userId, u])).values());
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN)
        c.send(JSON.stringify({ event: "online_users", data: unique.map((u) => ({ ...u, unreadNotifications: notificationManager.getUnreadCount(u.userId) })) }));
    });
  };

  // ==========================================
  // WEBSOCKET
  // ==========================================

  wss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      try {
        let parsed: { type?: string; data?: Record<string, unknown>; event?: string };
        try { parsed = JSON.parse(raw.toString()); }
        catch { ws.send(JSON.stringify({ event: "error", data: { message: "JSON inválido" } })); return; }

        if (!parsed || typeof parsed !== "object") { ws.send(JSON.stringify({ event: "error", data: { message: "Formato inválido" } })); return; }

        const data = parsed.data || {};
        const type = parsed.type || parsed.event;
        if (!type || typeof type !== "string") { ws.send(JSON.stringify({ event: "error", data: { message: "Campo 'type' obrigatório" } })); return; }

        const userData = onlineUsers.get(ws);

        switch (type) {
          case "identify": {
            const { userId, username } = data as { userId?: number; username?: string };
            if (typeof userId !== "number" || !username) { ws.send(JSON.stringify({ event: "error", data: { message: "userId e username obrigatórios" } })); return; }
            const norm = username.toLowerCase().trim();
            let avatarUrl: string | undefined;
            try { const dbUser = await storage.getUser(userId); avatarUrl = dbUser?.avatar_url || undefined; } catch {}
            const ud: OnlineUserData = { userId, username, normalizedUsername: norm, connectedAt: new Date().toISOString(), lastSeen: new Date().toISOString(), avatarUrl };
            onlineUsers.set(ws, ud);
            userSocketMap.set(norm, ws);
            ws.send(JSON.stringify({ event: "identified", data: { success: true, unreadNotifications: notificationManager.getUnreadCount(userId), notifications: notificationManager.getUserNotifications(userId).slice(0, 20) } }));
            broadcastOnlineUsers();
            if (chatManager.getHistory().length > 0) ws.send(JSON.stringify({ event: "chat_history", data: chatManager.getHistoryWithReads() }));
            notificationManager.broadcast(notificationManager.create("user_login", "Usuário Online", `${username} entrou no sistema`, { sender: username, priority: "low" }), userId);
            break;
          }

          case "delete_message": {
            if (!userData) break;
            const { messageId } = data as { messageId?: string };
            if (!messageId) break;
            const user = await storage.getUser(userData.userId);
            const isAdmin = userData.username === "DEV" || !!user?.pode_gerenciar_usuarios;
            const result = chatManager.deleteMessage(messageId, userData.userId, userData.username, isAdmin);
            if (!result.success) { ws.send(JSON.stringify({ event: "error", data: { message: result.error } })); break; }
            chatManager.broadcastToAll("message_deleted", { messageId, deletedBy: userData.username, permanent: result.isPermanent, isDeleted: true });
            await storage.createHistory({ usuario: userData.username, acao: "Exclusão de Mensagem", modulo: "Chat", descricao: `${userData.username} excluiu mensagem`, ip: "websocket" });
            break;
          }

          case "edit_message": {
            if (!userData) break;
            const { messageId: editId, newContent } = data as { messageId?: string; newContent?: string };
            if (!editId || !newContent) break;
            const result = chatManager.editMessage(editId, newContent, userData.username);
            if (!result.success) { ws.send(JSON.stringify({ event: "error", data: { message: result.error } })); break; }
            chatManager.broadcastToAll("message_edited", { messageId: editId, newContent, editedBy: userData.username, editedAt: result.editedAt });
            break;
          }

          case "message_reaction": {
            const { messageId: rid, emoji, user } = data as { messageId?: string; emoji?: string; user?: string };
            if (!rid || !emoji || !user) break;
            const reactions = chatManager.addReaction(rid, emoji, user);
            if (reactions) chatManager.broadcastToAll("message_reaction", { messageId: rid, emoji, user, reactions });
            break;
          }

          case "webrtc_offer": {
            if (!userData) break;
            const { target, offer, type: ct, isGroup, groupRoom } = data as { target?: string; offer?: unknown; type?: CallType; isGroup?: boolean; groupRoom?: string };
            if (!target) break;
            const result = callManager.createCall(userData.username, target, ct || "audio", offer, isGroup, groupRoom);
            if (!result.success) ws.send(JSON.stringify({ event: "webrtc_reject", data: { reason: result.error } }));
            break;
          }

          case "webrtc_answer": {
            if (!userData) break;
            const { target: aTarget, answer, callId: aCid } = data as { target?: string; answer?: unknown; callId?: string };
            if (!aTarget) break;
            callManager.answerCall(userData.username, aTarget, answer, aCid);
            break;
          }

          case "webrtc_ice_candidate": {
            if (!userData) break;
            const { target: iTarget, candidate, groupRoom: iGroupRoom } = data as { target?: string; candidate?: unknown; groupRoom?: string };
            if (!iTarget) break;
            if (iGroupRoom) callManager.relay(userData.username, iTarget, "webrtc_ice_candidate", { candidate, from: userData.username, groupRoom: iGroupRoom });
            else callManager.addIceCandidate(userData.username, iTarget, candidate);
            break;
          }

          case "webrtc_end": {
            if (!userData) break;
            const { reason: eReason, target: eTarget } = data as { reason?: string; target?: string };
            if (eTarget) callManager.relay(userData.username, eTarget, "webrtc_end", { reason: eReason || "ended", by: userData.username, from: userData.username });
            else callManager.endCall(userData.username, eReason || "Chamada encerrada");
            break;
          }

          case "webrtc_reject": {
            if (!userData) break;
            const { target: rTarget, reason: rReason, callId: rCid } = data as { target?: string; reason?: string; callId?: string };
            if (!rTarget) break;
            callManager.rejectCall(userData.username, rTarget, rReason, rCid);
            break;
          }

          case "webrtc_camera_toggle": {
            if (!userData) break;
            const { target: cTarget, videoEnabled, groupRoom: cGroupRoom } = data as { target?: string; videoEnabled?: boolean; groupRoom?: string };
            const relayData = { from: userData.username, videoEnabled };
            if (cGroupRoom) callManager.relayToGroup(userData.username, cGroupRoom, "webrtc_camera_toggle", relayData);
            else if (cTarget) callManager.relay(userData.username, cTarget, "webrtc_camera_toggle", relayData);
            break;
          }

          case "webrtc_audio_toggle": {
            if (!userData) break;
            const { target: aToggleTarget, audioEnabled, groupRoom: aToggleGroupRoom } = data as { target?: string; audioEnabled?: boolean; groupRoom?: string };
            const relayData = { from: userData.username, audioEnabled };
            if (aToggleGroupRoom) callManager.relayToGroup(userData.username, aToggleGroupRoom, "webrtc_audio_toggle", relayData);
            else if (aToggleTarget) callManager.relay(userData.username, aToggleTarget, "webrtc_audio_toggle", relayData);
            break;
          }

          case "chat_message": {
            const msgData = data as Partial<ChatMessage>;
            if (!msgData.sender || !msgData.content) break;
            const msg: ChatMessage = {
              id: msgData.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              sender: msgData.sender, content: msgData.content, timestamp: new Date().toISOString(),
              dmTo: msgData.dmTo, type: msgData.type || "text", imageUrl: msgData.imageUrl,
              readBy: [msgData.sender], edited: false, isDeleted: false, reactions: {}, replyTo: msgData.replyTo,
            };
            chatManager.addMessage(msg);
            chatManager.broadcastToAll("chat_message", msg);
            const mentions = (msg.content.match(/@(\w+)/g) || []) as string[];
            mentions.forEach((m) => {
              const uname = m.substring(1);
              if (uname.toLowerCase() !== msg.sender.toLowerCase())
                notificationManager.sendToUser(uname, notificationManager.create("chat_mention", "Você foi mencionado", `${msg.sender}: ${msg.content.substring(0, 60)}`, { sender: msg.sender, priority: "high", sound: true, link: "/chat" }));
            });
            if (!msg.dmTo) notificationManager.broadcast(notificationManager.create("chat_message", "Nova Mensagem", `${msg.sender}: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? "..." : ""}`, { sender: msg.sender, priority: "normal", link: "/chat" }));
            else notificationManager.sendToUser(msg.dmTo, notificationManager.create("chat_message", `Mensagem de ${msg.sender}`, msg.content.substring(0, 100), { sender: msg.sender, priority: "high", sound: true, link: "/chat" }));
            break;
          }

          case "typing": {
            if (!userData) break;
            const { isTyping, target: tTarget } = data as { isTyping?: boolean; target?: string };
            chatManager.broadcast("typing", { username: userData.username, isTyping: !!isTyping, target: tTarget }, ws);
            break;
          }

          case "mark_read": {
            if (!userData) break;
            const { messageIds } = data as { messageIds?: string[] };
            if (!Array.isArray(messageIds)) break;
            chatManager.markAsRead(messageIds, userData.username);
            chatManager.broadcastToAll("messages_read", { messageIds, readBy: userData.username, readAt: new Date().toISOString() });
            break;
          }

          case "mark_notification_read": {
            if (!userData) break;
            const { notificationId: nid, markAll } = data as { notificationId?: string; markAll?: boolean };
            notificationManager.markAsRead(userData.userId, nid, markAll);
            ws.send(JSON.stringify({ event: "notifications_updated", data: { unreadCount: notificationManager.getUnreadCount(userData.userId), notifications: notificationManager.getUserNotifications(userData.userId).slice(0, 20) } }));
            break;
          }

          case "delete_notification": {
            if (!userData) break;
            const { notificationId: dnid } = data as { notificationId?: string };
            if (!dnid) break;
            notificationManager.clearUserNotification(userData.userId, dnid);
            ws.send(JSON.stringify({ event: "notifications_updated", data: { unreadCount: notificationManager.getUnreadCount(userData.userId), notifications: notificationManager.getUserNotifications(userData.userId).slice(0, 20) } }));
            break;
          }

          case "report_generated": {
            const { username: ru, reportName } = data as { username?: string; reportName?: string };
            if (ru && reportName) notificationManager.broadcast(notificationManager.create("report_generated", "Relatório Gerado", `${ru} gerou: ${reportName}`, { sender: ru, priority: "low" }));
            break;
          }

          case "solicitacao_sent": {
            const { username: su } = data as { username?: string };
            if (su) notificationManager.broadcast(notificationManager.create("solicitacao", "Solicitação de Materiais", `${su} enviou uma solicitação`, { sender: su, priority: "high", sound: true, link: "/chat" }));
            break;
          }

          case "ping":
            ws.send(JSON.stringify({ event: "pong", timestamp: Date.now() }));
            break;

          default:
            ws.send(JSON.stringify({ event: "error", data: { message: `Tipo '${type}' não reconhecido` } }));
        }
      } catch (e) {
        console.error("❌ WS error:", e);
        try { ws.send(JSON.stringify({ event: "error", data: { message: "Erro interno" } })); } catch {}
      }
    });

    ws.on("close", () => {
      const ud = onlineUsers.get(ws);
      if (!ud) return;
      callManager.endCall(ud.username, "Usuário desconectou");
      onlineUsers.delete(ws);
      userSocketMap.delete(ud.normalizedUsername);
      notificationManager.broadcast(notificationManager.create("user_logout", "Usuário Offline", `${ud.username} saiu do sistema`, { sender: ud.username, priority: "low" }), ud.userId);
      broadcastOnlineUsers();
    });

    ws.on("error", (e) => console.error("❌ WS error:", e));
  });

  // ==========================================
  // ROTAS: NOTIFICAÇÕES
  // ==========================================

  app.get("/api/notifications", authenticateToken, async (req, res) => {
    const userId = (req as AuthenticatedRequest).user.id;
    const list = notificationManager.getUserNotifications(userId);
    const { unreadOnly, limit = "20", offset = "0" } = req.query;
    let filtered = unreadOnly === "true" ? list.filter((n) => !n.read) : list;
    const start = parseInt(offset as string), end = start + parseInt(limit as string);
    res.json({ notifications: filtered.slice(start, end), total: list.length, unreadCount: notificationManager.getUnreadCount(userId), hasMore: end < filtered.length });
  });

  app.post("/api/notifications/:id/read", authenticateToken, async (req, res) => {
    notificationManager.markAsRead((req as AuthenticatedRequest).user.id, req.params.id);
    res.json({ success: true, unreadCount: notificationManager.getUnreadCount((req as AuthenticatedRequest).user.id) });
  });

  app.post("/api/notifications/read-all", authenticateToken, async (req, res) => {
    notificationManager.markAsRead((req as AuthenticatedRequest).user.id, undefined, true);
    res.json({ success: true, unreadCount: 0 });
  });

  app.delete("/api/notifications/:id", authenticateToken, async (req, res) => {
    notificationManager.clearUserNotification((req as AuthenticatedRequest).user.id, req.params.id);
    res.json({ success: true, unreadCount: notificationManager.getUnreadCount((req as AuthenticatedRequest).user.id) });
  });

  app.delete("/api/notifications", authenticateToken, async (req, res) => {
    notificationManager.clearAllUserNotifications((req as AuthenticatedRequest).user.id);
    res.json({ success: true });
  });

  // ==========================================
  // ROTAS: AUTENTICAÇÃO
  // ==========================================

  app.post(api.auth.login.path, asyncHandler(async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const users = await storage.getUsers();
      const realUser = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!realUser || !realUser.active) return res.status(401).json({ message: "Usuário desativado ou inexistente." });
      if (!(await bcrypt.compare(password, realUser.password))) return res.status(401).json({ message: "Credenciais inválidas" });
      const token = jwt.sign({ id: realUser.id, username: realUser.username }, JWT_SECRET, { expiresIn: "8h" });
      await storage.createHistory({ usuario: realUser.username, acao: "Login", modulo: "Auth", descricao: "Usuário realizou login", ip: req.ip || "unknown" });
      notificationManager.broadcast(notificationManager.create("user_login", "Usuário Online", `${realUser.username} entrou no sistema`, { sender: realUser.username, priority: "low" }), realUser.id);
      res.status(200).json({ token, user: realUser, mustChangePassword: realUser.must_change_password, unreadNotifications: notificationManager.getUnreadCount(realUser.id) });
    } catch (err) { handleZodError(err, res); }
  }));

  app.get(api.auth.me.path, authenticateToken, async (req, res) => {
    const user = await storage.getUser((req as AuthenticatedRequest).user.id);
    if (!user) return res.sendStatus(404);
    res.json({ ...user, unreadNotifications: notificationManager.getUnreadCount(user.id) });
  });

  app.post(api.auth.changePassword.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const userId = (req as AuthenticatedRequest).user.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: "Senha atual incorreta" });
      await storage.updateUser(userId, { password: await bcrypt.hash(newPassword, 10), must_change_password: false });
      await storage.createHistory({ usuario: user.username, acao: "Troca de Senha", modulo: "Auth", descricao: "Usuário alterou sua senha", ip: req.ip || "unknown" });
      notificationManager.addToUser(userId, notificationManager.create("system", "Senha Alterada", "Sua senha foi alterada com sucesso", { priority: "high" }));
      res.status(200).json({ message: "Senha alterada com sucesso" });
    } catch (err) { handleZodError(err, res); }
  }));

  // ==========================================
  // ROTAS: USUÁRIOS
  // ==========================================

  app.get(api.users.list.path, authenticateToken, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users.map((u) => ({ ...u, online: Array.from(onlineUsers.values()).some((ou) => ou.userId === u.id), inCall: callManager.isUserInCall(u.username) })));
  });

  app.post(api.users.create.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      input.password = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser(input);
      const u = await storage.getUser((req as AuthenticatedRequest).user.id);
      await storage.createHistory({ usuario: u?.username || "Desconhecido", acao: "Cadastro de Usuário", modulo: "Usuários", descricao: `Cadastrou ${user.username}`, ip: req.ip || "unknown" });
      notificationManager.broadcast(notificationManager.create("user_create", "Novo Usuário", `${u?.username} cadastrou ${user.username}`, { sender: u?.username, priority: "normal" }));
      res.status(201).json(user);
    } catch (err) { handleZodError(err, res); }
  }));

  app.put(api.users.update.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const input = api.users.update.input.parse(req.body);
      if (input.password) input.password = await bcrypt.hash(input.password, 10);
      const targetUser = await storage.getUser(Number(req.params.id));
      const user = await storage.updateUser(Number(req.params.id), input);
      const u = await storage.getUser((req as AuthenticatedRequest).user.id);
      notificationManager.broadcast(notificationManager.create("user_update", "Usuário Atualizado", `${u?.username} alterou ${targetUser?.username || user?.username}`, { sender: u?.username, priority: "low" }));
      res.status(200).json(user);
    } catch (err) { handleZodError(err, res); }
  }));

  app.delete(api.users.delete.path, authenticateToken, asyncHandler(async (req, res) => {
    const reqUser = await storage.getUser((req as AuthenticatedRequest).user.id);
    if (!reqUser?.pode_gerenciar_usuarios) return res.status(403).json({ message: "Sem permissão" });
    const target = await storage.getUser(Number(req.params.id));
    if (target?.username === "DEV") return res.status(400).json({ message: "Não é possível excluir o usuário DEV" });
    if (target) {
      callManager.endCall(target.username, "Usuário excluído");
      const sock = userSocketMap.get(target.username.toLowerCase());
      if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ event: "force_logout", data: { message: "Sua conta foi excluída pelo administrador" } }));
    }
    await storage.deleteUser(Number(req.params.id));
    notificationManager.broadcast(notificationManager.create("user_delete", "Usuário Excluído", `${reqUser?.username} excluiu ${target?.username}`, { sender: reqUser?.username, priority: "high" }));
    res.sendStatus(204);
  }));

  // ==========================================
  // AVATAR UPLOAD — usa SQL direto para evitar problema de tipo no Drizzle
  // ==========================================

  const handleAvatarUpload = async (req: Request, res: Response, userId: number) => {
    if (!req.file) return res.status(400).json({ success: false, message: "Nenhuma imagem enviada" });

    const currentUser = (req as AuthenticatedRequest).user;
    if (currentUser.id !== userId && currentUser.username !== "DEV") {
      uploadManager.deleteFile(req.file.path);
      return res.status(403).json({ success: false, message: "Sem permissão" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      // Remover avatar antigo
      const existingUser = await storage.getUser(userId);
      const oldUrl = existingUser?.avatar_url;
      if (oldUrl) {
        const oldFilename = path.basename(oldUrl);
        if (uploadManager.validateFilename(oldFilename)) uploadManager.deleteFile(uploadManager.getAvatarPath(oldFilename));
      }

      // Salvar no banco via SQL direto (evita erro de tipo no Drizzle)
      const { sql: sqlRaw } = await import("drizzle-orm");
      await storage.updateAvatar(userId, avatarUrl);
      // Atualizar mapa de online users
      for (const [ws, ud] of onlineUsers.entries()) {
        if (ud.userId === userId) { onlineUsers.set(ws, { ...ud, avatarUrl }); break; }
      }

      // Broadcast para todos
      broadcastToAll("user_avatar_updated", {
        userId,
        username: existingUser?.username || currentUser.username,
        avatarUrl,
        timestamp: new Date().toISOString(),
      });
      broadcastOnlineUsers();

      console.log(`🖼️ Avatar atualizado: ${existingUser?.username} → ${avatarUrl}`);

      return res.json({
        success: true,
        url: avatarUrl,       // ← Chat.tsx usa data.url
        avatarUrl,
        filename: req.file.filename,
        size: req.file.size,
      });
    } catch (err) {
      console.error("❌ Erro ao salvar avatar:", err);
      uploadManager.deleteFile(req.file.path);
      return res.status(500).json({ success: false, message: "Erro ao salvar avatar" });
    }
  };

  // POST /api/users/avatar — usuário atual
  app.post("/api/users/avatar", authenticateToken,
    (req, res, next) => { avatarUpload.single("avatar")(req, res, (err) => { if (err) return res.status(400).json({ success: false, message: err.message }); next(); }); },
    (req, res) => handleAvatarUpload(req, res, (req as AuthenticatedRequest).user.id)
  );

  // POST /api/users/:userId/avatar — admin
  app.post("/api/users/:userId/avatar", authenticateToken,
    (req, res, next) => { avatarUpload.single("avatar")(req, res, (err) => { if (err) return res.status(400).json({ success: false, message: err.message }); next(); }); },
    (req, res) => {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) { if (req.file) uploadManager.deleteFile(req.file.path); return res.status(400).json({ success: false, message: "ID inválido" }); }
      handleAvatarUpload(req, res, userId);
    }
  );

  // DELETE avatar
  app.delete("/api/users/:userId/avatar", authenticateToken, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const currentUser = (req as AuthenticatedRequest).user;
    if (isNaN(userId)) return res.status(400).json({ success: false, message: "ID inválido" });
    if (currentUser.id !== userId && currentUser.username !== "DEV") return res.status(403).json({ success: false, message: "Sem permissão" });
    try {
      const user = await storage.getUser(userId);
      const oldUrl = user?.avatar_url;
      if (oldUrl) { const f = path.basename(oldUrl); if (uploadManager.validateFilename(f)) uploadManager.deleteFile(uploadManager.getAvatarPath(f)); }
      await storage.updateAvatar(userId, null);
      broadcastToAll("user_avatar_updated", { userId, username: user?.username || currentUser.username, avatarUrl: null, timestamp: new Date().toISOString() });
      broadcastOnlineUsers();
      res.json({ success: true, message: "Avatar removido" });
    } catch { res.status(500).json({ success: false, message: "Erro ao remover avatar" }); }
  }));

  // GET avatar
  app.get("/api/users/:userId/avatar", authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: "ID inválido" });
    try { const user = await storage.getUser(userId); res.json({ success: true, avatarUrl: user?.avatar_url || null }); }
    catch { res.status(500).json({ success: false, message: "Erro" }); }
  });

  // ==========================================
  // ROTAS: RESPONSÁVEIS
  // ==========================================

  app.get(api.responsaveis.list.path, authenticateToken, async (req, res) => res.json(await storage.getResponsaveis()));

  app.post(api.responsaveis.create.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const input = api.responsaveis.create.input.parse(req.body);
      const r = await storage.createResponsavel(input);
      const u = await storage.getUser((req as AuthenticatedRequest).user.id);
      await storage.createHistory({ usuario: u?.username || "Desconhecido", acao: "Cadastro de Responsável", modulo: "Usuários", descricao: `Cadastrou ${r.nome} (${r.setor})`, ip: req.ip || "unknown" });
      res.status(201).json(r);
    } catch (err) { handleZodError(err, res); }
  }));

  app.put(api.responsaveis.update.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const input = api.responsaveis.update.input.parse(req.body);
      res.status(200).json(await storage.updateResponsavel(Number(req.params.id), input));
    } catch (err) { handleZodError(err, res); }
  }));

  app.delete(api.responsaveis.delete.path, authenticateToken, async (req, res) => {
    await storage.deleteResponsavel(Number(req.params.id));
    res.sendStatus(204);
  });

  // ==========================================
  // ROTAS: PRODUTOS
  // ==========================================

  app.get(api.products.list.path, authenticateToken, async (req, res) => res.json(await storage.getProducts()));

  app.get(api.products.get.path, authenticateToken, async (req, res) => {
    const p = await storage.getProduct(Number(req.params.id));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  });

  app.post(api.products.create.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      input.criado_por = (req as AuthenticatedRequest).user.id;
      const product = await storage.createProduct(input);
      const u = await storage.getUser((req as AuthenticatedRequest).user.id);
      notificationManager.broadcast(notificationManager.create("product_create", "Novo Produto", `${u?.username} cadastrou ${product.nome}`, { sender: u?.username, priority: "normal" }));
      await storage.createHistory({ usuario: u?.username || "Desconhecido", acao: "Cadastro de Produto", modulo: "Produtos", descricao: `Cadastrou ${product.nome}`, ip: req.ip || "unknown" });
      res.status(201).json(product);
    } catch (err) { handleZodError(err, res); }
  }));

  app.put(api.products.update.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const input = api.products.update.input.parse(req.body);
      const old = await storage.getProduct(Number(req.params.id));
      if (!old) return res.status(404).json({ message: "Produto não encontrado" });
      const product = await storage.updateProduct(Number(req.params.id), input);
      const changes: string[] = [];
      if (input.nome !== undefined && input.nome !== old.nome) changes.push(`Nome: ${old.nome} → ${input.nome}`);
      if (input.quantidade_atual !== undefined && input.quantidade_atual !== old.quantidade_atual) {
        changes.push(`Qtd: ${old.quantidade_atual} → ${input.quantidade_atual}`);
        if (input.quantidade_atual <= (input.estoque_minimo || old.estoque_minimo) && input.quantidade_atual > 0)
          notificationManager.broadcast(notificationManager.create("alert", "⚠️ Estoque Baixo", `${product.nome} está com estoque baixo (${input.quantidade_atual})`, { priority: "urgent", sound: true, link: "/products" }));
        if (input.quantidade_atual === 0)
          notificationManager.broadcast(notificationManager.create("alert", "🚨 Estoque Zerado", `${product.nome} está sem estoque!`, { priority: "urgent", sound: true, link: "/products" }));
      }
      const u = await storage.getUser((req as AuthenticatedRequest).user.id);
      if (changes.length > 0) {
        await storage.createHistory({ usuario: u?.username || "Desconhecido", acao: "Edição de Produto", modulo: "Produtos", descricao: `Editou ${old.nome}: ${changes.join(", ")}`, ip: req.ip || "unknown" });
        notificationManager.broadcast(notificationManager.create("product_edit", "Produto Atualizado", `${u?.username} editou ${old.nome}`, { sender: u?.username, priority: "normal" }), u?.id);
      }
      res.status(200).json(product);
    } catch (err) { handleZodError(err, res); }
  }));

  app.delete("/api/products/:id", authenticateToken, asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const p = await storage.getProduct(id);
    if (!p) return res.status(404).json({ message: "Produto não encontrado" });
    const u = await storage.getUser((req as AuthenticatedRequest).user.id);
    await storage.deleteProduct(id);
    await storage.createHistory({ usuario: u?.username || "Desconhecido", acao: "Exclusão de Produto", modulo: "Produtos", descricao: `Excluiu ${p.nome}`, ip: req.ip || "unknown" });
    notificationManager.broadcast(notificationManager.create("product_delete", "Produto Excluído", `${u?.username} excluiu ${p.nome}`, { sender: u?.username, priority: "high" }), u?.id);
    res.status(204).send();
  }));

  app.delete("/api/products", authenticateToken, asyncHandler(async (req, res) => {
    const products = await storage.getProducts();
    for (const p of products) await storage.deleteProduct(p.id);
    res.json({ deleted: products.length });
  }));

  app.post("/api/products/recategorize", authenticateToken, asyncHandler(async (req, res) => {
    const { recategorizeProducts } = await import("./seed");
    res.json(await recategorizeProducts());
  }));

  app.post("/api/products/bulk-import", authenticateToken, asyncHandler(async (req, res) => {
    const { products: importProducts } = req.body;
    if (!Array.isArray(importProducts)) return res.status(400).json({ message: "Expected array" });
    let imported = 0, skipped = 0;
    const existing = new Set((await storage.getProducts()).map((p) => p.nome.toLowerCase()));
    for (const item of importProducts) {
      const nome = item.nome || item.name || "SEM NOME";
      if (existing.has(nome.toLowerCase())) { skipped++; continue; }
      try {
        await storage.createProduct({ nome, codigo_barras: item.codigo_barras || item.barcode || null, categoria: item.categoria || item.category || "OUTROS", quantidade_atual: item.quantidade ?? item.quantity ?? 0, unidade: item.unidade || item.unit || "UN", localizacao: item.localizacao || item.location || null, estoque_minimo: item.estoque_minimo ?? item.min_stock ?? 0, ativo: item.ativo ?? item.active ?? true, criado_por: (req as AuthenticatedRequest).user.id });
        imported++;
      } catch { skipped++; }
    }
    res.json({ imported, skipped, total: importProducts.length });
  }));

  // ==========================================
  // ROTAS: MOVIMENTAÇÕES
  // ==========================================

  app.get(api.movements.list.path, authenticateToken, async (req, res) => res.json(await storage.getMovements()));

  app.post(api.movements.create.path, authenticateToken, asyncHandler(async (req, res) => {
    try {
      const input = api.movements.create.input.parse(req.body);
      input.usuario_id = (req as AuthenticatedRequest).user.id;
      if (!input.responsavel_id) delete (input as any).responsavel_id;
      const product = await storage.getProduct(input.produto_id);
      if (!product) return res.status(404).json({ message: "Produto não encontrado" });
      let novaQtd = product.quantidade_atual;
      if (input.tipo === "entrada") novaQtd += input.quantidade;
      else { if (product.quantidade_atual < input.quantidade) return res.status(400).json({ message: "Saldo insuficiente" }); novaQtd -= input.quantidade; }
      const movement = await storage.createMovement({ produto_id: input.produto_id, tipo: input.tipo, quantidade: input.quantidade, usuario_id: (req as AuthenticatedRequest).user.id, responsavel_id: input.responsavel_id || null, observacao: input.observacao || null } as any);
      await storage.updateProduct(product.id, { quantidade_atual: novaQtd });
      const u = await storage.getUser((req as AuthenticatedRequest).user.id);
      const label = input.tipo === "entrada" ? "Entrada" : "Saída";
      await storage.createHistory({ usuario: u?.username || "Desconhecido", acao: `Registro de ${label}`, modulo: "Movimentações", descricao: `${label} de ${input.quantidade} ${product.unidade} - ${product.nome}`, ip: req.ip || "unknown" });
      notificationManager.broadcast(notificationManager.create(input.tipo === "entrada" ? "movement_entry" : "movement_exit", `${label} Registrada`, `${u?.username}: ${input.quantidade} ${product.unidade} - ${product.nome}`, { sender: u?.username, priority: "normal", sound: true }), u?.id);
      if (input.tipo === "saida" && novaQtd <= product.estoque_minimo && novaQtd > 0)
        notificationManager.broadcast(notificationManager.create("alert", "⚠️ Estoque Baixo", `${product.nome} agora tem ${novaQtd} ${product.unidade}`, { priority: "urgent", sound: true, link: "/products" }));
      res.status(201).json(movement);
    } catch (err: any) { res.status(400).json({ message: err.message || "Erro" }); }
  }));

  app.post(api.movements.bulkExit.path, authenticateToken, asyncHandler(async (req, res) => {
    const reqUser = (req as AuthenticatedRequest).user;
    const fullUser = await storage.getUser(reqUser.id);
    if (fullUser && !fullUser.pode_registrar_saida && fullUser.username !== "DEV") return res.status(403).json({ message: "Sem permissão" });
    const { items, observacao } = api.movements.bulkExit.input.parse(req.body);
    const u = await storage.getUser(reqUser.id);
    let processed = 0, skipped = 0;
    const names: string[] = [];
    for (const item of items) {
      const product = await storage.getProduct(item.produto_id);
      if (!product || product.quantidade_atual < item.quantidade) { skipped++; continue; }
      const nova = product.quantidade_atual - item.quantidade;
      await storage.createMovement({ produto_id: item.produto_id, tipo: "saida", quantidade: item.quantidade, usuario_id: reqUser.id, responsavel_id: null, observacao: observacao || "Baixa via solicitação" } as any);
      await storage.updateProduct(product.id, { quantidade_atual: nova });
      names.push(`${item.quantidade} ${product.unidade} - ${product.nome}`);
      processed++;
    }
    if (processed > 0) {
      await storage.createHistory({ usuario: u?.username || "Desconhecido", acao: "Baixa em Lote", modulo: "Movimentações", descricao: `Baixa de ${processed} produto(s): ${names.join("; ")}`, ip: req.ip || "unknown" });
      notificationManager.broadcast(notificationManager.create("movement_bulk", "Baixa em Lote", `${u?.username}: ${processed} produto(s)`, { sender: u?.username, priority: "high", sound: true }), u?.id);
    }
    res.status(201).json({ processed, skipped });
  }));

  // ==========================================
  // ROTAS: CHAT UPLOAD
  // ==========================================

  app.post("/api/chat/upload", authenticateToken,
    (req, res, next) => {
      chatImageUpload.single("image")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ success: false, message: "Imagem muito grande. Máximo 10MB." });
          return res.status(400).json({ success: false, message: err.message || "Erro no upload" });
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      if (!req.file) return res.status(400).json({ success: false, message: "Nenhuma imagem enviada" });
      res.json({ success: true, url: `/uploads/chat/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
    }
  );

  // ==========================================
  // ROTAS: ADMIN
  // ==========================================
  app.post("/api/admin/kick-all", authenticateToken, asyncHandler(async (req, res) => {
    const reqUser = (req as AuthenticatedRequest).user;
    const fullUser = await storage.getUser(reqUser.id);
    if (!fullUser?.pode_gerenciar_usuarios && fullUser?.username !== "DEV") return res.status(403).json({ message: "Sem permissão" });
    const adminUsername = fullUser?.username || "DEV";
    callManager.endAllCalls("Sistema em manutenção");
    wss.clients.forEach((c) => {
      if (c.readyState !== WebSocket.OPEN) return;
      const ud = onlineUsers.get(c);
      if (ud && ud.username !== adminUsername) c.send(JSON.stringify({ event: "force_logout", data: { message: "Sessão encerrada pelo DEV." } }));
    });
    await storage.createHistory({ usuario: adminUsername, acao: "Sessões Encerradas", modulo: "Sistema", descricao: `${adminUsername} encerrou todas as sessões`, ip: req.ip || "unknown" });
    res.json({ message: "Todos desconectados", kicked: onlineUsers.size - 1 });
  }));
  // ==========================================
  // ROTA: FIX DATABASE (temporária - remover depois)
  // ==========================================

  app.get("/api/fix-db", async (req, res) => {
    try {
      // Importa o client do drizzle
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      // Verifica se a coluna existe
      const checkResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'avatar_url'
      `);
      
      if (checkResult.rows.length > 0) {
        return res.json({ 
          success: true, 
          message: "Coluna avatar_url já existe!",
          alreadyExists: true 
        });
      }
      
      // Cria a coluna
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN avatar_url TEXT
      `);
      
      res.json({ 
        success: true, 
        message: "Coluna avatar_url criada com sucesso!",
        alreadyExists: false 
      });
      
    } catch (error: any) {
      console.error("Erro ao criar coluna:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao criar coluna", 
        error: error.message 
      });
    }
  });
  // ==========================================
  // ROTAS: HISTÓRICO + DASHBOARD
  // ==========================================

  app.get(api.history.list.path, authenticateToken, async (req, res) => res.json(await storage.getHistory()));

  app.get(api.dashboard.stats.path, authenticateToken, asyncHandler(async (req, res) => {
    const [products, movements, users] = await Promise.all([storage.getProducts(), storage.getMovements(), storage.getUsers()]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayMovs = movements.filter((m) => m.data_hora && new Date(m.data_hora) >= today);
    const entriesToday = todayMovs.filter((m) => m.tipo === "entrada");
    const exitsToday = todayMovs.filter((m) => m.tipo === "saida");
    const allEntries = movements.filter((m) => m.tipo === "entrada");
    const allExits = movements.filter((m) => m.tipo === "saida");
    const lowStockProducts = products.filter((p) => p.estoque_minimo > 0 && p.quantidade_atual <= p.estoque_minimo);
    const zeroStockProducts = products.filter((p) => p.quantidade_atual === 0);
    const allRisk = Array.from(new Map([...lowStockProducts, ...zeroStockProducts].map((p) => [p.id, p])).values());
    const categoryBreakdown: Record<string, { count: number; stock: number }> = {};
    for (const p of products) { if (!categoryBreakdown[p.categoria]) categoryBreakdown[p.categoria] = { count: 0, stock: 0 }; categoryBreakdown[p.categoria].count++; categoryBreakdown[p.categoria].stock += p.quantidade_atual; }
    const alerts = [];
    if (zeroStockProducts.length > 0) alerts.push({ type: "danger", title: "Produtos sem Estoque", message: `${zeroStockProducts.length} produto(s) com estoque zerado`, count: zeroStockProducts.length });
    if (lowStockProducts.length > 0) alerts.push({ type: "warning", title: "Estoque Baixo", message: `${lowStockProducts.length} produto(s) abaixo do mínimo`, count: lowStockProducts.length });
    res.json({
      totalProducts: products.length, totalStock: products.reduce((a, p) => a + p.quantidade_atual, 0),
      lowStock: allRisk.length, lowStockList: allRisk.sort((a, b) => a.quantidade_atual - b.quantidade_atual).slice(0, 50).map((p) => ({ id: p.id, nome: p.nome, quantidade_atual: p.quantidade_atual, estoque_minimo: p.estoque_minimo, unidade: p.unidade, categoria: p.categoria, localizacao: p.localizacao })),
      categoryBreakdown, entriesToday: entriesToday.length, exitsToday: exitsToday.length,
      entriesItemsToday: entriesToday.reduce((a, m) => a + m.quantidade, 0), exitsItemsToday: exitsToday.reduce((a, m) => a + m.quantidade, 0),
      activeUsers: users.filter((u) => u.active).length, totalEntries: allEntries.length, totalExits: allExits.length,
      totalEntriesItems: allEntries.reduce((a, m) => a + m.quantidade, 0), totalExitsItems: allExits.reduce((a, m) => a + m.quantidade, 0),
      alerts, onlineNow: onlineUsers.size, activeCalls: callManager.getActiveCallsCount(),
    });
  }));

  // ==========================================
  // INICIALIZAÇÃO DO BANCO
  // ==========================================

  const initDb = async () => {
    const users = await storage.getUsers();
    if (users.length === 0) {
      const devUser = await storage.createUser({ username: "DEV", password: await bcrypt.hash("120605", 10), cargo: "Dev", active: true, pode_ver_dashboard: true, pode_ver_produtos: true, pode_registrar_entrada: true, pode_registrar_saida: true, pode_ver_historico: true, pode_ver_chat: true, pode_exportar_relatorio: true, pode_gerenciar_usuarios: true });
      await storage.createHistory({ usuario: "Sistema", acao: "Sistema Iniciado", modulo: "Sistema", descricao: "Usuário DEV criado automaticamente." });
      notificationManager.addToUser(devUser.id, notificationManager.create("system", "🎉 Bem-vindo!", "Usuário DEV criado. Senha: 120605", { priority: "high" }));
      try {
        const seedPath = path.join(process.cwd(), "attached_assets", "Pasted--id-6-barcode-name-ESCOVA-M-QUINA-DE-LIMPEZA-quantity-3_1772282094980.txt");
        if (fs.existsSync(seedPath)) {
          let content = fs.readFileSync(seedPath, "utf-8");
          if (!content.endsWith("]")) { const last = content.lastIndexOf("}"); if (last !== -1) content = content.substring(0, last + 1) + "]"; }
          const arr = JSON.parse(content);
          for (const p of arr) await storage.createProduct({ codigo_barras: p.barcode || "", nome: p.name, categoria: p.category || "OUTROS", quantidade_atual: p.quantity, unidade: p.unit || "UN", localizacao: p.location || "", estoque_minimo: p.min_stock || 0, ativo: p.active !== false, criado_por: devUser.id });
          console.log(`✅ Seeded ${arr.length} products`);
        }
      } catch (e) { console.error("❌ Seed error:", e); }
    }
  };

  initDb().catch((e) => console.error("❌ initDb error:", e));
  return httpServer;
}