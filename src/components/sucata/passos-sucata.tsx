// Passo a passo do processo de sucata: as 4 fases em uma única tela.
// Ordem: 1 Entrada · 2 Saída (valor e pedido da nota) · 3 Nota Fiscal Avulsa · 4 Recibo do sucateiro.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Check, Download, FileImage, FileText, Lock, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { formatarDataHora, formatarKg } from "@/lib/sucata/validadores";
import { supabase } from "@/integrations/supabase/client";
import { obrasQueryOptions } from "@/lib/pesagem-queries";
import { tiposSucataQueryOptions } from "@/lib/sucata/sucata-queries";
import {
  BUCKET_EVIDENCIAS, capturarEvidencia, eventosProcessoQueryOptions, evidenciasQueryOptions, posicoesVigentes,
  vigentes, type EventoRow, type EvidenciaRow,
} from "@/lib/sucata/evidencias-queries";
import { relatoriosQueryOptions, urlRelatorio } from "@/lib/sucata/relatorio-queries";
import { MiniaturaFoto } from "@/components/sucata/miniatura-foto";
import {
  POSICAO_CACAMBA_CHEIA, POSICAO_CAMINHAO_VAZIO, POSICAO_COMPROVANTE, POSICAO_FRENTE_PLACA,
  POSICAO_NFA, POSICAO_RECIBO,
  codigoDe, rotuloDe,
} from "@/lib/sucata/posicoes-evidencia";
import { FASES_V2, estadosDoProcesso, type EstadoFase, type NumeroFase } from "@/lib/sucata/fases-v2";
import { lerRegistroFases, type RegistroFases } from "@/lib/sucata/registro-fases";
import { ajustarValorColeta, dadosRevisaoFase2, solicitarNfa } from "@/lib/sucata/coleta.functions";
import { encerrarComRelatorio, type EnvioRelatorio } from "@/lib/sucata/relatorio.functions";
import { dadosNfa } from "@/lib/sucata/nfa.functions";
import { carregarFotosRelatorio, gerarPdfRelatorio, imagemDaFolhaNfa, nomeRelator } from "@/lib/sucata/relatorio-pdf";
import {
  RelatorioFotografico, TOTAL_PAGINAS_RELATORIO, type FotoRelatorio,
} from "@/components/sucata/relatorio-fotografico";
import { useAuth } from "@/hooks/useAuth";
import { NfaFolha } from "@/components/sucata/nfa-folha";

type Processo = {
  id: string;
  numero: string;
  placa: string;
  motorista: string | null;
  obra_id: string;
  sucateiro_id?: string | null;
  tipo_sucata_id: string | null;
  tara_kg: number;
  bruto_kg: number | null;
  peso_aferido_kg: number | null;
  descricao_carga: string | null;
  valor_total: number | null;
  valor_por_tonelada: number | null;
  valor_unitario_kg: number | null;
  valor_ajustado_em?: string | null;
  valor_ajuste_justificativa?: string | null;
  entrada_em: string;
  saida_em: string | null;
  nfa_solicitada_em: string | null;
  nfa_numero: string | null;
  nfa_emissao: string | null;
  nfa_enviada_em: string | null;
  nfa_exportada_em?: string | null;
  nfa_impedimento_motivo: string | null;
  concluido_em: string | null;
  situacao: string;
  fases_registro?: unknown;
};

const moeda = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const moedaKg = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : `${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 })}/kg`;

const ID_RELATORIO_OCULTO = "relatorio-oculto";
const ID_NFA_RELATORIO_OCULTO = "nfa-relatorio-oculto";

/** Espera as páginas do relatório oculto entrarem no DOM após o React renderizar. */
async function aguardarPaginasOcultas(): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    if (document.getElementById(`${ID_RELATORIO_OCULTO}-${TOTAL_PAGINAS_RELATORIO}`)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Não foi possível montar o relatório fotográfico. Tente novamente.");
}

