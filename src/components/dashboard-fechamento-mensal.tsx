import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import { ArrowDown, ArrowUp, Download, Package, Users, Scale, FileText, AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PesagemComEvidencias } from "@/lib/pesagem-store";
import { contabilizavelNaConferencia } from "@/lib/afericao-escopo";
import { useTolerancias, categorizar, type Categoria } from "@/lib/tolerancias-material";
import {
  useToleranciasPadrao, useGerenciamentoFornecedores, useOverridesFornecedor,
  resolverToleranciaDaPesagem, type ToleranciaResolvida,
} from "@/lib/tolerancias-heranca";
import { getFornecedoresConcreto } from "@/lib/concreto.functions";
import { pesoNfReferencia } from "@/lib/unidades";
import { useResolvedorDensidadePorFornecedor } from "@/lib/densidades";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EstratificacaoDialog, montarLinhaEstratificacao, type LinhaEstratificacao, abrirEdicaoGlobal } from "@/components/estratificacao-dialog";
import { chaveFornecedor, construirMapaFornecedores, rotuloFornecedor } from "@/lib/fornecedor";
import { construirMapaContratantes, rotuloContratante } from "@/lib/contratante";

type Props = { pesagens: PesagemComEvidencias[] };

type MapaTolerancias = Map<string, ToleranciaResolvida>;

const TOL_FALLBACK = 3;

const rotuloOrigem = (o: ToleranciaResolvida["origem"]) =>
  o === "carta_traco" ? "carta de traço"
  : o === "fornecedor" ? "tabela padrão · fornecedor"
  : o === "padrao" ? "tabela padrão"
  : "tolerância geral";

/** Tolerância efetiva de um conjunto de registros (média ponderada pelo aferido). */
function tolerarConjunto(ps: PesagemComEvidencias[], mapa: MapaTolerancias) {
  let peso = 0, soma = 0, min = Infinity, max = -Infinity;
  const origens = new Map<ToleranciaResolvida["origem"], number>();
  for (const p of ps) {
    const t = mapa.get(p.id);
    if (!t) continue;
    const w = Math.max(Number(p.peso_liquido ?? 0), 1);
    peso += w;
    soma += t.pct * w;
    min = Math.min(min, t.pct);
    max = Math.max(max, t.pct);
    origens.set(t.origem, (origens.get(t.origem) ?? 0) + w);
  }
  if (peso === 0) {
    return { pct: TOL_FALLBACK, min: TOL_FALLBACK, max: TOL_FALLBACK, origem: "geral" as ToleranciaResolvida["origem"] };
  }
  const origem = Array.from(origens.entries()).sort((a, b) => b[1] - a[1])[0][0];
  return { pct: soma / peso, min, max, origem };
}

const fmtTolFaixa = (t: { pct: number; min: number; max: number }) => {
  const f = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return t.min === t.max ? `±${f(t.pct)}%` : `±${f(t.min)} a ±${f(t.max)}%`;
};


const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--dimmer)"];
const COR_POS = "var(--success)";
const COR_NEG = "var(--destructive)"; // erro

const fmtT = (kg: number) =>
  `${(kg / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`;
const fmtKgSigned = (kg: number) => {
  const sign = kg > 0 ? "+" : kg < 0 ? "−" : "";
  return `${sign}${Math.abs(kg).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`;
};
const fmtPct = (n: number) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Impacto R$ = valor da NF × (diferença ÷ peso NF). */
const impactoDe = (valorNf: number, diff: number, pesoNf: number) =>
  pesoNf > 0 && valorNf > 0 ? valorNf * (diff / pesoNf) : 0;
/** Impacto R$ só vale para linhas acima da tolerância. */
function impactoLinha(f: LinhaForn): number | null {
  if (f.situacao !== "acima_da_tolerancia") return null;
  if (!f.temNf || f.valorNf <= 0) return null;
  return impactoDe(f.valorNf, f.diff, f.pesoNf);
}
const somaImpacto = (linhas: LinhaForn[]) =>
  linhas.reduce((s, f) => s + (impactoLinha(f) ?? 0), 0);
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const nome = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
};

type Situacao = "ok" | "abaixo" | "acima" | "sem" | "acima_da_tolerancia";

type LinhaForn = {
  emissor: string;
  qtd: number;
  aferido: number;
  temNf: boolean;
  pesoNf: number;
  valorNf: number;
  diff: number;
  pct: number | null;
  situacao: Situacao;
  categoriaPredominante: Categoria | null;
  tolerancia: number;
  tolMin: number;
  tolMax: number;
  tolOrigem: ToleranciaResolvida["origem"];
  toleranciaMedia: number | null;
  pesagens: PesagemComEvidencias[];

};

type GrupoObra = {
  obra: string;
  fornecedores: LinhaForn[];
  totAferido: number;
  totNf: number;
  totValorNf: number;
  totQtd: number;
  totDiff: number;
  totTemNf: boolean;
  totTolSoma: number;
  totTolQtd: number;
};

type RankingItem = {
  emissor: string;
  rec: number;
  af: number;
  nf: number;
  nfc: number;
  valorNfComPeso: number;
  obras: string[];
  categoria: Categoria | null;
  dif: number;
  difPct: number | null;
  impactoRS: number | null;
  tolerancia: number;
  tolMin: number;
  tolMax: number;
  tolOrigem: ToleranciaResolvida["origem"];
  situacao: Situacao;

};

/** Sobra (diferença positiva) nunca é penalizada: só o déficit fora da tolerância vira alerta. */
function situacaoDe(pct: number | null, tolerancia: number): Situacao {
  if (pct == null) return "sem";
  if (pct >= 0) return "ok";
  return Math.abs(pct) <= tolerancia ? "ok" : "abaixo";
}

/** Situação no fechamento por obra × fornecedor: só déficit acima da tolerância média é alerta. */
function situacaoFechamento(pct: number | null, toleranciaMedia: number | null): Situacao {
  if (pct == null || toleranciaMedia == null) return "sem";
  if (pct >= 0) return "ok";
  if (Math.abs(pct) <= toleranciaMedia) return "ok";
  return "acima_da_tolerancia";
}

