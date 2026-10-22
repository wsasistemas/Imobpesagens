import { ReactNode, useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Customized,
} from "recharts";

import { ArrowDown, ArrowUp, CheckCircle2, AlertTriangle, TrendingDown, FileSpreadsheet, Search, ChevronRight, ChevronLeft, Calculator, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Kpi } from "@/components/kpi-card";
import type { PesagemComEvidencias } from "@/lib/pesagem-store";
import {
  EstratificacaoDialog, montarLinhaEstratificacao, fmtTon, fmtPct, fmtKgSigned,
  type LinhaEstratificacao, type SituacaoEstratificacao, abrirEdicaoGlobal,
} from "@/components/estratificacao-dialog";
import { construirMapaFornecedores, rotuloFornecedor } from "@/lib/fornecedor";
import { contabilizavelNaConferencia, excluidosSemSaida, fechadoComOcorrencia } from "@/lib/afericao-escopo";
import { construirMapaContratantes, rotuloContratante } from "@/lib/contratante";
import { baixarCsv } from "@/lib/exportar-csv";
import { useResolvedorDensidadePorFornecedor } from "@/lib/densidades";

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFornecedoresConcreto } from "@/lib/concreto.functions";
import { categorizar } from "@/lib/tolerancias-material";
import {
  useToleranciasPadrao, useGerenciamentoFornecedores, useOverridesFornecedor,
  resolverToleranciaDaPesagem, type ToleranciaResolvida,
} from "@/lib/tolerancias-heranca";

const POR_PAGINA = 30;

/** Sequência de páginas com reticências, mantendo o cabeçalho curto. */
function paginasVisiveis(atual: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - (nums[i - 1] as number) > 1) out.push("...");
    out.push(n);
  });
  return out;
}

const FILL_RED = "var(--destructive)";
const FILL_BLUE = "var(--info)";

function AreaFillBetween(props: any) {
  const xScale = props.xAxisMap?.[0]?.scale;
  const yScale = props.yAxisMap?.[0]?.scale;
  const data = props.data as Array<{ rotulo: string; nfT: number; aferidoT: number }>;
  if (!xScale || !yScale || data.length < 2) return null;

  const paths: ReactNode[] = [];
  for (let i = 0; i < data.length - 1; i++) {
    const d0 = data[i];
    const d1 = data[i + 1];
    const x0 = xScale(d0.rotulo);
    const x1 = xScale(d1.rotulo);
    const yNf0 = yScale(d0.nfT);
    const yNf1 = yScale(d1.nfT);
    const yAf0 = yScale(d0.aferidoT);
    const yAf1 = yScale(d1.aferidoT);
    const diff0 = d0.aferidoT - d0.nfT;
    const diff1 = d1.aferidoT - d1.nfT;

    if (diff0 === 0 && diff1 === 0) continue;

    const sameSign = (diff0 >= 0 && diff1 >= 0) || (diff0 <= 0 && diff1 <= 0);
    if (sameSign) {
      const color = diff0 > 0 || diff1 > 0 ? FILL_BLUE : FILL_RED;
      const d = `M ${x0} ${yNf0} L ${x1} ${yNf1} L ${x1} ${yAf1} L ${x0} ${yAf0} Z`;
      paths.push(
        <path key={`seg-${i}`} d={d} fill={color} fillOpacity={0.35} stroke="none" />
      );
    } else {
      const denominator = (yNf1 - yNf0) - (yAf1 - yAf0);
      if (denominator === 0) continue;
      const t = (yAf0 - yNf0) / denominator;
      const xi = x0 + t * (x1 - x0);
      const yi = yNf0 + t * (yNf1 - yNf0);
      const color0 = diff0 > 0 ? FILL_BLUE : FILL_RED;
      const color1 = diff1 > 0 ? FILL_BLUE : FILL_RED;
      const path0 = `M ${x0} ${yNf0} L ${xi} ${yi} L ${x0} ${yAf0} Z`;
      const path1 = `M ${xi} ${yi} L ${x1} ${yNf1} L ${x1} ${yAf1} Z`;
      paths.push(
        <path key={`seg-${i}-0`} d={path0} fill={color0} fillOpacity={0.35} stroke="none" />
      );
      paths.push(
        <path key={`seg-${i}-1`} d={path1} fill={color1} fillOpacity={0.35} stroke="none" />
      );
    }
  }
  return <g>{paths}</g>;
}

type Props = { 
  pesagens: PesagemComEvidencias[];
  competencia?: string;
  onPeriodoChange?: (preset: "hoje" | "semana" | "mes" | "ano" | "custom") => void;
};

