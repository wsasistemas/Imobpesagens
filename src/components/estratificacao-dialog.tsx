import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FileSpreadsheet, PackageOpen, Eye, Calculator, RefreshCw, AlertTriangle, Wand2, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { PesagemComEvidencias } from "@/lib/pesagem-store";
import { signedUrlsQueryOptions } from "@/lib/pesagem-queries";
import { useDensidades, criarResolvedorDensidade } from "@/lib/densidades";
import { pesoNfReferencia, calcularPesoItem, prepararItensNfParaCalculo, detectarUnidadesSuspeitas, aplicarUnidadesCorrigidas, type ResolvedorDensidade } from "@/lib/unidades";
import { corrigirItensNf } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/useAuth";
import { chaveFornecedor, type FornecedorGrupo } from "@/lib/fornecedor";
import { useToleranciasPadrao, useGerenciamentoFornecedores, useOverridesFornecedor, resolverToleranciaDaPesagem } from "@/lib/tolerancias-heranca";
import { categorizar } from "@/lib/tolerancias-material";
import { getFornecedoresConcreto } from "@/lib/concreto.functions";

export type SituacaoEstratificacao = "ok" | "abaixo";

export type LinhaEstratificacao = {
  id: string;
  data: string;
  dataFmt: string;
  fornecedor: string;
  /** Chave canônica usada para unificar grafias diferentes do mesmo emissor. */
  fornecedorChave: string;
  /** Grafias originais encontradas para este fornecedor. */
  fornecedorVariantes: string[];
  produto: string;
  entrada: number;
  saida: number;
  liquido: number;
  nf: number;
  nfOrigem: "carta_traco" | "calculado" | "nf" | "nenhum";
  /** Tolerância (%) efetivamente aplicada nesta linha. */
  tolLinha: number;

  nfParcial: boolean;
  difKg: number;
  difPct: number;
  situacao: SituacaoEstratificacao;
  pesagem: PesagemComEvidencias;
};

export type ItemLinha = {
  descricao: string;
  quantidade: number;
  unidade: string;
  pesoKg: number | null;
  estimado: boolean;
  motivo?: string;
  origemDensidade?: string;
  fornecedorDensidade?: string;
  valor_unitario: number;
  valor_total: number;
  participacao: number;
  rateado: number;
  difItem: number;
};


export const fmtTon = (kg: number) =>
  `${(kg / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`;
