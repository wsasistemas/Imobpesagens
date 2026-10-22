import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { ChevronRight, Layers3, Recycle, Scale, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kpi } from "@/components/kpi-card";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { resumoPorObraQueryOptions, type ResumoSucataLinha } from "@/lib/sucata/sucata-queries";
import { obrasQueryOptions } from "@/lib/pesagem-queries";
import { useAuth } from "@/hooks/useAuth";

type Periodo = "mes" | "3meses" | "ano" | "tudo";
type Granularidade = "dia" | "semana" | "mes";

type ResumoObra = {
  obra_id: string;
  nome: string;
  concluidos: number;
  andamento: number;
  kg: number;
  valor: number;
};

type ResumoMes = {
  chave: string;
  rotulo: string;
  obras: ResumoObra[];
  concluidos: number;
  andamento: number;
  kg: number;
  valor: number;
};

const PERIODOS: { chave: Periodo; rotulo: string }[] = [
  { chave: "mes", rotulo: "Mês atual" },
  { chave: "3meses", rotulo: "Últimos 3 meses" },
  { chave: "ano", rotulo: "Ano" },
  { chave: "tudo", rotulo: "Tudo" },
];

function intervalo(p: Periodo): { inicio: string | null; fim: string | null } {
  if (p === "tudo") return { inicio: null, fim: null };
  const agora = new Date();
  const inicio =
    p === "mes"
      ? new Date(agora.getFullYear(), agora.getMonth(), 1)
      : p === "3meses"
        ? new Date(agora.getFullYear(), agora.getMonth() - 2, 1)
        : new Date(agora.getFullYear(), 0, 1);
  return { inicio: inicio.toISOString(), fim: null };
}

const nt = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function nomeDaObra(
  obraId: string,
  obras: Array<{ id: string; nome: string }>,
) {
  return obras.find((obra) => obra.id === obraId)?.nome ?? "Obra não identificada";
}

function agregarPorObra(
  linhas: ResumoSucataLinha[],
  obras: Array<{ id: string; nome: string }>,
): ResumoObra[] {
  const mapa = new Map<string, ResumoObra>();
  for (const linha of linhas) {
    const atual = mapa.get(linha.obra_id) ?? {
      obra_id: linha.obra_id,
      nome: nomeDaObra(linha.obra_id, obras),
      concluidos: 0,
      andamento: 0,
      kg: 0,
      valor: 0,
    };
    const concluido = linha.situacao === "CONCLUIDO" || Boolean(linha.concluido_em);
    if (concluido) atual.concluidos += 1;
    else atual.andamento += 1;
    atual.kg += Number(linha.peso_aferido_kg ?? 0);
    atual.valor += Number(linha.valor_total ?? 0);
    mapa.set(linha.obra_id, atual);
  }
  return [...mapa.values()].sort((a, b) => b.kg - a.kg);
}

function rotuloMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  if (!ano || !mes) return chave;
  const nome = new Date(ano, mes - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  return `${nome}/${ano}`;
}

function chaveTemporal(data: Date, granularidade: Granularidade) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  if (granularidade === "mes") return `${ano}-${mes}`;
  if (granularidade === "semana") {
    const inicio = new Date(ano, data.getMonth(), data.getDate());
    inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
    return `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`;
  }
  return `${ano}-${mes}-${dia}`;
}