function mensagemRelatorio(r: EnvioRelatorio): void {
  if (r.enviados.length > 0) {
    toast.success(`Relatório fotográfico v${r.versao} enviado para ${r.enviados.join(", ")}. Processo encerrado.`);
  } else {
    toast.success(`Processo encerrado. Relatório fotográfico v${r.versao} guardado no processo.`);
  }
  if (r.erro) toast.warning(r.erro);
  if (r.falhas.length > 0) toast.warning(`Sem sucesso para: ${r.falhas.join(", ")}`);
}

function lerNumero(txt: string): number | null {
  const limpo = txt.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PassosSucata({
  processo,
  evidencias,
}: {
  processo: Processo;
  evidencias: EvidenciaRow[];
}) {
  const qc = useQueryClient();
  const buscarDadosNfa = useServerFn(dadosNfa);
  const buscarRevisao = useServerFn(dadosRevisaoFase2);
  const { user, isAdmin, isSuperAdmin, isAdministrativoObra, isContador } = useAuth();
  const feitas = useMemo(() => new Set(posicoesVigentes(evidencias)), [evidencias]);
  const estados = estadosDoProcesso(processo, feitas);
  const registro = useMemo(() => lerRegistroFases(processo.fases_registro), [processo.fases_registro]);

  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const { data: tipos = [] } = useQuery(tiposSucataQueryOptions());
  const { data: relatorios = [] } = useQuery(relatoriosQueryOptions(processo.id));
  const { data: notaRelatorio } = useQuery({
    queryKey: ["sucata", "nfa", processo.id],
    queryFn: () => buscarDadosNfa({ data: { processoId: processo.id } }),
    staleTime: 15_000,
  });
  const { data: revisao } = useQuery({
    queryKey: ["sucata", "revisao-fase-2", processo.id],
    queryFn: () => buscarRevisao({ data: { processoId: processo.id } }),
    enabled: !!processo.bruto_kg,
    staleTime: 15_000,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["sucata"] });
  };

  const podeAdministrativo = isAdministrativoObra || isAdmin || isSuperAdmin;
  const podeContabilidade = isContador || isAdmin || isSuperAdmin;
  const podeAjustarValor = isAdmin || isSuperAdmin;
  const concluido = processo.situacao === "CONCLUIDO" || !!processo.concluido_em;
  const notaEmitida = !!processo.nfa_enviada_em || !!processo.nfa_exportada_em;
  // Valor ajustado depois da emissão: a nota anterior precisa ser cancelada e substituída.
  const substituicaoPendente = (() => {
    if (!notaEmitida || !processo.valor_ajustado_em) return false;
    const emissao = processo.nfa_exportada_em ?? processo.nfa_enviada_em;
    return !!emissao && new Date(processo.valor_ajustado_em).getTime() > new Date(emissao).getTime();
  })();

  // ---------- Fase 2: valor e pedido da nota ----------
  const [observacao, setObservacao] = useState("");
  const [confirmarPedido, setConfirmarPedido] = useState(false);
  const pedirNota = useMutation({
    mutationFn: () => solicitarNfa({ data: { processoId: processo.id, observacao: observacao.trim() || null } }),
    onSuccess: (r) => {
      if (r.emailOk) toast.success(`Pedido enviado para ${r.destinatarios.join(", ")}.`);
      else toast.warning(r.erro ?? "Pedido registrado, mas o e-mail não saiu.");
      setObservacao("");
      setConfirmarPedido(false);
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível solicitar a nota."),
  });

  const [novoValor, setNovoValor] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [confirmarAjuste, setConfirmarAjuste] = useState(false);
  const ajustar = useMutation({
    mutationFn: () => {
      const total = lerNumero(novoValor);
      if (total === null) throw new Error("Informe o novo valor total da coleta.");
      if (justificativa.trim().length < 5) throw new Error("Escreva a justificativa do ajuste.");
      return ajustarValorColeta({
        data: { processoId: processo.id, valorTotal: total, valorUnitario: null, justificativa: justificativa.trim() },
      });
    },
    onSuccess: (r) => {
      if (r.emailOk) {
        toast.success(
          r.notaEmitida
            ? `Pedido de cancelamento e nova nota enviado para ${r.destinatarios.join(", ")}.`
            : `Novo valor enviado à Contabilidade (${r.destinatarios.join(", ")}).`,
        );
      } else {
        toast.warning(r.erro ?? "Valor ajustado, mas o e-mail à Contabilidade não saiu.");
      }
      setNovoValor("");
      setJustificativa("");
      setConfirmarAjuste(false);
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível ajustar o valor."),
  });

  const enviarFoto = useMutation({
    mutationFn: async (args: { posicao: number; arquivo: File }) => {
      const versao = evidencias.filter((e) => e.posicao === args.posicao).length + 1;
      const vigente = evidencias.find((e) => e.posicao === args.posicao && e.substituida_por === null);
      await capturarEvidencia({
        processoId: processo.id,
        posicao: args.posicao,
        arquivo: args.arquivo,
        versao,
        substituiId: vigente?.id ?? null,
        motivo: vigente ? "Nova versão do documento" : null,
      });
    },
    onSuccess: () => {
      toast.success("Foto registrada.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto."),
  });


  // ---------- Relatório fotográfico + encerramento ----------
  const [fotosRelatorio, setFotosRelatorio] = useState<FotoRelatorio[] | null>(null);
  const [notaImagemRelatorio, setNotaImagemRelatorio] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);

  useEffect(() => {
    if (!notaRelatorio) {
      setNotaImagemRelatorio(null);
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(() => {
      void imagemDaFolhaNfa(ID_NFA_RELATORIO_OCULTO).then((imagem) => {
        if (!cancelado) setNotaImagemRelatorio(imagem);
      });
    }, 300);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [notaRelatorio]);

  const obra = obras.find((o) => o.id === processo.obra_id) ?? null;
  const tipo = tipos.find((t) => t.id === processo.tipo_sucata_id) ?? null;
  const dataColeta = processo.saida_em ?? processo.entrada_em;
  const dadosRelatorio = {
    numero: processo.numero,
    obra: obra?.nome ?? "—",
    dataColeta: new Date(dataColeta).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    descricao: `Retirada de ${tipo?.nome ?? "sucata"}`,
    relator: nomeRelator(user),
  };

  /** Monta o relatório com as 5 fotos (inclusive o preview da nota), gera o PDF e encerra no servidor. */
  async function gerarRelatorioEEncerrar(): Promise<EnvioRelatorio> {
    if (!notaRelatorio || !notaImagemRelatorio) {
      throw new Error("Aguarde a Nota Fiscal Avulsa terminar de carregar em A4.");
    }
    setEtapa("Montando o relatório fotográfico...");
    const frescas = await qc.fetchQuery({ ...evidenciasQueryOptions(processo.id), staleTime: 0 });
    const fotos = await carregarFotosRelatorio(vigentes(frescas));
    setFotosRelatorio(fotos);
    try {
      await aguardarPaginasOcultas();
      setEtapa("Gerando o PDF...");
      const pdf = await gerarPdfRelatorio(ID_RELATORIO_OCULTO, processo.numero, TOTAL_PAGINAS_RELATORIO);
      setEtapa("Enviando e encerrando o processo...");
      return await encerrarComRelatorio({ data: { processoId: processo.id, pdfBase64: pdf } });
    } finally {
      setFotosRelatorio(null);
      setEtapa(null);
    }
  }

  // ---------- Fase 3: registro da emissão (somente leitura) ----------
  // A emissão acontece na tela da Nota Fiscal Avulsa; aqui fica só o log.
  const { data: eventos = [] } = useQuery(eventosProcessoQueryOptions(processo.id));
  const eventoEmissao = useMemo(
    () => [...eventos].reverse().find((e) => e.acao === "nfa_preview_confirmada") ?? null,
    [eventos],
  );


  const encerrar = useMutation({
    mutationFn: () => gerarRelatorioEEncerrar(),
    onSuccess: (r) => {
      mensagemRelatorio(r);
      invalidar();
    },
    onError: (e) => {
      setEtapa(null);
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    },
  });

  const ocupado = encerrar.isPending;
  const ultimoRelatorio = relatorios[0] ?? null;
  const reciboOk = feitas.has(POSICAO_RECIBO) && feitas.has(POSICAO_COMPROVANTE);
  const caminhoDe = (posicao: number): string | null =>
    evidencias.find((e) => e.posicao === posicao && e.substituida_por === null)?.storage_path ?? null;

  return (
    <div className="space-y-4">
      <Trilha estados={estados} />

      {/* FASE 1 — Entrada do caminhão */}
      <PassoCard numero={1} estado={estados[1]} registro={registro}>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Campo rotulo="Placa" valor={processo.placa} mono />
          <Campo rotulo="Motorista" valor={processo.motorista ?? "—"} />
          <Campo rotulo="Entrada" valor={formatarDataHora(processo.entrada_em)} mono />
          <Campo rotulo="Tara (kg)" valor={formatarKg(processo.tara_kg)} mono />
        </div>
        <ItemFoto
          posicao={POSICAO_CAMINHAO_VAZIO}
          feito={feitas.has(POSICAO_CAMINHAO_VAZIO)}
          storagePath={caminhoDe(POSICAO_CAMINHAO_VAZIO)}
          processoId={processo.id}
        />
        <ItemFoto
          posicao={POSICAO_FRENTE_PLACA}
          feito={feitas.has(POSICAO_FRENTE_PLACA)}
          storagePath={caminhoDe(POSICAO_FRENTE_PLACA)}
          processoId={processo.id}
        />
      </PassoCard>

      {/* FASE 2 — Saída do caminhão, valor e pedido da nota */}
      <PassoCard numero={2} estado={estados[2]} registro={registro}>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Campo rotulo="Saída" valor={formatarDataHora(processo.saida_em)} mono />
          <Campo rotulo="Bruto (kg)" valor={formatarKg(processo.bruto_kg)} mono />
          <Campo rotulo="Peso aferido (kg)" valor={formatarKg(processo.peso_aferido_kg)} mono />
          <Campo rotulo="Valor por quilo" valor={moedaKg(processo.valor_unitario_kg)} mono />
          <Campo rotulo="Valor total a pagar" valor={moeda(processo.valor_total)} mono />
          <Campo rotulo="Pedido à Contabilidade" valor={formatarDataHora(processo.nfa_solicitada_em)} mono />
        </div>
        <ItemFoto
          posicao={POSICAO_CACAMBA_CHEIA}
          feito={feitas.has(POSICAO_CACAMBA_CHEIA)}
          storagePath={caminhoDe(POSICAO_CACAMBA_CHEIA)}
          processoId={processo.id}
        />
        <Campo rotulo="Descrição da carga" valor={processo.descricao_carga ?? "—"} />

        {estados[1] !== "concluida" && <Bloqueado texto="Conclua a entrada do caminhão para liberar esta fase." />}

        {processo.valor_ajustado_em && (
          <p className="text-xs text-muted-foreground">
            Valor ajustado em {formatarDataHora(processo.valor_ajustado_em)} — {processo.valor_ajuste_justificativa}
          </p>
        )}

        {estados[2] === "atual" && !processo.bruto_kg && (
          <p className="text-xs text-muted-foreground">
            A saída é registrada na tela de pesagem, no modo Sucata. Ao salvar o peso bruto, o sistema calcula o
            valor a pagar. O pedido só será enviado depois da revisão abaixo.
          </p>
        )}

        {!!processo.bruto_kg && !concluido && podeAdministrativo && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Campo rotulo="Sucateiro" valor={revisao?.sucateiro ?? "—"} />
              <Campo rotulo="Placa" valor={processo.placa} mono />
              <Campo rotulo="Descrição" valor={processo.descricao_carga ?? "—"} />
              <Campo rotulo="Tara" valor={formatarKg(processo.tara_kg)} mono />
              <Campo rotulo="Bruto" valor={formatarKg(processo.bruto_kg)} mono />
              <Campo rotulo="Peso aferido — somente leitura" valor={formatarKg(processo.peso_aferido_kg)} mono />
              <Campo rotulo="Banco — somente leitura" valor={revisao?.banco ?? "—"} />
              <Campo rotulo="Conta — somente leitura" valor={revisao?.contaMascarada ?? "—"} mono />
              <Campo rotulo="Valor total" valor={moeda(processo.valor_total)} mono />
            </div>
            <Label className="text-xs">
              {processo.nfa_solicitada_em ? "Reenviar o pedido à Contabilidade" : "Enviar o pedido à Contabilidade"} —
              observação (opcional)
            </Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            <Button
              className="bg-primary text-white hover:bg-primary-dark"
              onClick={() => setConfirmarPedido(true)}
              disabled={pedirNota.isPending}
            >
              <Mail className="mr-2 h-4 w-4" />
              {processo.nfa_solicitada_em ? "REENVIAR SOLICITAÇÃO" : "SOLICITAR NOTA FISCAL"}
            </Button>
          </div>
        )}

        <AlertDialog open={confirmarPedido} onOpenChange={setConfirmarPedido}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar os dados e solicitar a nota fiscal?</AlertDialogTitle>
              <AlertDialogDescription>
                A Contabilidade receberá os dados revisados do processo {processo.numero}. Confira sucateiro,
                pesos, valor e dados bancários antes de continuar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar e revisar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-white hover:bg-primary-dark"
                onClick={(e) => {
                  e.preventDefault();
                  pedirNota.mutate();
                }}
                disabled={pedirNota.isPending}
              >
                Confirmar e enviar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!!processo.valor_total && podeAjustarValor && !concluido && (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <div className="font-heading text-sm font-semibold">Ajuste do valor (administrador)</div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40">
                <Label className="mb-1 block text-xs">Novo valor total (R$)</Label>
                <Input
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0,00"
                  className={CLASSE_NUM}
                />
              </div>
              <div className="min-w-64 flex-1">
                <Label className="mb-1 block text-xs">Justificativa</Label>
                <Input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (lerNumero(novoValor) === null) {
                    toast.error("Informe o novo valor total da coleta.");
                    return;
                  }
                  if (justificativa.trim().length < 5) {
                    toast.error("Escreva a justificativa do ajuste.");
                    return;
                  }
                  setConfirmarAjuste(true);
                }}
                disabled={ajustar.isPending}
              >
                <Check className="mr-2 h-4 w-4" /> Ajustar valor
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A Contabilidade é avisada por e-mail do novo valor
              {notaEmitida ? " e do cancelamento da nota já emitida." : "."}
            </p>
          </div>
        )}

        <AlertDialog open={confirmarAjuste} onOpenChange={setConfirmarAjuste}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar o novo valor da venda?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    O valor passa de <b>{moeda(processo.valor_total)}</b> para{" "}
                    <b>{moeda(lerNumero(novoValor))}</b>.
                  </p>
                  <p>
                    {notaEmitida
                      ? `A Contabilidade recebe um pedido para cancelar a nota nº ${processo.nfa_numero ?? "—"} e emitir nova nota pelo novo valor.`
                      : "A Contabilidade é avisada para emitir a Nota Fiscal Avulsa pelo novo valor."}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-white hover:bg-primary-dark"
                onClick={(e) => {
                  e.preventDefault();
                  ajustar.mutate();
                }}
                disabled={ajustar.isPending}
              >
                Confirmar e avisar a Contabilidade
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PassoCard>

      {/* FASE 3 — Nota Fiscal Avulsa (Contabilidade) */}
      <PassoCard numero={3} estado={estados[3]} registro={registro}>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Campo rotulo="Nota fiscal avulsa" valor={processo.nfa_numero ?? "—"} mono />
          <Campo
            rotulo="Emissão"
            valor={
              processo.nfa_emissao
                ? new Date(`${processo.nfa_emissao}T12:00:00Z`).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })
                : "—"
            }
            mono
          />
        </div>

        {substituicaoPendente && (
          <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <b>Substituição solicitada</b> — nota anterior a cancelar. Novo valor a emitir:{" "}
            <span className={CLASSE_NUM}>{moeda(processo.valor_total)}</span>.
          </div>
        )}


        {processo.nfa_impedimento_motivo && (
          <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <b>Impedimento da Contabilidade:</b> {processo.nfa_impedimento_motivo}
          </div>
        )}

        {!processo.nfa_solicitada_em ? (
          <Bloqueado texto="A fase abre quando o pedido da nota chega à Contabilidade, logo após a saída do caminhão." />
        ) : (
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/sucata/$id/nfa" params={{ id: processo.id }}>
                <FileText className="mr-2 h-4 w-4" /> Abrir os dados de emissão
              </Link>
            </Button>

            <RegistroEmissao sucateiro={revisao?.sucateiro ?? "—"} numero={processo.nfa_numero} evento={eventoEmissao} />

            {!podeContabilidade && !notaEmitida && (
              <p className="text-sm text-muted-foreground">
                Pedido enviado. A Contabilidade emite a Nota Fiscal Avulsa.
              </p>
            )}

            {etapa && (
              <div className="rounded-md border border-warning/30 bg-warning-soft p-2 text-xs font-medium text-warning">
                {etapa}
              </div>
            )}
          </>
        )}
      </PassoCard>

      {/* FASE 4 — Recibo do sucateiro e encerramento */}
      <PassoCard numero={4} estado={estados[4]} registro={registro}>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Campo rotulo="Valor total da coleta" valor={moeda(processo.valor_total)} mono />
          <Campo rotulo="Processo encerrado em" valor={formatarDataHora(processo.concluido_em)} mono />
        </div>

        {!notaEmitida ? (
          <Bloqueado texto="A fase abre quando a Contabilidade envia ou exporta a nota fiscal avulsa." />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <ItemFoto
                posicao={POSICAO_RECIBO}
                feito={feitas.has(POSICAO_RECIBO)}
                storagePath={caminhoDe(POSICAO_RECIBO)}
                processoId={processo.id}
                onArquivo={
                  concluido || !podeAdministrativo
                    ? undefined
                    : (f) => enviarFoto.mutate({ posicao: POSICAO_RECIBO, arquivo: f })
                }
                enviando={enviarFoto.isPending}
              />
              <ItemFoto
                posicao={POSICAO_COMPROVANTE}
                feito={feitas.has(POSICAO_COMPROVANTE)}
                storagePath={caminhoDe(POSICAO_COMPROVANTE)}
                processoId={processo.id}
                onArquivo={
                  concluido || !podeAdministrativo
                    ? undefined
                    : (f) => enviarFoto.mutate({ posicao: POSICAO_COMPROVANTE, arquivo: f })
                }
                enviando={enviarFoto.isPending}
              />
            </div>

            {!concluido && podeAdministrativo && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">
                  {reciboOk
                    ? "Recibo e comprovante registrados. Gere o relatório técnico e encerre o processo."
                    : "Anexe o recibo do sucateiro e o comprovante de pagamento para encerrar."}
                </div>
                <Button variant="outline" onClick={() => encerrar.mutate()} disabled={ocupado || !reciboOk}>
                  <FileImage className="mr-2 h-4 w-4" /> Gerar relatório e encerrar
                </Button>
              </div>
            )}

            {etapa && (
              <div className="rounded-md border border-warning/30 bg-warning-soft p-2 text-xs font-medium text-warning">
                {etapa}
              </div>
            )}

            {(ultimoRelatorio || concluido) && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Relatório fotográfico</div>
                {ultimoRelatorio ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={CLASSE_NUM}>
                      v{ultimoRelatorio.versao} · {formatarDataHora(ultimoRelatorio.gerado_em)}
                    </span>
                    <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
                      <Check className="mr-1 h-3 w-3" /> Gerado
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={async () => {
                        const url = await urlRelatorio(ultimoRelatorio.storage_path);
                        if (url) window.open(url, "_blank");
                        else toast.error("Não foi possível abrir o arquivo.");
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" /> Abrir PDF
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/sucata/$id/relatorio" params={{ id: processo.id }}>
                        Ver versões
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 text-muted-foreground">Nenhuma versão gerada.</div>
                )}
              </div>
            )}
          </>
        )}
      </PassoCard>

      {/* Relatório renderizado fora da área visível só durante a geração do PDF. */}
      {fotosRelatorio && (
        <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 -z-10 w-[210mm]">
          <RelatorioFotografico
            dados={dadosRelatorio}
            fotos={fotosRelatorio}
            nota={notaRelatorio ? {
              campos: notaRelatorio.formulario,
              cfop: notaRelatorio.cfopSugerido ?? "",
              natureza: notaRelatorio.naturezaSugerida,
              numero: notaRelatorio.nfaNumero ?? "00001",
              emissao: notaRelatorio.nfaEmissao ?? "",
              processo: notaRelatorio.numero,
            } : null}
            notaImagem={notaImagemRelatorio}
            idBase={ID_RELATORIO_OCULTO}
          />
        </div>
      )}
      {notaRelatorio && (
        <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 h-[1123px] w-[794px] bg-card">
          <NfaFolha
            idFolha={ID_NFA_RELATORIO_OCULTO}
            campos={notaRelatorio.formulario}
            cfop={notaRelatorio.cfopSugerido ?? ""}
            natureza={notaRelatorio.naturezaSugerida}
            numero={notaRelatorio.nfaNumero ?? "00001"}
            emissao={notaRelatorio.nfaEmissao ?? ""}
            processo={notaRelatorio.numero}
          />
        </div>
      )}
    </div>
  );
}