export const fmtPct = (n: number) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const fmtKgSigned = (kg: number) => {
  const sign = kg > 0 ? "+" : kg < 0 ? "−" : "";
  const abs = Math.abs(kg);
  if (abs >= 1000) return `${sign}${(abs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
  return `${sign}${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`;
};

/** Monta a linha de estratificação a partir de uma pesagem. */
export function montarLinhaEstratificacao(
  p: PesagemComEvidencias,
  toleranciaPct: number,
  mapaFornecedores?: Map<string, FornecedorGrupo>,
  /** Resolvedor do cadastro de Densidades, para o Declarado NF bater com a memória de cálculo. */
  resolverDens?: ResolvedorDensidade,
  densidadeCarta?: number | null,
): LinhaEstratificacao {
  const entrada = Number(p.peso_entrada ?? 0);
  const saida = Number(p.peso_saida ?? 0);
  const liquido = p.peso_liquido != null ? Number(p.peso_liquido) : Math.max(0, entrada - saida);
  const ref = pesoNfReferencia(p, resolverDens, densidadeCarta);
  const nf = ref.kg ?? 0;
  const difKg = liquido - nf;
  const difPct = nf > 0 ? (difKg / nf) * 100 : 0;
  // Quando a base é a carta de traço, a tolerância da carta prevalece.
  const tolLinha = ref.origem === "carta_traco" && ref.tol != null ? ref.tol : toleranciaPct;
  // Sobra nunca é penalizada: somente déficit fora da tolerância vira alerta.
  const situacao: SituacaoEstratificacao =
    nf <= 0 || difKg >= 0 || Math.abs(difPct) <= tolLinha
      ? "ok"
      : "abaixo";
  const dataRef = p.saiu_em ?? p.created_at;
  const nomeEmissor = (p.emissor ?? "").trim() || "Sem emissor";
  const chave = chaveFornecedor(nomeEmissor);
  const grupo = mapaFornecedores?.get(chave);
  return {
    id: p.id,
    data: dataRef,
    dataFmt: new Date(dataRef).toLocaleDateString("pt-BR"),
    fornecedor: grupo?.rotulo ?? nomeEmissor,
    fornecedorChave: chave,
    fornecedorVariantes: grupo?.variantes ?? [nomeEmissor],
    produto: p.descricao ?? "—",
    entrada, saida, liquido, nf,
    nfOrigem: ref.origem, nfParcial: ref.parcial, tolLinha,
    difKg, difPct, situacao,
    pesagem: p,
  };

}

const fmtQtd = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export const abrirEdicaoGlobal = (p: PesagemComEvidencias) => {
  // A tela de Pesagem hospeda o modal de edição. Se ela não estiver montada
  // (ex.: usuário no Dashboard), navega para lá já abrindo o registro.
  const ev = new CustomEvent("abrir-edicao-pesagem", { detail: p, cancelable: true });
  window.dispatchEvent(ev);
  if (!ev.defaultPrevented) {
    window.location.assign(`/pesagem?editar=${encodeURIComponent(p.id)}`);
  }
};

export function EstratificacaoDialog({
  linha, onClose, toleranciaPct, abrirEdicao,
}: { linha: LinhaEstratificacao | null; onClose: () => void; toleranciaPct: number; abrirEdicao?: (p: PesagemComEvidencias) => void }) {
  const open = linha !== null;
  const [memoriaOpen, setMemoriaOpen] = useState(false);

  const { materiais: densMateriais, excecoes: densExcecoes } = useDensidades();

  // Carta de traço vinculada ao registro (fornecedor + traço + densidade oficial).
  const getFornConcretoFn = useServerFn(getFornecedoresConcreto);
  const { data: fornConcreto = [] } = useQuery({
    queryKey: ["fornecedores_concreto"],
    queryFn: () => getFornConcretoFn({ data: undefined } as never),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const carta = useMemo(() => {
    const tracoId = linha?.pesagem.traco_id;
    if (!tracoId) return null;
    for (const f of (fornConcreto as any[]) ?? []) {
      const t = (f?.tracos ?? []).find((x: any) => x?.id === tracoId);
      if (!t) continue;
      const densidade = Number(t.densidade_teorica ?? t.densidade_pratica ?? 0) || null;
      const tol = Number(t.tolerancia_peso ?? f.tolerancia_padrao ?? 0) || null;
      return { fornecedorNome: String(f.nome ?? ""), traco: t, densidade, tol };
    }
    return null;
  }, [fornConcreto, linha]);

  const { categorias } = useToleranciasPadrao();
  const { fornecedores } = useGerenciamentoFornecedores();
  const { overrides } = useOverridesFornecedor();

  const dados = useMemo(() => {
    if (!linha) return { itens: [] as ItemLinha[], itensBase: [] as ReturnType<typeof prepararItensNfParaCalculo>, somaPesoKg: 0, somaValor: 0, parcial: false, estimado: false, diag: null as ReturnType<typeof detectarUnidadesSuspeitas>, tolAplicada: toleranciaPct, tolOrigem: "geral" as string, tolRotulo: "tolerância geral do filtro" };
    const raw = (linha.pesagem.itens_nf ?? []) as Array<{ descricao?: string; quantidade?: number; unidade?: string; valor_unitario?: number }>;
    const itensBase = prepararItensNfParaCalculo(Array.isArray(raw) ? raw : [], linha.pesagem.qtd_total);

    const tolRes = resolverToleranciaDaPesagem(linha.pesagem as any, {
      categorias: categorias as any,
      fornecedores,
      overrides,
      fornecedorNome: linha.fornecedor,
      fallbackPct: toleranciaPct,
      toleranciaCarta: carta?.tol ?? null,
      categorizar: categorizar as any,
    });
    const tolAplicada = tolRes.pct;


    // Prioriza a densidade da carta de traço; cai para a última aferição salva.
    const densidadeTraco = carta?.densidade ?? (linha.pesagem as any).resultado_afericao?.rho ?? null;

    // Mesmo nome bruto do emissor usado pelas grades, para a exceção de densidade bater.
    const resolverDens = criarResolvedorDensidade(densMateriais, densExcecoes, linha.pesagem.emissor ?? linha.fornecedor);
    const calculados = itensBase.map((i) => calcularPesoItem(i, densidadeTraco, resolverDens));
    const somaPesoKg = calculados.reduce((a, c) => a + (c.pesoKg ?? 0), 0);
    const somaValorBase = itensBase.reduce((a, i) => a + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0);
    const itens: ItemLinha[] = itensBase.map((i, idx) => {
      const c = calculados[idx];
      const q = Number(i.quantidade) || 0;
      const vu = Number(i.valor_unitario) || 0;
      const valor_total = q * vu;
      // Rateio pelo peso convertido; se nenhum item converteu, cai para o valor.
      const participacao = somaPesoKg > 0
        ? (c.pesoKg ?? 0) / somaPesoKg
        : somaValorBase > 0 ? valor_total / somaValorBase : 0;
      const rateado = participacao * linha.liquido;
      return {
        descricao: c.descricao || "—",
        quantidade: q,
        unidade: c.unidade || "—",
        pesoKg: c.pesoKg,
        estimado: !!c.estimado,
        motivo: c.motivo,
        origemDensidade: c.origemDensidade,
        fornecedorDensidade: c.fornecedorDensidade,
        valor_unitario: vu,
        valor_total,
        participacao,
        rateado,
        difItem: c.pesoKg != null ? rateado - c.pesoKg : 0,
      };
    });
    const somaValor = itens.reduce((a, i) => a + i.valor_total, 0);
    return {
      itens,
      itensBase,
      somaPesoKg,
      somaValor,
      parcial: calculados.some((c) => c.pesoKg == null),
      estimado: calculados.some((c) => c.estimado),
      diag: detectarUnidadesSuspeitas(itensBase, linha.liquido),
      tolAplicada,
      tolOrigem: tolRes.origem as string,
      tolRotulo: tolRes.rotulo,

    };
  }, [linha, carta, categorias, fornecedores, overrides, toleranciaPct, densMateriais, densExcecoes]);

  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const corrigirFn = useServerFn(corrigirItensNf);
  const suspeitos = useMemo(() => new Set(dados.diag?.indices ?? []), [dados.diag]);

  const recalcularTudo = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["pesagens"], refetchType: "all" }),
      qc.invalidateQueries({ queryKey: ["dashboard"], refetchType: "all" }),
    ]);
    toast.success("Peso da NF recalculado com os dados atuais.");
  };

  const corrigirMut = useMutation({
    mutationFn: async () => {
      if (!linha || !dados.diag) return;
      const itens = aplicarUnidadesCorrigidas(dados.itensBase, dados.diag.indices);
      await corrigirFn({
        data: {
          id: linha.pesagem.id,
          itens: itens.map((i) => ({
            descricao: i.descricao ?? null,
            quantidade: i.quantidade != null ? Number(i.quantidade) : null,
            unidade: i.unidade ?? null,
            unidade_normalizada: i.unidade_normalizada ?? null,
            valor_unitario: i.valor_unitario != null ? Number(i.valor_unitario) : null,
          })),
        },
      });
    },
    onSuccess: async () => {
      toast.success("Unidades corrigidas e pesos recalculados.");
      await recalcularTudo();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao corrigir as unidades."),
  });

  const [recalculando, setRecalculando] = useState(false);

  const p = linha?.pesagem;
  const isConcreto = useMemo(() => {
    if (!p) return false;
    const desc = (p.descricao ?? "").toUpperCase();
    return desc.includes("CONCRETO") || /\bFCK\b|\bTC\b/.test(desc);
  }, [p]);
  const notaEv = p?.evidencias?.find((e) => e.tipo === "nota");
  const notaPaths = notaEv ? [notaEv.storage_path] : [];
  const { data: urlMap = {} } = useQuery(signedUrlsQueryOptions(notaPaths)) as { data: Record<string, string> };

  if (!linha || !p) return null;

  // Declarado NF sempre igual ao "Total declarado NF" da memória de cálculo.
  const nfComp = linha.nfOrigem === "calculado" && dados.somaPesoKg > 0 ? dados.somaPesoKg : linha.nf;
  const difKgComp = nfComp > 0 ? linha.liquido - nfComp : 0;
  const difPctComp = nfComp > 0 ? (difKgComp / nfComp) * 100 : 0;
  const situacaoComp: SituacaoEstratificacao =
    nfComp <= 0 || difKgComp >= 0 || Math.abs(difPctComp) <= dados.tolAplicada ? "ok" : "abaixo";

  const nfLabel = p.numero_nota ? `NF ${p.numero_nota}` : "NF sem número";
  const totalDeclarado = p.valor_total_nf != null ? Number(p.valor_total_nf) : dados.somaValor;
  const notaUrl = notaEv ? urlMap[notaEv.storage_path] : undefined;


  const badgeCor = situacaoComp === "abaixo"
    ? "border-destructive/30 bg-destructive text-white"
    : "border-success/30 bg-success text-white";

  const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const exportarItens = () => {
    const header = ["#", "Descrição", "Qtd NF", "Un", "Peso do item (kg)", "Vlr unit", "Valor total", "Participação %", "Peso rateado (kg)", "Diferença item (kg)"];
    const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    const rows = dados.itens.map((it, i) => [
      String(i + 1), it.descricao,
      fmtNum(it.quantidade), it.unidade, it.pesoKg != null ? fmtNum(it.pesoKg) : "",
      fmtNum(it.valor_unitario), fmtNum(it.valor_total),
      fmtPct(it.participacao * 100), fmtNum(it.rateado), it.pesoKg != null ? fmtNum(it.difItem) : "",
    ]);

    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estratificacao-${(p.numero_nota ?? p.id).toString().replace(/\W+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            Estratificação — <span className="text-success">{linha.fornecedor}</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">· {nfLabel} · {linha.dataFmt}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Mini-KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-success-soft/60 p-3">
            <div className="text-[11px] uppercase tracking-wide text-success/70">Líquido aferido</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-success">{fmtTon(linha.liquido)}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Entrada {fmtTon(linha.entrada)} − Saída {fmtTon(linha.saida)}</div>
          </div>
          <div className="rounded-lg border bg-muted p-3">
            <div className="text-[11px] uppercase tracking-wide text-foreground">Declarado NF</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{nfComp > 0 ? fmtTon(nfComp) : "—"}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Total NF {fmtBRL(totalDeclarado)}</div>
          </div>
          <div className={`rounded-lg border p-3 ${badgeCor}`}>
            <div className="text-[11px] uppercase tracking-wide opacity-80">Diferença</div>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums">
              {nfComp > 0 ? fmtKgSigned(difKgComp) : "—"}
              {nfComp > 0 && (
                <Badge variant="outline" className="border-white/50 text-white bg-white/10 backdrop-blur-sm">
                  {difPctComp >= 0 ? <ArrowUp className="mr-1 h-3 w-3" /> : <ArrowDown className="mr-1 h-3 w-3" />}
                  {fmtPct(difPctComp)}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-[11px] opacity-70">Tolerância aplicada ±{fmtPct(dados.tolAplicada)}</div>
            <div className="text-[10px] italic opacity-60">{dados.tolRotulo}</div>

            {p.recalculado_em && (
              <div className="mt-2 border-t border-success/50 pt-1 text-[10px] italic opacity-80">
                Valor anterior (densidade genérica): {p.aud_diferenca_pct_anterior?.toFixed(2)}% · 
                atual (carta de traço): {difPctComp.toFixed(2)}%
              </div>
            )}
          </div>

        </div>

        {dados.diag && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Divergência muito alta — verifique a unidade dos itens</div>
                <div className="opacity-80">
                  {dados.diag.indices.length} {dados.diag.indices.length === 1 ? "item parece estar" : "itens parecem estar"} com unidade incorreta.
                  Tratando como KG, o declarado cai de {fmtTon(dados.diag.totalAtualKg)} para {fmtTon(dados.diag.totalCorrigidoKg)} (aferido {fmtTon(dados.diag.aferidoKg)}).
                </div>
              </div>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                className="shrink-0 bg-warning hover:bg-warning/90"
                onClick={() => corrigirMut.mutate()}
                disabled={corrigirMut.isPending}
              >
                {corrigirMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Interpretar como KG
              </Button>
            )}
          </div>
        )}



        {/* Tabela de itens */}
        <div className="mt-1 overflow-x-auto rounded-lg border">
          {dados.itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <PackageOpen className="h-8 w-8 opacity-60" />
              <div className="text-sm">Nenhum item detalhado nesta nota fiscal.</div>
              <div className="text-xs">Reprocesse o OCR ou preencha os itens manualmente para ver a estratificação.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  {["#", "Descrição do produto", "Qtd NF", "Un", "Peso do item", "Vlr unit", "Valor total", "Part. %", "Peso rateado", "Comparativo", "Dif. item"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((it, i) => {
                  const pesoItem = it.pesoKg ?? 0;
                  const maxVal = Math.max(it.rateado, pesoItem, 1);
                  const pctAf = (it.rateado / maxVal) * 100;
                  const pctNf = (pesoItem / maxVal) * 100;
                  const difPctItem = pesoItem > 0 ? (it.difItem / pesoItem) * 100 : 0;
                  const okItem = pesoItem <= 0 || Math.abs(difPctItem) <= dados.tolAplicada;
                  const corAf = okItem ? "bg-success" : difPctItem < 0 ? "bg-destructive" : "bg-warning";
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{it.descricao}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtQtd(it.quantidade)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${suspeitos.has(i) ? "bg-warning-soft text-warning ring-1 ring-warning" : "bg-muted"}`}>{it.unidade}</span>
                        {suspeitos.has(i) && (
                          <span className="ml-1 text-[10px] text-warning" title="A conversão desta unidade estoura o peso aferido — provavelmente a NF traz a quantidade em KG.">
                            unidade suspeita
                          </span>
                        )}
                        {it.estimado && <span className="ml-1 text-[10px] text-warning">infer.</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums" title={it.motivo ?? undefined}>
                        {isConcreto ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-success">{it.pesoKg != null ? fmtTon(it.pesoKg) : <span className="text-muted-foreground">—</span>}</span>
                            <span className="text-[10px] bg-success-soft text-success px-1 rounded-sm w-fit font-bold uppercase tracking-tighter">Carta de Traço</span>
                          </div>
                        ) : (
                          it.pesoKg != null ? fmtTon(it.pesoKg) : <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtBRL(it.valor_unitario)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtBRL(it.valor_total)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtPct(it.participacao * 100)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums text-success">{fmtTon(it.rateado)}</td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-[120px] flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 text-[10px] text-muted-foreground">Af</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full ${corAf}`} style={{ width: `${pctAf}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 text-[10px] text-muted-foreground">NF</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-muted-foreground" style={{ width: `${pctNf}%` }} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2 tabular-nums font-medium ${it.difItem < 0 ? "text-destructive" : it.difItem > 0 ? "text-warning" : ""}`}>
                        {it.pesoKg != null ? fmtKgSigned(it.difItem) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-semibold">Totais</td>
                  <td />
                  <td />
                  <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">
                    {fmtTon(dados.somaPesoKg)}
                    {dados.parcial && <span className="ml-1 text-[10px] font-normal text-warning">parcial</span>}
                  </td>
                  <td />
                  <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">{fmtBRL(dados.somaValor)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">100,00%</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums text-success">{fmtTon(linha.liquido)}</td>
                  <td />
                  <td className={`whitespace-nowrap px-3 py-2 font-semibold tabular-nums ${difKgComp < 0 ? "text-destructive" : difKgComp > 0 ? "text-warning" : ""}`}>
                    {dados.somaPesoKg > 0 ? fmtKgSigned(linha.liquido - dados.somaPesoKg) : "—"}
                  </td>
                </tr>
              </tfoot>

            </table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            Peso rateado = participação do item na NF × líquido aferido.
          </div>
          <div className="flex gap-2">
            {abrirEdicao && (
              <Button
                variant="outline"
                onClick={() => abrirEdicao(linha.pesagem)}
                title="Muda para edição manual do registro para correção de dados técnicos ou financeiros"
              >
                <Pencil className="mr-2 h-4 w-4" /> Editar registro
              </Button>
            )}
            <Button variant="outline" onClick={() => setMemoriaOpen(true)}>
              <Calculator className="mr-2 h-4 w-4" /> Memória de cálculo
            </Button>
            <Button
              variant="outline"
              onClick={() => notaUrl && window.open(notaUrl, "_blank", "noopener,noreferrer")}
              disabled={!notaEv || !notaUrl}
              title={notaEv ? "Visualizar nota fiscal (foto/PDF)" : "Nenhuma nota fiscal anexada"}
              className="border-success/30 text-success hover:bg-success-soft hover:text-success"
            >
              <Eye className="mr-2 h-4 w-4" /> Ver NF
            </Button>
            <Button variant="outline" onClick={exportarItens} disabled={dados.itens.length === 0}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar para Excel
            </Button>
            <Button onClick={onClose}>Fechar</Button>
          </div>

        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={memoriaOpen} onOpenChange={setMemoriaOpen}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Memória de cálculo — Declarado NF
            <span className="ml-2 text-xs font-normal text-muted-foreground">· {nfLabel} · {linha.dataFmt}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <div>
            <span className="font-medium">Origem do valor: </span>
            {dados.somaPesoKg > 0
              ? carta?.densidade
                ? "peso calculado a partir dos itens da nota fiscal com a densidade da carta de traço do fornecedor."
                : "peso calculado a partir dos itens da nota fiscal (conversão por unidade e densidade do cadastro de Densidades, incluindo exceções por fornecedor)."
              : "peso da NF informado no registro (a nota não possui itens conversíveis)."}
          </div>
          {carta?.densidade && (
            <div className="mt-1 rounded border border-success/30 bg-success-soft px-2 py-1 text-success">
              <strong>Carta de traço {carta.fornecedorNome}</strong>
              {carta.traco?.codigo ? ` · ${carta.traco.codigo}` : ""}
              {carta.traco?.fck != null ? ` · FCK ${carta.traco.fck}` : ""}
              {carta.traco?.slump_nominal != null ? ` · slump ${carta.traco.slump_nominal} ${carta.traco.slump_unidade ?? "cm"}` : ""}
              {` · ${carta.densidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg/m³`}
              {carta.tol ? ` · tolerância ±${carta.tol}%` : ""}
            </div>
          )}
          {dados.parcial && (
            <div className="mt-1 text-warning">
              Atenção: cálculo <strong>parcial</strong> — há itens sem regra de conversão; eles não somam no total.
            </div>
          )}
          {dados.estimado && (
            <div className="mt-1 text-warning">
              Há itens cuja unidade foi <strong>inferida pela descrição</strong> (a NF não trouxe a unidade).
            </div>
          )}
        </div>

        {dados.itens.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            Nenhum item detalhado nesta nota fiscal para demonstrar o cálculo.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  {["#", "Produto", "Qtd NF", "Un", "Regra aplicada", "Peso (kg)"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{it.descricao}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtQtd(it.quantidade)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{it.unidade || "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {regraAplicada(it, carta?.densidade ? carta.fornecedorNome : null)}
                      {it.estimado && <span className="ml-1 text-warning">(unidade inferida pela descrição)</span>}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${it.pesoKg == null ? "text-muted-foreground" : "font-medium"}`}>
                      {it.pesoKg != null ? it.pesoKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-3 py-2" colSpan={4} />
                  <td className="px-3 py-2 font-semibold">Total declarado NF</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                    {dados.somaPesoKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                    <div className="text-[11px] font-normal text-muted-foreground">= {fmtTon(dados.somaPesoKg)}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="space-y-1 rounded-lg border p-3 text-[11px] text-muted-foreground">
          <div><strong>Comparação:</strong> Líquido aferido (Entrada − Saída) {fmtTon(linha.liquido)} − {linha.nfOrigem === "carta_traco" ? "Peso Carta Traço" : "Declarado NF"} {nfComp > 0 ? fmtTon(nfComp) : "—"} = {nfComp > 0 ? `${fmtKgSigned(difKgComp)} (${fmtPct(difPctComp)})` : "—"}, com tolerância de ±{fmtPct(dados.tolAplicada)} ({dados.tolRotulo}).</div>
          {linha.nfOrigem === "carta_traco" && carta && (
            <div className="mt-2 rounded border border-success/30 bg-success-soft/70 p-2 text-success">
              <div className="mb-0.5 font-bold uppercase tracking-tight">Memória de cálculo — Carta de Traço</div>
              <div>Fornecedor: {carta.fornecedorNome} · Traço {carta.traco?.codigo ?? "—"} · FCK {carta.traco?.fck ?? "—"} MPa</div>
              <div>Volume {fmtQtd(Number((linha.pesagem as any).volume_m3 ?? (linha.pesagem as any).resultado_afericao?.volume ?? 0))} m³ × Densidade {fmtQtd(Number(carta.densidade ?? 0))} kg/m³ = <strong>{fmtTon(linha.nf)}</strong></div>
              <div>Aferido {fmtTon(linha.liquido)} → diferença {fmtKgSigned(difKgComp)} ({fmtPct(difPctComp)}) · situação <strong>{situacaoComp.toUpperCase()}</strong></div>
            </div>
          )}

          {isConcreto && (
            <div className="mt-2 p-2 rounded border border-success/30 bg-success-soft text-success animate-pulse">
              <div className="flex items-center gap-1.5 font-bold mb-0.5 uppercase tracking-tighter">
                <RefreshCw className="h-3 w-3" />
                Melhoria Aplicada: Método Carta de Traço
              </div>
              <p className="italic">
                Identificado como <strong>Concreto Usinado</strong>. O peso calculado utiliza a <strong>Densidade Teórica da Mistura</strong> (kg/m³) da concreteira, validando o volume real faturado com precisão técnica superior.
              </p>
            </div>
          )}
          <div><strong>Rateio:</strong> participação do item = peso do item ÷ soma dos pesos dos itens. Quando nenhum item pode ser convertido, o rateio usa o valor financeiro (valor total do item ÷ valor total da NF).</div>
          <div><strong>Conversões:</strong> KG = valor direto · TON × 1.000 · M³ × densidade do material · L × densidade do líquido · SC × peso padrão do saco.</div>
        </div>

        <DialogFooter>
          <Button onClick={() => setMemoriaOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function origemDensidade(it: ItemLinha, cartaFornecedor?: string | null): string {
  if (it.origemDensidade === "carta_traco" || cartaFornecedor) {
    return `— carta de traço${cartaFornecedor ? ` ${cartaFornecedor}` : ""}`;
  }
  if (it.origemDensidade === "fornecedor") {
    return `(fornecedor ${it.fornecedorDensidade ?? ""})`.replace(" )", ")");
  }
  if (it.origemDensidade === "cadastro") return "(cadastro de densidades)";
  return "(genérica)";
}

function regraAplicada(it: ItemLinha, cartaFornecedor?: string | null): string {
  if (it.pesoKg == null) return it.motivo ? `Não convertido — ${it.motivo}` : "Não convertido";
  const q = it.quantidade;
  const fator = q ? it.pesoKg / q : 0;
  const fmtF = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  switch (it.unidade) {
    case "KG": return "1 kg por KG (valor direto)";
    case "TON": return "× 1.000 kg por tonelada";
    case "M3": return `densidade ${fmtF(fator)} kg/m³ ${origemDensidade(it, cartaFornecedor)}`;
    case "L": return `densidade ${fmtF(fator)} kg/L ${origemDensidade(it, null)}`;
    case "SC": return `${fmtF(fator)} kg por saco ${origemDensidade(it, null)}`;
    default: return `× ${fmtF(fator)} kg por ${it.unidade}`;
  }
}
