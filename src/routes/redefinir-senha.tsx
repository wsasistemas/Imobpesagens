import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { conferirLinkRedefinicao, redefinirSenhaComToken } from "@/lib/redefinir-senha.functions";
import { SENHA_REGRAS_TEXTO, validarPoliticaSenha } from "@/lib/senha";
import wsaLogo from "@/assets/wsa-logo.png";

// Link do e-mail "Esqueceu a senha?" (/redefinir-senha?token=…). Quem chega aqui não tem sessão.
// O token só é conferido e consumido no servidor (src/lib/redefinir-senha.functions.ts).

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  head: () => ({ meta: [{ title: "Nova senha — Portal de Pesagem" }] }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  // Guardado em estado: logo abaixo o token sai da barra de endereço.
  const [token] = useState(Route.useSearch().token);
  const navigate = useNavigate();
  const conferir = useServerFn(conferirLinkRedefinicao);
  const redefinir = useServerFn(redefinirSenhaComToken);
  const [link, setLink] = useState<{ valido: boolean; email: string | null } | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // O token não fica na barra de endereço nem no histórico depois de lido.
    if (token) window.history.replaceState(null, "", "/redefinir-senha");
    conferir({ data: { token } })
      .then(setLink)
      .catch(() => setLink({ valido: false, email: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const erroPolitica = validarPoliticaSenha(senha);
    if (erroPolitica) return setErro(erroPolitica);
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setEnviando(true);
    try {
      await redefinir({ data: { token, novaSenha: senha } });
    } catch (err) {
      setEnviando(false);
      return setErro(err instanceof Error ? err.message : String(err));
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    setEnviando(false);
    toast.success("Senha redefinida. Entre com a nova senha.");
    navigate({ to: "/auth", search: { next: undefined }, replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <img src={wsaLogo} alt="WSA Sistemas" className="h-9 w-9 rounded-full bg-card shadow-card" />
          <div className="font-semibold">Portal de Pesagem</div>
        </div>

        {!link ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !link.valido ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este link é inválido, expirou ou já foi usado. Os links valem por 30 minutos e uma única vez.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/auth" search={{ next: undefined }}>Voltar para o login</Link>
            </Button>
          </>
        ) : (
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Crie uma nova senha</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Conta {link.email}. A nova senha vale também nos outros sistemas da WSA Sistemas.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input id="nova-senha" type="password" autoComplete="new-password" value={senha}
                onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha-2">Confirmar senha</Label>
              <Input id="nova-senha-2" type="password" autoComplete="new-password" value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)} />
            </div>
            {erro && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</div>
            )}
            <p className="text-xs text-muted-foreground">{SENHA_REGRAS_TEXTO}</p>
            <Button type="submit" className="w-full" disabled={enviando || !senha || !confirmacao}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
            </Button>
            <Link to="/auth" search={{ next: undefined }}
              className="block text-center text-[13px] font-semibold text-primary hover:underline">
              Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