const MESES_POR_PAGINA = 3;

const rotuloMes = (chave: string) => {
  const [a, m] = chave.split("-").map(Number);
  if (!a || !m) return chave;
  const nome = new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${nome}/${a}`;
};


type Situacao = SituacaoEstratificacao;
type Linha = LinhaEstratificacao;
type FiltroSituacao = Situacao | "__all__" | "__divergente__";

const linhaDivergente = (linha: Pick<Linha, "situacao">) => linha.situacao === "abaixo";


const PRESETS = [0.5, 1, 2, 3, 5, 10];

type Preset = "hoje" | "semana" | "mes" | "ano" | "custom";

const fmtDataStr = (d: Date) => Number.isNaN(d.getTime()) ? "Data inválida" : d.toLocaleDateString("pt-BR");
const toInputDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fromInputDate = (s: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const data = new Date(y, m - 1, d);
  if (data.getFullYear() !== y || data.getMonth() !== m - 1 || data.getDate() !== d) return null;
  return data;
};

const parseCompetencia = (valor?: string): { ano: number; mes: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(valor ?? "");
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  return mes >= 1 && mes <= 12 ? { ano, mes } : null;
};

function calcularIntervalo(preset: Preset, custom: { ini: string; fim: string }, competencia?: string): { ini: Date; fim: Date } {
  const agora = new Date();
  const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fimHoje = new Date(hoje0.getTime() + 24 * 3600_000 - 1);
  const competenciaValida = parseCompetencia(competencia);

  if (preset === "mes" && competenciaValida) {
    const ini = new Date(competenciaValida.ano, competenciaValida.mes - 1, 1);
    const fim = new Date(competenciaValida.ano, competenciaValida.mes, 1, 0, 0, 0, -1);
    return { ini, fim };
  }

  if (preset === "hoje") return { ini: hoje0, fim: fimHoje };
  if (preset === "semana") {
    const dow = hoje0.getDay();
    return { ini: new Date(hoje0.getTime() - dow * 24 * 3600_000), fim: fimHoje };
  }
  if (preset === "mes") return { ini: new Date(agora.getFullYear(), agora.getMonth(), 1), fim: fimHoje };
  if (preset === "ano") {
    const ano = competenciaValida?.ano ?? agora.getFullYear();
    const fimAno = ano === agora.getFullYear() ? fimHoje : new Date(ano, 11, 31, 23, 59, 59, 999);
    return { ini: new Date(ano, 0, 1), fim: fimAno };
  }
  const customIni = fromInputDate(custom.ini);
  const customFim = fromInputDate(custom.fim);
  if (!customIni || !customFim || customIni.getTime() > customFim.getTime()) {
    return { ini: hoje0, fim: fimHoje };
  }
  const ini = customIni;
  const fim = new Date(customFim.getTime() + 24 * 3600_000 - 1);
  return { ini, fim };
}

export function DashboardConferencia({ pesagens, competencia, onPeriodoChange }: Props) {
  const resolverDensPor = useResolvedorDensidadePorFornecedor();
  const [toleranciaPct, setToleranciaPct] = useState<number>(2);
  const [fornecedorFiltro, setFornecedorFiltro] = useState<string>("__all__");
  const [busca, setBusca] = useState("");
  const [situacaoFiltro, setSituacaoFiltro] = useState<FiltroSituacao>("__all__");
  const [detalhe, setDetalhe] = useState<Linha | null>(null);
  const [pagina, setPagina] = useState(1);
  const [granularidade, setGranularidade] = useState<"dia" | "semana" | "mes">("dia");
  const [graficoFornecedor, setGraficoFornecedor] = useState<string>("__all__");
  
  const [preset, setPreset] = useState<Preset>("mes");
  const [custom, setCustom] = useState<{ ini: string; fim: string }>(() => {
    const hoje = new Date();
    const dIni = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { ini: toInputDate(dIni), fim: toInputDate(hoje) };
  });

  // Atualiza as datas auxiliares sem substituir o período escolhido pelo usuário.
  useEffect(() => {
    const valor = parseCompetencia(competencia);
    if (valor) {
      const ini = toInputDate(new Date(valor.ano, valor.mes - 1, 1));
      const fim = toInputDate(new Date(valor.ano, valor.mes, 0));
      // Só troca o estado quando o valor realmente muda: evita novo objeto a cada render.
      setCustom((atual) => (atual.ini === ini && atual.fim === fim ? atual : { ini, fim }));
    }
  }, [competencia]);

  // Informa ao Dashboard qual período está ativo (a Competência some no modo Ano).
  useEffect(() => {
    onPeriodoChange?.(preset);
    // Só o período importa: uma função nova a cada render não deve redisparar o aviso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);



  const { ini, fim } = useMemo(
    () => calcularIntervalo(preset, custom, competencia),
    [preset, custom.ini, custom.fim, competencia],
  );
  // Chaves primitivas do intervalo: evitam efeitos disparando por identidade de Date.
  const iniMsPeriodo = ini.getTime();
  const fimMsPeriodo = fim.getTime();
  const customIniValida = fromInputDate(custom.ini);
  const customFimValida = fromInputDate(custom.fim);
  const erroPeriodoPersonalizado = preset === "custom"
    ? !customIniValida || !customFimValida
      ? "Informe as duas datas do período."
      : customIniValida.getTime() > customFimValida.getTime()
        ? "A data inicial deve ser anterior à data final."
        : null
    : null;

  const mapaFornecedores = useMemo(() => construirMapaFornecedores(pesagens), [pesagens]);
  const mapaContratantes = useMemo(() => construirMapaContratantes(pesagens), [pesagens]);

  // ---- Tolerância por registro: carta de traço → cadastro da carta;
  //      itens da NF → override do fornecedor ?? tabela padrão ?? tolerância geral do filtro.
  const getFornConcretoFn = useServerFn(getFornecedoresConcreto);
  const { data: fornConcreto = [] } = useQuery({
    queryKey: ["fornecedores_concreto"],
    queryFn: () => getFornConcretoFn(undefined as never),
    staleTime: 5 * 60_000,
  });

  const { categorias: categoriasPadrao } = useToleranciasPadrao();
  const { fornecedores: fornecedoresMat } = useGerenciamentoFornecedores();
  const { overrides } = useOverridesFornecedor();

  /** traco_id → tolerância cadastrada na carta de traço. */
  const tolPorTraco = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of ((fornConcreto as any[]) ?? [])) {
      for (const t of (f?.tracos ?? [])) {
        const tol = Number(t?.tolerancia_peso ?? f?.tolerancia_padrao ?? 0) || null;
        if (t?.id && tol) m.set(String(t.id), tol);
      }
    }
    return m;
  }, [fornConcreto]);

  /** traco_id → densidade da carta de traço (mesma regra do popup de detalhe). */
  const densPorTraco = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of ((fornConcreto as any[]) ?? [])) {
      for (const t of (f?.tracos ?? [])) {
        const d = Number(t?.densidade_teorica ?? t?.densidade_pratica ?? 0) || null;
        if (t?.id && d) m.set(String(t.id), d);
      }
    }
    return m;
  }, [fornConcreto]);

  const tolPorPesagem = useMemo(() => {
    const m = new Map<string, ToleranciaResolvida>();
    for (const p of pesagens) {
      const carta = p.traco_id ? (tolPorTraco.get(String(p.traco_id)) ?? null) : null;
      m.set(p.id, resolverToleranciaDaPesagem(p as any, {
        categorias: categoriasPadrao as any,
        fornecedores: fornecedoresMat,
        overrides,
        fornecedorNome: rotuloFornecedor(p.emissor, mapaFornecedores),
        fallbackPct: toleranciaPct,
        toleranciaCarta: carta,
        categorizar: categorizar as any,
      }));
    }
    return m;
  }, [pesagens, tolPorTraco, categoriasPadrao, fornecedoresMat, overrides, mapaFornecedores, toleranciaPct]);

  const linhas = useMemo<Linha[]>(() => {
    const iniMs = ini.getTime();
    const fimMs = fim.getTime();
    return pesagens
      .filter(contabilizavelNaConferencia)
      .filter((p) => {
        const ts = new Date(p.saiu_em ?? p.created_at).getTime();
        return ts >= iniMs && ts <= fimMs;
      })
      .map((p) => {
        const pMod = { ...p, contratante: rotuloContratante(p.contratante, mapaContratantes) };
        const tolReg = tolPorPesagem.get(p.id)?.pct ?? toleranciaPct;
        return montarLinhaEstratificacao(
          pMod,
          tolReg,
          mapaFornecedores,
          resolverDensPor(p.emissor),
          p.traco_id ? (densPorTraco.get(String(p.traco_id)) ?? null) : null,
        );
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [pesagens, toleranciaPct, tolPorPesagem, mapaFornecedores, mapaContratantes, resolverDensPor, ini, fim]);

  /** Encerrados no período que ficaram fora por não ter pesagem de saída. */
  const semSaidaNoPeriodo = useMemo(() => {
    const iniMs = ini.getTime();
    const fimMs = fim.getTime();
    return excluidosSemSaida(pesagens).filter((p) => {
      const ts = new Date(p.saiu_em ?? p.created_at).getTime();
      return ts >= iniMs && ts <= fimMs;
    }).length;
  }, [pesagens, ini, fim]);



  const fornecedores = useMemo(() => {
    const m = new Map<string, { chave: string; rotulo: string; variantes: number }>();
    linhas.forEach((l) => {
      if (!m.has(l.fornecedorChave)) {
        m.set(l.fornecedorChave, {
          chave: l.fornecedorChave, rotulo: l.fornecedor, variantes: l.fornecedorVariantes.length,
        });
      }
    });
    return Array.from(m.values()).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (fornecedorFiltro !== "__all__" && l.fornecedorChave !== fornecedorFiltro) return false;
      if (situacaoFiltro === "__divergente__" && !linhaDivergente(l)) return false;
      if (situacaoFiltro !== "__all__" && situacaoFiltro !== "__divergente__" && l.situacao !== situacaoFiltro) return false;
      if (!q) return true;
      return l.fornecedor.toLowerCase().includes(q)
        || l.fornecedorVariantes.some((v) => v.toLowerCase().includes(q))
        || l.produto.toLowerCase().includes(q)
        || l.dataFmt.includes(q);
    });
  }, [linhas, fornecedorFiltro, situacaoFiltro, busca]);

  const comNf = filtradas.filter((l) => l.nf > 0);

  const modoAno = preset === "ano";

  /** Agrupamento por mês (usado no período Ano), do mais recente para o mais antigo. */
  const gruposMes = useMemo(() => {
    if (!modoAno) return [];
    const mapa = new Map<string, { chave: string; linhas: Linha[]; aferidoKg: number; divergentes: number }>();
    for (const l of filtradas) {
      const d = new Date(l.data);
      if (Number.isNaN(d.getTime())) continue;
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const g = mapa.get(chave) ?? { chave, linhas: [], aferidoKg: 0, divergentes: 0 };
      g.linhas.push(l);
      g.aferidoKg += l.liquido;
      if (linhaDivergente(l)) g.divergentes += 1;
      mapa.set(chave, g);
    }
    return Array.from(mapa.values()).sort((a, b) => b.chave.localeCompare(a.chave));
  }, [filtradas, modoAno]);

  // No modo Ano os meses abrem sempre RECOLHIDOS; o usuário expande o mês desejado.
  const [mesesAbertos, setMesesAbertos] = useState<Set<string>>(new Set());
  useEffect(() => {
    setMesesAbertos((atual) => (atual.size === 0 ? atual : new Set()));
  }, [modoAno, iniMsPeriodo, fimMsPeriodo]);
  const alternarMes = (chave: string) =>
    setMesesAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });

  // Paginação do quadro comparativo (apresentação apenas).
  const totalPaginas = modoAno
    ? Math.max(1, Math.ceil(gruposMes.length / MESES_POR_PAGINA))
    : Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  useEffect(() => {
    setPagina(1);
  }, [fornecedorFiltro, situacaoFiltro, busca, toleranciaPct, iniMsPeriodo, fimMsPeriodo, modoAno]);
  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas));
  }, [totalPaginas]);
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioIdx = (paginaAtual - 1) * (modoAno ? MESES_POR_PAGINA : POR_PAGINA);
  const paginadas = useMemo(
    () => (modoAno ? [] : filtradas.slice(inicioIdx, inicioIdx + POR_PAGINA)),
    [filtradas, inicioIdx, modoAno],
  );
  const gruposVisiveis = useMemo(
    () => (modoAno ? gruposMes.slice(inicioIdx, inicioIdx + MESES_POR_PAGINA) : []),
    [gruposMes, inicioIdx, modoAno],
  );

  type ItemTabela =
    | { kind: "grupo"; chave: string; qtd: number; aferidoKg: number; divergentes: number; fechado: boolean }
    | { kind: "linha"; l: Linha };

  const itensTabela = useMemo<ItemTabela[]>(() => {
    if (!modoAno) return paginadas.map((l) => ({ kind: "linha", l }));
    const out: ItemTabela[] = [];
    for (const g of gruposVisiveis) {
      const aberto = mesesAbertos.has(g.chave);
      out.push({
        kind: "grupo", chave: g.chave, qtd: g.linhas.length,
        aferidoKg: g.aferidoKg, divergentes: g.divergentes, fechado: !aberto,
      });
      if (aberto) for (const l of g.linhas) out.push({ kind: "linha", l });
    }
    return out;
  }, [modoAno, paginadas, gruposVisiveis, mesesAbertos]);


  const kpis = useMemo(() => {
    const total = comNf.length;
    const okC = comNf.filter((l) => l.situacao === "ok").length;
    const abaixoC = comNf.filter((l) => l.situacao === "abaixo").length;
    const somaDifKg = comNf.reduce((acc, l) => acc + l.difKg, 0);
    const mediaPct = total > 0 ? comNf.reduce((acc, l) => acc + l.difPct, 0) / total : 0;
    return { total, okC, abaixoC, somaDifKg, mediaPct, semNf: filtradas.length - total };
  }, [comNf, filtradas.length]);

  const exportarCsv = () => {
    const header = [
      ...(modoAno ? ["Mês"] : []),
      "Data", "Nº Nota", "Emissor", "Contratante", "Fornecedor", "Produto",
      "Carta traço", "Transportadora", "Placa", "Carreta", "Modelo", "Marca", "Motorista", "UF",
      "Entrada (kg)", "Saída (kg)", "Líquido aferido (kg)", "Declarado NF (kg)",
      "Diferença (kg)", "Diferença (%)", "% Tolerância", "Situação",
    ];
    const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    const txt = (v: unknown) => {
      const s = v == null ? "" : String(v).trim();
      return s === "" ? "—" : s;
    };
    const mesDe = (l: Linha) => {
      const d = new Date(l.data);
      if (Number.isNaN(d.getTime())) return "—";
      return rotuloMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };
    const rows = filtradas.map((l) => {
      const p = l.pesagem as any;
      const carta = p?.traco_id ? (p?.is_padrao_fallback ? "PADRÃO" : "CARTA TRAÇO") : "—";
      return [
        ...(modoAno ? [mesDe(l)] : []),
        l.dataFmt, txt(p?.numero_nota), txt(p?.emissor), txt(p?.contratante),
        l.fornecedor, l.produto, carta,

        txt(p?.transportadora), txt(p?.placa), txt(p?.carreta), txt(p?.modelo), txt(p?.marca),
        txt(p?.motorista), txt(p?.uf),
        fmtNum(l.entrada), fmtNum(l.saida), fmtNum(l.liquido), fmtNum(l.nf),
        fmtNum(l.difKg), fmtPct(l.difPct), fmtPct(l.tolLinha),
        l.nf <= 0 ? "Sem NF" : linhaDivergente(l) ? "Acima da Tolerância" : "OK",
      ];
    });
    baixarCsv("conferencia", [header, ...rows]);
  };


  const serieTempo = useMemo(() => {
    const chaveDe = (d: Date) => {
      if (granularidade === "mes") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (granularidade === "semana") {
        const t = new Date(d);
        t.setHours(0, 0, 0, 0);
        t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
        return t.toISOString().slice(0, 10);
      }
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
    };
    const map = new Map<string, { key: string; nf: number; aferido: number; qtd: number }>();
    comNf.forEach((l) => {
      if (fornecedorFiltro === "__all__" && graficoFornecedor !== "__all__" && l.fornecedorChave !== graficoFornecedor) return;
      const d = new Date(l.data);
      if (isNaN(d.getTime())) return;
      const k = chaveDe(d);
      const cur = map.get(k) ?? { key: k, nf: 0, aferido: 0, qtd: 0 };
      cur.nf += l.nf;
      cur.aferido += l.liquido;
      cur.qtd += 1;
      map.set(k, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((p) => {
        const difKg = p.aferido - p.nf;
        const rotulo = granularidade === "mes"
          ? new Date(`${p.key}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
          : new Date(`${p.key}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return {
          ...p,
          rotulo: granularidade === "semana" ? `sem. ${rotulo}` : rotulo,
          nfT: Number((p.nf / 1000).toFixed(3)),
          aferidoT: Number((p.aferido / 1000).toFixed(3)),
          difKg,
          difPct: p.nf > 0 ? (difKg / p.nf) * 100 : 0,
        };
      });
  }, [comNf, granularidade, graficoFornecedor, fornecedorFiltro]);


  const corMedia = Math.abs(kpis.mediaPct) <= toleranciaPct
    ? "text-success" : kpis.mediaPct < 0 ? "text-destructive" : "text-warning";

  const legendPayload = [
    { value: "Peso NF", type: "line" as const, id: "nf", color: "var(--chart-1)" },
    { value: "Aferido", type: "line" as const, id: "aferido", color: "var(--chart-4)" },
    { value: "Aferido < NF", type: "square" as const, id: "fill-red", color: "var(--destructive)" },
    { value: "Aferido > NF", type: "square" as const, id: "fill-blue", color: "var(--info)" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex w-full flex-col">
            <Label className="text-xs">Período</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {[
                { id: "hoje" as Preset, label: "Hoje" },
                { id: "semana" as Preset, label: "Semana" },
                { id: "mes" as Preset, label: "Mês" },
                { id: "ano" as Preset, label: "Ano" },
                { id: "custom" as Preset, label: "Personalizado" },
              ].map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={preset === p.id ? "default" : "outline"}
                  onClick={() => setPreset(p.id)}
                  className={`h-8 px-3 ${preset === p.id ? "bg-primary hover:bg-primary/90" : ""}`}
                >
                  {p.label}
                </Button>
              ))}
              {preset === "custom" && (
                <div className="ml-2 flex items-center gap-1.5">
                  <Input type="date" value={custom.ini} onChange={(e) => setCustom((c) => ({ ...c, ini: e.target.value }))} className="h-8 w-full sm:w-[140px]" />
                  <span className="text-xs">até</span>
                  <Input type="date" value={custom.fim} onChange={(e) => setCustom((c) => ({ ...c, fim: e.target.value }))} className="h-8 w-full sm:w-[140px]" />
                </div>
              )}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              Intervalo: <span className="font-medium">{fmtDataStr(ini)} – {fmtDataStr(fim)}</span>
            </div>
            {erroPeriodoPersonalizado && (
              <p className="mt-1 text-xs text-destructive">{erroPeriodoPersonalizado}</p>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-end gap-3">

            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Select value={fornecedorFiltro} onValueChange={setFornecedorFiltro}>
                <SelectTrigger className="mt-1.5 h-9 w-full sm:w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os fornecedores</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.chave} value={f.chave}>
                      {f.rotulo}{f.variantes > 1 ? ` (${f.variantes} grafias)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Busca</Label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Fornecedor, produto, data..."
                  className="h-9 w-full sm:w-[240px] pl-8"
                />
              </div>
            </div>
            <Button variant="outline" onClick={exportarCsv} className="h-9">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Gerar Relatorio Analitico
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi 
          label="Recebimentos conferidos" 
          value={String(kpis.total)}
          sub={kpis.semNf > 0 ? `${kpis.semNf} sem NF` : undefined} 
          active={situacaoFiltro === "__all__"}
          onClick={() => setSituacaoFiltro("__all__")}
        />
        <Kpi 
          label="Dentro da tolerância" 
          value={String(kpis.okC)}
          sub={kpis.total > 0 ? `${((kpis.okC / kpis.total) * 100).toFixed(0)}% do total` : undefined}
          icon={<CheckCircle2 className="h-4 w-4" />} 
          tone="ok"
          active={situacaoFiltro === "ok"}
          onClick={() => setSituacaoFiltro("ok")}
        />
        <Kpi 
          label="Divergentes" 
          value={String(kpis.abaixoC)}
          sub={`${kpis.abaixoC} acima da tolerância`}
          icon={<AlertTriangle className="h-4 w-4" />} 
          tone="bad"
          active={situacaoFiltro === "__divergente__"}
          onClick={() => setSituacaoFiltro("__divergente__")}
        />
        <Kpi 
          label="Diferença média" 
          value={fmtPct(kpis.mediaPct)}
          sub={`Acumulado ${fmtKgSigned(kpis.somaDifKg)}`}
          icon={<TrendingDown className="h-4 w-4" />} 
          className={corMedia} 
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quadro comparativo: Pesagem × Nota Fiscal</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                {["Data", "Fornecedor / Produto", "Carta traço", "Entrada", "Saída", "Líquido aferido", "Declarado NF", "Comparativo", "Diferença", "%", "% Tolerância", "Situação"].map((h) => (
                  <th key={h} className={`whitespace-nowrap px-3 py-2 font-medium ${h === "Situação" ? "w-[150px] min-w-[150px]" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itensTabela.map((item) => {
                if (item.kind === "grupo") {
                  return (
                    <tr key={`g-${item.chave}`} className="border-b bg-muted/40">
                      <td colSpan={12} className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => alternarMes(item.chave)}
                            className="inline-flex items-center gap-2 text-left"
                            title={item.fechado ? "Expandir mês" : "Recolher mês"}
                          >
                            <ChevronRight
                              className={`h-4 w-4 text-muted-foreground transition-transform ${item.fechado ? "" : "rotate-90"}`}
                            />
                            <span className="text-sm font-semibold tabular-nums">{rotuloMes(item.chave)}</span>
                            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Users className="h-3 w-3" />
                              <span className="tabular-nums">{item.qtd}</span>
                            </span>
                          </button>
                          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                            {fmtTon(item.aferidoKg)} conferidas
                            {item.divergentes > 0 ? ` · ${item.divergentes} divergente(s)` : ""}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }
                const l = item.l;


                const maxVal = Math.max(l.liquido, l.nf, 1);
                const pctAf = (l.liquido / maxVal) * 100;
                const pctNf = (l.nf / maxVal) * 100;
                const divergente = linhaDivergente(l);
                const corAf = divergente ? "bg-destructive" : "bg-primary";
                return (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td className={`whitespace-nowrap py-2 pr-3 ${modoAno ? "pl-8" : "pl-3"}`}>

                      <div className="flex flex-col gap-0.5">
                        <span>{l.dataFmt}</span>
                        {fechadoComOcorrencia(l.pesagem) && (
                          <span
                            className="inline-flex w-fit items-center gap-1 rounded-full border border-abobora/50 bg-abobora-soft px-1.5 py-0.5 text-[9px] font-semibold text-abobora-dark"
                            title="Registro fechado com ocorrência — contabilizado por possuir pesagem de entrada e saída"
                          >
                            c/ocorrência
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetalhe(l)}
                            className="group inline-flex items-center gap-1 text-left font-medium text-primary hover:text-success hover:underline"
                            title="Ver estratificação de produtos"
                          >
                            <span>{l.fornecedor}</span>
                            {l.fornecedorVariantes.length > 1 && (
                              <span
                                className="rounded-full border border-success/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-normal text-primary"
                                title={`Grafias unificadas:\n${l.fornecedorVariantes.join("\n")}`}
                              >
                                unificado ×{l.fornecedorVariantes.length}
                              </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                          </button>
                        </div>
                        <div className="text-muted-foreground">{l.produto}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {l.pesagem.traco_id ? (
                        <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm ${
                          (l.pesagem as any).is_padrao_fallback 
                            ? 'border-success/30 bg-foreground text-success' 
                            : 'border-success/30 bg-primary/5 text-primary'
                        }`}>
                          {(l.pesagem as any).is_padrao_fallback ? <ShieldCheck className="h-3 w-3" /> : <Calculator className="h-3 w-3" />}
                          <span>{(l.pesagem as any).is_padrao_fallback ? 'PADRÃO' : 'CARTA TRAÇO'}</span>

                        </div>
                      ) : (
                        <span className="text-muted-foreground">−</span>
                      )}
                    </td>


                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtTon(l.entrada)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtTon(l.saida)}</td>
                    <td className="whitespace-nowrap bg-primary/5/60 px-3 py-2 font-semibold tabular-nums text-primary">
                      {fmtTon(l.liquido)}
                    </td>
                    <td
                      className="whitespace-nowrap bg-primary/5/50 px-3 py-2 tabular-nums"
                      title={
                        l.nfOrigem === "carta_traco"
                          ? `Peso oficial da Carta de Traço (volume × densidade) — tolerância ±${l.tolLinha}%`
                          : l.nfOrigem === "calculado"
                          ? `Peso calculado pelos itens da NF usando Carta de Traço (Densidade Teórica)${l.nfParcial ? " (parcial: nem todos os itens converteram)" : ""}`
                          : l.nfOrigem === "nf"
                            ? "Peso informado na NF"
                            : undefined
                      }
                    >
                      {l.nf > 0 ? (
                        <span className={`inline-flex items-center gap-1 ${l.nfOrigem === "calculado" || l.nfOrigem === "carta_traco" ? "font-bold text-success underline decoration-emerald-300 decoration-dotted underline-offset-2" : ""}`}>
                          {fmtTon(l.nf)}
                          {l.nfParcial && <span className="text-[10px] text-warning">parcial</span>}
                          {l.nfOrigem === "carta_traco" && <span className="rounded bg-success-soft px-1 text-[9px] font-bold text-success">CARTA</span>}
                          {l.nfOrigem === "calculado" && <Calculator className="h-3 w-3 text-primary" />}
                        </span>

                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[140px] flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 text-[10px] text-muted-foreground">Af</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full ${corAf}`} style={{ width: `${pctAf}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 text-[10px] text-muted-foreground">NF</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-muted-foreground" style={{ width: `${pctNf}%` }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 tabular-nums font-medium ${l.difKg < 0 ? "text-destructive" : l.difKg > 0 ? "text-warning" : ""}`}>
                      {l.nf > 0 ? fmtKgSigned(l.difKg) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {l.nf > 0 ? (
                        <Badge variant="outline" className={
                          divergente ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-success/30 bg-success-soft text-success"
                        }>
                          {divergente
                            ? <ArrowUp className="mr-1 h-3 w-3" />
                            : <ArrowDown className="mr-1 h-3 w-3" />}
                          {fmtPct(l.difPct)}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground"
                        title={tolPorPesagem.get(l.id)?.rotulo ?? "tolerância geral do filtro"}>
                      {l.nf > 0 ? `±${fmtPct(l.tolLinha)}` : "—"}
                    </td>
                    <td className="w-[150px] min-w-[150px] whitespace-nowrap px-3 py-2">
                      {l.nf <= 0 ? (
                        <Badge variant="outline" className="text-muted-foreground">Sem NF</Badge>
                      ) : divergente ? (
                        <Badge className="inline-flex w-full max-w-[136px] items-center justify-center whitespace-nowrap px-2 py-0.5 leading-none bg-destructive text-white hover:bg-destructive/90" style={{ fontSize: "9.5px" }}>Acima da Tolerância</Badge>
                      ) : (
                        <Badge className="inline-flex w-full max-w-[136px] items-center justify-center whitespace-nowrap px-2 py-0.5 leading-none bg-success text-white hover:bg-success/90">OK</Badge>
                      )}
                    </td>


                  </tr>
                );
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Sem recebimentos no período.</td></tr>
              )}
            </tbody>
          </table>
          {filtradas.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground sm:flex-row">
              <span>
                {modoAno
                  ? `Mostrando ${gruposVisiveis.length} mês(es) de ${gruposMes.length} · ${filtradas.length} registro(s) no ano`
                  : `Mostrando ${inicioIdx + 1}–${Math.min(inicioIdx + POR_PAGINA, filtradas.length)} de ${filtradas.length} registro(s)`}
              </span>

              {totalPaginas > 1 && (
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-7 gap-1 px-2"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </Button>
                  {paginasVisiveis(paginaAtual, totalPaginas).map((p, i) =>
                    p === "..." ? (
                      <span key={`e${i}`} className="px-1">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === paginaAtual ? "default" : "ghost"}
                        size="sm"
                        className="h-7 min-w-7 px-2"
                        onClick={() => setPagina(p)}
                      >
                        {p}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline" size="sm" className="h-7 gap-1 px-2"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  >
                    Próxima <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
          {semSaidaNoPeriodo > 0 && (
            <div className="border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              {semSaidaNoPeriodo} registro(s) encerrado(s) sem pesagem de saída não entram na apuração (peso líquido não apurável).
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico NF x Aferido ao longo do tempo */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">
            NF × Aferido ao longo do tempo
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={graficoFornecedor} onValueChange={setGraficoFornecedor}>
              <SelectTrigger className="h-8 w-full sm:w-[240px] text-xs">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os fornecedores</SelectItem>
                {fornecedores
                  .filter((f) => fornecedorFiltro === "__all__" || f.chave === fornecedorFiltro)
                  .map((f) => (
                    <SelectItem key={f.chave} value={f.chave}>
                      {f.rotulo}{f.variantes > 1 ? ` (${f.variantes} grafias)` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              {(["dia", "semana", "mes"] as const).map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={granularidade === g ? "default" : "outline"}
                  className="h-8 px-3"
                  onClick={() => setGranularidade(g)}
                >
                  {g === "dia" ? "Dia" : g === "semana" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          {serieTempo.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados no período.
            </div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={serieTempo} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tickFormatter={(v) => `${v} t`} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as typeof serieTempo[number];
                    return (
                      <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
                        <div className="mb-1 font-medium">{label}</div>
                        <div className="text-info">NF: {fmtTon(p.nf)}</div>
                        <div className="text-primary">Aferido: {fmtTon(p.aferido)}</div>
                        <div className={p.difKg < 0 ? "text-destructive" : "text-warning"}>
                          Diferença: {fmtKgSigned(p.difKg)} ({fmtPct(p.difPct)})
                        </div>
                        <div className="mt-1 text-muted-foreground">{p.qtd} recebimento(s)</div>
                      </div>
                    );
                  }}
                />
                <Legend payload={legendPayload} />
                <Customized component={AreaFillBetween} />
                <Line type="linear" dataKey="nfT" name="Peso NF" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="linear" dataKey="aferidoT" name="Aferido" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>


      <EstratificacaoDialog linha={detalhe} onClose={() => setDetalhe(null)} toleranciaPct={toleranciaPct} abrirEdicao={abrirEdicaoGlobal} />
    </div>
  );
}



