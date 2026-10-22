import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { Package, TrendingUp, Users, Percent, Loader2, Timer, Building2 } from "lucide-react";
import { AppShell, TODAS_OBRAS, useObraAtual } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { pesagensQueryOptions, dashboardQueryOptions } from "@/lib/pesagem-queries";
import { supabase } from "@/integrations/supabase/client";
import { fmtKg } from "@/lib/pesagem-store";
import { pesoNfReferencia } from "@/lib/unidades";
import { useResolvedorDensidadePorFornecedor } from "@/lib/densidades";
import { DashboardConferencia } from "@/components/dashboard-conferencia";
import { DashboardErrorBoundary } from "@/components/dashboard-error-boundary";
import { DashboardFechamentoMensal } from "@/components/dashboard-fechamento-mensal";
import { contabilizavelNaConferencia } from "@/lib/afericao-escopo";
import { construirMapaContratantes, rotuloContratante } from "@/lib/contratante";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Portal de Pesagem" },
      { name: "description", content: "Indicadores de recebimento por obra baseados no histórico de pesagens concluídas." },
    ],
  }),
  component: DashboardPage,
});

// Paleta do design system (tokens chart-1…5): série principal no azul WSA.
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--dimmer)"];
const BAR_CONTRATANTES = "var(--chart-1)";
const BAR_DIA = "var(--chart-1)";

function parseCompetencia(valor: string): { ano: number; mes: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(valor);
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  return { ano, mes };
}

function competenciaAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function DashboardPage() {
  const resolverDensPor = useResolvedorDensidadePorFornecedor();
  const [obraId, setObraId] = useObraAtual();
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [periodoConferencia, setPeriodoConferencia] = useState<"hoje" | "semana" | "mes" | "ano" | "custom">("mes");
  const [abaAtiva, setAbaAtiva] = useState("indicadores");
  // A competência só sai da tela quando a aba Conferências está em "Ano";
  // as demais abas continuam dependendo do seletor de mês.
  const ocultarCompetencia = abaAtiva === "conferencias" && periodoConferencia === "ano";

  const [contratanteFiltro, setContratanteFiltro] = useState<string>("__all__");
  const obraConsultaId = obraId === TODAS_OBRAS ? null : obraId || null;
  const visaoConsolidada = obraId === TODAS_OBRAS;

  const competenciaEfetiva = parseCompetencia(competencia) ?? parseCompetencia(competenciaAtual());
  const { iniIso, fimIso, iniMs, fimMs } = useMemo(() => {
    const ano = competenciaEfetiva?.ano ?? new Date().getFullYear();
    const mes = competenciaEfetiva?.mes ?? new Date().getMonth() + 1;
    const dIni = new Date(Date.UTC(ano, mes - 1, 1));
    const dFim = new Date(Date.UTC(ano, mes, 1));
    return {
      iniIso: dIni.toISOString(),
      fimIso: dFim.toISOString(),
      iniMs: dIni.getTime(),
      fimMs: dFim.getTime(),
    };
  }, [competenciaEfetiva?.ano, competenciaEfetiva?.mes]);

  const { data: pesagens, isLoading: loadingPesagens, isError: pesagensIsError, error: pesagensError } = useQuery(
    pesagensQueryOptions(obraConsultaId),
  );
  const { data: dashData, isLoading: loadingDash, isError, error } = useQuery(
    dashboardQueryOptions(obraConsultaId, iniIso, fimIso)
  );

  const isLoading = loadingPesagens || (!visaoConsolidada && loadingDash);
  const consultaFalhou = pesagensIsError || (!visaoConsolidada && isError);
  const consultaErro = pesagensIsError ? pesagensError : error;

  // Filtra pesagens concluídas dentro da competência selecionada.
  const concluidas = useMemo(() => {
    if (!pesagens) return [];
    return pesagens.filter((p) => {
      if (!contabilizavelNaConferencia(p)) return false;
      const ref = new Date(p.saiu_em ?? p.created_at).getTime();
      return ref >= iniMs && ref < fimMs;
    });
  }, [pesagens, iniMs, fimMs]);

  const mapaContratantes = useMemo(() => construirMapaContratantes(pesagens ?? []), [pesagens]);
  
  const contratantesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    concluidas.forEach((p) => {
      const c = rotuloContratante(p.contratante, mapaContratantes);
      if (c && c !== "Sem contratante") set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [concluidas, mapaContratantes]);

  const filtradas = useMemo(() => {
    if (contratanteFiltro === "__all__") return concluidas;
    return concluidas.filter((p) => rotuloContratante(p.contratante, mapaContratantes) === contratanteFiltro);
  }, [concluidas, contratanteFiltro, mapaContratantes]);

  // Conferências possui seus próprios períodos (dia, semana, mês, ano e
  // personalizado), portanto precisa receber a base completa, sem o recorte
  // mensal aplicado aos demais painéis.
  const pesagensConferencia = useMemo(() => {
    const base = pesagens ?? [];
    if (contratanteFiltro === "__all__") return base;
    return base.filter((p) => rotuloContratante(p.contratante, mapaContratantes) === contratanteFiltro);
  }, [pesagens, contratanteFiltro, mapaContratantes]);

  // Nomes das obras liberadas, para o cartão "Registros por obra".
  const { data: obrasNomes = [] } = useQuery({
    queryKey: ["obras-nomes"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const porObra = useMemo(() => {
    const nomes = new Map(obrasNomes.map((o) => [o.id, o.nome]));
    const map = new Map<string, { nome: string; qtd: number; peso: number }>();
    for (const p of filtradas) {
      const nome = nomes.get(p.obra_id ?? "") ?? p.contratante ?? "Sem obra";
      const cur = map.get(nome) ?? { nome, qtd: 0, peso: 0 };
      cur.qtd += 1;
      cur.peso += Number(p.peso_liquido ?? 0);
      map.set(nome, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.qtd - b.qtd);
  }, [filtradas, obrasNomes]);



  const agregado = useMemo(() => {
    if (filtradas.length > 0) {
      return agregar(filtradas, resolverDensPor);
    }
    
    if (visaoConsolidada || !dashData) return filtradas.length === 0 ? agregar([], resolverDensPor) : null;
    
    const topContratantes = (dashData.top_contratantes ?? []).map((m: any) => ({
      nome: m.nome || "Desconhecido",
      peso: Number(m.peso) || 0,
      qtd: Number(m.qtd) || 0,
      principal: m.principal
    })).sort((a: any, b: any) => b.peso - a.peso);

    return {
      kpis: {
        totalKg: Number(dashData.kpis.total_kg) || 0,
        totalReceb: Number(dashData.kpis.total_receb) || 0,
        totalForn: Number(dashData.kpis.total_forn) || 0,
        totalContr: Number(dashData.kpis.total_contr) || 0,
        diverg: Number(dashData.kpis.diverg) || 0,
        acuracidade: dashData.kpis.peso_nf_tot > 0 
          ? Math.max(0, 100 - (Number(dashData.kpis.diverg) / Number(dashData.kpis.peso_nf_tot)) * 100) 
          : null,
        permanenciaHoras: null, 
      },
      topContratantes,
      topFornecedores: (dashData.top_fornecedores ?? []).map((f: any) => ({
        nome: f.nome || "Desconhecido",
        peso: Number(f.peso) || 0
      })),
      porDia: (dashData.por_dia ?? []).map((d: any) => ({
        dia: d.dia,
        peso: Number(d.peso) || 0
      }))
    };
  }, [dashData, filtradas, visaoConsolidada, resolverDensPor]);

  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="dashboard">
      <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-4 p-3 sm:gap-6 sm:p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard de recebimento</h1>
            <p className="text-sm text-muted-foreground">
              {visaoConsolidada
                ? `Visão consolidada de todas as obras liberadas (${pesagens?.length ?? 0} registros na base).`
                : "Baseado no histórico de pesagens concluídas da obra selecionada."}
            </p>
          </div>
          <div className="grid w-full grid-cols-1 items-end gap-3 sm:flex sm:w-auto sm:flex-wrap">
            <div className="space-y-1.5">
              <Label>Contratante</Label>
              <Select value={contratanteFiltro} onValueChange={setContratanteFiltro}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os contratantes</SelectItem>
                  {contratantesDisponiveis.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!ocultarCompetencia && (
              <div className="space-y-1.5">
                <Label>Competência</Label>
                <Input
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="w-full sm:w-[180px]"
                />
              </div>
            )}

          </div>
        </div>

        {!obraId ? (
          <div className="p-8 text-sm text-muted-foreground">Selecione uma obra.</div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores...
          </div>
        ) : consultaFalhou ? (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Falha ao carregar dashboard: {consultaErro instanceof Error ? consultaErro.message : "erro desconhecido"}
          </div>
        ) : (
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
            <TabsList className="h-11 w-full gap-1 bg-muted/30 p-1 ring-1 ring-border sm:w-auto">
              <TabsTrigger
                value="indicadores"
                className="shrink-0 px-3 h-9 text-xs sm:px-5 sm:text-sm font-heading font-semibold text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02]"
              >
                Indicadores
              </TabsTrigger>
              <TabsTrigger
                value="conferencias"
                className="shrink-0 px-3 h-9 text-xs sm:px-5 sm:text-sm font-heading font-semibold text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02]"
              >
                Conferências
              </TabsTrigger>
              <TabsTrigger
                value="fechamento"
                className="shrink-0 px-3 h-9 text-xs sm:px-5 sm:text-sm font-heading font-semibold text-foreground/70 transition-all duration-200 hover:text-foreground data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02]"
              >
                Fechamento Mensal
              </TabsTrigger>
            </TabsList>
            <TabsContent value="indicadores" className="mt-4 flex flex-col gap-4">
              {!agregado || agregado.kpis.totalReceb === 0 ? (
                <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhuma pesagem concluída no período selecionado.
                </div>
              ) : (
                <DashboardErrorBoundary>
                  <DashConteudo agregado={agregado} competencia={competenciaEfetiva ? `${competenciaEfetiva.ano}-${String(competenciaEfetiva.mes).padStart(2, "0")}` : competenciaAtual()} porObra={porObra} visaoConsolidada={visaoConsolidada} />
                </DashboardErrorBoundary>
              )}
            </TabsContent>
            {/* Cada aba isolada: uma falha em uma aba não derruba a tela inteira. */}
            <TabsContent value="conferencias" className="mt-4">
              <DashboardErrorBoundary>
                <DashboardConferencia pesagens={pesagensConferencia} competencia={competencia} onPeriodoChange={setPeriodoConferencia} />
              </DashboardErrorBoundary>
            </TabsContent>
            <TabsContent value="fechamento" className="mt-4">
              <DashboardErrorBoundary>
                <DashboardFechamentoMensal pesagens={filtradas} />
              </DashboardErrorBoundary>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

type Agregado = ReturnType<typeof agregar>;

function agregar(
  rows: import("@/lib/pesagem-store").PesagemComEvidencias[],
  resolverDensPor: (nome?: string | null) => import("@/lib/unidades").ResolvedorDensidade | undefined = () => undefined,
) {
  let totalKg = 0;
  let pesoNfTot = 0;
  let diverg = 0;
  let permanenciaMs = 0;
  let permanenciaN = 0;

  const fornecedores = new Set<string>();
  const contratantes = new Set<string>();

  const porContratante = new Map<string, { peso: number; qtd: number; fornecedores: Map<string, number> }>();
  const porFornecedor = new Map<string, number>();
  const porDia = new Map<string, number>();

  for (const p of rows) {
    const liq = Number(p.peso_liquido ?? 0);
    totalKg += liq;

    if (p.emissor) fornecedores.add(p.emissor);
    if (p.contratante) contratantes.add(p.contratante);

    const nf = pesoNfReferencia(p, resolverDensPor(p.emissor)).kg;
    if (nf != null && nf > 0) {
      pesoNfTot += nf;
      diverg += Math.abs(liq - nf);
    }

    if (p.entrou_em && p.saiu_em) {
      const ms = new Date(p.saiu_em).getTime() - new Date(p.entrou_em).getTime();
      if (ms > 0) {
        permanenciaMs += ms;
        permanenciaN += 1;
      }
    }

    const cKey = (p.contratante ?? "").trim() || "Sem contratante";
    const cur = porContratante.get(cKey) ?? { peso: 0, qtd: 0, fornecedores: new Map<string, number>() };
    cur.peso += liq;
    cur.qtd += 1;
    if (p.emissor) cur.fornecedores.set(p.emissor, (cur.fornecedores.get(p.emissor) ?? 0) + liq);
    porContratante.set(cKey, cur);

    const fKey = p.emissor ?? "Sem emissor";
    porFornecedor.set(fKey, (porFornecedor.get(fKey) ?? 0) + liq);

    const ref = new Date(p.saiu_em ?? p.created_at);
    const dia = String(ref.getUTCDate()).padStart(2, "0");
    porDia.set(dia, (porDia.get(dia) ?? 0) + liq);
  }

  const topContratantes = Array.from(porContratante.entries())
    .map(([nome, v]) => {
      const principal = Array.from(v.fornecedores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { nome, peso: v.peso, qtd: v.qtd, principal };
    })
    .sort((a, b) => b.peso - a.peso);

  const topFornecedores = Array.from(porFornecedor.entries())
    .map(([nome, peso]) => ({ nome, peso }))
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 8);

  const porDiaArr = Array.from(porDia.entries())
    .map(([dia, peso]) => ({ dia, peso: peso / 1000 }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const acuracidade = pesoNfTot > 0 ? Math.max(0, 100 - (diverg / pesoNfTot) * 100) : null;
  const permanenciaHoras = permanenciaN > 0 ? permanenciaMs / permanenciaN / 3_600_000 : null;

  return {
    kpis: {
      totalKg,
      totalReceb: rows.length,
      totalForn: fornecedores.size,
      totalContr: contratantes.size,
      diverg,
      acuracidade,
      permanenciaHoras,
    },
    topContratantes,
    topFornecedores,
    porDia: porDiaArr,
  };
}

type ResumoObra = { nome: string; qtd: number; peso: number };

function DashConteudo({
  agregado,
  competencia,
  porObra = [],
  visaoConsolidada = true,
}: {
  agregado: Agregado;
  competencia: string;
  porObra?: ResumoObra[];
  visaoConsolidada?: boolean;
}) {

  const { kpis, topContratantes, topFornecedores, porDia } = agregado;
  const topPercent = kpis.totalKg > 0
    ? topContratantes.map((m) => ({ ...m, pct: (m.peso / kpis.totalKg) * 100 }))
    : topContratantes.map((m) => ({ ...m, pct: 0 }));

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={Package} label="Peso líquido total" value={fmtKg(kpis.totalKg)} />
        <Kpi icon={TrendingUp} label="Recebimentos" value={String(kpis.totalReceb)} />
        <Kpi icon={Users} label="Fornecedores" value={String(kpis.totalForn)} />
        <Kpi icon={Building2} label="Contratantes" value={String(kpis.totalContr)} />
        <Kpi icon={Percent} label="Acuracidade NF×Balança"
          value={kpis.acuracidade == null ? "—" : `${kpis.acuracidade.toFixed(1)}%`} />
      </div>

      {kpis.permanenciaHoras != null && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Kpi icon={Timer} label="Permanência média no canteiro"
            value={`${kpis.permanenciaHoras.toFixed(1)} h`} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Contratantes por peso</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] sm:h-[340px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topContratantes}
                layout="vertical"
                margin={{ left: 10, right: 80, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal stroke="var(--border)" />
                <XAxis
                  type="number"
                  domain={[0, 'dataMax + 10000']}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}t`}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={220}
                  tick={{ fontSize: 10, fill: "var(--foreground)", fontWeight: 600 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(v) => [`${(Number(v) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} t`, "Peso"]}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Bar
                  dataKey="peso"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="peso"
                    position="right"
                    offset={10}
                    formatter={(v: number) => `${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}t`}
                    style={{ fontSize: 11, fontWeight: 600, fill: "var(--muted-foreground)" }}
                  />
                  {topContratantes.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={i === 0 ? "var(--chart-1)" : "var(--chart-4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recebimento por fornecedor</CardTitle></CardHeader>
          <CardContent style={{ height: 340 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={topFornecedores}
                  dataKey="peso"
                  nameKey="nome"
                  outerRadius={85}
                  label={(props) => {
                    const { name, x, y, textAnchor, dominantBaseline } = props as any;
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        dominantBaseline={dominantBaseline}
                        fill="var(--muted-foreground)"
                        fontSize={10}
                        fontWeight={500}
                      >
                        {(name as string)?.slice(0, 10)}
                      </text>
                    );
                  }}
                  labelLine={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                >
                  {topFornecedores.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _n, props) => {
                    const total = topFornecedores.reduce((a, b) => a + b.peso, 0);
                    const pct = total > 0 ? (Number(v) / total) * 100 : 0;
                    return [`${fmtKg(Number(v))} (${pct.toFixed(1)}%)`, (props as any)?.name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  layout="horizontal"
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 10, lineHeight: "14px", paddingTop: 6 }}
                  formatter={(value: string) => (
                    <span style={{ color: "var(--foreground)", fontSize: 10 }} title={value}>
                      {value.length > 22 ? `${value.slice(0, 22)}…` : value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {porObra.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Registros por obra</CardTitle>
            {!visaoConsolidada && (
              <p className="text-[11px] text-muted-foreground">
                Mostrando apenas {porObra[porObra.length - 1]?.nome ?? "a obra selecionada"} — selecione
                "Todas as obras" no seletor do topo para o consolidado.
              </p>
            )}
          </CardHeader>

          <CardContent style={{ height: Math.max(200, porObra.length * 46 + 40) }} className="pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porObra} layout="vertical" margin={{ left: 10, right: 110, top: 6, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal stroke="var(--border)" />
                <XAxis
                  type="number"
                  domain={[0, "dataMax + 5"]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={230}
                  tick={{ fontSize: 10, fill: "var(--foreground)", fontWeight: 600 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(v, _n, props) => [
                    `${Number(v)} registros — ${((props as any)?.payload?.peso / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`,
                    "Obra",
                  ]}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="qtd" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false}>
                  <LabelList
                    dataKey="qtd"
                    position="right"
                    offset={10}
                    formatter={(v: number) => `${v} reg.`}
                    style={{ fontSize: 11, fontWeight: 600, fill: "var(--muted-foreground)" }}
                  />
                  {porObra.map((_, i) => (
                    <Cell key={i} fill={i === porObra.length - 1 ? BAR_CONTRATANTES : "var(--chart-4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}



      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recebido por dia (toneladas)</CardTitle></CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={porDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)} t`} />
              <Bar dataKey="peso" fill={BAR_DIA} radius={[6, 6, 0, 0]}>
                {porDia.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2 text-[11px] text-muted-foreground">
            <span className="font-medium">Cores por dia:</span>
            {porDia.map((d, i) => {
              const [, m] = competencia.split("-").map(Number);
              const dataStr = `${String(d.dia).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
              return (
                <div key={d.dia} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span>{dataStr}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Detalhamento por contratante</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                {["Contratante", "Peso líquido", "Recebimentos", "% do total", "Fornecedor principal"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topPercent.map((m) => (
                <tr key={m.nome} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{m.nome}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtKg(m.peso)}</td>
                  <td className="px-3 py-2 tabular-nums">{m.qtd}</td>
                  <td className="px-3 py-2 tabular-nums">{m.pct.toFixed(1)}%</td>
                  <td className="px-3 py-2">{m.principal ?? "—"}</td>
                </tr>
              ))}
              {topPercent.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem dados no período.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