function rotuloTemporal(chave: string, granularidade: Granularidade) {
  if (granularidade === "mes") {
    const [ano, mes] = chave.split("-").map(Number);
    return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  const [ano, mes, dia] = chave.split("-").map(Number);
  const rotulo = new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return granularidade === "semana" ? `sem. ${rotulo}` : rotulo;
}

export function ResumoPorObra({ obraId }: { obraId: string | null }) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("tudo");
  const [mesesAbertos, setMesesAbertos] = useState<Set<string>>(new Set());
  const [granularidade, setGranularidade] = useState<Granularidade>("dia");
  const [obraGrafico, setObraGrafico] = useState("__all__");
  const { inicio, fim } = intervalo(periodo);

  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const { data: linhas = [], isLoading } = useQuery(resumoPorObraQueryOptions(obraId, inicio, fim));

  const porObra = useMemo(() => agregarPorObra(linhas, obras), [linhas, obras]);

  const totais = useMemo(
    () => ({
      kg: porObra.reduce((s, o) => s + o.kg, 0),
      valor: porObra.reduce((s, o) => s + o.valor, 0),
      concluidos: porObra.reduce((s, o) => s + o.concluidos, 0),
      andamento: porObra.reduce((s, o) => s + o.andamento, 0),
    }),
    [porObra],
  );

  const dadosGrafico = useMemo(
    () => [...porObra].reverse().map((o) => ({ ...o, t: o.kg / 1000 })),
    [porObra],
  );

  const modoAno = periodo === "ano";

  useEffect(() => {
    setMesesAbertos(new Set());
  }, [modoAno, inicio]);

  useEffect(() => {
    if (obraId) setObraGrafico(obraId);
    else setObraGrafico("__all__");
  }, [obraId]);

  const meses = useMemo<ResumoMes[]>(() => {
    if (!modoAno) return [];
    const mapa = new Map<string, ResumoSucataLinha[]>();
    for (const linha of linhas) {
      const data = new Date(linha.entrada_em);
      if (Number.isNaN(data.getTime())) continue;
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
      mapa.set(chave, [...(mapa.get(chave) ?? []), linha]);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([chave, registros]) => {
        const obrasDoMes = agregarPorObra(registros, obras);
        return {
          chave,
          rotulo: rotuloMes(chave),
          obras: obrasDoMes,
          concluidos: obrasDoMes.reduce((soma, obra) => soma + obra.concluidos, 0),
          andamento: obrasDoMes.reduce((soma, obra) => soma + obra.andamento, 0),
          kg: obrasDoMes.reduce((soma, obra) => soma + obra.kg, 0),
          valor: obrasDoMes.reduce((soma, obra) => soma + obra.valor, 0),
        };
      });
  }, [linhas, modoAno, obras]);

  const obrasDisponiveis = useMemo(
    () => porObra.map((obra) => ({ id: obra.obra_id, nome: obra.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [porObra],
  );

  const serieTemporal = useMemo(() => {
    const mapa = new Map<string, { chave: string; kg: number; processos: number }>();
    for (const linha of linhas) {
      if (obraGrafico !== "__all__" && linha.obra_id !== obraGrafico) continue;
      const data = new Date(linha.entrada_em);
      if (Number.isNaN(data.getTime())) continue;
      const chave = chaveTemporal(data, granularidade);
      const atual = mapa.get(chave) ?? { chave, kg: 0, processos: 0 };
      atual.kg += Number(linha.peso_aferido_kg ?? 0);
      atual.processos += 1;
      mapa.set(chave, atual);
    }
    return [...mapa.values()]
      .sort((a, b) => a.chave.localeCompare(b.chave))
      .map((item) => ({
        ...item,
        rotulo: rotuloTemporal(item.chave, granularidade),
        toneladas: Number((item.kg / 1000).toFixed(3)),
      }));
  }, [granularidade, linhas, obraGrafico]);

  const alternarMes = (chave: string) => {
    setMesesAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Button
            key={p.chave}
            type="button"
            size="sm"
            variant={periodo === p.chave ? "default" : "outline"}
            onClick={() => setPeriodo(p.chave)}
          >
            {p.rotulo}
          </Button>
        ))}
      </div>

      <div className={`grid gap-3 sm:grid-cols-2 ${modoAno ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Kpi
          label="Peso total aferido"
          value={`${nt(totais.kg / 1000)} t`}
          sub={`${nt(totais.kg, 0)} kg`}
          icon={<Scale className="h-4 w-4" />}
          tone="info"
        />
        <Kpi
          label="Valor total"
          value={brl(totais.valor)}
          sub="Soma dos processos do período"
          icon={<Wallet className="h-4 w-4" />}
          tone="ok"
        />
        <Kpi
          label="Processos concluídos"
          value={String(totais.concluidos)}
          sub={`${porObra.reduce((s, o) => s + o.andamento, 0)} em andamento`}
          icon={<Recycle className="h-4 w-4" />}
        />
        {modoAno && (
          <Kpi
            label="Total de processos"
            value={String(linhas.length)}
            sub={`${totais.concluidos} concluídos · ${totais.andamento} em andamento`}
            icon={<Layers3 className="h-4 w-4" />}
            active
          />
        )}
      </div>

      {modoAno ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">Demonstrativo anual de sucata por obra</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Mês / Obra</th>
                  <th className="px-3 py-2 text-right font-medium">Processos</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídos</th>
                  <th className="px-3 py-2 text-right font-medium">Em andamento</th>
                  <th className="px-3 py-2 text-right font-medium">Peso aferido</th>
                  <th className="px-4 py-2 text-right font-medium">Valor total</th>
                  <th className="px-4 py-2 text-right font-medium">Valor médio / t</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
                )}
                {!isLoading && meses.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum processo de sucata no ano atual.</td></tr>
                )}
                {meses.map((mes) => {
                  const aberto = mesesAbertos.has(mes.chave);
                  return (
                    <FragmentoMes
                      key={mes.chave}
                      mes={mes}
                      aberto={aberto}
                      onAlternar={() => alternarMes(mes.chave)}
                    />
                  );
                })}
              </tbody>
            </table>
            {meses.length > 0 && (
              <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                Mostrando {meses.length} mês(es) · {linhas.length} processo(s) no ano
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">Resumo por obra</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Obra</th>
                  <th className="p-2 text-right">Concluídos</th>
                  <th className="p-2 text-right">Em andamento</th>
                  <th className="p-2 text-right">Peso aferido (t)</th>
                  <th className="p-2 text-right">Valor total</th>
                  <th className="p-2 text-right">Valor médio / t</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
                )}
                {!isLoading && porObra.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      Nenhum processo de sucata no período selecionado.
                    </td>
                  </tr>
                )}
                {porObra.map((o) => (
                  <tr key={o.obra_id} className="border-t">
                    <td className="p-2 font-medium">{o.nome}</td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>{o.concluidos}</td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>{o.andamento}</td>
                    <td className={`p-2 text-right font-semibold ${CLASSE_NUM}`}>{nt(o.kg / 1000)}</td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>{brl(o.valor)}</td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>
                      {o.kg > 0 ? brl(o.valor / (o.kg / 1000)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {porObra.length > 0 && (
                <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                  <tr>
                    <td className="p-2">Total</td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>{totais.concluidos}</td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>
                      {porObra.reduce((s, o) => s + o.andamento, 0)}
                    </td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>{nt(totais.kg / 1000)}</td>
                    <td className={`p-2 text-right ${CLASSE_NUM}`}>{brl(totais.valor)}</td>
                    <td className="p-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {modoAno && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
            <CardTitle className="font-heading text-base">Peso de sucata ao longo do tempo</CardTitle>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Select value={obraGrafico} onValueChange={setObraGrafico} disabled={Boolean(obraId)}>
                <SelectTrigger className="h-9 w-full text-xs sm:w-[260px]">
                  <SelectValue placeholder="Todas as obras" />
                </SelectTrigger>
                <SelectContent>
                  {!obraId && <SelectItem value="__all__">Todas as obras</SelectItem>}
                  {obrasDisponiveis.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                {(["dia", "semana", "mes"] as const).map((opcao) => (
                  <Button
                    key={opcao}
                    type="button"
                    size="sm"
                    variant={granularidade === opcao ? "default" : "outline"}
                    className="h-9 px-3"
                    onClick={() => setGranularidade(opcao)}
                  >
                    {opcao === "dia" ? "Dia" : opcao === "semana" ? "Semana" : "Mês"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            {serieTemporal.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieTemporal} margin={{ left: 4, right: 18, top: 8, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(valor: number) => `${nt(Number(valor), 0)} t`} width={58} />
                  <Tooltip
                    formatter={(valor, nome, item) => nome === "toneladas"
                      ? [`${nt(Number(valor))} t`, "Peso aferido"]
                      : [valor, nome]}
                    labelFormatter={(rotulo, itens) => {
                      const processos = itens[0]?.payload?.processos;
                      return processos == null ? rotulo : `${rotulo} · ${processos} processo(s)`;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="toneladas"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--color-card)", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {!modoAno && dadosGrafico.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">Peso de sucata por obra (t)</CardTitle>
          </CardHeader>
          <CardContent
            style={{ height: Math.max(200, dadosGrafico.length * 46 + 40) }}
            className="pt-4"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 10, right: 110, top: 6, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal stroke="var(--border)" />
                <XAxis
                  type="number"
                  domain={[0, "dataMax"]}
                  tickFormatter={(v: number) => nt(Number(v), 0)}
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
                  formatter={(v) => [`${nt(Number(v))} t`, "Peso aferido"]}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="t" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false}>
                  {dadosGrafico.map((_, i) => (
                    <Cell key={i} fill={i === dadosGrafico.length - 1 ? "var(--chart-1)" : "var(--chart-4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FragmentoMes({
  mes,
  aberto,
  onAlternar,
}: {
  mes: ResumoMes;
  aberto: boolean;
  onAlternar: () => void;
}) {
  return (
    <>
      <tr className="border-b bg-muted/30">
        <td className="px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-2 px-0 py-0 font-semibold hover:bg-transparent"
            onClick={onAlternar}
            title={aberto ? "Recolher mês" : "Expandir mês"}
          >
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`} />
            {mes.rotulo}
          </Button>
        </td>
        <td className={`px-3 py-2 text-right font-semibold ${CLASSE_NUM}`}>{mes.concluidos + mes.andamento}</td>
        <td className={`px-3 py-2 text-right ${CLASSE_NUM}`}>{mes.concluidos}</td>
        <td className={`px-3 py-2 text-right ${CLASSE_NUM}`}>{mes.andamento}</td>
        <td className={`px-3 py-2 text-right font-semibold ${CLASSE_NUM}`}>{nt(mes.kg / 1000)} t</td>
        <td className={`px-4 py-2 text-right font-semibold ${CLASSE_NUM}`}>{brl(mes.valor)}</td>
        <td className="px-4 py-2 text-right text-muted-foreground">—</td>
      </tr>
      {aberto && mes.obras.map((obra) => (
        <tr key={`${mes.chave}-${obra.obra_id}`} className="border-b hover:bg-muted/20">
          <td className="py-2 pl-12 pr-4 font-medium">{obra.nome}</td>
          <td className={`px-3 py-2 text-right ${CLASSE_NUM}`}>{obra.concluidos + obra.andamento}</td>
          <td className={`px-3 py-2 text-right ${CLASSE_NUM}`}>{obra.concluidos}</td>
          <td className={`px-3 py-2 text-right ${CLASSE_NUM}`}>{obra.andamento}</td>
          <td className={`px-3 py-2 text-right ${CLASSE_NUM}`}>{nt(obra.kg / 1000)} t</td>
          <td className={`px-4 py-2 text-right ${CLASSE_NUM}`}>{brl(obra.valor)}</td>
          <td className={`px-4 py-2 text-right ${CLASSE_NUM}`}>
            {obra.kg > 0 ? brl(obra.valor / (obra.kg / 1000)) : "—"}
          </td>
        </tr>
      ))}
    </>
  );
}
