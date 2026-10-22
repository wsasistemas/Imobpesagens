import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Scale, ShieldCheck, FileText, Camera, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import wsaLogo from "@/assets/wsa-logo.png";
import { solicitarRedefinicaoSenha } from "@/lib/redefinir-senha.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Portal de Pesagem" },
      { name: "description", content: "Acesso ao Portal de Pesagem." },
    ],
  }),
  component: AuthPage,
});

const BULLETS = [
  { icon: Scale, text: "Pesagem de cargas por obra" },
  { icon: FileText, text: "Leitura de NF-e via SEFAZ e OCR" },
  { icon: Camera, text: "Recebimento e recusa com evidências" },
  { icon: BarChart3, text: "Dashboards por obra" },
];

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const irParaDestino = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/" });
  };
  // Sem auto-cadastro: o acesso é criado pelo administrador (login único do ImobSystem).
  const [modo, setModo] = useState<"entrar" | "esqueci">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState<string | null>(null);
  const solicitar = useServerFn(solicitarRedefinicaoSenha);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) irParaDestino();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);

  const dominioOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dominioOk(email)) {
      toast.error("Informe um e-mail válido para entrar.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha inválidos." : error.message);
      return;
    }
    toast.success("Bem-vindo(a)!");
    irParaDestino();
  };

  // "Esqueceu a senha?": o servidor envia um link de uso único (30 min) por e-mail. A resposta é sempre a mesma,
  // exista ou não a conta (src/lib/redefinir-senha.functions.ts).
  const esqueci = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dominioOk(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      const r = await solicitar({ data: { email: email.trim() } });
      setPedidoEnviado(r.mensagem);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o pedido agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden brand-gradient p-10 text-white lg:flex lg:flex-col lg:justify-between overflow-hidden">
        {/* Blueprint background effect */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="relative z-10 flex items-center gap-3">
          <img src={wsaLogo} alt="WSA Sistemas" className="h-11 w-11 rounded-full bg-white object-contain shadow-card" />
          <div>
            <div className="text-sm text-white/70 font-heading tracking-wider uppercase">Portal</div>
            <div className="font-heading font-semibold text-white">WSA Sistemas</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1 mb-6">
            <div className="h-1.5 w-1.5 rounded-full bg-abobora" />
            <span className="text-[10px] font-heading font-semibold uppercase tracking-[0.2em] text-white/80">Login único WSA Sistemas</span>
          </div>
          <h1 className="text-5xl font-heading font-extrabold leading-tight text-white uppercase tracking-tight">Portal de Pesagem</h1>
          <p className="mt-3 text-xl font-heading font-semibold text-abobora">WSA Sistemas</p>
          <p className="mt-6 text-sm text-white/80 font-sans leading-relaxed">
            Controle de pesagem rodoviária, recebimento e recusa de mercadorias por obra —
            integrado à NF-e e à balança da portaria.
          </p>
          <ul className="mt-8 space-y-4">
            {BULLETS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-sm text-white/90 font-sans">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/15 text-abobora transition-transform hover:scale-110">
                  <b.icon className="h-5 w-5" />
                </span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/50 font-sans">
          <ShieldCheck className="h-4 w-4 text-abobora" />
          Acesso restrito. Todas as ações são auditadas.
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 lg:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <img src={wsaLogo} alt="WSA Sistemas" className="h-9 w-9 rounded-full bg-card shadow-card" />
            <div className="font-semibold">Portal de Pesagem</div>
          </div>

          {modo === "entrar" ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use o e-mail e a senha da sua conta. É a mesma dos outros sistemas da WSA Sistemas.
              </p>
              <form onSubmit={entrar} className="mt-6 space-y-4">
                <CampoEmail email={email} setEmail={setEmail} />
                <CampoSenha senha={senha} setSenha={setSenha} mostrar={mostrar} setMostrar={setMostrar} />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setPedidoEnviado(null);
                    setModo("esqueci");
                  }}
                  className="block w-full text-center text-[13px] font-semibold text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </form>
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Ainda não tem acesso? Peça ao administrador do Portal de Pesagem da sua empresa.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Esqueceu a senha?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.
              </p>
              {pedidoEnviado ? (
                <div className="mt-6 rounded-lg border border-success/30 bg-success-soft p-4 text-sm text-success">
                  {pedidoEnviado}
                </div>
              ) : (
                <form onSubmit={esqueci} className="mt-6 space-y-4">
                  <CampoEmail email={email} setEmail={setEmail} />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
                  </Button>
                </form>
              )}
              <button
                type="button"
                onClick={() => setModo("entrar")}
                className="mt-4 block w-full text-center text-[13px] font-semibold text-primary hover:underline"
              >
                Voltar para o login
              </button>
            </>
          )}

          <div className="mt-10 text-center text-xs text-muted-foreground">© 2026 WSA Sistemas</div>
        </div>
      </div>
    </div>
  );
}

function CampoEmail({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">E-mail</Label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com.br"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
    </div>
  );
}

function CampoSenha({
  senha,
  setSenha,
  mostrar,
  setMostrar,
}: {
  senha: string;
  setSenha: (v: string) => void;
  mostrar: boolean;
  setMostrar: (fn: (v: boolean) => boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="senha">Senha</Label>
      <div className="relative">
        <Input
          id="senha"
          type={mostrar ? "text" : "password"}
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button
          type="button"
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={() => setMostrar((v) => !v)}
        >
          {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
