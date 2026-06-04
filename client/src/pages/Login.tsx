import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Loader2, Lock, User, ShieldCheck, ArrowRight, Eye, EyeOff, Sparkles, Fingerprint, AlertTriangle, Clock } from "lucide-react";
import logoImg from "@assets/image_1772282413691.png";

// Componente de partículas de fundo
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let animationFrameId: number;
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
    }> = [];
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    const createParticles = () => {
      particles = [];
      const colors = ["#22c55e", "#16a34a", "#15803d", "#4ade80"];
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
          alpha: Math.random() * 0.5 + 0.1,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    };
    
    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.alpha;
        ctx.fill();
        
        // Conectar partículas próximas
        particles.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 150) {
            ctx.beginPath();
            ctx.strokeStyle = "#22c55e";
            ctx.globalAlpha = (1 - distance / 150) * 0.15;
            ctx.lineWidth = 1;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });
      });
      
      animationFrameId = requestAnimationFrame(drawParticles);
    };
    
    resize();
    createParticles();
    drawParticles();
    
    window.addEventListener("resize", () => {
      resize();
      createParticles();
    });
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
};

// Efeito de spotlight do mouse
const MouseSpotlight = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 150 };
  const spotlightX = useSpring(mouseX, springConfig);
  const spotlightY = useSpring(mouseY, springConfig);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);
  
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background: useTransform(
          [spotlightX, spotlightY],
          ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, rgba(34, 197, 94, 0.08), transparent 40%)`
        )
      }}
    />
  );
};

// Banner de Expiração
const ExpirationBanner = () => {
  const [daysLeft, setDaysLeft] = useState(0);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const expirationDate = new Date("2026-04-09");
    const today = new Date("2026-04-09"); // Data atual conforme contexto
    const diffTime = expirationDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysLeft(diffDays);
    setIsUrgent(diffDays <= 3);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
      className="w-full max-w-[460px] z-20 mb-4"
    >
      <motion.div
        animate={isUrgent ? {
          boxShadow: [
            "0 0 0 0 rgba(239, 68, 68, 0)",
            "0 0 0 4px rgba(239, 68, 68, 0.3)",
            "0 0 0 0 rgba(239, 68, 68, 0)"
          ]
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl ${
          isUrgent 
            ? "bg-red-950/90 border-red-500/50" 
            : "bg-amber-950/80 border-amber-500/40"
        }`}
      >
        {/* Animated background gradient */}
        <div className={`absolute inset-0 opacity-30 ${
          isUrgent 
            ? "bg-gradient-to-r from-red-600/20 via-orange-600/20 to-red-600/20" 
            : "bg-gradient-to-r from-amber-600/20 via-yellow-600/20 to-amber-600/20"
        }`} />
        
        {/* Shimmer effect */}
        <motion.div
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
        />

        <div className="relative z-10 p-4 flex items-center gap-4">
          <motion.div
            animate={isUrgent ? { rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
              isUrgent ? "bg-red-500/20" : "bg-amber-500/20"
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className={`w-6 h-6 ${isUrgent ? "text-red-400" : "text-amber-400"}`} />
            ) : (
              <Clock className={`w-6 h-6 ${isUrgent ? "text-red-400" : "text-amber-400"}`} />
            )}
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-sm font-bold uppercase tracking-wider ${
                isUrgent ? "text-red-400" : "text-amber-400"
              }`}>
                {isUrgent ? "⚠️ Acesso Expirado" : "⏰ Acesso Limitado"}
              </h3>
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isUrgent 
                    ? "bg-red-500/30 text-red-300" 
                    : "bg-amber-500/30 text-amber-300"
                }`}
              >
                {daysLeft} {daysLeft === 1 ? "dias" : "dias"} Restantes
              </motion.span>
            </div>
            <p className={`text-xs leading-relaxed ${
              isUrgent ? "text-red-200/80" : "text-amber-200/80"
            }`}>
              O acesso ao sistema Master Cargas Brasil foi encerrado pelo Administrador <span className="font-bold">09/04/2026</span>. 
              .
            </p>
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: `${(daysLeft / 30) * 100}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className={`h-full ${
                isUrgent 
                  ? "bg-gradient-to-r from-red-500 to-orange-500" 
                  : "bg-gradient-to-r from-amber-500 to-yellow-500"
              }`}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login, isLoggingIn } = useAuth();
  const { theme, setTheme } = useTheme();
  const previousTheme = useRef(theme);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    previousTheme.current = theme;
    setTheme("dark");
    return () => {
      setTheme(previousTheme.current);
    };
  }, [setTheme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await login({ username, password });
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao fazer login");
    }
  };

  // Efeito de shake no erro
  const shakeAnimation = {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#030303] relative overflow-hidden p-4">
      {/* Background Layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.08),transparent_40%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(34,197,94,0.06),transparent_40%)]" />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />
      
      <ParticleBackground />
      <MouseSpotlight />
      
      {/* Floating Orbs */}
      <motion.div
        animate={{
          y: [0, -30, 0],
          x: [0, 20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-20 left-20 w-72 h-72 bg-accent/20 rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div
        animate={{
          y: [0, 30, 0],
          x: [0, -20, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none"
      />

      {/* Expiration Banner - Positioned above login card */}
      <ExpirationBanner />

      <motion.div 
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[460px] z-10 perspective-1000"
      >
        <motion.div 
          className="relative bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[40px] p-10 border border-white/[0.08] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.02)] overflow-hidden"
          whileHover={{ boxShadow: "0 32px 64px -16px rgba(0,0,0,0.9), 0 0 40px rgba(34,197,94,0.1)" }}
          transition={{ duration: 0.3 }}
        >
          {/* Glass Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
          
          {/* Top Accent Line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />
          
          {/* Corner Accents */}
          <div className="absolute top-6 left-6 w-2 h-2 border-l border-t border-accent/30 rounded-tl-sm" />
          <div className="absolute top-6 right-6 w-2 h-2 border-r border-t border-accent/30 rounded-tr-sm" />
          <div className="absolute bottom-6 left-6 w-2 h-2 border-l border-b border-accent/30 rounded-bl-sm" />
          <div className="absolute bottom-6 right-6 w-2 h-2 border-r border-b border-accent/30 rounded-br-sm" />

          <div className="flex flex-col items-center mb-10 relative z-10">
            <motion.div
              initial={{ y: -20, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="relative mb-6 group"
            >
              <motion.div 
                className="absolute inset-0 bg-accent/30 blur-3xl rounded-full group-hover:bg-accent/40 transition-all duration-500"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              <div className="relative z-10 p-4 bg-gradient-to-b from-white/[0.1] to-transparent rounded-3xl border border-white/[0.1] backdrop-blur-sm">
                <img 
                  src={logoImg} 
                  alt="Logo" 
                  className="h-16 w-auto relative z-10 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]" 
                />
              </div>
              <motion.div
                className="absolute -bottom-1 -right-1 bg-accent text-accent-foreground p-2 rounded-xl shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                <Fingerprint className="w-4 h-4" />
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center space-y-2"
            >
              <motion.h1 
                className="text-4xl font-black text-white tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Almoxarifado
              </motion.h1>
              <motion.div 
                className="flex items-center justify-center gap-2 text-muted-foreground/70 text-xs font-bold uppercase tracking-[0.25em]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span className="bg-gradient-to-r from-accent/80 to-accent/40 bg-clip-text text-transparent">
                  Gestão de Estoque Segura
                </span>
              </motion.div>
            </motion.div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10" data-testid="form-login">
            {/* Username Field */}
            <motion.div 
              initial={{ x: -20, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-accent/60" />
                Identificação
              </Label>
              <motion.div 
                className="relative group"
                whileFocus={{ scale: 1.02 }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-xl"
                />
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                  <User className="w-5 h-5 text-muted-foreground/40 group-focus-within:text-accent transition-colors duration-300" />
                </div>
                <Input 
                  data-testid="input-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-12 h-14 bg-white/[0.03] border-white/[0.08] text-white focus:bg-white/[0.06] focus:border-accent/50 rounded-2xl transition-all duration-300 placeholder:text-white/20 focus:shadow-[0_0_20px_rgba(34,197,94,0.15)] backdrop-blur-sm"
                  placeholder="Seu usuário"
                  required
                />
                <AnimatePresence>
                  {focusedField === "username" && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>

            {/* Password Field */}
            <motion.div 
              initial={{ x: -20, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              transition={{ delay: 0.5 }}
              className="space-y-2"
            >
              <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1 flex items-center gap-2">
                <Lock className="w-3 h-3 text-accent/60" />
                Segurança
              </Label>
              <motion.div 
                className="relative group"
                whileFocus={{ scale: 1.02 }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-xl"
                />
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                  <Lock className="w-5 h-5 text-muted-foreground/40 group-focus-within:text-accent transition-colors duration-300" />
                </div>
                <Input 
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-12 pr-12 h-14 bg-white/[0.03] border-white/[0.08] text-white focus:bg-white/[0.06] focus:border-accent/50 rounded-2xl transition-all duration-300 placeholder:text-white/20 focus:shadow-[0_0_20px_rgba(34,197,94,0.15)] backdrop-blur-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-muted-foreground/40 hover:text-accent transition-colors z-10"
                >
                  <AnimatePresence mode="wait">
                    {showPassword ? (
                      <motion.div
                        key="eye"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Eye className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="eyeoff"
                        initial={{ scale: 0, rotate: 90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <EyeOff className="w-5 h-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            </motion.div>

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="overflow-hidden"
                >
                  <motion.div 
                    className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl text-destructive text-sm font-semibold text-center flex items-center justify-center gap-3 backdrop-blur-sm"
                    animate={shakeAnimation}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                      <span>{errorMsg}</span>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ delay: 0.6 }}
              className="pt-2"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  data-testid="button-submit-login"
                  type="submit" 
                  disabled={isLoggingIn}
                  className="w-full h-14 text-sm font-black uppercase tracking-[0.15em] bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground rounded-2xl shadow-[0_8px_30px_rgba(34,197,94,0.3)] hover:shadow-[0_8px_40px_rgba(34,197,94,0.4)] transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {isLoggingIn ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Autenticando...</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2 relative z-10">
                      Acessar Painel
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
                  )}
                </Button>
              </motion.div>
            </motion.div>

            {/* Security Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/40 font-medium pt-4"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span>Conexão Segura </span>
              </div>
            </motion.div>
          </form>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-10 text-center relative z-10"
          >
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
              <p className="text-[10px] text-muted-foreground/30 font-bold uppercase tracking-[0.3em]">
                Master Cargas Brasil
              </p>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
            </div>
            <p className="text-[9px] text-muted-foreground/20 font-medium">
              © 2026 Todos os direitos reservados
            </p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Ambient Glow at Bottom */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
    </div>
  );
}