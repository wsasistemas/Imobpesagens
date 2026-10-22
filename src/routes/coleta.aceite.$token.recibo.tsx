import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Printer } from "lucide-react";
import { chamarPortal, formatarBRL, type ProcessoPortal } from "@/lib/sucata/portal-coleta";
import { AvisoLeitura, PortalMoldura } from "@/components/sucata/portal-ui";
import { formatarKg } from "@/lib/sucata/validadores";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coleta/aceite/$token/recibo")({
  head: () => ({
    meta: [
      { title: "Recibo da coleta — Coleta de sucata" },
      { name: "description", content: "Recibo da compra de sucata com peso aferido, valor total e dados do comprador." },
      { property: "og:title", content: "Recibo da coleta — Coleta de sucata" },
      { property: "og:description", content: "Recibo da compra de sucata retirada da obra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReciboPage,
  errorComponent: () => <AvisoLeitura texto="Não foi possível abrir o recibo." />,
  notFoundComponent: () => <AvisoLeitura texto="Link não encontrado." />,
});

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(
    new Date(iso),
  );
}

function ReciboPage() {
  const { token } = Route.useParams();
  const [processo, setProcesso] = useState<ProcessoPortal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    chamarPortal({ token, acao: "consultar" }).then((r) => {
      if (!ativo) return;
      setCarregando(false);
      if (!r.processo) setErro(r.motivo ?? "Link inválido.");
      else setProcesso(r.processo);
    });
    return () => {
      ativo = false;
    };
  }, [token]);

  if (carregando) {
    return (
      <PortalMoldura numero="">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando o recibo...
        </div>
      </PortalMoldura>
    );
  }
  if (!processo) return <AvisoLeitura texto={erro ?? "Link inválido."} />;
  if (processo.valor_total === null) return <AvisoLeitura texto="O valor da coleta ainda não foi informado." />;

  const linha = (rotulo: string, valor: string, mono = false) => (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 text-sm">
      <span className="text-foreground">{rotulo}</span>
      <span className={mono ? "font-mono tabular-nums text-foreground" : "text-right text-foreground"}>{valor}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted px-3 py-6 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-2xl rounded-xl border bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-4 border-primary pb-3">
          <div>
            <div className="font-heading text-base font-bold tracking-wide text-primary">PORTAL DE PESAGEM</div>
            <div className="text-xs text-muted-foreground">Recibo de compra de sucata</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Processo
            <div className="font-mono text-sm tabular-nums text-foreground">{processo.numero}</div>
          </div>
        </div>

        <h1 className="mt-4 font-heading text-lg font-semibold text-foreground">Recibo de compra de sucata ferrosa</h1>

        <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">COMPRADOR</div>
            {linha("Nome / razão social", processo.comprador)}
            {linha("CNPJ / CPF", processo.documento, true)}
            {linha("Município / UF", processo.municipio_uf ?? "—")}
          </div>
          <div>
            <div className="mb-1 mt-4 text-xs font-semibold tracking-wide text-muted-foreground sm:mt-0">COLETA</div>
            {linha("Obra", processo.obra ?? "—")}
            {linha("Placa", processo.placa, true)}
            {linha("Tipo de sucata", processo.tipo ?? "—")}
            {linha("Data da coleta", dataBR(processo.data_coleta), true)}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">PESAGEM E VALOR</div>
          {linha("Tara de entrada", `${formatarKg(processo.tara_kg)} kg`, true)}
          {linha("Bruto de saída", `${formatarKg(processo.bruto_kg)} kg`, true)}
          {linha("Peso aferido", `${formatarKg(processo.peso_aferido_kg)} kg`, true)}
          {linha("Valor por tonelada", formatarBRL(processo.valor_por_tonelada), true)}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg bg-foreground px-4 py-3">
          <span className="text-xs tracking-widest text-muted-foreground">VALOR TOTAL</span>
          <span className="font-mono text-2xl font-bold tabular-nums text-success">
            {formatarBRL(processo.valor_total)}
          </span>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-foreground">
          Declaro ter recebido a sucata ferrosa descrita acima, retirada da obra indicada, e confirmo o peso aferido e o
          valor total registrados neste recibo. Aceite eletrônico realizado em{" "}
          <span className="font-mono tabular-nums">{dataBR(processo.aceite_em)}</span>.
        </p>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="border-t border-border-strong pt-2 text-center text-xs text-foreground">
            {processo.comprador}
            <div className="text-muted-foreground">Comprador</div>
          </div>
          <div className="border-t border-border-strong pt-2 text-center text-xs text-foreground">
            Vendedora (construtora)
            <div className="text-muted-foreground">{processo.obra ?? "Obra"}</div>
          </div>
        </div>

        <div className="mt-6 print:hidden">
          <Button className="w-full" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir ou salvar em PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