function Trilha({ estados }: { estados: Record<NumeroFase, EstadoFase> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {FASES_V2.map((f) => {
        const e = estados[f.numero];
        const cor =
          e === "concluida"
            ? "border-success/30 bg-success-soft text-success"
            : e === "atual"
              ? "border-warning/30 bg-warning-soft text-warning"
              : "border-muted bg-muted/40 text-muted-foreground";
        return (
          <div key={f.numero} className={`rounded-lg border p-3 ${cor}`}>
            <div className="flex items-center gap-2">
              <span className={`font-heading text-sm font-bold ${CLASSE_NUM}`}>FASE {f.numero}</span>
              {e === "concluida" && <Check className="h-4 w-4" />}
            </div>
            <div className="font-heading text-sm font-semibold">{f.nome}</div>
            <div className="text-[11px]">
              {e === "concluida" ? "Concluída" : e === "atual" ? "Em andamento" : "Aguardando"} · {f.responsavel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PassoCard({
  numero,
  estado,
  registro,
  children,
}: {
  numero: NumeroFase;
  estado: EstadoFase;
  registro: RegistroFases;
  children: React.ReactNode;
}) {
  const fase = FASES_V2.find((f) => f.numero === numero)!;
  const marca = registro[String(numero) as "1" | "2" | "3" | "4"];
  return (
    <Card className={estado === "atual" ? "border-warning/30" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 font-heading text-base">
          <span className={CLASSE_NUM}>FASE {numero}</span> — {fase.nome}
          <Badge
            variant="outline"
            className={
              estado === "concluida"
                ? "border-success/30 bg-success-soft text-success"
                : estado === "atual"
                  ? "border-warning/30 bg-warning-soft text-warning"
                  : "text-muted-foreground"
            }
          >
            {estado === "concluida" ? "Concluída" : estado === "atual" ? "Em andamento" : "Aguardando"}
          </Badge>
          <span className="ml-auto text-xs font-normal text-muted-foreground">{fase.responsavel}</span>
        </CardTitle>
        {(marca?.aberta_em || marca?.fechada_em) && (
          <div className={`text-[11px] text-muted-foreground ${CLASSE_NUM}`}>
            {marca?.aberta_em && (
              <span>
                Aberta em {formatarDataHora(marca.aberta_em)}
                {marca.aberta_nome ? ` por ${marca.aberta_nome}` : ""}
              </span>
            )}
            {marca?.aberta_em && marca?.fechada_em && <span> · </span>}
            {marca?.fechada_em && (
              <span>
                Concluída em {formatarDataHora(marca.fechada_em)}
                {marca.fechada_nome ? ` por ${marca.fechada_nome}` : ""}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function ItemFoto({
  posicao,
  feito,
  processoId,
  storagePath = null,
  onArquivo,
  enviando,
}: {
  posicao: number;
  feito: boolean;
  processoId: string;
  storagePath?: string | null;
  onArquivo?: (f: File) => void;
  enviando?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
      <MiniaturaFoto
        storagePath={storagePath}
        rotulo={`${codigoDe(posicao)} — ${rotuloDe(posicao)}`}
        onTirarOutra={onArquivo ? () => ref.current?.click() : undefined}
        className="h-16 w-20"
      />
      <span className={`${CLASSE_NUM} text-xs text-muted-foreground`}>{codigoDe(posicao)}</span>
      <span className="mr-auto">{rotuloDe(posicao)}</span>
      {feito ? (
        <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
          <Check className="mr-1 h-3 w-3" /> Registrada
        </Badge>
      ) : (
        <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
          Pendente
        </Badge>
      )}
      {onArquivo ? (
        <>
          <input
            ref={ref}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onArquivo(f);
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={enviando}>
            <Camera className="mr-2 h-4 w-4" /> {feito ? "Substituir" : "Tirar foto"}
          </Button>
        </>
      ) : (
        !feito && (
          <Button asChild size="sm" variant="outline">
            <Link to="/sucata/$id/evidencias" params={{ id: processoId }}>
              <Camera className="mr-2 h-4 w-4" /> Registrar
            </Link>
          </Button>
        )
      )}
    </div>
  );
}

function Bloqueado({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-primary-dark/30 bg-primary-dark/10 p-2 text-sm text-primary-dark">
      <Lock className="h-4 w-4" /> {texto}
    </div>
  );
}

/** Log da emissão da nota: sucateiro, número, data/hora, autor e quem foi avisado. */
function RegistroEmissao({
  sucateiro,
  numero,
  evento,
}: {
  sucateiro: string;
  numero: string | null;
  evento: EventoRow | null;
}) {
  const payload = (evento?.payload ?? {}) as { emails?: unknown; nfa_numero?: unknown };
  const emails = Array.isArray(payload.emails) ? payload.emails.filter((e): e is string => typeof e === "string") : [];
  const autor = evento?.usuario_email ?? evento?.usuario_nome ?? "—";
  const numeroNota = numero ?? (typeof payload.nfa_numero === "string" ? payload.nfa_numero : null);

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="font-heading text-sm font-semibold">Registro da emissão</div>
      {!evento && !numeroNota ? (
        <p className="text-sm text-muted-foreground">
          Nota ainda não emitida. Use “Abrir os dados de emissão” para conferir e emitir a Nota Fiscal Avulsa.
        </p>
      ) : (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Campo rotulo="Sucateiro" valor={sucateiro} />
          <Campo rotulo="Nota fiscal" valor={numeroNota ?? "—"} mono />
          <Campo rotulo="Emitida em" valor={formatarDataHora(evento?.created_at ?? null)} mono />
          <Campo rotulo="Emitida por" valor={autor} />
          <div className="sm:col-span-2">
            <Campo rotulo="Avisos enviados" valor={emails.length > 0 ? emails.join(", ") : "—"} />
          </div>
        </dl>
      )}
    </div>
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
