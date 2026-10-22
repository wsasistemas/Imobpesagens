import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Recycle, ShieldCheck } from "lucide-react";
import { chamarPortal, type ModoPortal, type ProcessoPortal } from "@/lib/sucata/portal-coleta";
import { PortalMoldura, LinhaDado, MostradorPeso, AvisoLeitura } from "@/components/sucata/portal-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/coleta/aceite/$token/")({
  head: () => ({
    meta: [
      { title: "Aceite do peso aferido — Coleta de sucata" },
      { name: "description", content: "Confirme o peso aferido da coleta de sucata retirada da obra e siga para informar o valor." },
      { property: "og:title", content: "Aceite do peso aferido — Coleta de sucata" },
      { property: "og:description", content: "Confirmação do peso aferido da coleta de sucata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AceitePage,
  errorComponent: () => <AvisoLeitura texto="Não foi possível abrir esta coleta." />,
  notFoundComponent: () => <AvisoLeitura texto="Link não encontrado." />,
});

function AceitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<ModoPortal | null>(null);
  const [processo, setProcesso] = useState<ProcessoPortal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    chamarPortal({ token, acao: "consultar" }).then((r) => {
      if (!ativo) return;
      setCarregando(false);
      if (!r.ok || !r.processo) {
        setErro(r.motivo ?? "Link inválido.");
        return;
      }
      setModo(r.modo ?? "LEITURA");
      setProcesso(r.processo);
      if (typeof window !== "undefined" && window.location.search.includes("contestar=1")) {
        setContestando(true);
      }
    });
    return () => {
      ativo = false;
    };
  }, [token]);

  const aceitar = async () => {
    setEnviando(true);
    const r = await chamarPortal({ token, acao: "aceitar" });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.motivo ?? "Não foi possível registrar o aceite.");
      if (r.processo) setProcesso(r.processo);
      return;
    }
    navigate({ to: "/coleta/aceite/$token/valor", params: { token } });
  };

  const contestar = async () => {
    if (motivo.trim().length < 3) return;
    setEnviando(true);
    const r = await chamarPortal({ token, acao: "contestar", motivo: motivo.trim() });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.motivo ?? "Não foi possível registrar a contestação.");
      return;
    }
    setModo("LEITURA");
    setProcesso(r.processo ?? processo);
    setContestando(false);
  };

  if (carregando) {
    return (
      <PortalMoldura numero="">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando a coleta...
        </div>
      </PortalMoldura>
    );
  }

  if (!processo) return <AvisoLeitura texto={erro ?? "Link inválido."} />;

  return (
    <PortalMoldura numero={processo.numero}>
      <h1 className="font-heading text-lg font-semibold text-foreground">Aceite do peso aferido</h1>
      <p className="mt-1 text-sm text-foreground">
        Confira os dados da coleta retirada da obra e confirme o peso aferido.
      </p>

      <div className="mt-4 divide-y rounded-lg border">
        <LinhaDado rotulo="Obra" valor={processo.obra ?? "—"} />
        <LinhaDado rotulo="Data da coleta" valor={processo.data_coleta} tipo="data" />
        <LinhaDado rotulo="Placa" valor={processo.placa} mono />
        <LinhaDado rotulo="Tipo de sucata" valor={processo.tipo ?? "—"} />
        <LinhaDado rotulo="Tara de entrada" valor={processo.tara_kg} tipo="kg" />
        <LinhaDado rotulo="Bruto de saída" valor={processo.bruto_kg} tipo="kg" />
      </div>

      <MostradorPeso kg={processo.peso_aferido_kg} />

      {processo.expirado && (
        <div className="mt-4 rounded-lg border border-primary-dark/30 bg-primary-dark/10 p-3 text-sm text-primary-dark">
          <b>Link expirado.</b> Esta página está em modo leitura. Fale com a obra para receber um novo link.
        </div>
      )}

      {processo.contestacao_em && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <b>Peso contestado.</b> Registramos o seu motivo e o administrativo da obra foi avisado.
          <div className="mt-1 text-warning">{processo.contestacao_motivo}</div>
        </div>
      )}

      {processo.aceite_em && !processo.contestacao_em && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success">
          <b>Peso já aceito.</b> {modo === "VALOR" ? "Falta informar o valor da coleta." : "Valor já informado."}
          <Button
            className="mt-2 w-full"
            onClick={() => navigate({ to: "/coleta/aceite/$token/valor", params: { token } })}
          >
            Continuar
          </Button>
        </div>
      )}

      {erro && <div className="mt-3 text-sm text-primary">{erro}</div>}

      {modo === "ACEITE" && !processo.expirado && !contestando && (
        <div className="mt-5 space-y-3">
          <Button className="h-12 w-full bg-success text-base hover:bg-success/90" disabled={enviando} onClick={aceitar}>
            {enviando ? "Registrando..." : "Aceito o peso e vou informar o valor"}
          </Button>
          <Button variant="outline" className="h-12 w-full text-base" onClick={() => setContestando(true)}>
            Não concordo com o peso
          </Button>
        </div>
      )}

      {modo === "ACEITE" && contestando && (
        <div className="mt-5 space-y-3">
          <label className="text-sm font-medium text-foreground" htmlFor="motivo">
            Conte o motivo da contestação
          </label>
          <Textarea
            id="motivo"
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: o peso da minha balança ficou 320 kg abaixo do informado."
          />
          <Button variant="outline" className="h-12 w-full" disabled={enviando || motivo.trim().length < 3} onClick={contestar}>
            {enviando ? "Enviando..." : "Enviar contestação"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setContestando(false)}>
            Voltar
          </Button>
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Página exclusiva desta coleta. Nenhum outro dado do Portal é acessível por aqui.
      </p>
      <Recycle className="mt-2 hidden" />
    </PortalMoldura>
  );
}
