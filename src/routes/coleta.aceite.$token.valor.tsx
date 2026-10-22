import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { chamarPortal, formatarBRL, mascaraBRL, type ModoPortal, type ProcessoPortal } from "@/lib/sucata/portal-coleta";
import { PortalMoldura, LinhaDado, MostradorPeso, AvisoLeitura } from "@/components/sucata/portal-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/coleta/aceite/$token/valor")({
  head: () => ({
    meta: [
      { title: "Valor da coleta — Coleta de sucata" },
      { name: "description", content: "Informe o valor total pago pela coleta de sucata e escolha como o recibo será emitido." },
      { property: "og:title", content: "Valor da coleta — Coleta de sucata" },
      { property: "og:description", content: "Registro do valor da compra da sucata coletada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ValorPage,
  errorComponent: () => <AvisoLeitura texto="Não foi possível abrir esta coleta." />,
  notFoundComponent: () => <AvisoLeitura texto="Link não encontrado." />,
});

function ValorPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<ModoPortal | null>(null);
  const [processo, setProcesso] = useState<ProcessoPortal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [numero, setNumero] = useState<number | null>(null);
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
    });
    return () => {
      ativo = false;
    };
  }, [token]);

  const toneladas = useMemo(() => (processo?.peso_aferido_kg ?? 0) / 1000, [processo]);
  const porTonPrevia = useMemo(
    () => (numero && toneladas > 0 ? numero / toneladas : null),
    [numero, toneladas],
  );
  const foraDaFaixa = useMemo(() => {
    if (porTonPrevia === null || !processo) return false;
    const { faixa_min: min, faixa_max: max } = processo;
    return (min !== null && porTonPrevia < min) || (max !== null && porTonPrevia > max);
  }, [porTonPrevia, processo]);

  const gravar = async (recibo: "SISTEMA" | "PROPRIO") => {
    if (!numero) return;
    setEnviando(true);
    const r = await chamarPortal({ token, acao: "informar_valor", valor_total: numero, recibo_modo: recibo });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.motivo ?? "Não foi possível gravar o valor.");
      return;
    }
    if (recibo === "SISTEMA") {
      navigate({ to: "/coleta/aceite/$token/recibo", params: { token } });
      return;
    }
    setModo("LEITURA");
    setProcesso(r.processo ?? processo);
  };

  if (carregando) {
    return (
      <PortalMoldura numero="">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      </PortalMoldura>
    );
  }

  if (!processo) return <AvisoLeitura texto={erro ?? "Link inválido."} />;

  if (!processo.aceite_em) {
    return (
      <PortalMoldura numero={processo.numero}>
        <p className="text-sm text-foreground">É preciso aceitar o peso aferido antes de informar o valor.</p>
        <Button className="mt-4 w-full" onClick={() => navigate({ to: "/coleta/aceite/$token", params: { token } })}>
          Voltar para o aceite
        </Button>
      </PortalMoldura>
    );
  }

  const jaInformado = processo.valor_total !== null;

  return (
    <PortalMoldura numero={processo.numero}>
      <h1 className="font-heading text-lg font-semibold text-foreground">Valor da coleta</h1>
      <p className="mt-1 text-sm text-foreground">Peso aceito. Agora informe quanto será pago por esta coleta.</p>

      <MostradorPeso kg={processo.peso_aferido_kg} />

      <div className="mt-4 divide-y rounded-lg border">
        <LinhaDado rotulo="Obra" valor={processo.obra ?? "—"} />
        <LinhaDado rotulo="Placa" valor={processo.placa} mono />
        <LinhaDado rotulo="Tipo de sucata" valor={processo.tipo ?? "—"} />
      </div>

      {jaInformado || modo === "LEITURA" ? (
        <div className="mt-4 space-y-3">
          <div className="divide-y rounded-lg border">
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-foreground">Valor total</span>
              <span className="font-mono tabular-nums text-foreground">{formatarBRL(processo.valor_total)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-foreground">Valor por tonelada</span>
              <span className="font-mono tabular-nums text-foreground">{formatarBRL(processo.valor_por_tonelada)}</span>
            </div>
            <LinhaDado
              rotulo="Recibo"
              valor={processo.recibo_modo === "PROPRIO" ? "Recibo próprio do comprador" : "Recibo do sistema"}
            />
          </div>
          {processo.recibo_modo === "SISTEMA" && (
            <Button className="w-full" onClick={() => navigate({ to: "/coleta/aceite/$token/recibo", params: { token } })}>
              Ver o recibo
            </Button>
          )}
          {processo.recibo_modo === "PROPRIO" && (
            <p className="text-sm text-foreground">
              Tudo registrado. Envie o seu recibo próprio para o administrativo da obra.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="valor">
              Valor total da coleta
            </label>
            <Input
              id="valor"
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 h-12 font-mono text-lg tabular-nums"
              placeholder="R$ 0,00"
              value={texto}
              onChange={(e) => {
                const m = mascaraBRL(e.target.value);
                setTexto(m.mascarado);
                setNumero(m.numero);
              }}
            />
          </div>

          <div className="rounded-lg border bg-muted p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Equivale por tonelada</span>
              <span className="font-mono tabular-nums text-foreground">{formatarBRL(porTonPrevia)}</span>
            </div>
            {(processo.faixa_min !== null || processo.faixa_max !== null) && (
              <div className="mt-1 text-xs text-muted-foreground">
                Faixa de referência: {formatarBRL(processo.faixa_min)} a {formatarBRL(processo.faixa_max)} por tonelada
              </div>
            )}
          </div>

          {foraDaFaixa && (
            <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
              <b>Atenção:</b> o valor por tonelada está fora da faixa de referência. Você pode continuar — a obra vai conferir.
            </div>
          )}

          {erro && <div className="text-sm text-primary">{erro}</div>}

          <div className="space-y-3">
            <Button className="h-12 w-full text-base" disabled={!numero || enviando} onClick={() => gravar("SISTEMA")}>
              {enviando ? "Gravando..." : "Gerar recibo do sistema"}
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full text-base"
              disabled={!numero || enviando}
              onClick={() => gravar("PROPRIO")}
            >
              Vou emitir meu próprio recibo
            </Button>
          </div>
        </div>
      )}
    </PortalMoldura>
  );
}
