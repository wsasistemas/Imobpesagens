import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, FileImage, History, Recycle } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { formatarDataHora, formatarKg } from "@/lib/sucata/validadores";
import { StatusProcesso } from "@/components/sucata/status-badge";
import { GradeEvidencias } from "@/components/sucata/grade-evidencias";
import { TimelineProcesso } from "@/components/sucata/timeline-processo";
import { ReabrirProcesso } from "@/components/sucata/reabrir-processo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import {
  eventosProcessoQueryOptions, evidenciasQueryOptions, posicoesVigentes, processoQueryOptions,
} from "@/lib/sucata/evidencias-queries";
import { FASES_V2, estadosDoProcesso, faseAtual as numeroFaseAtual } from "@/lib/sucata/fases-v2";
import { PassosSucata } from "@/components/sucata/passos-sucata";
import { dadosNfa } from "@/lib/sucata/nfa.functions";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";

export const Route = createFileRoute("/sucata/$id/")({
  head: () => ({
    meta: [
      { title: "Processo de sucata — Portal de Pesagem" },
      { name: "description", content: "Dados da coleta, evidências fotográficas e timeline das fases do processo de sucata." },
      { property: "og:title", content: "Processo de sucata — Portal de Pesagem" },
      { property: "og:description", content: "Acompanhe evidências e fases do processo de sucata da obra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProcessoPage,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar este processo.</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Processo não encontrado.</div>,
});

function ProcessoPage() {
  const { id } = Route.useParams();
  const [obraId, setObraId] = useObraAtual();
  const buscarDadosNfa = useServerFn(dadosNfa);
  const { data: processo, isLoading } = useQuery(processoQueryOptions(id));
  const { data: evidencias = [] } = useQuery(evidenciasQueryOptions(id));
  const { data: eventos = [] } = useQuery(eventosProcessoQueryOptions(id));
  const temNota = evidencias.some((e) => e.posicao === 12 && e.substituida_por === null);
  const { data: nota } = useQuery({
    queryKey: ["sucata", "nfa", id],
    queryFn: () => buscarDadosNfa({ data: { processoId: id } }),
    enabled: temNota,
    staleTime: 15_000,
  });
  const { isAdmin, isSuperAdmin } = useAuth();

  const feitas = new Set(posicoesVigentes(evidencias));
  const estados = processo ? estadosDoProcesso(processo, feitas) : null;
  const concluido = processo?.situacao === "CONCLUIDO";
  const faseAtual = estados && !concluido ? FASES_V2.find((f) => f.numero === numeroFaseAtual(estados)) ?? null : null;
  const ultimo = [...eventos].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  // Relatório fotográfico: só com as 4 fases completas e só para o administrativo da obra ou a TI.
  const temPerfilRelatorio = isAdmin || isSuperAdmin;
  const pendencias: string[] = [];
  if (processo) {
    if (!processo.tara_kg) pendencias.push("tara da entrada");
    if (!feitas.has(1)) pendencias.push("foto do caminhão vazio (001)");
    if (!processo.bruto_kg) pendencias.push("peso bruto da saída");
    if (!processo.valor_total) pendencias.push("valor da coleta");
    if (!feitas.has(4)) pendencias.push("foto da caçamba cheia (004)");
    if (!processo.nfa_numero || !feitas.has(12)) pendencias.push("nota fiscal avulsa (012)");
    if (!feitas.has(10)) pendencias.push("foto do recibo (010)");
    if (!feitas.has(11)) pendencias.push("comprovante de pagamento (011)");
  }
  const podeRelatorio = !!processo && temPerfilRelatorio && (concluido || pendencias.length === 0);

  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <IconeIlustrativo icon={Recycle} size={26} />
          <div className="mr-auto">
            <h1 className={`font-heading text-xl font-semibold ${CLASSE_NUM}`}>
              {processo?.numero ?? (isLoading ? "Carregando..." : "—")}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {processo && <StatusProcesso situacao={processo.situacao} />}
              {processo?.teste_manual && (
                <Badge variant="outline" className="border-primary-dark/30 bg-primary-dark/10 text-primary-dark">
                  Processo de teste
                </Badge>
              )}
              {faseAtual && (
                <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                  <span className={CLASSE_NUM}>FASE {faseAtual.numero}</span>&nbsp;· {faseAtual.nome} — {faseAtual.responsavel}
                </Badge>
              )}
              {ultimo && (
                <span>
                  último registro em <span className={CLASSE_NUM}>{formatarDataHora(ultimo.created_at)}</span>
                </span>
              )}
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  {podeRelatorio ? (
                    <Button asChild variant="outline">
                      <Link to="/sucata/$id/relatorio" params={{ id }}>
                        <FileImage className="mr-2 h-4 w-4" /> Relatório fotográfico
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      <FileImage className="mr-2 h-4 w-4" /> Relatório fotográfico
                    </Button>
                  )}
                </span>
              </TooltipTrigger>
              {!podeRelatorio && (
                <TooltipContent>
                  {!temPerfilRelatorio
                    ? "Só o administrativo da obra ou a TI podem gerar o relatório."
                    : `Falta: ${pendencias.join(" · ")}`}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <Button asChild variant="outline">
            <Link to="/sucata">
              <History className="mr-2 h-4 w-4" /> Histórico
            </Link>
          </Button>
          <Button asChild>
            <Link to="/sucata/$id/evidencias" params={{ id }}>
              <Camera className="mr-2 h-4 w-4" /> Capturar evidências
            </Link>
          </Button>
        </div>

        {processo?.situacao === "CONCLUIDO" && <ReabrirProcesso processoId={id} />}

        

        {processo && <PassosSucata processo={processo} evidencias={evidencias} />}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Evidências fotográficas</CardTitle>
            </CardHeader>
            <CardContent>
              <GradeEvidencias
                evidencias={evidencias}
                nota={nota ? {
                  campos: nota.formulario,
                  cfop: nota.cfopSugerido ?? "",
                  natureza: nota.naturezaSugerida,
                  numero: nota.nfaNumero ?? "00001",
                  emissao: nota.nfaEmissao ?? "",
                  processo: nota.numero,
                } : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Histórico do processo</CardTitle>
            </CardHeader>
            <CardContent>
              {estados ? (
                <TimelineProcesso eventos={eventos} evidencias={evidencias} estados={estados} />
              ) : (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Campo({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className={mono ? `font-medium ${CLASSE_NUM}` : "font-medium"}>{valor}</div>
    </div>
  );
}
