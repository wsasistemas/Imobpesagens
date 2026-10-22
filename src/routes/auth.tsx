import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import wsaLogo from "@/assets/wsa-logo.png";
import fotoLogin from "@/assets/login-pesagem.webp";
import { solicitarRedefinicaoSenha } from "@/lib/redefinir-senha.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    // Destino depois do login; nunca o próprio /auth (evita o ciclo /auth?next=/auth?next=…).
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") && !s.next.startsWith("/auth")
        ? s.next
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Portal de Pesagem" },
      { name: "description", content: "Acesso ao Portal de Pesagem." },
    ],
  }),
  component: AuthPage,
});

// Destaques do painel esquerdo: descrevem o produto (sem números inventados).
const DESTAQUES = [
  { titulo: "NF-e", texto: "Leitura automática" },
  { titulo: "Balança", texto: "Integrada" },
  { titulo: "IA", texto: "Placa e nota" },
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

  // Layout da entrada do imobdocerias nas cores do Portal (classes .mpl-* em src/styles.css), aprovado em 22/10/2026.
  return (
    <div className="mpl-root">
      <aside className="mpl-visual">
        {/* Foto provisória (imagem do ImobPesagem do site imobsystems.com.br); trocar o arquivo pela foto em alta. */}
        <img className="mpl-foto" src={fotoLogin} alt="Caminhão na balança rodoviária da obra" />
        <div className="mpl-scrim" />

        <div className="mpl-brand">
          <div className="mpl-mark">
            <img src={wsaLogo} alt="WSA Sistemas" />
          </div>
          <span>
            Portal de Pesagem
            <small>WSA Sistemas</small>
          </span>
        </div>

        <div>
          <span className="mpl-tag">Pesagem de Carga Inteligente</span>
          <h1>Controle com IA sua carga entregue</h1>
          <p>Entrada e saída na balança, nota fiscal conferida pela SEFAZ e alerta quando o peso foge da tolerância.</p>
        </div>

        <div className="mpl-metrics">
          {DESTAQUES.map((d) => (
            <div key={d.titulo}>
              <b>{d.titulo}</b>
              <small>{d.texto}</small>
            </div>
          ))}
        </div>
      </aside>

      <main className="mpl-panel">
        <div>
          <p className="mpl-kicker">Acesso ao portal</p>
          <h2>{modo === "entrar" ? "Entrar" : "Esqueceu a senha?"}</h2>
          <hr className="mpl-rule" />

          {modo === "entrar" ? (
            <form className="mpl-form" onSubmit={entrar} noValidate>
              <div className="mpl-field">
                <label className="mpl-label" htmlFor="mpl-email">E-mail</label>
                <input id="mpl-email" className="mpl-input" type="email" autoComplete="email"
                  placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="mpl-field">
                <label className="mpl-label" htmlFor="mpl-senha">
                  Senha
                  <button type="button" className="mpl-toggle" onClick={() => setMostrar((v) => !v)}>
                    {mostrar ? "Ocultar" : "Mostrar"}
                  </button>
                </label>
                <input id="mpl-senha" className="mpl-input" type={mostrar ? "text" : "password"}
                  autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </div>
              <button type="submit" className="mpl-btn" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
                <span aria-hidden="true">→</span>
              </button>
              <div className="mpl-links">
                <span>Primeiro acesso? Fale com o administrador.</span>
                <button type="button" className="mpl-link" onClick={() => { setPedidoEnviado(null); setModo("esqueci"); }}>
                  Esqueceu a senha?
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="mpl-sub">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
              {pedidoEnviado ? (
                <div className="mpl-form">
                  <div className="mpl-ok">{pedidoEnviado}</div>
                </div>
              ) : (
                <form className="mpl-form" onSubmit={esqueci} noValidate>
                  <div className="mpl-field">
                    <label className="mpl-label" htmlFor="mpl-email-rec">E-mail</label>
                    <input id="mpl-email-rec" className="mpl-input" type="email" autoComplete="email"
                      placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <button type="submit" className="mpl-btn" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar link"}
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              )}
              <div className="mpl-links" style={{ marginTop: 20 }}>
                <span />
                <button type="button" className="mpl-link" onClick={() => setModo("entrar")}>Voltar para o login</button>
              </div>
            </>
          )}

          <p className="mpl-note">
            Login único da WSA Sistemas: a mesma conta vale nos outros sistemas da sua empresa
            (ImobSuprimentos, ImobDisparos e outros).
          </p>
        </div>
      </main>
    </div>
  );
}
