import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/api";
import { KeyRound, ShieldCheck } from "lucide-react";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forced?: boolean;
}

export default function ChangePasswordModal({ open, onOpenChange, forced = false }: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 4 caracteres", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await fetchWithAuth("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast({ title: "Sucesso", description: "Senha alterada com sucesso!" });
      sessionStorage.setItem("password_changed", "true");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao alterar senha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={forced ? undefined : onOpenChange}>
      <DialogContent className="bg-card border border-border rounded-2xl max-w-md" onPointerDownOutside={forced ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <KeyRound className="w-5 h-5 text-accent" />
            {forced ? "Troca de Senha Obrigatória" : "Alterar Senha"}
          </DialogTitle>
          <DialogDescription className="sr-only">Formulario de alteracao de senha</DialogDescription>
        </DialogHeader>
        {forced && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-500">Por segurança, você precisa alterar sua senha no primeiro acesso.</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Senha Atual</Label>
            <Input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="bg-muted/30 border-border"
              data-testid="input-current-password"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nova Senha</Label>
            <Input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="bg-muted/30 border-border"
              data-testid="input-new-password"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirmar Nova Senha</Label>
            <Input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="bg-muted/30 border-border"
              data-testid="input-confirm-password"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-accent-foreground font-bold rounded-xl h-11"
            data-testid="button-submit-password-change"
          >
            {loading ? "Alterando..." : "Confirmar Alteração"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