function badgeSituacao(s: Situacao) {
  const base = "rounded-full px-2 py-0.5 font-semibold text-white whitespace-nowrap inline-flex items-center justify-center leading-none";
  if (s === "ok") return <span className={`${base} bg-success text-[11px]`}>OK</span>;
  if (s === "abaixo") return <span className={`${base} bg-destructive text-[11px]`}>Abaixo</span>;
  if (s === "acima") return <span className={`${base} bg-warning text-[11px]`}>Acima</span>;
  if (s === "acima_da_tolerancia") return <span className={`${base} bg-destructive text-[10px]`}>Acima da Tolerância</span>;
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground whitespace-nowrap inline-flex items-center justify-center leading-none">Sem parâmetro</span>;
}

function rotuloSituacao(s: Situacao) {
  if (s === "ok") return "OK";
  if (s === "abaixo") return "Abaixo";
  if (s === "acima") return "Acima";
  if (s === "acima_da_tolerancia") return "Acima da Tolerância";
  return "Sem parâmetro";
}

/** Ícone e cor do % Dif Médio no ranking: alerta (acima da tolerância) vs dentro do esperado (OK). */
function indicadorPctRanking(s: Situacao): { Icon: typeof ArrowUp; colorClass: string } {
  if (s === "acima_da_tolerancia") return { Icon: ArrowUp, colorClass: "text-destructive" };
  if (s === "ok") return { Icon: ArrowDown, colorClass: "text-success" };
  return { Icon: ArrowUp, colorClass: "" };
}

