import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/**
 * GlobalCallNotification
 *
 * Coloque este componente UMA VEZ no root do app (ex: App.tsx ou Layout.tsx),
 * fora de qualquer rota. Ele exibe a notificação de chamada em QUALQUER página.
 *
 * Exemplo de uso no App.tsx:
 *   import { GlobalCallNotification } from "@/components/GlobalCallNotification";
 *   ...
 *   <GlobalCallNotification />
 *   <Router>...</Router>
 */
export function GlobalCallNotification() {
  const { activeCall, setActiveCall, socket, sounds } = useWebSocket();
  const [, navigate] = useLocation();
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAnswering, setIsAnswering] = useState(false);

  // Resetar timer quando uma nova chamada chega
  useEffect(() => {
    if (!activeCall) {
      setTimeLeft(30);
      setIsAnswering(false);
      return;
    }

    setTimeLeft(30);
    setIsAnswering(false);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall?.from, activeCall?.timestamp]);

  const handleReject = useCallback(() => {
    if (!activeCall) return;
    sounds.stopRingtone();
    socket?.send(JSON.stringify({
      type: "webrtc_reject",
      data: { target: activeCall.from, reason: "rejected" },
    }));
    setActiveCall(null);
  }, [activeCall, socket, sounds, setActiveCall]);

  const handleAnswer = useCallback(() => {
    if (!activeCall) return;
    setIsAnswering(true);
    sounds.stopRingtone();

    // Salva os dados da chamada para o Chat.tsx recuperar ao montar
    try {
      localStorage.setItem("pending_call_answer", JSON.stringify({
        ...activeCall,
        answeredAt: Date.now(),
      }));
    } catch {}

    // Limpa activeCall do contexto — Chat.tsx vai pegar do localStorage
    setActiveCall(null);

    // Navega para o chat
    navigate("/chat");

    // Dispara evento para o Chat.tsx já montado responder imediatamente
    window.dispatchEvent(new CustomEvent("answer_pending_call"));
  }, [activeCall, sounds, setActiveCall, navigate]);

  if (!activeCall) return null;

  const isVideo = activeCall.type === "video";
  const isGroup = activeCall.isGroup;

  return (
    <AnimatePresence>
      <motion.div
        key={`call-${activeCall.from}-${activeCall.timestamp}`}
        initial={{ opacity: 0, y: -120, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -120, scale: 0.85 }}
        transition={{ type: "spring", damping: 20, stiffness: 280 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[380px] max-w-[95vw]"
        style={{ pointerEvents: "auto" }}
      >
        {/* Glow de fundo */}
        <motion.div
          animate={{ opacity: [0.3, 0.75, 0.3], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "absolute inset-0 rounded-3xl blur-3xl -z-10 pointer-events-none",
            isVideo
              ? "bg-gradient-to-br from-violet-600/70 via-blue-500/50 to-cyan-400/30"
              : "bg-gradient-to-br from-emerald-600/70 via-teal-500/50 to-cyan-400/30"
          )}
        />

        <div
          className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(8,8,22,0.98) 0%, rgba(12,12,32,0.97) 100%)",
            backdropFilter: "blur(32px)",
          }}
        >
          {/* Barra colorida no topo */}
          <motion.div
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 3, repeat: Infinity }}
            className={cn(
              "h-1.5 w-full",
              isVideo
                ? "bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-400"
                : "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
            )}
            style={{ backgroundSize: "200% 200%" }}
          />

          <div className="p-6">
            {/* Badge tipo */}
            <div className="flex items-center justify-center mb-5">
              <motion.div
                animate={{ opacity: [1, 0.45, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border",
                  isVideo
                    ? "bg-violet-500/15 border-violet-400/25 text-violet-300"
                    : "bg-emerald-500/15 border-emerald-400/25 text-emerald-300"
                )}
              >
                <motion.span
                  animate={{ scale: [1, 1.35, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                </motion.span>
                {isGroup
                  ? "Chamada em Grupo"
                  : isVideo
                  ? "Chamada de Vídeo"
                  : "Chamada de Voz"}
              </motion.div>
            </div>

            {/* Avatar + info */}
            <div className="flex items-center gap-4 mb-7">
              <div className="relative shrink-0">
                {/* Ondas de chamada */}
                {[0.6, 1.1, 1.7].map((delay, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 2.8], opacity: [0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay, ease: "easeOut" }}
                    className={cn(
                      "absolute inset-0 rounded-2xl",
                      isVideo ? "bg-violet-500/30" : "bg-emerald-500/30"
                    )}
                  />
                ))}
                <div
                  className={cn(
                    "relative w-[70px] h-[70px] rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-2xl ring-2",
                    isVideo
                      ? "bg-gradient-to-br from-violet-500 to-blue-600 ring-violet-400/30 shadow-violet-500/40"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600 ring-emerald-400/30 shadow-emerald-500/40"
                  )}
                >
                  {activeCall.from.substring(0, 2).toUpperCase()}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-extrabold text-xl tracking-tight truncate">
                  {activeCall.from}
                </p>
                <motion.p
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="text-white/40 text-sm mt-0.5"
                >
                  {isGroup
                    ? "convidando para chamada em grupo..."
                    : "está chamando você..."}
                </motion.p>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-center gap-10">
              {/* Recusar */}
              <div className="flex flex-col items-center gap-2.5">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={handleReject}
                  disabled={isAnswering}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center shadow-xl shadow-red-500/40 ring-4 ring-red-500/20 transition-all hover:shadow-red-500/60 disabled:opacity-50"
                >
                  <PhoneOff className="w-6 h-6" />
                </motion.button>
                <span className="text-white/30 text-xs font-semibold tracking-wide">
                  Recusar
                </span>
              </div>

              {/* Atender */}
              <div className="flex flex-col items-center gap-2.5">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  animate={
                    !isAnswering
                      ? {
                          boxShadow: [
                            isVideo
                              ? "0 0 0 0px rgba(139,92,246,0.7)"
                              : "0 0 0 0px rgba(16,185,129,0.7)",
                            isVideo
                              ? "0 0 0 18px rgba(139,92,246,0)"
                              : "0 0 0 18px rgba(16,185,129,0)",
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 1.3, repeat: Infinity }}
                  onClick={handleAnswer}
                  disabled={isAnswering}
                  className={cn(
                    "w-16 h-16 rounded-2xl text-white flex items-center justify-center shadow-xl ring-4 transition-all",
                    isVideo
                      ? "bg-gradient-to-br from-violet-500 to-blue-600 shadow-violet-500/40 ring-violet-500/20 hover:shadow-violet-500/60"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/40 ring-emerald-500/20 hover:shadow-emerald-500/60"
                  )}
                >
                  {isAnswering ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isVideo ? (
                    <Video className="w-6 h-6" />
                  ) : (
                    <Phone className="w-6 h-6" />
                  )}
                </motion.button>
                <span className="text-white/30 text-xs font-semibold tracking-wide">
                  Atender
                </span>
              </div>
            </div>
          </div>

          {/* Timer bar */}
          <div className="px-6 pb-5">
            <div className="relative h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isVideo
                    ? "bg-gradient-to-r from-violet-500 to-cyan-400"
                    : "bg-gradient-to-r from-emerald-500 to-teal-400"
                )}
                initial={{ width: "100%" }}
                animate={{ width: `${(timeLeft / 30) * 100}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
            <p className="text-[10px] text-white/20 text-center mt-2 font-medium tracking-wider">
              {timeLeft}s para expirar
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}