export function DashboardFechamentoMensal({ pesagens }: Props) {
  const { categorias } = useTolerancias();

  // Meses disponíveis (baseado em pesagens concluídas).
  const mesesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const p of pesagens) {
      if (!contabilizavelNaConferencia(p)) continue;
      const d = new Date(p.saiu_em ?? p.created_at);
      s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [pesagens]);

  const mesAtual = new Date();
  const mesAtualStr = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, "0")}`;
  const resolverDensPor = useResolvedorDensidadePorFornecedor();
  const [competencia, setCompetencia] = useState<string>(() =>
    mesesDisponiveis.includes(mesAtualStr) ? mesAtualStr : (mesesDisponiveis[0] ?? mesAtualStr),
  );
  const [obraFiltro, setObraFiltro] = useState<string>("__all__");
  const [metrica, setMetrica] = useState<"kg" | "pct" | "rs">("pct");
  const [notasSel, setNotasSel] = useState<{ obra: string; linha: LinhaForn } | null>(null);
  const [detalheNf, setDetalheNf] = useState<LinhaEstratificacao | null>(null);

  // Filtra pesagens da competência selecionada.
  const doMes = useMemo(() => {
    const [y, m] = competencia.split("-").map(Number);
    const ini = new Date(y, m - 1, 1).getTime();
    const fim = new Date(y, m, 1).getTime();
    return pesagens.filter((p) => {
      if (!contabilizavelNaConferencia(p)) return false;
      const t = new Date(p.saiu_em ?? p.created_at).getTime();
      return t >= ini && t < fim;
    });
  }, [pesagens, competencia]);

  const mapaContratantes = useMemo(() => construirMapaContratantes(pesagens), [pesagens]);

  const obrasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    doMes.forEach((p) => {
      const c = rotuloContratante(p.contratante, mapaContratantes);
      s.add(c);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [doMes, mapaContratantes]);

  const filtradas = useMemo(() => {
    if (obraFiltro === "__all__") return doMes;
    return doMes.filter((p) => rotuloContratante(p.contratante, mapaContratantes) === obraFiltro);
  }, [doMes, obraFiltro, mapaContratantes]);

  const mapaFornecedores = useMemo(() => construirMapaFornecedores(pesagens), [pesagens]);

  // ---- Tolerância por registro: carta de traço → cadastro da carta;
  //      itens da NF → override do fornecedor ?? TABELA PADRÃO ?? geral.
  const getFornConcretoFn = useServerFn(getFornecedoresConcreto);
  const { data: fornConcreto = [] } = useQuery({
    queryKey: ["fornecedores_concreto"],
    queryFn: () => getFornConcretoFn(undefined as never),
    staleTime: 5 * 60_000,
  });

  const { categorias: categoriasPadrao } = useToleranciasPadrao();
  const { fornecedores: fornecedoresMat } = useGerenciamentoFornecedores();
  const { overrides } = useOverridesFornecedor();

  /** traco_id → tolerância cadastrada (traço → fornecedor de concreto). */
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

  const tolPorPesagem: MapaTolerancias = useMemo(() => {
    const m: MapaTolerancias = new Map();
    for (const p of filtradas) {
      const carta = p.traco_id ? (tolPorTraco.get(String(p.traco_id)) ?? null) : null;
      m.set(p.id, resolverToleranciaDaPesagem(p as any, {
        categorias: categoriasPadrao as any,
        fornecedores: fornecedoresMat,
        overrides,
        fornecedorNome: rotuloFornecedor(p.emissor, mapaFornecedores),
        fallbackPct: TOL_FALLBACK,
        toleranciaCarta: carta,
        categorizar: categorizar as any,
      }));
    }
    return m;
  }, [filtradas, tolPorTraco, categoriasPadrao, fornecedoresMat, overrides, mapaFornecedores]);


  // Agregações por obra → fornecedor (unificando grafias do mesmo emissor).
  const grupos: GrupoObra[] = useMemo(() => {
    const porObra = new Map<string, Map<string, {
      emissor: string;
      qtd: number;
      aferido: number;
      pesoNf: number;
      valorNf: number;
      temNf: boolean;
      catVol: Map<string, { cat: Categoria; volume: number }>;
      pesagens: PesagemComEvidencias[];
    }>>();

    for (const p of filtradas) {
      const obra = rotuloContratante(p.contratante, mapaContratantes);
      const emissorChave = chaveFornecedor(p.emissor);
      const emissor = rotuloFornecedor(p.emissor, mapaFornecedores);
      const liq = Number(p.peso_liquido ?? 0);
      const nf = pesoNfReferencia(p, resolverDensPor(p.emissor)).kg;
      const valor = p.valor_total_nf != null ? Number(p.valor_total_nf) : 0;

      // Categorias envolvidas nesta pesagem (por itens ou descrição).
      const itens = ((p as unknown as { itens_nf?: Array<{ descricao?: string; quantidade?: number }> | null }).itens_nf ?? [])
        .filter((i) => (i.descricao ?? "").trim() !== "");
      const dists: Array<{ cat: Categoria; peso: number }> = [];
      if (itens.length > 0) {
        const qtds = itens.map((i) => Number(i.quantidade ?? 0));
        const soma = qtds.reduce((a, b) => a + b, 0);
        itens.forEach((it, idx) => {
          const share = soma > 0 ? qtds[idx] / soma : 1 / itens.length;
          dists.push({ cat: categorizar(it.descricao ?? "", categorias), peso: liq * share });
        });
      } else {
        dists.push({ cat: categorizar(p.descricao ?? "", categorias), peso: liq });
      }

      if (!porObra.has(obra)) porObra.set(obra, new Map());
      const bucketObra = porObra.get(obra)!;
      if (!bucketObra.has(emissorChave)) {
        bucketObra.set(emissorChave, {
          emissor, qtd: 0, aferido: 0, pesoNf: 0, valorNf: 0, temNf: false, catVol: new Map(), pesagens: [],
        });
      }
      const b = bucketObra.get(emissorChave)!;
      b.emissor = emissor;
      b.pesagens.push(p);
      b.qtd += 1;
      b.aferido += liq;
      b.valorNf += valor;
      if (nf != null && nf > 0) {
        b.pesoNf += nf;
        b.temNf = true;
      }
      for (const d of dists) {
        const cur = b.catVol.get(d.cat.id);
        if (cur) cur.volume += d.peso;
        else b.catVol.set(d.cat.id, { cat: d.cat, volume: d.peso });
      }
    }

    const out: GrupoObra[] = [];
    for (const [obra, forn] of porObra.entries()) {
      const linhas: LinhaForn[] = [];
      let totAferido = 0, totNf = 0, totValor = 0, totQtd = 0, totDiff = 0, totTemNf = false;
      let totTolSoma = 0, totTolQtd = 0;
      for (const [, b] of forn.entries()) {
        const emissor = b.emissor;
        const predominante = Array.from(b.catVol.values()).sort((a, z) => z.volume - a.volume)[0]?.cat ?? null;
        const tolRes = tolerarConjunto(b.pesagens, tolPorPesagem);
        const tol = tolRes.pct;
        // Média simples das tolerâncias apuradas em cada nota deste fornecedor.
        let tolSoma = 0, tolQtd = 0;
        for (const p of b.pesagens) {
          const t = tolPorPesagem.get(p.id)?.pct;
          if (t != null && Number.isFinite(t)) { tolSoma += t; tolQtd += 1; }
        }
        totTolSoma += tolSoma;
        totTolQtd += tolQtd;
        const pct = b.temNf && b.pesoNf > 0 ? ((b.aferido - b.pesoNf) / b.pesoNf) * 100 : null;
        const diff = b.temNf ? b.aferido - b.pesoNf : 0;
        const toleranciaMedia = tolQtd > 0 ? tolSoma / tolQtd : null;
        linhas.push({
          emissor,
          qtd: b.qtd,
          aferido: b.aferido,
          temNf: b.temNf,
          pesoNf: b.pesoNf,
          valorNf: b.valorNf,
          diff,
          pct,
          situacao: situacaoFechamento(pct, toleranciaMedia),
          categoriaPredominante: predominante,
          tolerancia: tol,
          tolMin: tolRes.min,
          tolMax: tolRes.max,
          tolOrigem: tolRes.origem,
          toleranciaMedia,
          pesagens: b.pesagens.slice().sort((x, z) =>
            new Date(z.saiu_em ?? z.created_at).getTime() - new Date(x.saiu_em ?? x.created_at).getTime()),
        });

        totAferido += b.aferido;
        totNf += b.pesoNf;
        totValor += b.valorNf;
        totQtd += b.qtd;
        totDiff += diff;
        if (b.temNf) totTemNf = true;
      }
      linhas.sort((a, z) => z.aferido - a.aferido);
      out.push({
        obra, fornecedores: linhas,
        totAferido, totNf, totValorNf: totValor, totQtd, totDiff, totTemNf,
        totTolSoma, totTolQtd,
      });
    }
    out.sort((a, z) => z.totAferido - a.totAferido);
    return out;
  }, [filtradas, categorias, tolPorPesagem, mapaContratantes, mapaFornecedores, resolverDensPor]);

  // Média geral das tolerâncias apuradas (todas as notas do período/obras exibidas).
  const tolMediaGeral = useMemo(() => {
    let soma = 0, qtd = 0;
    for (const g of grupos) { soma += g.totTolSoma; qtd += g.totTolQtd; }
    return qtd > 0 ? soma / qtd : null;
  }, [grupos]);



  // KPIs globais.
  const kpis = useMemo(() => {
    const fornecedores = new Set<string>();
    let totalAferido = 0, totalNf = 0, totalValor = 0, semParam = 0, totalPes = 0;
    let temNf = false;
    let tolPonderada = 0, volComNf = 0;
    for (const g of grupos) {
      for (const f of g.fornecedores) {
        fornecedores.add(f.emissor);
        totalPes += f.qtd;
        totalAferido += f.aferido;
        totalValor += f.valorNf;
        if (f.temNf) {
          totalNf += f.pesoNf;
          temNf = true;
          const tol = f.tolerancia;
          tolPonderada += tol * f.aferido;
          volComNf += f.aferido;
        } else {
          semParam += f.qtd;
        }
      }
    }
    const pct = temNf && totalNf > 0 ? ((totalAferido - totalNf) / totalNf) * 100 : null;
    const tolMedia = volComNf > 0 ? tolPonderada / volComNf : 3;
    return {
      totalPes, fornecedores: fornecedores.size,
      totalAferido, totalNf, totalValor,
      diffKg: temNf ? totalAferido - totalNf : 0,
      pct, tolMedia, semParam,
    };
  }, [grupos]);

  // Dados dos gráficos.
  const porObraPie = useMemo(() =>
    grupos.map((g) => ({ nome: g.obra, peso: g.totAferido })), [grupos]);

  const rankingForn = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of grupos) for (const f of g.fornecedores) {
      m.set(f.emissor, (m.get(f.emissor) ?? 0) + f.aferido);
    }
    return Array.from(m.entries())
      .map(([nome, peso]) => ({ nome, peso, pesoT: peso / 1000 }))
      .sort((a, z) => z.peso - a.peso)
      .slice(0, 15);
  }, [grupos]);

  // Ranking de diferenças: agrega por fornecedor (soma obras do período), exclui "sem parâmetro".
  const rankingDiferencas = useMemo<RankingItem[]>(() => {
    const map = new Map<string, {
      emissor: string;
      rec: number; af: number; nf: number; nfc: number; valorNfComPeso: number;
      obras: Set<string>;
      catVol: Map<string, { cat: Categoria; volume: number }>;
      pesagens: PesagemComEvidencias[];
    }>();
    for (const p of filtradas) {
      const emissorChave = chaveFornecedor(p.emissor);
      const emissor = rotuloFornecedor(p.emissor, mapaFornecedores);
      const obra = rotuloContratante(p.contratante, mapaContratantes);
      const liq = Number(p.peso_liquido ?? 0);
      const nf = pesoNfReferencia(p, resolverDensPor(p.emissor)).kg;
      const valor = p.valor_total_nf != null ? Number(p.valor_total_nf) : 0;

      const itens = ((p as unknown as { itens_nf?: Array<{ descricao?: string; quantidade?: number }> | null }).itens_nf ?? [])
        .filter((i) => (i.descricao ?? "").trim() !== "");
      const dists: Array<{ cat: Categoria; peso: number }> = [];
      if (itens.length > 0) {
        const qtds = itens.map((i) => Number(i.quantidade ?? 0));
        const soma = qtds.reduce((a, b) => a + b, 0);
        itens.forEach((it, idx) => {
          const share = soma > 0 ? qtds[idx] / soma : 1 / itens.length;
          dists.push({ cat: categorizar(it.descricao ?? "", categorias), peso: liq * share });
        });
      } else {
        dists.push({ cat: categorizar(p.descricao ?? "", categorias), peso: liq });
      }

      let cur = map.get(emissorChave);
      if (!cur) {
        cur = { emissor, rec: 0, af: 0, nf: 0, nfc: 0, valorNfComPeso: 0, obras: new Set(), catVol: new Map(), pesagens: [] };
        map.set(emissorChave, cur);
      }
      cur.emissor = emissor;
      cur.rec += 1;
      cur.af += liq;
      cur.obras.add(obra);
      cur.pesagens.push(p);
      if (nf != null && nf > 0) {
        cur.nf += nf;
        cur.nfc += 1;
        cur.valorNfComPeso += valor;
      }
      for (const d of dists) {
        const c = cur.catVol.get(d.cat.id);
        if (c) c.volume += d.peso;
        else cur.catVol.set(d.cat.id, { cat: d.cat, volume: d.peso });
      }
    }
    const out: RankingItem[] = [];
    for (const [, v] of map.entries()) {
      const emissor = v.emissor;
      if (v.nfc === 0) continue;
      const categoria = Array.from(v.catVol.values()).sort((a, z) => z.volume - a.volume)[0]?.cat ?? null;
      const tolRes = tolerarConjunto(v.pesagens, tolPorPesagem);
      const dif = v.af - v.nf;
      const difPct = v.nf > 0 ? (dif / v.nf) * 100 : null;
      const impactoRS = v.nf > 0 ? v.valorNfComPeso * (dif / v.nf) : null;
      out.push({
        emissor, rec: v.rec, af: v.af, nf: v.nf, nfc: v.nfc,
        valorNfComPeso: v.valorNfComPeso,
        obras: Array.from(v.obras).sort((a, z) => a.localeCompare(z, "pt-BR")),
        categoria, dif, difPct, impactoRS,
        tolerancia: tolRes.pct,
        tolMin: tolRes.min,
        tolMax: tolRes.max,
        tolOrigem: tolRes.origem,
        situacao: situacaoFechamento(difPct, tolRes.pct),
      });
    }
    return out;
  }, [filtradas, categorias, tolPorPesagem, mapaContratantes, mapaFornecedores, resolverDensPor]);


  // Impacto R$ só é considerado para fornecedores acima da tolerância.
  const impactoVisivel = (r: RankingItem) =>
    r.situacao === "acima_da_tolerancia" ? (r.impactoRS ?? null) : null;

  const rankingOrdenado = useMemo(() => {
    const chave = (r: RankingItem) =>
      metrica === "kg" ? Math.abs(r.dif)
      : metrica === "pct" ? Math.abs(r.difPct ?? 0)
      : r.situacao === "acima_da_tolerancia" ? Math.abs(r.impactoRS ?? 0) : 0;
    return [...rankingDiferencas].sort((a, z) => chave(z) - chave(a));
  }, [rankingDiferencas, metrica]);


  const exportarCSV = () => {
    const rows: string[][] = [];
    rows.push([`Fechamento Mensal — ${monthLabel(competencia)}`]);
    rows.push([]);
    rows.push(["Obra", "Fornecedor", "Recebimentos", "Aferido (kg)", "Peso NF (kg)", "Valor NF (R$)", "Diferença (kg)", "% Dif Médio", "% Tolerância Médio", "Impacto (R$)", "Situação"]);
    for (const g of grupos) {
      for (const f of g.fornecedores) {
        rows.push([
          g.obra,
          f.emissor,
          String(f.qtd),
          f.aferido.toFixed(3),
          f.temNf ? f.pesoNf.toFixed(3) : "",
          f.valorNf.toFixed(2),
          f.temNf ? f.diff.toFixed(3) : "",
          f.pct != null ? f.pct.toFixed(2) : "",
          f.toleranciaMedia != null ? f.toleranciaMedia.toFixed(2) : "",
          impactoLinha(f) != null ? impactoLinha(f)!.toFixed(2) : "",
          rotuloSituacao(f.situacao),
        ]);
      }
      rows.push([`SUBTOTAL — ${g.obra}`, "", String(g.totQtd), g.totAferido.toFixed(3),
        g.totTemNf ? g.totNf.toFixed(3) : "", g.totValorNf.toFixed(2), g.totTemNf ? g.totDiff.toFixed(3) : "",
        "", g.totTolQtd > 0 ? (g.totTolSoma / g.totTolQtd).toFixed(2) : "",
        somaImpacto(g.fornecedores).toFixed(2), ""]);
      rows.push([]);
    }
    rows.push(["TOTAL GERAL", "", String(kpis.totalPes),
      kpis.totalAferido.toFixed(3), kpis.totalNf.toFixed(3),
      kpis.totalValor.toFixed(2),
      kpis.diffKg.toFixed(3), kpis.pct != null ? kpis.pct.toFixed(2) : "",
      tolMediaGeral != null ? tolMediaGeral.toFixed(2) : "",
      grupos.reduce((s, g) => s + somaImpacto(g.fornecedores), 0).toFixed(2), ""]);


    // Ranking de diferenças (exclui "sem parâmetro").
    const metricaLabel = metrica === "kg" ? "kg" : metrica === "pct" ? "%" : "R$";
    rows.push([]);
    rows.push([`Ranking de diferenças (métrica: ${metricaLabel})`]);
    rows.push(["#", "Fornecedor", "Obra(s)", "Recebimentos", "Aferido (kg)", "Peso NF (kg)", "Valor NF (R$)", "Diferença (kg)", "% Dif Médio", "% Tolerância Médio", "Impacto (R$)", "Situação"]);
    rankingOrdenado.forEach((r, i) => {
      rows.push([
        String(i + 1),
        r.emissor,
        r.obras.join(" | "),
        String(r.rec),
        r.af.toFixed(3),
        r.nf.toFixed(3),
        r.valorNfComPeso ? r.valorNfComPeso.toFixed(2) : "",
        r.dif.toFixed(3),
        r.difPct != null ? r.difPct.toFixed(2) : "",
        r.tolerancia != null ? r.tolerancia.toFixed(2) : "",
        impactoVisivel(r) != null ? impactoVisivel(r)!.toFixed(2) : "",

        rotuloSituacao(r.situacao),
      ]);
    });
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fechamento-mensal-${competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const corDif = kpis.pct == null
    ? "text-foreground"
    : Math.abs(kpis.pct) <= kpis.tolMedia
      ? "text-success"
      : kpis.pct < 0 ? "text-destructive" : "text-warning";

  return (
    <div className="flex flex-col gap-4">
      {/* Controles */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label>Competência</Label>
            <Select value={competencia} onValueChange={setCompetencia}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(mesesDisponiveis.length > 0 ? mesesDisponiveis : [mesAtualStr]).map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Obra</Label>
            <Select value={obraFiltro} onValueChange={setObraFiltro}>
              <SelectTrigger className="w-full sm:w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as obras</SelectItem>
                {obrasDisponiveis.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <Button
              onClick={exportarCSV}
              disabled={grupos.length === 0}
              className="bg-success text-white hover:bg-success/90"
            >
              <Download className="mr-2 h-4 w-4" /> Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {grupos.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma pesagem concluída para os filtros selecionados.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi icon={Package} label="Recebimentos" value={`${kpis.totalPes}`} sub={`${kpis.fornecedores} fornecedor(es)`} />
            <Kpi icon={Scale} label="Peso recebido" value={fmtT(kpis.totalAferido)} sub={`${kpis.totalAferido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`} />
            <Kpi icon={FileText} label="Valor NF total" value={fmtBRL(kpis.totalValor)} />
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Divergência</span>
                  {kpis.pct != null && (kpis.pct < 0 ? <ArrowDown className="h-4 w-4 text-destructive" /> : <ArrowUp className="h-4 w-4 text-warning" />)}
                </div>
                <div className={`mt-1 text-xl font-semibold tabular-nums ${corDif}`}>
                  {kpis.pct == null ? "—" : fmtPct(kpis.pct)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {kpis.pct == null ? "sem peso na NF" : `${fmtKgSigned(kpis.diffKg)} · tol. média ±${fmtPct(kpis.tolMedia)}`}
                </div>
              </CardContent>
            </Card>
            <Kpi icon={AlertTriangle} label="Sem parâmetro" value={String(kpis.semParam)} sub="pesagens sem peso na NF" />
          </div>

          {/* Gráficos */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Recebido por obra (t)</CardTitle></CardHeader>
              <CardContent style={{ height: 340 }}>
                <ResponsiveContainer>
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={porObraPie}
                      dataKey="peso"
                      nameKey="nome"
                      cx="50%"
                      cy="42%"
                      outerRadius={80}
                      innerRadius={0}
                      label={false}
                      labelLine={false}
                      isAnimationActive={false}
                    >
                      {porObraPie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const p = payload[0];
                      const nome = p?.name as string;
                      const peso = Number(p?.value ?? 0);
                      const percent = Number(p?.payload?.percent ?? 0);
                      return (
                        <div className="rounded-md border bg-card px-3 py-2 shadow-sm text-xs">
                          <div className="font-semibold text-foreground mb-1">{nome}</div>
                          <div className="text-foreground">{fmtT(peso)}</div>
                          <div className="text-muted-foreground">{fmtPct(percent)} do total</div>
                        </div>
                      );
                    }} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      layout="horizontal"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, lineHeight: "14px", paddingTop: 8 }}
                      formatter={(value: string) => (
                        <span style={{ color: "var(--foreground)", fontSize: 10 }} title={value}>
                          {value.length > 28 ? `${value.slice(0, 28)}…` : value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Ranking de fornecedores por volume (t)</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={rankingForn} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${Number(v).toFixed(1)}t`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => fmtT(Number(v) * 1000)} />
                    <Bar dataKey="pesoT" radius={[0, 6, 6, 0]}>
                      {rankingForn.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Ranking de diferenças</CardTitle>
                <div className="inline-flex rounded-md border border-success/30 bg-success-soft/40 p-0.5 text-xs">
                  {([
                    { k: "pct", label: "Por %" },
                    { k: "rs", label: "Por impacto (R$)" },
                    { k: "kg", label: "Por peso (kg)" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.k}
                      type="button"
                      onClick={() => setMetrica(opt.k)}
                      className={`rounded px-2.5 py-1 font-medium transition ${
                        metrica === opt.k
                          ? "bg-success text-white shadow-sm"
                          : "text-success hover:bg-success-soft"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {rankingOrdenado.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Nenhum fornecedor com peso declarado na NF.
                </div>
              ) : (
                <>
                  <div style={{ height: Math.max(200, Math.min(700, rankingOrdenado.length * 46)) }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={rankingOrdenado.map((r) => ({
                          nome: r.emissor,
                          valor:
                            metrica === "kg" ? r.dif
                            : metrica === "pct" ? (r.difPct ?? 0)
                            : (impactoVisivel(r) ?? 0),
                        }))}
                        layout="vertical"
                        margin={{ left: 60, right: 24, top: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => {
                            const n = Number(v);
                            if (metrica === "kg") return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}t`;
                            if (metrica === "pct") return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
                            return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
                          }}
                        />
                        <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(v) => {
                            const n = Number(v);
                            if (metrica === "kg") return fmtKgSigned(n);
                            if (metrica === "pct") return fmtPct(n);
                            return fmtBRL(n);
                          }}
                        />
                        <ReferenceLine x={0} stroke="var(--muted-foreground)" />
                        <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                          {rankingOrdenado.map((r, i) => {
                            const v =
                              metrica === "kg" ? r.dif
                              : metrica === "pct" ? (r.difPct ?? 0)
                              : (impactoVisivel(r) ?? 0);
                            return <Cell key={i} fill={v < 0 ? COR_NEG : COR_POS} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1200px] text-xs">
                      <thead className="border-b bg-muted/50 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Fornecedor</th>
                          <th className="px-3 py-2 font-medium">Obra(s)</th>
                          <th className="px-3 py-2 font-medium text-center">Receb.</th>
                          <th className="px-3 py-2 font-medium text-right">Aferido</th>
                          <th className="px-3 py-2 font-medium text-right">Peso NF</th>
                          <th className="px-3 py-2 font-medium text-right">Valor NF</th>
                          <th className="px-3 py-2 font-medium text-right">Diferença</th>
                          <th className="px-3 py-2 font-medium text-right">% Dif Médio</th>
                          <th className="px-3 py-2 font-medium text-right">% Tolerância Médio</th>
                          <th className="px-3 py-2 font-medium text-right">Impacto R$</th>
                          <th className="px-3 py-2 font-medium text-center">Situação</th>
                        </tr>
                      </thead>

                      <tbody>
                        {rankingOrdenado.map((r, i) => {
                          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
                          const obrasStr = r.obras.length <= 1
                            ? (r.obras[0] ?? "—")
                            : `${r.obras[0]} +${r.obras.length - 1}`;
                          return (
                            <tr key={r.emissor} className={`border-b hover:bg-muted/30 ${i < 3 ? "bg-destructive/40" : ""}`}>
                              <td className="px-3 py-2 font-semibold tabular-nums">{medal}</td>
                              <td className="px-3 py-2 font-medium">{r.emissor}</td>
                              <td className="px-3 py-2" title={r.obras.join(" · ")}>{obrasStr}</td>
                              <td className="px-3 py-2 text-center tabular-nums">{r.rec}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-success whitespace-nowrap">{fmtT(r.af)}</td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                {r.nf > 0 ? fmtT(r.nf) : <span className="text-muted-foreground">— sem peso —</span>}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                {r.valorNfComPeso > 0 ? fmtBRL(r.valorNfComPeso) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className={`px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap ${r.dif < 0 ? "text-destructive" : "text-success"}`}>
                                {fmtKgSigned(r.dif)}
                              </td>
                              <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${(() => {
                                const { colorClass } = indicadorPctRanking(r.situacao);
                                return colorClass;
                              })()}`}>
                                {r.difPct == null ? "—" : (
                                  (() => {
                                    const { Icon, colorClass } = indicadorPctRanking(r.situacao);
                                    return (
                                      <span className={`inline-flex items-center gap-1 ${colorClass}`}>
                                        {colorClass && <Icon className={`h-3 w-3 ${colorClass}`} />}
                                        {fmtPct(r.difPct)}
                                      </span>
                                    );
                                  })()
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                {fmtTolMedia(r.tolerancia)}
                              </td>
                              <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${(impactoVisivel(r) ?? 0) < 0 ? "text-destructive" : ""}`}>
                                {impactoVisivel(r) == null ? "—" : fmtBRL(impactoVisivel(r)!)}
                              </td>
                              <td className="px-3 py-2 text-center">{badgeSituacao(r.situacao)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 bg-muted/40">
                        <tr className="font-semibold">
                          <td className="px-3 py-2" colSpan={6}>Total geral</td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            {fmtBRL(rankingOrdenado.reduce((s, r) => s + (r.valorNfComPeso ?? 0), 0))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            {fmtKgSigned(rankingOrdenado.reduce((s, r) => s + (r.dif ?? 0), 0))}
                          </td>
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />

                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-destructive">
                            {fmtBRL(rankingOrdenado.reduce((s, r) => s + (impactoVisivel(r) ?? 0), 0))}
                          </td>
                          <td className="px-3 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Situação no ranking apurada pela tolerância média do fornecedor: com carta de traço, a tolerância é a do
                    cadastro da carta; sem carta, vale o cadastro do fornecedor ou a tabela padrão da categoria.
                    Quando o desvio absoluto supera a tolerância média, exibe "Acima da Tolerância".
                    Impacto R$ = valor da NF × (diferença ÷ peso NF).
                  </p>

                </>
              )}
            </CardContent>
          </Card>


          {/* Tabela de fechamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fechamento por obra × fornecedor</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[1160px] text-xs">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fornecedor</th>
                    <th className="px-3 py-2 font-medium text-center">Receb.</th>
                    <th className="px-3 py-2 font-medium text-right">Aferido</th>
                    <th className="px-3 py-2 font-medium text-right">Peso NF</th>
                    <th className="px-3 py-2 font-medium text-right">Valor NF</th>
                    <th className="px-3 py-2 font-medium text-right">Diferença</th>
                    <th className="px-3 py-2 font-medium text-right">% Dif Médio</th>
                    <th className="px-3 py-2 font-medium text-right">% Tolerância Médio</th>
                    <th className="px-3 py-2 font-medium text-right">Impacto R$</th>
                    <th className="px-3 py-2 font-medium text-center">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <FragmentObra key={g.obra} g={g} onSelecionar={(l) => setNotasSel({ obra: g.obra, linha: l })} />
                  ))}
                  <tr className="border-t-2 border-success bg-success-soft font-semibold">
                    <td className="px-3 py-2">TOTAL GERAL</td>
                    <td className="px-3 py-2 text-center tabular-nums">{kpis.totalPes}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">{fmtT(kpis.totalAferido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{kpis.totalNf > 0 ? fmtT(kpis.totalNf) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(kpis.totalValor)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${kpis.diffKg < 0 ? "text-destructive" : "text-success"}`}>
                      {kpis.totalNf > 0 ? fmtKgSigned(kpis.diffKg) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">
                      {kpis.pct == null ? "—" : (
                        <span className="inline-flex items-center gap-1">
                          <ArrowUp className="h-3 w-3 text-destructive" />
                          {fmtPct(kpis.pct)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtTolMedia(tolMediaGeral)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">
                      {fmtBRL(grupos.reduce((s, g) => s + somaImpacto(g.fornecedores), 0))}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

        </>
      )}

      <NotasFornecedorDialog
        sel={notasSel}
        tolPorPesagem={tolPorPesagem}
        onClose={() => setNotasSel(null)}
        onDetalhar={(p, tol) =>
          setDetalheNf(
            montarLinhaEstratificacao(
              p,
              tol,
              mapaFornecedores,
              resolverDensPor(p.emissor),
              p.traco_id ? (densPorTraco.get(String(p.traco_id)) ?? null) : null,
            ),
          )
        }
      />
      <EstratificacaoDialog
        linha={detalheNf}
        onClose={() => setDetalheNf(null)}
        toleranciaPct={
          (detalheNf ? tolPorPesagem.get(detalheNf.id)?.pct : undefined) ?? notasSel?.linha.tolerancia ?? TOL_FALLBACK
        }

        abrirEdicao={abrirEdicaoGlobal}
      />
    </div>
  );
}

function NotasFornecedorDialog({
  sel, tolPorPesagem, onClose, onDetalhar,
}: {
  sel: { obra: string; linha: LinhaForn } | null;
  tolPorPesagem: MapaTolerancias;
  onClose: () => void;
  onDetalhar: (p: PesagemComEvidencias, tolerancia: number) => void;
}) {
  const resolverDensPor = useResolvedorDensidadePorFornecedor();
  const linha = sel?.linha;

  const notas = useMemo(() => {
    if (!linha) return [];
    return linha.pesagens.map((p) => {
      const liq = Number(p.peso_liquido ?? 0);
      const nf = pesoNfReferencia(p, resolverDensPor(p.emissor)).kg ?? 0;
      const dif = nf > 0 ? liq - nf : 0;
      const pct = nf > 0 ? (dif / nf) * 100 : null;
      const tolRes = tolPorPesagem.get(p.id);
      const tol = tolRes?.pct ?? linha.tolerancia;
      return {
        p,
        dataFmt: new Date(p.saiu_em ?? p.created_at).toLocaleDateString("pt-BR"),
        numero: p.numero_nota ?? "—",
        placa: p.placa ?? "—",
        produto: (p.descricao ?? "").trim() || "—",
        liq, nf, dif, pct,
        tol,
        tolOrigem: tolRes?.origem ?? "geral",
        situacao: situacaoDe(pct, tol),
      };
    });
  }, [linha, tolPorPesagem, resolverDensPor]);

  if (!sel || !linha) return null;

  const exportar = () => {
    const header = ["Data", "NF", "Placa", "Produto", "Aferido (kg)", "Peso NF (kg)", "Diferença (kg)", "%", "Tolerância %", "Origem da tolerância", "Situação"];
    const rows = notas.map((n) => [
      n.dataFmt, String(n.numero), n.placa, n.produto,
      n.liq.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
      n.nf > 0 ? n.nf.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "",
      n.nf > 0 ? n.dif.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "",
      n.pct == null ? "" : fmtPct(n.pct),
      n.tol.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
      rotuloOrigem(n.tolOrigem),
      n.situacao,
    ]);

    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas-${sel.obra}-${linha.emissor}`.replace(/\W+/g, "_") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Notas fiscais — <span className="text-success">{linha.emissor}</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">· {sel.obra} · {linha.qtd} recebimento(s)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-success-soft/60 p-3">
            <div className="text-[11px] uppercase tracking-wide text-success/70">Aferido total</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-success">{fmtT(linha.aferido)}</div>
          </div>
          <div className="rounded-lg border bg-muted p-3">
            <div className="text-[11px] uppercase tracking-wide text-foreground">Peso NF total</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{linha.temNf ? fmtT(linha.pesoNf) : "—"}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Valor NF {fmtBRL(linha.valorNf)}</div>
          </div>
          <div className={`rounded-lg border p-3 ${linha.situacao === "ok" ? "bg-success-soft" : linha.situacao === "abaixo" || linha.situacao === "acima_da_tolerancia" ? "bg-destructive/10" : linha.situacao === "acima" ? "bg-warning-soft" : "bg-muted"}`}>
            <div className="text-[11px] uppercase tracking-wide opacity-80">Diferença</div>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums">
              {linha.temNf ? fmtKgSigned(linha.diff) : "—"}
              {linha.pct != null && badgeSituacao(linha.situacao)}
            </div>
            <div className="mt-0.5 text-[11px] opacity-70">
              {linha.pct == null
                ? "Sem parâmetro"
                : `${fmtPct(linha.pct)} · tolerância ${fmtTolFaixa({ pct: linha.tolerancia, min: linha.tolMin, max: linha.tolMax })}`}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-60">
              {rotuloOrigem(linha.tolOrigem)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                {["Data", "NF", "Placa", "Produto", "Aferido", "Peso NF", "Diferença", "%", "Tolerância", "Situação", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr
                  key={n.p.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-success-soft/50"
                  onClick={() => onDetalhar(n.p, n.tol)}
                >
                  <td className="whitespace-nowrap px-3 py-2">{n.dataFmt}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{n.numero}</td>
                  <td className="whitespace-nowrap px-3 py-2">{n.placa}</td>
                  <td className="px-3 py-2">{n.produto}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-success">{fmtT(n.liq)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{n.nf > 0 ? fmtT(n.nf) : "—"}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${n.nf > 0 && n.dif < 0 ? "text-destructive" : n.nf > 0 ? "text-success" : ""}`}>
                    {n.nf > 0 ? fmtKgSigned(n.dif) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{n.pct == null ? "—" : fmtPct(n.pct)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    ±{n.tol.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                    <span className="ml-1 block text-[10px] leading-tight text-muted-foreground">{rotuloOrigem(n.tolOrigem)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center">{badgeSituacao(n.situacao)}</td>

                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                      Detalhar <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/40 text-[12px] font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={4}>Totais</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-success">{fmtT(linha.aferido)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{linha.temNf ? fmtT(linha.pesoNf) : "—"}</td>
                <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${linha.temNf && linha.diff < 0 ? "text-destructive" : "text-success"}`}>
                  {linha.temNf ? fmtKgSigned(linha.diff) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{linha.pct == null ? "—" : fmtPct(linha.pct)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            Clique em uma nota para abrir a estratificação (itens, rateio e memória de cálculo).
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportar} disabled={notas.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Média simples das tolerâncias apuradas, no formato ±X,XX%. */
function fmtTolMedia(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return <span className="text-muted-foreground">—</span>;
  return <>±{v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</>;
}

function FragmentObra({ g, onSelecionar }: { g: GrupoObra; onSelecionar: (l: LinhaForn) => void }) {
  return (
    <>
      <tr className="bg-success-soft/70">
        <td colSpan={10} className="px-3 py-2 text-[13px] font-semibold text-success">
          <Users className="mr-1 inline h-3.5 w-3.5" />
          {g.obra}
        </td>
      </tr>
      {g.fornecedores.map((f) => (
        <tr
          key={f.emissor}
          className="cursor-pointer border-b hover:bg-success-soft/60"
          onClick={() => onSelecionar(f)}
          title="Ver notas fiscais deste recebimento"
        >
          <td className="px-3 py-2 font-medium">
            <span className="inline-flex items-center gap-1">
              {f.emissor}
              <ChevronRight className="h-3.5 w-3.5 text-success opacity-70" />
            </span>
          </td>
          <td className="px-3 py-2 text-center tabular-nums">{f.qtd}</td>
          <td className="px-3 py-2 text-right tabular-nums font-semibold text-success whitespace-nowrap">{fmtT(f.aferido)}</td>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
            {f.temNf ? fmtT(f.pesoNf) : <span className="text-muted-foreground">— sem peso —</span>}
          </td>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
            {f.valorNf > 0 ? fmtBRL(f.valorNf) : <span className="text-muted-foreground">—</span>}
          </td>
          <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${f.temNf && f.diff < 0 ? "text-destructive font-medium" : f.temNf ? "text-success" : ""}`}>
            {f.temNf ? fmtKgSigned(f.diff) : "—"}
          </td>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
            {f.pct == null ? "—" : (() => {
              const { Icon, colorClass } = indicadorPctRanking(f.situacao);
              return (
                <span className={`inline-flex items-center gap-1 ${colorClass}`}>
                  {colorClass && <Icon className={`h-3 w-3 ${colorClass}`} />}
                  {fmtPct(f.pct)}
                </span>
              );
            })()}
          </td>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtTolMedia(f.toleranciaMedia)}</td>
          <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${(impactoLinha(f) ?? 0) < 0 ? "text-destructive" : ""}`}>
            {impactoLinha(f) == null ? "—" : fmtBRL(impactoLinha(f)!)}
          </td>
          <td className="px-3 py-2 text-center">{badgeSituacao(f.situacao)}</td>
        </tr>
      ))}
      <tr className="border-b bg-muted/40 text-[12px] font-semibold">
        <td className="px-3 py-2">Subtotal — {g.obra}</td>
        <td className="px-3 py-2 text-center tabular-nums">{g.totQtd}</td>
        <td className="px-3 py-2 text-right tabular-nums text-success">{fmtT(g.totAferido)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{g.totTemNf ? fmtT(g.totNf) : "—"}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(g.totValorNf)}</td>
        <td className={`px-3 py-2 text-right tabular-nums ${g.totTemNf && g.totDiff < 0 ? "text-destructive" : "text-success"}`}>
          {g.totTemNf ? fmtKgSigned(g.totDiff) : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-destructive">
          {g.totTemNf && g.totNf > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="h-3 w-3 text-destructive" />
              {fmtPct(((g.totAferido - g.totNf) / g.totNf) * 100)}
            </span>
          ) : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtTolMedia(g.totTolQtd > 0 ? g.totTolSoma / g.totTolQtd : null)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-destructive">
          {fmtBRL(somaImpacto(g.fornecedores))}
        </td>
        <td />
      </tr>

    </>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Package; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
