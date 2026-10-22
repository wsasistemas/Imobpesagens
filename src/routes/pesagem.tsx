import { createFileRoute } from "@tanstack/react-router";

/** Peso esperado da carta de traço: coluna dedicada ou, se vazia, a apuração salva no registro. */
function pesoEsperadoDe(p: any): number | null {
  const tracoId = p?.traco_id;
  if (!tracoId && !p?.resultado_afericao) return null;
  const direto = p?.peso_esperado;
  if (direto != null && Number.isFinite(Number(direto))) return Number(direto);
  const ap = p?.resultado_afericao;
  const esperado = ap && typeof ap === "object" ? (ap as any).esperado : null;
  return esperado != null && Number.isFinite(Number(esperado)) ? Number(esperado) : null;
}
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Upload,
  ScanLine,
  Search,
  FileText,
  Scale as ScaleIcon,
  Wifi,
  WifiOff,
  Save,
  Ban,
  Eraser,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  ImagePlus,
  Trash2,
  Loader2,
  FileSpreadsheet,
  Eye,
  Truck,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Image as ImageIcon,
  Send,
  Lock,
  X,
  FlaskConical,
  Sparkles,
  Building2,
  Pencil,
  RefreshCw,
  AlertCircle,
  Info,
  ShieldCheck,
  LayoutGrid,
  History as HistoryIcon,
  Droplet,
} from "lucide-react";

import { ColunaFiltro, type FaixaNum, type FaixaData } from "@/components/grid-filtro-coluna";
import { useIsMobile } from "@/hooks/use-mobile";

import { AppShell, useObraAtual, TODAS_OBRAS } from "@/components/app-shell";
import { Recycle } from "lucide-react";
import { PainelSucata } from "@/components/sucata/painel-sucata";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  VisualizadorArquivoDialog,
  ehArquivoPdf,
  type ArquivoVisualizacao,
} from "@/components/visualizador-arquivo-dialog";

import { supabase } from "@/integrations/supabase/client";
import { useCelmiScale } from "@/hooks/useCelmiScale";
import { useServerFn } from "@tanstack/react-start";
import { ocrNotaFiscal } from "@/lib/ocr-nota.functions";
import {
  duracaoStr,
  fmtDate,
  fmtKg,
  pesoLiquido,
  type EvidenciaRow,
  type FonteNota,
  type PesagemComEvidencias,
  type TipoEvidencia,
} from "@/lib/pesagem-store";
import {
  obrasQueryOptions,
  pesagensQueryOptions,
  removeEvidencia,
  signedUrlsQueryOptions,
  uploadEvidencia,
} from "@/lib/pesagem-queries";
import { montarPayloadRecusa } from "@/lib/recusa";
import { atualizarPesagemAdmin, excluirPesagensLote, listarEmailsUsuarios, registrarLogPesagem } from "@/lib/admin.functions";
import { LogsPesagemDialog } from "@/components/logs-pesagem-dialog";
import { formatarNomeUsuario } from "@/lib/utils";
import { calcularPesoItem, calcularPesoNf, calcularPesoNfDaPesagem, fmtKgPt, fmtQtdUnidade, fmtToneladas, normalizarUnidade, paraNumero, pesoNfReferencia } from "@/lib/unidades";
import { identificarConcreto, validarCargaConcreto, casarFornecedorPorEmissor, derivarVolumeNota } from "@/lib/concreto";
import { sinalTolerancia, type SinalTolerancia } from "@/lib/sinal-tolerancia";
import {
  useToleranciasPadrao,
  useGerenciamentoFornecedores,
  useOverridesFornecedor,
} from "@/lib/tolerancias-heranca";
import { getFornecedoresConcreto } from "@/lib/concreto.functions";
import { getMyProfile, melhorarTextoOcorrencia } from "@/lib/ocorrencia.functions";
import { destinatariosOcorrencia, TIPOS_OCORRENCIA, assinaturaPerfil, montarPayloadOcorrencia } from "@/lib/ocorrencia";
import { enviarEmailResend } from "@/lib/email/resend.functions";
import { notificarToleranciaAcima } from "@/lib/ocorrencia-tolerancia.functions";
import { enviarAlertaToleranciaAcima } from "@/lib/whatsapp/alerta-tolerancia.functions";
import { construirMapaContratantes, rotuloContratante, identificarObraContratante } from "@/lib/contratante";
import { SeletorObraContratante } from "@/components/seletor-obra-contratante";
import { BUCKETS } from "@/integrations/db-schema";

export const Route = createFileRoute("/pesagem")({
  head: () => ({
    meta: [{ title: "Pesagem — Portal de Pesagem" }],
  }),
  component: PesagemPage,
});

const SUPER_ADMIN_EMAIL = "wsasistemas.ia@gmail.com";

type PeriodoGrid = "hoje" | "ontem" | "7d" | "30d" | "tudo";

const PERIODOS: { valor: PeriodoGrid; label: string }[] = [
  { valor: "hoje", label: "Hoje" },
  { valor: "ontem", label: "Ontem" },
  { valor: "7d", label: "7 dias" },
  { valor: "30d", label: "30 dias" },
  { valor: "tudo", label: "Tudo" },
];

function rotuloStatus(s: any) {
  if (s === "rascunho_entrada") return "Rascunho Entrada";
  if (s === "rascunho_saida") return "Rascunho Saída";
  if (s === "aguardando_saida") return "Aguardando saída";
  if (s === "aguardando_saida_ocorrencia") return "Aguardando saída c/ocorrência";
  if (s === "concluida") return "Concluída";
  if (s === "recusado") return "Recusado";
  if (s === "fechada_com_ocorrencia") return "Fechada c/ocorrência";
  return String(s);
}

function dentroDoPeriodo(iso: string | null | undefined, periodo: PeriodoGrid) {
  if (periodo === "tudo") return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  
  // Usar data local para o filtro ser intuitivo
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  
  // Diferença em milissegundos convertida para dias
  const diffTime = hoje.getTime() - dia.getTime();
  const diffDias = Math.floor(diffTime / 86_400_000);

  if (periodo === "hoje") return diffDias === 0;
  if (periodo === "ontem") return diffDias === 1;
  if (periodo === "7d") return diffDias <= 7;
  return diffDias <= 30;
}




const TIPOS_EV: { value: TipoEvidencia; label: string }[] = [
  { value: "placa", label: "Placa" },
  { value: "carga", label: "Carga" },
  { value: "lateral", label: "Lateral" },
  { value: "nota", label: "Nota" },
  { value: "outro", label: "Outro" },
];

function PesagemPage() {
  const [obraId, setObraId] = useObraAtual();
  const { menusPermitidos } = useAuth();
  const [modoSucata, setModoSucata] = useState(false);
  const podeSucata = !!menusPermitidos.sucata;
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="pesagem">
      {obraId ? (
        <div className="space-y-3 p-4">
          {podeSucata && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={modoSucata ? "default" : "outline"}
                onClick={() => setModoSucata((v) => !v)}
                className="font-heading"
              >
                <Recycle className="mr-2 h-4 w-4" /> SUCATA
              </Button>
              <span className="text-xs text-muted-foreground">
                {modoSucata
                  ? "Modo Sucata ativo — a pesagem é lida de forma inversa: tara na entrada, bruto na saída."
                  : "Ative o modo Sucata para a pesagem inversa de venda de sucata."}
              </span>
            </div>
          )}
          {podeSucata && modoSucata ? (
            <PainelSucata obraId={obraId === TODAS_OBRAS ? null : obraId} />
          ) : (
            <PesagemInner key={obraId} obraId={obraId === TODAS_OBRAS ? null : obraId} />
          )}
        </div>
      ) : (
        <div className="p-8 text-sm text-muted-foreground">Selecione uma obra para começar.</div>
      )}
    </AppShell>
  );
}

function PesagemInner({ obraId }: { obraId: string | null }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const { data: pesagens = [] } = useQuery(pesagensQueryOptions(obraId));
  const obraAtual = obras.find((o) => o.id === obraId);
  /** Sem obra específica: visão consolidada (somente consulta). */
  const todasObras = !obraId;
  const nomePorObra = useMemo(() => {
    const m = new Map<string, string>();
    obras.forEach((o) => m.set(o.id, `${o.coligada} – ${o.nome}`));
    return m;
  }, [obras]);
  const ocrFn = useServerFn(ocrNotaFiscal);
  const mapaContratantes = useMemo(() => construirMapaContratantes(pesagens), [pesagens]);



  // Emails dos usuários que criaram entrada/saída (para a coluna "Usuário")
  const listarEmailsFn = useServerFn(listarEmailsUsuarios);
  const userIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of pesagens as Array<PesagemComEvidencias & { criado_por?: string | null; saida_por?: string | null; ocorrencia_por?: string | null }>) {
      if (p.criado_por) s.add(p.criado_por);
      if (p.saida_por) s.add(p.saida_por);
      if (p.ocorrencia_por) s.add(p.ocorrencia_por);
    }
    return Array.from(s).sort();
  }, [pesagens]);
  const { data: emailMap = {} } = useQuery({
    queryKey: ["user-emails", userIds],
    enabled: userIds.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: () => listarEmailsFn({ data: { ids: userIds } }),
  });

  // Modo dupla pesagem
  const [modo, setModo] = useState<"entrada" | "saida">("entrada");
  const [pesagemPendenteId, setPesagemPendenteId] = useState<string>("");
  // Fluxo guiado da SAÍDA: primeiro localizar o caminhão pela placa
  const [saidaEtapa, setSaidaEtapa] = useState<"buscar" | "pronto">("buscar");
  const [buscaPlaca, setBuscaPlaca] = useState<string>("");
  const [candidatos, setCandidatos] = useState<PesagemComEvidencias[]>([]);

  // Balança + detecção mobile
  const scale = useCelmiScale();
  const balancaConectada = scale.status === "connected";
  const isMobile = useIsMobile();
  // Web Serial só existe em Chrome/Edge desktop. No celular sempre cai no modo manual.
  const modoBalanca: "auto" | "manual" = !isMobile && scale.supported ? "auto" : "manual";
  const saidaDestravada = modo !== "saida" || saidaEtapa === "pronto";

  // Peso capturado (kg)
  const [peso, setPeso] = useState<number | "">("");
  const [pesoFonte, setPesoFonte] = useState<"balanca" | "manual">("manual");

  // Nota fiscal
  const [chave, setChave] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [emissao, setEmissao] = useState("");
  const [emissor, setEmissor] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [placa, setPlaca] = useState("");
  const [uf, setUf] = useState("");
  const [motorista, setMotorista] = useState("");
  
  const [pesoNf, setPesoNf] = useState<number | "">("");
  const [fonteNota, setFonteNota] = useState<FonteNota>("manual");
  const [contratante, setContratante] = useState("");
  const [contratanteOrigem, setContratanteOrigem] = useState<"auto" | "manual" | "nao_identificado" | null>(null);
  /** Documento não fiscal de ÁGUA (comprovante caminhão-pipa): formulário simplificado. */
  const [docNaoFiscalAgua, setDocNaoFiscalAgua] = useState(false);
  const obraDestino = useMemo(() => {
    const nome = contratante.trim().toUpperCase();
    return obras.find((o) => o.nome.trim().toUpperCase() === nome) ?? obraAtual ?? null;
  }, [contratante, obraAtual, obras]);
  const [emailFornecedor, setEmailFornecedor] = useState("");
  // Novos campos obrigatórios (OCR ou manual)
  const [modelo, setModelo] = useState("");
  const [marca, setMarca] = useState("");
  const [carreta, setCarreta] = useState("");
  const [valorTotalNf, setValorTotalNf] = useState<number | "">("");
  type ItemLinha = { descricao: string; quantidade: number | ""; unidade: string; valor_unitario: number | "" };
  const [itensNf, setItensNf] = useState<ItemLinha[]>([{ descricao: "", quantidade: "", unidade: "", valor_unitario: "" }]);

  // --- Módulo Concreto ---
  const [modoPesagem, setModoPesagem] = useState<"dupla" | "unica_excecao">("dupla");
  const [taraInformada, setTaraInformada] = useState<number | "">("");
  const [volumeResiduo, setVolumeResiduo] = useState<number | "">("");
  const [fornecedoresConcreto, setFornecedoresConcreto] = useState<any[]>([]);
  const [carregandoFornecedoresConcreto, setCarregandoFornecedoresConcreto] = useState(true);
  const [tracoIdentificado, setTracoIdentificado] = useState<any>(null);
  const [isPadraoFallback, setIsPadraoFallback] = useState(false);

  const [fornecedorIdentificado, setFornecedorIdentificado] = useState<any>(null);
  const [tracoConfirmadoManual, setTracoConfirmadoManual] = useState(false);
  const [fornecedorConfirmadoManual, setFornecedorConfirmadoManual] = useState(false);
  const [resultadoConcreto, setResultadoConcreto] = useState<any>(null);
  const [dadosConcretoOcr, setDadosConcretoOcr] = useState<{ fck?: number; slump_nominal?: number; slump_unidade?: string } | null>(null);
  /** Texto do quadro "Dados adicionais" da nota (fonte do volume em notas de remessa). */
  const [dadosAdicionaisNf, setDadosAdicionaisNf] = useState<string>("");
  /** Volume (m³) informado manualmente pelo usuário (tem prioridade sobre a nota). */
  const [volumeManual, setVolumeManual] = useState<number | "">("");
  /** Volume (m³) devolvido pela leitura da nota. */
  const [volumeOcr, setVolumeOcr] = useState<number | null>(null);
  /** Volume (m³) gravado no registro de entrada — usado ao reaferir na saída. */
  const [volumeRegistro, setVolumeRegistro] = useState<number | null>(null);
  /** Peso de entrada gravado no registro localizado pela placa (base do líquido). */
  const [entradaKgRegistro, setEntradaKgRegistro] = useState<number | null>(null);



  const getFornConcretoFn = useServerFn(getFornecedoresConcreto);

  useEffect(() => {
    getFornConcretoFn()
      .then(setFornecedoresConcreto)
      .catch(console.error)
      .finally(() => setCarregandoFornecedoresConcreto(false));
  }, []);

  // Motor de identificação automática de Concreto
  // Regra oficial: o campo Fornecedor (card Peso) segue o EMISSOR da nota,
  // priorizando o primeiro nome significativo (ex.: SUPERMIX CONCRETO S/A -> SUPERMIX).
  useEffect(() => {
    const emissorLimpo = emissor.trim();
    if (!fornecedoresConcreto.length || !emissorLimpo) {
      if (!fornecedorConfirmadoManual && !tracoConfirmadoManual && !emissorLimpo) {
        setFornecedorIdentificado(null);
        setTracoIdentificado(null);
      }
      return;
    }

    const descricoes = itensNf.map(i => i.descricao).join(" ");
    const match = identificarConcreto(emissorLimpo, descricoes, fornecedoresConcreto, dadosConcretoOcr ?? undefined);
    const fornecedorAlvo = match?.fornecedor ?? casarFornecedorPorEmissor(emissorLimpo, fornecedoresConcreto);

    if (!fornecedorConfirmadoManual) {
      setFornecedorIdentificado(fornecedorAlvo ?? null);
      if (!fornecedorAlvo) setTracoIdentificado(null);
    }

    if (match?.traco && !tracoConfirmadoManual) {
      setTracoIdentificado(match.traco);
      setIsPadraoFallback(!!match.isPadraoFallback);
    } else if (!tracoConfirmadoManual) {
      setIsPadraoFallback(false);
    }

  }, [emissor, itensNf, fornecedoresConcreto, tracoConfirmadoManual, fornecedorConfirmadoManual, dadosConcretoOcr]);


  // Volume da carga: manual > dados adicionais da nota > item de concreto em m³.
  const volumeNota = useMemo(
    () =>
      derivarVolumeNota({
        itens: itensNf,
        dadosAdicionais: dadosAdicionaisNf,
        volumeOcr,
        volumeManual: volumeManual === "" ? (volumeRegistro ?? null) : volumeManual,
      }),
    [itensNf, dadosAdicionaisNf, volumeOcr, volumeManual, volumeRegistro],
  );

  // Cálculo de aferição de concreto
  useEffect(() => {
    if (!fornecedorIdentificado || !tracoIdentificado || !volumeNota.volume) {
      setResultadoConcreto(null);
      return;
    }

    const volume = volumeNota.volume;

    // Na saída o aferido é o LÍQUIDO real do registro (entrada − saída capturada).
    const aferidoSaida =
      modo === "saida" && entradaKgRegistro != null && peso !== ""
        ? Math.abs(Number(entradaKgRegistro) - Number(peso))
        : null;

    const res = validarCargaConcreto({
      fornecedor: fornecedorIdentificado,
      traco: tracoIdentificado,
      volume,
      modo: modoPesagem,
      pesoEntrada: Number(peso || 0),
      pesoSaida: Number(scale.leitura?.peso || 0), // Usar leitura atual
      taraInformada: Number(taraInformada || 0),
      pesoNF: Number(pesoNf || 0),
      aferidoDireto: aferidoSaida,
    });

    setResultadoConcreto({ ...res, origem_volume: volumeNota.origem, detalhe_volume: volumeNota.detalhe });
  }, [fornecedorIdentificado, tracoIdentificado, modoPesagem, peso, scale.leitura?.peso, taraInformada, pesoNf, volumeNota, entradaKgRegistro, modo]);


  // Evidências (arquivos ainda não salvos, aguardando salvar pesagem)
  const [evPend, setEvPend] = useState<{ file: File; tipo: TipoEvidencia; preview: string }[]>([]);
  const [tipoEvidencia, setTipoEvidencia] = useState<TipoEvidencia>("placa");
  const notaCamRef = useRef<HTMLInputElement>(null);
  const notaFileRef = useRef<HTMLInputElement>(null);
  const evRef = useRef<HTMLInputElement>(null);

  // Modal recusa
  const [openRecusa, setOpenRecusa] = useState(false);
  const [obsRecusa, setObsRecusa] = useState("");

  // Ocorrência (inline no card Evidências)
  const [ocorrEstagio, setOcorrEstagio] = useState<"entrada" | "saida">("entrada");
  const [ocorrTipo, setOcorrTipo] = useState<string>("");
  const [ocorrTipoOutro, setOcorrTipoOutro] = useState<string>("");
  const [ocorrRelato, setOcorrRelato] = useState<string>("");
  const [ccInput, setCcInput] = useState<string>("");
  const [ccList, setCcList] = useState<string[]>([]);
  // Ocorrência sobre registro existente (acionada via "Ações → Ocorrências" no histórico)
  const [ocorrenciaAlvoId, setOcorrenciaAlvoId] = useState<string | null>(null);
  const [alvoTemPesoSaida, setAlvoTemPesoSaida] = useState(false);
  const [confirmSemPeso, setConfirmSemPeso] = useState(false);
  const getPerfilFn = useServerFn(getMyProfile);
  const melhorarFn = useServerFn(melhorarTextoOcorrencia);
  const { data: perfilOcorr } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getPerfilFn(),
    staleTime: 5 * 60_000,
  });
  const melhorarMut = useMutation({
    mutationFn: async () => {
      if (!ocorrRelato.trim()) throw new Error("Escreva um rascunho antes de melhorar o texto.");
      const tipoLabel = ocorrTipo === "Outro" ? ocorrTipoOutro || "Outro" : ocorrTipo;
      return melhorarFn({ data: { texto: ocorrRelato, tipo: tipoLabel || undefined } });
    },
    onSuccess: (res) => {
      setOcorrRelato(res.texto);
      toast.success("Texto revisado pela IA.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao melhorar o texto."),
  });

  // Busca no grid
  const [busca, setBusca] = useState("");
  const [contratanteFiltro, setContratanteFiltro] = useState<string>("__all__");
  const [pagina, setPagina] = useState(1);
  const [ordenacao, setOrdenacao] = useState<{ coluna: string; direcao: "asc" | "desc" } | null>(null);
  const [filtrosData, setFiltrosData] = useState<Record<string, FaixaData>>({});

  const [porPagina, setPorPagina] = useState(25);
  // Período padrão: somente os registros do dia
  const [periodo, setPeriodo] = useState<PeriodoGrid>("hoje");
  // Ajuste automático do período (uma única vez por obra) quando não há registros de hoje.
  const autoPeriodoRef = useRef(false);
  const [avisoPeriodoAuto, setAvisoPeriodoAuto] = useState(false);
  const [limiteAnteriores, setLimiteAnteriores] = useState(20);
  // Seleção múltipla para exclusão
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [alertExcluir, setAlertExcluir] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const excluirLoteFn = useServerFn(excluirPesagensLote);

  const excluirLoteMut = useMutation({
    mutationFn: (ids: string[]) => excluirLoteFn({ data: { ids } }),
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} registro(s) excluído(s) com sucesso.`);
      setSelecionados(new Set());
      setAlertExcluir({ open: false, ids: [] });
      qc.invalidateQueries({ queryKey: ["pesagens"] });
    },
    onError: (e) => {
      setAlertExcluir({ open: false, ids: [] });
      toast.error(e instanceof Error ? e.message : "Falha ao excluir registros.");
    },
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluirLoteFn({ data: { ids: [id] } }),
    onSuccess: () => {
      toast.success("Registro excluído com sucesso.");
      setAlertExcluir({ open: false, ids: [] });
      qc.invalidateQueries({ queryKey: ["pesagens"] });
    },
    onError: (e) => {
      setAlertExcluir({ open: false, ids: [] });
      toast.error(e instanceof Error ? e.message : "Falha ao excluir registro.");
    },
  });

  const excluirLote = () => {
    if (selecionados.size === 0) return;
    setAlertExcluir({ open: true, ids: Array.from(selecionados) });
  };

  const toggleSelecao = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTudo = () => {
    if (selecionados.size === pesagensPagina.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pesagensPagina.map((p) => p.id)));
    }
  };

  // Filtros embutidos nos títulos das colunas
  const [filtrosLista, setFiltrosLista] = useState<Record<string, string[]>>({});
  const [filtrosTexto, setFiltrosTexto] = useState<Record<string, string>>({});
  const [filtrosNum, setFiltrosNum] = useState<Record<string, FaixaNum>>({});

  const [fotosDialog, setFotosDialog] = useState<{ open: boolean; pesagem: PesagemComEvidencias | null }>({ open: false, pesagem: null });
  const ocorrDetDialog0 = useState<{ open: boolean; pesagem: PesagemComEvidencias | null }>({ open: false, pesagem: null });
  const [ocorrDetDialog, setOcorrDetDialog] = ocorrDetDialog0;

  // Edição de registro (somente super admin)
  const isSuperAdmin = (user?.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
  type EditForm = {
    id: string;
    numero_nota: string;
    emissor: string;
    contratante: string;
    chave_nfe: string;
    descricao: string;
    placa: string;
    transportadora: string;
    motorista: string;
    modelo: string;
    marca: string;
    carreta: string;
    uf: string;
    valor_total_nf: string;
    qtd_total: string;
    peso_nf: string;
    peso_entrada: string;
    peso_saida: string;
    itens: { descricao: string; quantidade: string; unidade: string; valor_unitario: string }[];
    // Dados históricos da carta de traço e da apuração
    traco_id?: string | null;
    /** Apenas UI: usina escolhida para filtrar as cartas de traço. */
    fornecedor_concreto_id?: string | null;
    /** Marca que a carta foi trocada manualmente na edição. */
    carta_alterada?: boolean;
    resultado_afericao?: any | null;
    peso_esperado?: number | null;
    tolerancia_aplicada?: number | null;
    status_afericao?: string | null;
    volume_m3?: number | null;
    /** Marca que o volume foi corrigido manualmente na edição. */
    volume_alterado?: boolean;
    diferenca_kg?: number | null;
    diferenca_pct?: number | null;
    /** Obrigatória: motivo da alteração (auditoria). */
    justificativa: string;
  };
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [logsDialog, setLogsDialog] = useState<{ open: boolean; id: string | null; rotulo: string }>({
    open: false,
    id: null,
    rotulo: "",
  });
  const registrarLogFn = useServerFn(registrarLogPesagem);
  const atualizarPesagemFn = useServerFn(atualizarPesagemAdmin);
  const notificarToleranciaFn = useServerFn(notificarToleranciaAcima);
  const alertaWhatsAppFn = useServerFn(enviarAlertaToleranciaAcima);

  /** Alerta WhatsApp ao engenheiro responsável, com as mensagens de retorno. */
  function dispararAlertaTolerancia(
    pesagemId: string,
    sinal: SinalTolerancia,
    forcarReenvio = false,
  ) {
    void alertaWhatsAppFn({ data: { pesagemId, sinal, forcarReenvio } })
      .then((res) => {
        const resumo = [
          `${res.enviados ?? 0} enviado(s)`,
          (res.semTelefone ?? 0) > 0 ? `${res.semTelefone} sem telefone` : null,
          (res.falhas ?? 0) > 0 ? `${res.falhas} falha(s)` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        if (res.resultado === "enviado") {
          toast.success(`Alerta WhatsApp: ${resumo}.`, {
            description: res.motivo
              ? `Último erro: ${res.motivo}`
              : "Veja o conteúdo em WhatsApp › Logs de Alertas de Tolerância.",
          });
        } else if (res.resultado === "sem_destinatario") {
          toast.warning("Alerta não enviado: responsável/telefone não configurado.");
        } else if (res.resultado === "falha") {
          toast.error(`Falha no envio do alerta: ${res.motivo ?? "motivo não informado"}`);
        } else if (forcarReenvio) {
          toast.info(`Alerta não enviado: ${res.motivo ?? "sem condições de envio"}`);
        }
        qc.invalidateQueries({ queryKey: ["whatsapp-alertas"] });
      })
      .catch((e) => {
        toast.error(
          `Falha no envio do alerta: ${e instanceof Error ? e.message : "erro inesperado"}`,
        );
      });
  }


  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault?.(); // confirma que a tela de Pesagem tratou o pedido
      abrirEdicao(e.detail);
    };
    window.addEventListener("abrir-edicao-pesagem", handler);
    return () => window.removeEventListener("abrir-edicao-pesagem", handler);
  }, [fornecedoresConcreto, mapaContratantes]);

  // Abertura vinda de outra tela (Dashboard → Estratificação → Editar registro)
  const editarParamTratado = useRef(false);
  useEffect(() => {
    if (editarParamTratado.current || carregandoFornecedoresConcreto) return;
    const id = new URLSearchParams(window.location.search).get("editar");
    if (!id) return;
    editarParamTratado.current = true;
    abrirEdicao({ id } as PesagemComEvidencias);
    window.history.replaceState(null, "", window.location.pathname);
  }, [carregandoFornecedoresConcreto]);

  async function abrirEdicao(p: PesagemComEvidencias) {
    const { data: registroCompleto, error } = await supabase
      .from("pesagens")
      .select("*, evidencias(id, pesagem_id, tipo, storage_path, nome, created_at)")
      .eq("id", p.id)
      .single();

    if (error) {
      toast.error("Não foi possível carregar todos os dados do registro.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pa = registroCompleto as any;
    const itens = Array.isArray(pa.itens_nf) ? pa.itens_nf : [];
    setEditForm({
      id: pa.id,
      numero_nota: pa.numero_nota ?? "",
      emissor: pa.emissor ?? "",
      contratante: rotuloContratante(pa.contratante, mapaContratantes),
      chave_nfe: pa.chave_nfe ?? "",
      descricao: pa.descricao ?? "",
      placa: pa.placa ?? "",
      transportadora: pa.transportadora ?? "",
      motorista: pa.motorista ?? "",
      modelo: pa.modelo ?? "",
      marca: pa.marca ?? "",
      carreta: pa.carreta ?? "",
      uf: pa.uf ?? "",
      valor_total_nf: pa.valor_total_nf != null ? String(pa.valor_total_nf) : "",
      qtd_total: pa.qtd_total != null ? String(pa.qtd_total) : "",
      peso_nf: pa.peso_nf != null ? String(pa.peso_nf) : "",
      peso_entrada: pa.peso_entrada != null ? String(pa.peso_entrada) : "",
      peso_saida: pa.peso_saida != null ? String(pa.peso_saida) : "",
      itens:
        itens.length > 0
          ? itens.map((it: { descricao?: string; quantidade?: number; unidade?: string; valor_unitario?: number }) => ({
              descricao: it?.descricao ?? "",
              quantidade: it?.quantidade != null ? String(it.quantidade) : "",
              unidade: (it?.unidade ?? "").toUpperCase(),
              valor_unitario: it?.valor_unitario != null ? String(it.valor_unitario) : "",
            }))
          : [{ descricao: "", quantidade: "", unidade: "", valor_unitario: "" }],
      traco_id: pa.traco_id,
      fornecedor_concreto_id:
        fornecedoresConcreto.find((fc: any) =>
          fc.tracos?.some((t: any) => t.id === pa.traco_id),
        )?.id ?? null,
      carta_alterada: false,
      resultado_afericao: pa.resultado_afericao,
      peso_esperado: pa.peso_esperado,
      tolerancia_aplicada: pa.tolerancia_aplicada,
      status_afericao: pa.status_afericao,
      volume_m3: pa.volume_m3,
      diferenca_kg: pa.diferenca_kg,
      diferenca_pct: pa.diferenca_pct,
      justificativa: "",
    });
  }

  const editarMut = useMutation({
    mutationFn: async (f: EditForm) => {
      const num = (v: string) => paraNumero(v);
      const txt = (v: string) => (v.trim() === "" ? null : v.trim());
      const qtdTotalNum = num(f.qtd_total);
      const itensSanitizados = f.itens
        .filter((i) => i.descricao.trim() || i.quantidade || i.valor_unitario)
        .map((i, idx, arr) => ({
          descricao: i.descricao.trim() || null,
          quantidade: arr.length === 1 && qtdTotalNum != null ? qtdTotalNum : num(i.quantidade),
          unidade: normalizarUnidade(i.unidade.trim()) || null,
          valor_unitario: num(i.valor_unitario),
        }));
      // Carta de traço trocada OU volume corrigido na edição → reapura os dados técnicos.
      const cartaPatch: Record<string, unknown> = (() => {
        if (!f.carta_alterada && !f.volume_alterado) return {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const forn: any = fornecedoresConcreto.find((x: any) => x.id === f.fornecedor_concreto_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const traco: any = forn?.tracos?.find((t: any) => t.id === f.traco_id);
        const base = f.carta_alterada
          ? { traco_confirmado_manual: true, fornecedor_confirmado_manual: true }
          : {};
        if (!traco) {
          return {
            ...base,
            traco_id: null,
            peso_esperado: null,
            tolerancia_aplicada: null,
            diferenca_kg: null,
            diferenca_pct: null,
            status_afericao: null,
          };
        }
        const ap = f.resultado_afericao && typeof f.resultado_afericao === "object" ? f.resultado_afericao : {};
        const rho = Number(traco.densidade_teorica ?? traco.densidade_pratica ?? 0);
        const volume = Number(f.volume_m3 ?? ap.volume ?? qtdTotalNum ?? 0);
        const tol = Number(traco.tolerancia_peso ?? forn?.tolerancia_padrao ?? 4);
        const esperado = rho > 0 && volume > 0 ? volume * rho : null;
        const entrada = num(f.peso_entrada);
        const saida = num(f.peso_saida);
        const aferido = entrada != null && saida != null ? Math.abs(entrada - saida) : null;
        const difKg = esperado != null && aferido != null ? aferido - esperado : null;
        const difPct = esperado && difKg != null ? (difKg / esperado) * 100 : null;
        const status = difPct == null ? null : difPct < -tol ? "abaixo" : difPct > tol ? "acima" : "conforme";
        return {
          ...base,
          traco_id: f.traco_id ?? null,
          peso_esperado: esperado,
          tolerancia_aplicada: tol,
          volume_m3: volume > 0 ? volume : null,
          diferenca_kg: difKg,
          diferenca_pct: difPct,
          status_afericao: status,
        };
      })();
      const patch = {
        id: f.id,
        numero_nota: txt(f.numero_nota),
        emissor: txt(f.emissor),
        contratante: txt(f.contratante),
        chave_nfe: txt(f.chave_nfe),
        descricao: txt(f.descricao),
        placa: txt(f.placa),
        transportadora: txt(f.transportadora),
        motorista: txt(f.motorista),
        modelo: txt(f.modelo),
        marca: txt(f.marca),
        carreta: txt(f.carreta),
        uf: txt(f.uf),
        valor_total_nf: num(f.valor_total_nf),
        qtd_total: qtdTotalNum,
        // Peso da NF sempre recalculado a partir dos itens corrigidos.
        peso_nf:
          pesoNfReferencia({ itens_nf: itensSanitizados, qtd_total: qtdTotalNum }).kg ??
          num(f.peso_nf),
        peso_entrada: num(f.peso_entrada),
        peso_saida: num(f.peso_saida),
        itens_nf: itensSanitizados,
        ...cartaPatch,
        // Registro corrigido sai de rascunho e passa para "Em análise"
        ...(() => {
          const orig = pesagens.find((p) => p.id === f.id) as any;
          return orig?.status === "rascunho_entrada" && num(f.peso_entrada) != null
            ? { status: "aguardando_saida" as const }
            : {};
        })(),
        justificativa: f.justificativa.trim(),
      };
      await atualizarPesagemFn({ data: patch });

      return patch;
    },
    onSuccess: async (patch) => {
      toast.success("Registro atualizado. Peso calculado recalculado.");
      qc.invalidateQueries({ queryKey: ["pesagem-logs"] });
      setEditForm(null);
      // Atualização imediata do cache (grid e dashboards leem a mesma lista),
      // antes mesmo do refetch chegar do servidor.
      qc.setQueriesData<PesagemComEvidencias[]>({ queryKey: ["pesagens"] }, (antigo) =>
        Array.isArray(antigo)
          ? antigo.map((p) =>
              p.id === patch.id ? ({ ...p, ...patch } as PesagemComEvidencias) : p,
            )
          : antigo,
      );

      // Ocorrência automática quando a edição resultar em tolerância acima do permitido.
      const original = pesagens.find((p) => p.id === patch.id);
      if (original) {
        const merged = { ...original, ...patch } as PesagemComEvidencias;
        const sinalEdicao = calcularSinalRegistro(merged);
        if (sinalEdicao.chave === "acima") {
          void notificarToleranciaFn({ data: { pesagemId: patch.id, sinal: sinalEdicao } }).catch(
            () => undefined,
          );
          dispararAlertaTolerancia(patch.id, sinalEdicao);
        }
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pesagens"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["dashboard"], refetchType: "all" }),
      ]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar alterações."),
  });



  // Controle de destaque em vermelho: só marca campos vazios após tentativa de salvar.
  const [tentouSalvar, setTentouSalvar] = useState(false);


  const pendentes = useMemo(
    () => pesagens.filter((p: any) => 
      p.status === "aguardando_saida" || 
      p.status === "aguardando_saida_ocorrencia" ||
      p.status === "rascunho_entrada" ||
      p.status === "rascunho_saida"
    ),
    [pesagens],
  );

  const pesoAtualBalanca = scale.leitura?.peso ?? null;
  const pesoAtualEstavel = scale.leitura?.estavel ?? false;

  function capturarPesoBalanca() {
    if (!pesoAtualBalanca || !pesoAtualEstavel) {
      toast.error("Aguardando peso estável na balança.");
      return;
    }
    setPeso(pesoAtualBalanca);
    setPesoFonte("balanca");
    toast.success(`Peso capturado: ${pesoAtualBalanca.toLocaleString("pt-BR")} kg`);
  }

  function limparOcorrencia() {
    setOcorrTipo("");
    setOcorrTipoOutro("");
    setOcorrRelato("");
    setEvPend((prev) => prev.filter((e) => e.tipo === "nota"));
    setOcorrenciaAlvoId(null);
    setAlvoTemPesoSaida(false);
  }

  function limparForm() {
    setPeso("");
    setPesoFonte("manual");
    setChave("");
    setNumeroNota("");
    setEmissao("");
    setEmissor("");
    setTransportadora("");
    setPlaca("");
    setUf("");
    setMotorista("");
    
    setPesoNf("");
    setFonteNota("manual");
    setContratante("");
    setContratanteOrigem(null);
    setEmailFornecedor("");
    setModelo("");
    setMarca("");
    setCarreta("");
    setValorTotalNf("");
    setItensNf([{ descricao: "", quantidade: "", unidade: "", valor_unitario: "" }]);
    setEvPend([]);
    setPesagemPendenteId("");
    setObsRecusa("");
    setBuscaPlaca("");
    setCandidatos([]);
    setSaidaEtapa("buscar");
    setTentouSalvar(false);
    setOcorrTipo("");
    setOcorrTipoOutro("");
    setOcorrRelato("");
    setOcorrenciaAlvoId(null);
    setAlvoTemPesoSaida(false);
    setVolumeRegistro(null);
    setEntradaKgRegistro(null);
    setDadosAdicionaisNf("");
    setVolumeManual("");
    setVolumeOcr(null);
    setDocNaoFiscalAgua(false);

  }

  // Modo ocorrência: qualquer preenchimento no card de ocorrência bloqueia a gravação normal
  const ocorrenciaEmPreenchimento =
    !!ocorrTipo.trim() ||
    !!ocorrTipoOutro.trim() ||
    !!ocorrRelato.trim() ||
    evPend.some((e) => e.tipo !== "nota") ||
    !!ocorrenciaAlvoId;

  function irParaOcorrencia() {
    const el = document.getElementById("ocorrencia-card");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-warning", "animate-pulse");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-warning", "animate-pulse"), 1200);
  }


  function trocarModo(v: "entrada" | "saida") {
    setModo(v);
    setOcorrEstagio(v);
    limparForm();
  }

  function trocarPlaca() {
    setPesagemPendenteId("");
    setSaidaEtapa("buscar");
    setCandidatos([]);
    setPeso("");
    setEvPend([]);
  }

  function localizarPlaca() {
    const q = buscaPlaca.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (q.length < 3) {
      toast.error("Informe a placa do caminhão (mín. 3 caracteres).");
      return;
    }
    const encontrados = pendentes.filter((p) => {
      const pl = (p.placa ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      // Somente status "aguardando_saida" (Regra 2)
      return p.status === "aguardando_saida" && pl.includes(q);
    });
    if (encontrados.length === 0) {
      setCandidatos([]);
      toast.error(`Nenhuma pesagem de entrada em aberto para esta placa.`);
      return;
    }
    if (encontrados.length === 1) {
      setCandidatos([]);
      setPesagemPendenteId(encontrados[0].id);
      setSaidaEtapa("pronto");
      toast.success(`Caminhão ${encontrados[0].placa} localizado.`);
      return;
    }
    setCandidatos(encontrados);
  }

  function selecionarCandidato(id: string) {
    setPesagemPendenteId(id);
    setSaidaEtapa("pronto");
    setCandidatos([]);
  }

  // Acionada pelo menu "Ações → Ocorrências" do histórico. Carrega o registro
  // (via placa/id) no painel de ocorrência, sem alterar o peso já aferido.
  function abrirOcorrenciaRegistro(p: PesagemComEvidencias) {
    setModo("saida");
    setOcorrEstagio("saida");
    setSaidaEtapa("pronto");
    setBuscaPlaca(p.placa ?? "");
    setCandidatos([]);

    if (p.status === "aguardando_saida" || p.status === "aguardando_saida_ocorrencia") {
      // Registro pendente: usa o fluxo normal — o useEffect preenche os campos
      setOcorrenciaAlvoId(null);
      setAlvoTemPesoSaida(false);
      setPesagemPendenteId(p.id);
    } else {
      // Registro já concluído/fechado: carrega manualmente e marca alvo
      setPesagemPendenteId("");
      setOcorrenciaAlvoId(p.id);
      const temSaida = p.peso_saida != null;
      setAlvoTemPesoSaida(temSaida);
      setChave(p.chave_nfe ?? "");
      setNumeroNota(p.numero_nota ?? "");
      setEmissao(p.emissao ?? "");
      setEmissor(p.emissor ?? "");
      setTransportadora(p.transportadora ?? "");
      setPlaca(p.placa ?? "");
      setUf(p.uf ?? "");
      setMotorista(p.motorista ?? "");
      setPesoNf(p.peso_nf != null ? Number(p.peso_nf) : "");
      setFonteNota(p.fonte_nota);
      setContratante(p.contratante ?? "");
      setContratanteOrigem(p.contratante ? "manual" : null);
      setPeso(temSaida ? Number(p.peso_saida) : "");
      setPesoFonte(p.fonte_peso_saida ?? "manual");
      // Pré-carrega os campos de ocorrência de SAÍDA (edição pelo menu abre no estágio saída)
      const pSaida = p as PesagemComEvidencias & {
        ocorrencia_saida_tipo?: string | null;
        ocorrencia_saida_tipo_outro?: string | null;
        ocorrencia_saida_relato?: string | null;
      };
      setOcorrTipo(pSaida.ocorrencia_saida_tipo ?? "");
      setOcorrTipoOutro(pSaida.ocorrencia_saida_tipo_outro ?? "");
      setOcorrRelato(pSaida.ocorrencia_saida_relato ?? "");
    }

    // Rola para o card de ocorrência
    setTimeout(() => {
      document.getElementById("ocorrencia-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    toast.info(`Ocorrência para placa ${p.placa ?? "—"}.`);
  }



  // Carrega dados de uma pesagem pendente quando o operador seleciona
  useEffect(() => {
    if (modo !== "saida" || !pesagemPendenteId) return;
    const p = pendentes.find((x) => x.id === pesagemPendenteId);
    if (!p) return;
    setChave(p.chave_nfe ?? "");
    setNumeroNota(p.numero_nota ?? "");
    setEmissao(p.emissao ?? "");
    setEmissor(p.emissor ?? "");
    setTransportadora(p.transportadora ?? "");
    setPlaca(p.placa ?? "");
    setUf(p.uf ?? "");
    setMotorista(p.motorista ?? "");
    
    setPesoNf(p.peso_nf != null ? Number(p.peso_nf) : "");
    setFonteNota(p.fonte_nota);
    setContratante(p.contratante ?? "");
    setContratanteOrigem(p.contratante ? "manual" : null);
    const pAny = p as PesagemComEvidencias & {
      modelo?: string | null;
      marca?: string | null;
      carreta?: string | null;
      valor_total_nf?: number | string | null;
      itens_nf?: Array<{ descricao?: string; quantidade?: number; unidade?: string; valor_unitario?: number }> | null;
    };
    setModelo((pAny.modelo ?? "").toUpperCase());
    setMarca((pAny.marca ?? "").toUpperCase());
    setCarreta((pAny.carreta ?? "").toUpperCase());
    setValorTotalNf(pAny.valor_total_nf != null ? Number(pAny.valor_total_nf) : "");
    setItensNf(
      Array.isArray(pAny.itens_nf) && pAny.itens_nf.length > 0
        ? pAny.itens_nf.map((it) => ({
            descricao: it?.descricao ?? "",
            quantidade: typeof it?.quantidade === "number" ? it.quantidade : "",
            unidade: (it?.unidade ?? "").toUpperCase(),
            valor_unitario: typeof it?.valor_unitario === "number" ? it.valor_unitario : "",
          }))
        : [{ descricao: "", quantidade: "", unidade: "", valor_unitario: "" }],
    );
    setPeso("");
    setEntradaKgRegistro(p.peso_entrada != null ? Number(p.peso_entrada) : null);

    // Reidrata a carta de traço vinculada na ENTRADA para que a saída não perca
    // o Peso Carta Traço nem recalcule com dados diferentes.
    const tracoIdReg = (pAny as any).traco_id as string | null | undefined;

    if (tracoIdReg && fornecedoresConcreto.length) {
      const fornReg = fornecedoresConcreto.find((f: any) =>
        (f.tracos ?? []).some((t: any) => t.id === tracoIdReg),
      );
      const tracoReg = fornReg?.tracos?.find((t: any) => t.id === tracoIdReg) ?? null;
      if (fornReg && tracoReg) {
        setFornecedorIdentificado(fornReg);
        setTracoIdentificado(tracoReg);
        setFornecedorConfirmadoManual(true);
        setTracoConfirmadoManual(true);
        setIsPadraoFallback(!!(pAny as any).is_padrao_fallback);
        const volReg = Number((pAny as any).volume_m3 ?? 0);
        if (volReg > 0) setVolumeRegistro(volReg);
        else setVolumeRegistro(null);
        setDadosAdicionaisNf((pAny as any).dados_adicionais_nf ?? "");
        setVolumeOcr(null);
        setVolumeManual("");
      }
    } else {
      setVolumeRegistro(null);
    }
  }, [pesagemPendenteId, modo, pendentes, fornecedoresConcreto]);


  // ---- OCR
  const ocrMut = useMutation({
    mutationFn: async (arquivo: { dataUrl: string; mimeType: string; filename?: string }) =>
      ocrFn({ data: { arquivo: arquivo.dataUrl, mimeType: arquivo.mimeType, filename: arquivo.filename } }),

    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.motivo);
        return;
      }
      const c = r.campos;

      // Documento NÃO fiscal de ÁGUA (ex.: comprovante de abastecimento por caminhão-pipa).
      // Exige classificação positiva de documento não fiscal + indício explícito de água,
      // e nunca ativa quando há sinais de nota fiscal/concreto (evita cair em nota de concreto
      // que lista ÁGUA como matéria-prima).
      const chaveValida = (c.chave_nfe ?? "").replace(/\D/g, "").length === 44;
      const textoDoc = [c.descricao, c.produto_predominante]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      const categoriaAgua =
        (c.produto_categoria ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim() === "agua";
      const indicioAgua =
        categoriaAgua ||
        /CAMINHAO[- ]?PIPA|CAMINHOES[- ]?PIPA|ABASTECIMENTO DE AGUA|COMPROVANTE DE ABASTECIMENTO/.test(textoDoc);
      const naoFiscalDeclarado = c.tipo_nota === "nao_fiscal" || c.documento_nao_fiscal === true;
      const sinaisFiscais =
        chaveValida ||
        (typeof c.valor_total_nf === "number" && c.valor_total_nf > 0) ||
        (Array.isArray(c.itens) && c.itens.length > 1) ||
        (!!c.concreto &&
          (c.concreto.fck != null ||
            c.concreto.slump_nominal != null ||
            !!c.concreto.dosagem ||
            c.concreto.volume_m3 != null));
      const ehAguaNaoFiscal = naoFiscalDeclarado && indicioAgua && !sinaisFiscais;

      setDocNaoFiscalAgua(ehAguaNaoFiscal);
      if (ehAguaNaoFiscal) {
        toast.info("Documento não fiscal de ÁGUA identificado — preencha apenas os campos essenciais.");
      }

      if (c.chave_nfe) setChave(c.chave_nfe);
      if (c.numero_nota) setNumeroNota(c.numero_nota);
      if (c.emissao) setEmissao(c.emissao);
      if (c.emissor) setEmissor(c.emissor);
      if (c.transportadora) setTransportadora(c.transportadora);
      if (c.placa) setPlaca(c.placa);
      if (c.uf) setUf(c.uf);
      if (c.motorista) setMotorista(c.motorista);
      
      if (typeof c.peso_kg === "number") setPesoNf(c.peso_kg);
      if (typeof c.tara_kg === "number") setTaraInformada(c.tara_kg);
      // Contratante = obra do cadastro. Tenta identificar por CNPJ e depois por razão social.
      const ident = identificarObraContratante(c, obras);
      if (ident.obra) {
        setContratante(ident.obra.nome.toUpperCase());
        setContratanteOrigem("auto");
      } else {
        setContratante("");
        setContratanteOrigem("nao_identificado");
        toast.warning("Obra contratante não identificada na nota — selecione na lista.");
      }
      if (c.modelo) setModelo(c.modelo.toUpperCase());
      if (c.marca) setMarca(c.marca.toUpperCase());
      if (c.carreta) setCarreta(c.carreta.toUpperCase());
      if (typeof c.valor_total_nf === "number") setValorTotalNf(c.valor_total_nf);
      if (Array.isArray(c.itens) && c.itens.length > 0) {
        setItensNf(
          c.itens.map((it) => ({
            descricao: it.descricao ?? "",
            quantidade: typeof it.quantidade === "number" ? it.quantidade : "",
            unidade: (it.unidade ?? "").toUpperCase(),
            valor_unitario: typeof it.valor_unitario === "number" ? it.valor_unitario : "",
          })),
        );
      }

      setDadosAdicionaisNf(c.dados_adicionais_nf ?? "");
      setVolumeManual("");
      setVolumeOcr(
        typeof c.concreto?.volume_m3 === "number" && c.concreto.volume_m3 > 0
          ? c.concreto.volume_m3
          : null,
      );

      if (c.concreto) {
        setDadosConcretoOcr({
          fck: c.concreto.fck,
          slump_nominal: c.concreto.slump_nominal,
          slump_unidade: c.concreto.slump_unidade,
        });
      } else {
        setDadosConcretoOcr(null);
      }

      if (c.avisos && c.avisos.length > 0) {
        c.avisos.forEach((aviso) => toast.warning(aviso));
      }

      // Motor de identificação automática (feedback imediato ao ler a nota)
      if (ehAguaNaoFiscal) {
        setFornecedorIdentificado(null);
        setTracoIdentificado(null);
        setIsPadraoFallback(false);
        setFornecedorConfirmadoManual(false);
        setTracoConfirmadoManual(false);
      } else if (fornecedoresConcreto.length > 0) {
        const desc = Array.isArray(c.itens) ? c.itens.map((it) => it.descricao).join(" ") : "";
        const match = identificarConcreto(c.emissor || "", desc, fornecedoresConcreto, c.concreto);
        
        let fornecedorAlvo = match?.fornecedor ?? casarFornecedorPorEmissor(c.emissor || "", fornecedoresConcreto);
        let tracoAlvo = match?.traco ?? null;
        let fallbackPadrao = !!match?.isPadraoFallback;

        // Regra: Se não achou fornecedor nem traço, aplica fornecedor PADRÃO
        if (!fornecedorAlvo && !tracoAlvo) {
          const fornPadrao = fornecedoresConcreto.find(f => f.nome.toUpperCase() === "PADRÃO");
          if (fornPadrao) {
            fornecedorAlvo = fornPadrao;
            tracoAlvo = fornPadrao.tracos?.[0] ?? null;
            fallbackPadrao = true;
          }
        }

        // Nota nova: sempre volta ao modo automático
        setFornecedorConfirmadoManual(false);
        setTracoConfirmadoManual(false);
        setFornecedorIdentificado(fornecedorAlvo ?? null);
        setTracoIdentificado(tracoAlvo ?? null);
        setIsPadraoFallback(fallbackPadrao);

        if (fornecedorAlvo) setModoPesagem("dupla");
      }

      setFonteNota("ocr");
      setOcrHighlight(true);
      toast.success("Nota lida por OCR. Confira os campos.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no OCR"),
  });

  // ---- Detecção de nota duplicada (mesmo nº + emissor) para bloquear entrada dupla
  const notaDuplicada = useMemo(() => {
    if (modo !== "entrada") return null;
    const num = numeroNota.trim();
    const emi = emissor.trim().toLowerCase();
    if (!num || !emi) return null;
    return (
      pesagens.find(
        (p) =>
          (p.numero_nota ?? "").trim() === num &&
          (p.emissor ?? "").trim().toLowerCase() === emi,
      ) ?? null
    );
  }, [modo, numeroNota, emissor, pesagens]);

  // Visualizador interno de arquivos (nota/evidências) — evita bloqueio de pop-up
  const [arquivoVis, setArquivoVis] = useState<ArquivoVisualizacao | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Highlight temporário dos campos preenchidos pelo OCR

  const [ocrHighlight, setOcrHighlight] = useState(false);
  useEffect(() => {
    if (!ocrHighlight) return;
    const t = setTimeout(() => setOcrHighlight(false), 1900);
    return () => clearTimeout(t);
  }, [ocrHighlight]);

  function abrirVisualizador(args: { file?: File | null; dataUrl?: string; url?: string; nome?: string; tipo?: string }) {
    try {
      if (args.url) {
        setArquivoVis({ url: args.url, nome: args.nome ?? "arquivo", tipo: args.tipo ?? args.nome });
        return;
      }
      if (args.file) {
        const url = URL.createObjectURL(args.file);
        objectUrlRef.current = url;
        setArquivoVis({ url, nome: args.nome ?? args.file.name, tipo: args.file.type || args.file.name });
        return;
      }
      const dataUrl = args.dataUrl ?? "";
      const m = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
      if (!m) {
        setArquivoVis({ url: dataUrl, nome: args.nome ?? "arquivo", tipo: args.tipo });
        return;
      }
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: m[1] });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setArquivoVis({ url, nome: args.nome ?? "nota", tipo: m[1] });
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    }
  }

  function fecharVisualizador(open: boolean) {
    if (open) return;
    setArquivoVis(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }


  async function onNotaArquivo(f: File | null) {
    if (!f) return;
    const isPdf = f.type.includes("pdf") || /\.pdf$/i.test(f.name);
    if (f.size > 10 * 1024 * 1024) {
      toast.error(
        isPdf
          ? "PDF maior que 10 MB. Envie um recorte/print das páginas da nota."
          : "Arquivo maior que 10 MB.",
      );
      return;
    }
    const dataUrl = await fileToDataUrl(f);
    setEvPend((prev) => [...prev, { file: f, tipo: "nota", preview: dataUrl }]);
    ocrMut.mutate({ dataUrl, mimeType: isPdf ? "application/pdf" : f.type, filename: f.name });
  }


  async function buscarSefaz() {
    const chaveLimpa = chave.replace(/\D/g, "");
    if (chaveLimpa.length !== 44) {
      toast.error("Chave da NF-e deve ter 44 dígitos.");
      return;
    }
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select(
        "chave, numero, emissao, emissor, transportadora, placa, uf, peso, fonte",
      )
      .eq("chave", chaveLimpa)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.info("Chave não encontrada no cache SEFAZ. A varredura roda periodicamente.");
      return;
    }
    setNumeroNota(data.numero ?? "");
    setEmissao(data.emissao ?? "");
    setEmissor(data.emissor ?? "");
    setTransportadora(data.transportadora ?? "");
    setPlaca(data.placa ?? "");
    setUf(data.uf ?? "");
    
    if (data.peso != null) setPesoNf(Number(data.peso));
    setFonteNota("sefaz");
    toast.success("Dados carregados da SEFAZ.");
  }

  function adicionarEvidencia(f: File | null) {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo maior que 10 MB.");
      return;
    }
    fileToDataUrl(f).then((preview) =>
      setEvPend((prev) => [...prev, { file: f, tipo: tipoEvidencia, preview }]),
    );
  }

  // ---- Itens da NF: helpers e totais
  const qtdTotal = useMemo(() => {
    return itensNf.reduce((acc, it) => {
      const q = typeof it.quantidade === "number" ? it.quantidade : 0;
      return acc + q;
    }, 0);
  }, [itensNf]);

  const itensValidos = useMemo(
    () =>
      itensNf.filter(
        (it) =>
          it.descricao.trim() !== "" &&
          it.quantidade !== "" &&
          Number(it.quantidade) > 0 &&
          it.valor_unitario !== "" &&
          Number(it.valor_unitario) >= 0,
      ),
    [itensNf],
  );

  // Campos obrigatórios pendentes (para bloquear salvar entrada e destacar em vermelho após tentativa de salvar)
  const isEntrada = modo === "entrada";
  const faltaNumeroNota = isEntrada && numeroNota.trim() === "";
  const faltaEmissao = isEntrada && !docNaoFiscalAgua && emissao.trim() === "";
  const faltaEmissor = isEntrada && emissor.trim() === "";
  const faltaTransportadora = isEntrada && transportadora.trim() === "";
  const faltaPlaca = isEntrada && placa.trim() === "";
  const faltaUf = isEntrada && uf.trim() === "";
  const faltaMotorista = isEntrada && motorista.trim() === "";
  const faltaPesoNf = isEntrada && pesoNf === "";
  const faltaTara = false; // Campo não obrigatório conforme solicitação do usuário
  const faltaContratante = isEntrada && contratante.trim() === "";
  const faltaModelo = isEntrada && !docNaoFiscalAgua && modelo.trim() === "";
  const faltaMarca = isEntrada && !docNaoFiscalAgua && marca.trim() === "";
  const faltaCarreta = isEntrada && !docNaoFiscalAgua && carreta.trim() === "";
  const faltaValorTotal = isEntrada && !docNaoFiscalAgua && (valorTotalNf === "" || Number(valorTotalNf) <= 0);
  const faltaItens = isEntrada && !docNaoFiscalAgua && itensValidos.length === 0;
  const camposObrigatoriosPendentes = useMemo(() => {
    const arr: string[] = [];
    if (faltaContratante) arr.push("Contratante");
    if (faltaNumeroNota) arr.push("Nº nota");
    if (faltaEmissao) arr.push("Data emissão");
    if (faltaEmissor) arr.push("Emissor");
    if (faltaTransportadora) arr.push("Transportadora");
    if (faltaPlaca) arr.push("Placa (cavalo)");
    if (faltaUf) arr.push("UF");
    if (faltaMotorista) arr.push("Motorista");
    if (faltaPesoNf) arr.push("Peso da NF");
    
    if (faltaModelo) arr.push("Modelo");
    if (faltaMarca) arr.push("Marca");
    if (faltaCarreta) arr.push("Carreta");
    if (faltaValorTotal) arr.push("Valor total da NF");
    if (faltaItens) arr.push("Itens da NF");

    // Regra: Se é fornecedor de concreto, a carta de traço é obrigatória
    const ehFornecedorConcreto = fornecedorIdentificado != null;
    if (isEntrada && !docNaoFiscalAgua && ehFornecedorConcreto && !tracoIdentificado) {
      arr.push("Carta de Traço");
    }

    return arr;
  }, [faltaContratante, faltaNumeroNota, faltaEmissao, faltaEmissor, faltaTransportadora, faltaPlaca, faltaUf, faltaMotorista, faltaPesoNf, faltaModelo, faltaMarca, faltaCarreta, faltaValorTotal, faltaItens, isEntrada, docNaoFiscalAgua, fornecedorIdentificado, tracoIdentificado]);

  function atualizarItem(idx: number, patch: Partial<ItemLinha>) {
    setItensNf((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function adicionarItem() {
    setItensNf((prev) => [...prev, { descricao: "", quantidade: "", unidade: "", valor_unitario: "" }]);
  }
  function removerItem(idx: number) {
    setItensNf((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  // ---- Salvar (entrada ou saída)
  const salvarMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      if (peso === "" || Number(peso) <= 0) throw new Error("Informe o peso capturado.");

      const isEntrada = modo === "entrada";
      const faltando = camposObrigatoriosPendentes;
      const concluindoFluxo = faltando.length === 0;

      if (isEntrada) {
        if (concluindoFluxo && modoPesagem === "unica_excecao" && (taraInformada === "" || Number(taraInformada) <= 0)) {
          throw new Error("Para concluir o modo de pesagem única (exceção), informe a tara manual.");
        }

        // Antes de permitir uma nova pesagem de ENTRADA para uma placa, verifica unicidade (Regra 3)
        if (!pesagemPendenteId && placa.trim()) {
          const placaNormalizada = placa.replace(/[^A-Z0-9]/gi, "").toUpperCase();
          const emAberto = pendentes.find(p => 
            p.status === "aguardando_saida" && 
            (p.placa ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase() === placaNormalizada
          );
          if (emAberto) {
            throw new Error(`Esta placa já possui uma pesagem de entrada em aberto.`);
          }
        }

        const itensSanitizados = itensNf
          .map((it) => ({
            descricao: it.descricao.trim(),
            quantidade: it.quantidade === "" ? null : Number(it.quantidade),
            unidade: it.unidade.trim().toUpperCase() || null,
            valor_unitario: it.valor_unitario === "" ? null : Number(it.valor_unitario),
          }))
          .filter((it) => it.descricao || it.quantidade != null);

        const payload = {
          obra_id: obraDestino?.id ?? obraId!,
          status: (concluindoFluxo ? "aguardando_saida" : "rascunho_entrada") as any,
          fonte_peso_entrada: pesoFonte,
          fonte_nota: fonteNota,
          peso_entrada: Number(peso),
          entrou_em: new Date().toISOString(),
          chave_nfe: docNaoFiscalAgua ? null : chave.replace(/\D/g, "") || null,
          numero_nota: numeroNota || null,
          emissao: docNaoFiscalAgua ? null : emissao || null,
          emissor: emissor || null,
          transportadora: transportadora || null,
          placa: placa || null,
          uf: uf || null,
          motorista: motorista || null,
          peso_nf: pesoNf === "" ? null : Number(pesoNf),
          contratante: obraDestino?.nome.trim().toUpperCase() ?? null,
          modelo: docNaoFiscalAgua ? null : modelo.trim() || null,
          marca: docNaoFiscalAgua ? null : marca.trim() || null,
          carreta: docNaoFiscalAgua ? null : carreta.trim() || null,
          valor_total_nf: docNaoFiscalAgua ? null : valorTotalNf === "" ? null : Number(valorTotalNf),
          qtd_total: docNaoFiscalAgua ? null : qtdTotal,
          peso_esperado: resultadoConcreto?.esperado ?? null,
          tolerancia_aplicada: resultadoConcreto?.tol ?? null,
          diferenca_pct: resultadoConcreto?.desvioPct ?? null,
          diferenca_kg: resultadoConcreto ? Number(resultadoConcreto.aferido ?? 0) - Number(resultadoConcreto.esperado ?? 0) : null,
          status_afericao: resultadoConcreto?.status ?? null,
          volume_m3: resultadoConcreto?.volume ?? null,
          itens_nf: (docNaoFiscalAgua ? null : itensSanitizados) as any,
          modo_pesagem: modoPesagem,
          tara_informada: taraInformada === "" ? null : Number(taraInformada),
          traco_id: docNaoFiscalAgua ? null : tracoIdentificado?.id || null,
          is_padrao_fallback: docNaoFiscalAgua ? false : isPadraoFallback,
          dados_adicionais_nf: dadosAdicionaisNf.trim() || null,
          volume_derivado_detalhe: (volumeNota.volume
            ? { origem: volumeNota.origem, detalhe: volumeNota.detalhe, volume_m3: volumeNota.volume }
            : { origem: "indefinido", detalhe: volumeNota.detalhe, volume_m3: null }) as any,
          resultado_afericao: (resultadoConcreto ? { ...resultadoConcreto, volume: resultadoConcreto.volume } : null) as any,
          requer_conferencia_eng: resultadoConcreto?.requerEngenharia || false,
          traco_confirmado_manual: tracoConfirmadoManual,
          fornecedor_confirmado_manual: fornecedorConfirmadoManual,
        };

        if (pesagemPendenteId) {
          const { data, error } = await supabase
            .from("pesagens")
            .update(payload)
            .eq("id", pesagemPendenteId)
            .select()
            .single();
          if (error) throw error;
          for (const ev of evPend) {
            await uploadEvidencia(obraId!, data.id, ev.file, ev.tipo);
          }
          return data;
        } else {
          const { data, error } = await supabase
            .from("pesagens")
            .insert({ ...payload, criado_por: user.id })
            .select()
            .single();
          if (error) throw error;
          setPesagemPendenteId(data.id);
          for (const ev of evPend) {
            await uploadEvidencia(obraId!, data.id, ev.file, ev.tipo);
          }
          return data;
        }
      } else {
        if (!pesagemPendenteId) throw new Error("Selecione o caminhão pendente.");
        const p = pendentes.find((x) => x.id === pesagemPendenteId);
        if (!p) throw new Error("Pesagem de entrada não encontrada para vínculo.");
        
        const concluindoSaida = true;

        // Aferição no fechamento: sempre com base no LÍQUIDO (entrada − saída).
        const pAny = p as any;
        const liquidoKg = Math.abs(Number(p.peso_entrada ?? 0) - Number(peso));
        const esperadoKg = resultadoConcreto?.esperado ?? pesoEsperadoDe(p);
        const temCarta = esperadoKg != null && Number(esperadoKg) > 0;

        const tecnicos: Record<string, unknown> = {};
        if (temCarta) {
          const esperado = Number(esperadoKg);
          const tol = Number(
            resultadoConcreto?.tol ?? pAny.tolerancia_aplicada ?? pAny.resultado_afericao?.tol ?? 4,
          );
          const difKg = liquidoKg - esperado;
          const difPct = (difKg / esperado) * 100;
          const min = esperado * (1 - tol / 100);
          const max = esperado * (1 + tol / 100);
          const status = liquidoKg < min ? "abaixo" : liquidoKg > max ? "acima" : "conforme";
          const volume = Number(resultadoConcreto?.volume ?? pAny.volume_m3 ?? pAny.resultado_afericao?.volume ?? 0);

          tecnicos.peso_esperado = esperado;
          tecnicos.tolerancia_aplicada = tol;
          tecnicos.diferenca_kg = difKg;
          tecnicos.diferenca_pct = difPct;
          tecnicos.status_afericao = status;
          tecnicos.base_calculo = "carta_traco";
          if (volume > 0) tecnicos.volume_m3 = volume;
          tecnicos.resultado_afericao = {
            ...(pAny.resultado_afericao ?? {}),
            ...(resultadoConcreto ?? {}),
            esperado,
            tol,
            aferido: liquidoKg,
            desvioPct: difPct,
            min,
            max,
            status,
            ...(volume > 0 ? { volume } : {}),
          };
          if (resultadoConcreto?.requerEngenharia != null) {
            tecnicos.requer_conferencia_eng = !!resultadoConcreto.requerEngenharia;
          }
        }

        const { data, error } = await supabase
          .from("pesagens")
          .update({
            peso_saida: Number(peso),
            saiu_em: new Date().toISOString(),
            status: (concluindoSaida ? "concluida" : "rascunho_saida") as any,
            fonte_peso_saida: pesoFonte,
            saida_por: user.id,
            ...tecnicos,
          } as any)
          .eq("id", p.id)
          .select()
          .single();

        if (error) throw error;
        for (const ev of evPend) {
          await uploadEvidencia(obraId!, p.id, ev.file, ev.tipo);
        }
        return data;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["pesagens", obraId] });
      qc.invalidateQueries({ queryKey: ["dash", obraId] });

      const isConcluido = data.status === "aguardando_saida" || data.status === "concluida";

      if (isConcluido) {
        // Trilha de auditoria da fase concluída.
        void registrarLogFn({
          data: {
            pesagem_id: data.id,
            evento: modo === "entrada" ? "entrada" : "saida",
            alteracoes: [{ campo: "status", de: null, para: data.status }],
          },
        }).catch(() => undefined);

        // Ocorrência automática quando tolerância acima do permitido.
        const sinalSaida = calcularSinalRegistro(data as PesagemComEvidencias);
        if (sinalSaida.chave === "acima") {
          void notificarToleranciaFn({ data: { pesagemId: data.id, sinal: sinalSaida } }).catch(
            () => undefined,
          );
          dispararAlertaTolerancia(data.id, sinalSaida);
        }

        toast.success(modo === "entrada" ? "Entrada concluída." : "Saída registrada.");
        limparForm();
        setTracoIdentificado(null);
        setFornecedorIdentificado(null);
        setTracoConfirmadoManual(false);
        setFornecedorConfirmadoManual(false);
        setResultadoConcreto(null);
        if (modo === "saida") setModo("entrada");
      } else {
        toast.info("Rascunho salvo.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  // ---- Recusa
  const recusaMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      const pId = modo === "saida" ? pesagemPendenteId : null;
      if (!pId) throw new Error("Recusa disponível somente na etapa de saída.");
      const p = pendentes.find((x) => x.id === pId);
      if (!p) throw new Error("Pesagem não encontrada.");
      if (peso === "") throw new Error("Capture o peso de saída antes de recusar.");
      const liq = Math.abs(Number(p.peso_entrada) - Number(peso));
      const { data, error } = await supabase
        .from("pesagens")
        .update({
          peso_saida: Number(peso),
          saiu_em: new Date().toISOString(),
          status: "recusado",
          fonte_peso_saida: pesoFonte,
          justificativa: obsRecusa || null,
        })
        .eq("id", p.id)
        .select()
        .single();
      if (error) throw error;
      for (const ev of evPend) {
        await uploadEvidencia(obraId!, p.id, ev.file, ev.tipo);
      }
      return { pesagem: data, liq };
    },
    onSuccess: ({ pesagem, liq }) => {
      const nfKg = pesagem.peso_nf != null ? Number(pesagem.peso_nf) : null;
      const payload = montarPayloadRecusa({
        emailFornecedor: emailFornecedor || "",
        numeroNota: pesagem.numero_nota ?? "",
        placa: pesagem.placa ?? "",
        emissor: pesagem.emissor ?? "",
        obraNome: obraAtual?.nome ?? "",
        pesoNfKg: nfKg,
        pesoLiquidoKg: liq,
        divergenciaKg: nfKg != null ? Math.abs(nfKg - liq) : null,
        observacoes: obsRecusa,
        usuarioNome: user?.email ?? undefined,
      });
      // envia via Resend (server-side)
      if (payload.para) {
        enviarEmailResend({
          data: {
            para: [payload.para],
            cc: payload.cc,
            assunto: payload.assunto,
            corpoTexto: payload.corpoTexto,
          },
        })
          .then(() => toast.success("E-mail de recusa enviado ao fornecedor."))
          .catch((err) => toast.error(err instanceof Error ? err.message : "Falha ao enviar e-mail."));
      } else {
        toast.info("Recusa registrada. Preencha o e-mail do fornecedor para enviar a notificação.");
      }
      qc.invalidateQueries({ queryKey: ["pesagens", obraId] });
      qc.invalidateQueries({ queryKey: ["dash", obraId] });
      setOpenRecusa(false);
      limparForm();
      setModo("entrada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao recusar."),
  });

  // ---- Ocorrência (fecha a pesagem com status fechada_com_ocorrencia)
  const ocorrenciaMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      const tipoResolvido = ocorrTipo === "Outro" ? ocorrTipoOutro.trim() : ocorrTipo.trim();
      
      // Regra automática: "Caminhão sem pesagem de saída" -> Modo Pesagem Única + Tara informada
      if (tipoResolvido === "Caminhão sem pesagem de saída") {
        setModoPesagem("unica_excecao");
        // Se a tara já veio do OCR ou foi digitada, ela será usada no banco pelo insert/update abaixo
      }

      if (!tipoResolvido) throw new Error("Selecione o tipo da ocorrência.");
      if (ocorrRelato.trim().length < 10) throw new Error("Descreva o relato (mín. 10 caracteres).");

      let pesagemId: string;
      let pesoLiqKg: number | null = null;
      let pesoNfKg: number | null = pesoNf === "" ? null : Number(pesoNf);

      if (ocorrenciaAlvoId) {
        // Ocorrência sobre registro existente (aberto via "Ações → Ocorrências")
        pesagemId = ocorrenciaAlvoId;
        pesoNfKg = pesoNf === "" ? null : Number(pesoNf);
        pesoLiqKg = peso !== "" ? Number(peso) : null;
        const gravarPesoAgora = peso !== "" && !alvoTemPesoSaida;
        const isSaida = ocorrEstagio === "saida";
        const ocorrCols = isSaida
          ? {
              ocorrencia_saida_tipo: tipoResolvido,
              ocorrencia_saida_tipo_outro: ocorrTipo === "Outro" ? ocorrTipoOutro.trim() || null : null,
              ocorrencia_saida_relato: ocorrRelato.trim(),
              ocorrencia_saida_em: new Date().toISOString(),
              ocorrencia_saida_por: user.id,
            }
          : {
              ocorrencia_tipo: tipoResolvido,
              ocorrencia_tipo_outro: ocorrTipo === "Outro" ? ocorrTipoOutro.trim() || null : null,
              ocorrencia_relato: ocorrRelato.trim(),
              ocorrencia_em: new Date().toISOString(),
              ocorrencia_por: user.id,
            };
        const { error } = await supabase
          .from("pesagens")
          .update({
            status: "fechada_com_ocorrencia",
            ...ocorrCols,
            ...(gravarPesoAgora
              ? { peso_saida: Number(peso), saiu_em: new Date().toISOString(), fonte_peso_saida: pesoFonte, saida_por: user.id }
              : {}),
          } as never)
          .eq("id", pesagemId);
        if (error) throw error;
      } else if (ocorrEstagio === "saida") {
        if (!pesagemPendenteId) throw new Error("Localize o caminhão pela placa antes de registrar.");
        const p = pendentes.find((x) => x.id === pesagemPendenteId);
        if (!p) throw new Error("Pesagem não encontrada.");
        pesagemId = p.id;
        pesoNfKg = p.peso_nf != null ? Number(p.peso_nf) : pesoNfKg;
        pesoLiqKg = peso !== "" ? Math.abs(Number(p.peso_entrada) - Number(peso)) : null;
        const { error } = await supabase
          .from("pesagens")
          .update({
            status: "fechada_com_ocorrencia",
            // Ocorrência no estágio de SAÍDA — grava nas colunas específicas de saída,
            // preservando qualquer ocorrência de entrada previamente registrada.
            ocorrencia_saida_tipo: tipoResolvido,
            ocorrencia_saida_tipo_outro: ocorrTipo === "Outro" ? ocorrTipoOutro.trim() || null : null,
            ocorrencia_saida_relato: ocorrRelato.trim(),
            ocorrencia_saida_em: new Date().toISOString(),
            ocorrencia_saida_por: user.id,
            ...(peso !== ""
              ? { peso_saida: Number(peso), saiu_em: new Date().toISOString(), fonte_peso_saida: pesoFonte, saida_por: user.id }
              : {}),
          } as never)
          .eq("id", pesagemId);
        if (error) throw error;
      } else {
        // ocorrência na ENTRADA — cria a pesagem já fechada com ocorrência
        const itensSanitizados = itensNf
          .map((it) => ({
            descricao: it.descricao.trim(),
            quantidade: it.quantidade === "" ? null : Number(it.quantidade),
            unidade: it.unidade.trim().toUpperCase() || null,
            valor_unitario: it.valor_unitario === "" ? null : Number(it.valor_unitario),
          }))
          .filter((it) => it.descricao);
        const insert = {
          obra_id: obraDestino?.id ?? obraId!,
          criado_por: user.id,
          // Ocorrência na entrada: registro permanece aberto aguardando a saída.
          // Ao aferir a saída pela placa, o fluxo normal fecha como "fechada_com_ocorrencia".
          status: "aguardando_saida_ocorrencia" as const,
          fonte_peso_entrada: pesoFonte,
          fonte_nota: fonteNota,
          peso_entrada: peso === "" ? 0 : Number(peso),
          entrou_em: new Date().toISOString(),
          chave_nfe: docNaoFiscalAgua ? null : chave.replace(/\D/g, "") || null,
          numero_nota: numeroNota || null,
          emissao: docNaoFiscalAgua ? null : emissao || null,
          emissor: emissor || null,
          transportadora: transportadora || null,
          placa: placa || null,
          uf: uf || null,
          motorista: motorista || null,
          peso_nf: pesoNfKg,
          contratante: obraDestino?.nome.trim().toUpperCase() ?? null,
          modelo: modelo.trim() || null,
          marca: marca.trim() || null,
          carreta: carreta.trim() || null,
          valor_total_nf: valorTotalNf === "" ? null : Number(valorTotalNf),
          modo_pesagem: modoPesagem,
          tara_informada: taraInformada === "" ? null : Number(taraInformada),
          traco_id: tracoIdentificado?.id || null,
          is_padrao_fallback: isPadraoFallback,
          dados_adicionais_nf: dadosAdicionaisNf.trim() || null,
          volume_derivado_detalhe: (volumeNota.volume
            ? { origem: volumeNota.origem, detalhe: volumeNota.detalhe, volume_m3: volumeNota.volume }
            : { origem: "indefinido", detalhe: volumeNota.detalhe, volume_m3: null }) as any,
          resultado_afericao: (resultadoConcreto ? { ...resultadoConcreto, volume: resultadoConcreto.volume } : null) as any,
          peso_esperado: resultadoConcreto?.esperado ?? null,
          tolerancia_aplicada: resultadoConcreto?.tol ?? null,
          diferenca_pct: resultadoConcreto?.desvioPct ?? null,
          diferenca_kg: resultadoConcreto ? Number(resultadoConcreto.aferido ?? 0) - Number(resultadoConcreto.esperado ?? 0) : null,
          status_afericao: resultadoConcreto?.status ?? null,
          volume_m3: resultadoConcreto?.volume ?? null,
          requer_conferencia_eng: resultadoConcreto?.requerEngenharia || false,
          traco_confirmado_manual: tracoConfirmadoManual,
          fornecedor_confirmado_manual: fornecedorConfirmadoManual,
          qtd_total: qtdTotal,
          itens_nf: itensSanitizados as never,
          ocorrencia_tipo: tipoResolvido,
          ocorrencia_tipo_outro: ocorrTipo === "Outro" ? ocorrTipoOutro.trim() || null : null,
          ocorrencia_relato: ocorrRelato.trim(),
          ocorrencia_em: new Date().toISOString(),
          ocorrencia_por: user.id,
        };
        const { data, error } = await supabase.from("pesagens").insert(insert as never).select().single();
        if (error) throw error;
        pesagemId = (data as { id: string }).id;
      }

      // Trilha de auditoria da ocorrência.
      void registrarLogFn({
        data: {
          pesagem_id: pesagemId,
          evento: "ocorrencia",
          justificativa: ocorrRelato.trim() || null,
          alteracoes: [{ campo: "ocorrencia_tipo", de: null, para: tipoResolvido }],
        },
      }).catch(() => undefined);

      // Upload de TODAS as evidências pendentes (fotos gerais + de ocorrência)
      for (const ev of evPend) {
        await uploadEvidencia(obraId!, pesagemId, ev.file, ev.tipo);
      }

      // Normaliza C.C.: inclui o que já está em ccList + qualquer coisa ainda
      // digitada no campo (separado por vírgula, ponto e vírgula, espaço ou enter).
      const ccExtras: string[] = [...ccList];
      const pendingCc = ccInput.trim();
      if (pendingCc) {
        pendingCc
          .split(/[,;\s]+/)
          .map((v) => v.trim())
          .filter((v) => v && /.+@.+\..+/.test(v))
          .forEach((v) => {
            if (!ccExtras.includes(v)) ccExtras.push(v);
          });
      }

      // Monta payload e abre o e-mail
      const payload = montarPayloadOcorrencia({
        tipo: tipoResolvido,
        relato: ocorrRelato.trim(),
        ccExtra: ccExtras,
        numeroNota,
        placa,
        emissor,
        contratante,
        obraNome: obraAtual?.nome ?? null,
        engenheiroEmail: obraAtual?.engenheiro_email ?? null,
        engenheiroNome: obraAtual?.engenheiro_nome ?? null,
        pesoNfKg,
        pesoLiquidoKg: pesoLiqKg,
        perfil: perfilOcorr ?? null,
      });
      // envia via Resend (server-side)
      await enviarEmailResend({
        data: {
          para: payload.para,
          cc: payload.cc,
          assunto: payload.assunto,
          corpoTexto: payload.corpoTexto,
          replyTo: perfilOcorr?.email ?? undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ocorrência registrada e e-mail enviado.");
      qc.invalidateQueries({ queryKey: ["pesagens", obraId] });
      qc.invalidateQueries({ queryKey: ["dash", obraId] });
      setOcorrTipo("");
      setOcorrTipoOutro("");
      setOcorrRelato("");
      setCcList([]);
      setTracoIdentificado(null);
      setFornecedorIdentificado(null);
      setTracoConfirmadoManual(false);
      setFornecedorConfirmadoManual(false);
      setResultadoConcreto(null);
      setCcInput("");
      limparForm();
      setModo("entrada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao registrar ocorrência."),
  });




  // Reprocessa os itens da NF a partir da foto arquivada (super admin)
  const reprocessarMut = useMutation({
    mutationFn: async (pesagemId: string) => {
      const alvo = pesagens.find((p) => p.id === pesagemId);
      const ev = alvo?.evidencias.find((e) => e.tipo === "nota");
      if (!ev) throw new Error("Esta pesagem não tem foto da nota fiscal arquivada.");
      const { data: signed, error: errUrl } = await supabase.storage
        .from(BUCKETS.evidencias)
        .createSignedUrl(ev.storage_path, 120);
      if (errUrl || !signed?.signedUrl) throw new Error("Não foi possível abrir a foto da nota.");
      const blob = await (await fetch(signed.signedUrl)).blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Falha ao ler a imagem."));
        fr.readAsDataURL(blob);
      });
      const res = await ocrFn({ data: { arquivo: base64, mimeType: blob.type } });
      if (!res.ok) throw new Error(res.motivo);
      const itens = (res.campos.itens ?? [])
        .filter((it) => (it?.descricao ?? "").trim() || it?.quantidade != null)
        .slice(0, 60)
        .map((it) => ({
          descricao: (it.descricao ?? "").trim().toUpperCase() || null,
          quantidade: it.quantidade ?? null,
          unidade: (it.unidade ?? "").trim().toUpperCase() || null,
          valor_unitario: it.valor_unitario ?? null,
        }));
      if (itens.length === 0) throw new Error("Nenhum item foi identificado na foto da nota.");
      // Registro corrigido: sai de rascunho e volta ao fluxo como "Em análise"
      const promoverStatus =
        (alvo as any)?.status === "rascunho_entrada" && paraNumero(alvo?.peso_entrada ?? null) != null
          ? ("aguardando_saida" as const)
          : undefined;
      await atualizarPesagemFn({
        data: {
          id: pesagemId,
          itens_nf: itens,
          peso_nf: pesoNfReferencia({ itens_nf: itens }).kg ?? undefined,
          ...(promoverStatus ? { status: promoverStatus } : {}),
          justificativa:
            "Reprocessamento automático dos itens da NF a partir da foto arquivada (releitura por OCR das descrições, quantidades e unidades).",
        },
      });

      return itens.length;
    },
    onSuccess: (qtd) => {
      toast.success(`${qtd} ${qtd === 1 ? "item atualizado" : "itens atualizados"} com as unidades da nota.`);
      qc.invalidateQueries({ queryKey: ["pesagens"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboard"], refetchType: "all" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reprocessar a nota."),
  });



  // (URLs assinadas são carregadas apenas para a página visível — ver abaixo)


  const contratantesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    pesagens.forEach((p) => {
      const c = (p.contratante ?? "").trim();
      if (c) s.add(c);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pesagens]);

  // --- Sinal de tolerância por registro (coluna do grid) ---
  const { categorias: categoriasTolPadrao } = useToleranciasPadrao();
  const { fornecedores: fornecedoresTol } = useGerenciamentoFornecedores();
  const { overrides: overridesTol } = useOverridesFornecedor();

  const tolPorTraco = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of fornecedoresConcreto ?? []) {
      for (const t of (f?.tracos ?? [])) {
        const tol = Number(t?.tolerancia_peso ?? f?.tolerancia_padrao ?? 0) || null;
        if (t?.id && tol) m.set(String(t.id), tol);
      }
    }
    return m;
  }, [fornecedoresConcreto]);

  const sinalPorPesagem = useMemo(() => {
    const m = new Map<string, SinalTolerancia>();
    for (const p of pesagens) {
      const nfKg = calcularPesoNfDaPesagem(p as any).totalKg ?? pesoNfReferencia(p as any).kg;
      m.set(
        p.id,
        sinalTolerancia(p as any, {
          categorias: categoriasTolPadrao as any,
          fornecedores: fornecedoresTol,
          overrides: overridesTol,
          tolPorTraco,
        }, nfKg ?? null),
      );
    }
    return m;
  }, [pesagens, categoriasTolPadrao, fornecedoresTol, overridesTol, tolPorTraco]);

  const calcularSinalRegistro = (p: PesagemComEvidencias): SinalTolerancia => {
    const nfKg = calcularPesoNfDaPesagem(p as any).totalKg ?? pesoNfReferencia(p as any).kg;
    return sinalTolerancia(
      p as any,
      {
        categorias: categoriasTolPadrao as any,
        fornecedores: fornecedoresTol,
        overrides: overridesTol,
        tolPorTraco,
      },
      nfKg ?? null,
    );
  };
  const linhasGrid = useMemo(() => {
    return pesagens.map((p) => {
      const pExt = p as PesagemComEvidencias & {
        modelo?: string | null;
        marca?: string | null;
        carreta?: string | null;
        valor_total_nf?: number | string | null;
        qtd_total?: number | string | null;
        criado_por?: string | null;
        saida_por?: string | null;
        itens_nf?: Array<{ descricao?: string | null }> | null;
      };
      const itens = (pExt.itens_nf ?? []).map((it) => (it?.descricao ?? "").trim()).filter(Boolean);
      const usuarios = Array.from(
        new Set(
          [pExt.criado_por, pExt.saida_por]
            .filter(Boolean)
            .map((id) => formatarNomeUsuario(emailMap[id as string] ?? "—")),
        ),
      );
      const calc = calcularPesoNfDaPesagem(pExt);
      return {
        p,
        v: {
          obra: nomePorObra.get(p.obra_id) ?? "—",
          contratante: (p.contratante ?? "").trim(),

          situacao: rotuloStatus(p.status),
          sinalTol: (() => {
            const s = sinalPorPesagem.get(p.id);
            if (!s) return "";
            if (s.chave === "acima") return "Acima da Tolerância";
            if (s.chave === "ok") return "OK";
            return "";
          })(),
          nota: p.numero_nota ?? "",
          placa: p.placa ?? "",
          carreta: pExt.carreta ?? "",
          modelo: `${pExt.modelo ?? ""} ${pExt.marca ?? ""}`.trim(),
          transportadora: (p.transportadora ?? "").trim(),
          descricao: itens.join(" | "),
          fonte: rotuloFonte(p.fonte_nota),
          usuarios,
          qtdNf: paraNumero(pExt.qtd_total ?? null),
          pesoCalcT: calc.totalKg != null ? calc.totalKg / 1000 : null,
          pesoEsperado: pesoEsperadoDe(p),
          valorNf: pExt.valor_total_nf != null ? Number(pExt.valor_total_nf) : null,
          entrada: p.peso_entrada != null ? Number(p.peso_entrada) : null,
          saida: p.peso_saida != null ? Number(p.peso_saida) : null,
          liquido: pesoLiquido(p),
          dataMs: p.created_at ? new Date(p.created_at).getTime() : null,
          duracaoMin: (() => {
            const pd = p as { entrou_em?: string | null; saiu_em?: string | null };
            if (!pd.entrou_em || !pd.saiu_em) return null;
            const ms = new Date(pd.saiu_em).getTime() - new Date(pd.entrou_em).getTime();
            return ms >= 0 ? Math.floor(ms / 60000) : null;
          })(),

        },
      };
    });
  }, [pesagens, emailMap, nomePorObra, sinalPorPesagem]);

  const opcoesColuna = useMemo(() => {
    const mk = (get: (v: (typeof linhasGrid)[number]["v"]) => string | string[]) => {
      const cont = new Map<string, number>();
      linhasGrid.forEach(({ v }) => {
        const raw = get(v);
        const arr = Array.isArray(raw) ? raw : [raw];
        arr.forEach((x) => {
          const val = (x ?? "").trim();
          if (!val || val === "—") return;
          cont.set(val, (cont.get(val) ?? 0) + 1);
        });
      });
      return Array.from(cont.entries())
        .map(([valor, contagem]) => ({ valor, contagem }))
        .sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR"));
    };
    return {
      obra: mk((v) => v.obra),
      contratante: mk((v) => v.contratante),

      situacao: mk((v) => v.situacao),
      sinalTol: mk((v) => v.sinalTol),
      transportadora: mk((v) => v.transportadora),
      fonte: mk((v) => v.fonte),
      usuario: mk((v) => v.usuarios),
    };
  }, [linhasGrid]);

  const filtrosAtivos = useMemo(() => {
    const chips: { chave: string; rotulo: string; limpar: () => void }[] = [];
    Object.entries(filtrosLista).forEach(([k, vals]) => {
      if (vals?.length) {
        chips.push({
          chave: `l-${k}`,
          rotulo: `${k}: ${vals.length > 2 ? `${vals.length} selecionados` : vals.join(", ")}`,
          limpar: () => setFiltrosLista((s) => ({ ...s, [k]: [] })),
        });
      }
    });
    Object.entries(filtrosTexto).forEach(([k, val]) => {
      if (val?.trim()) {
        chips.push({
          chave: `t-${k}`,
          rotulo: `${k}: ${val}`,
          limpar: () => setFiltrosTexto((s) => ({ ...s, [k]: "" })),
        });
      }
    });
    Object.entries(filtrosNum).forEach(([k, f]) => {
      if (f?.min || f?.max) {
        chips.push({
          chave: `n-${k}`,
          rotulo: `${k}: ${f.min || "…"} a ${f.max || "…"}`,
          limpar: () => setFiltrosNum((s) => ({ ...s, [k]: {} })),
        });
      }
    });
    Object.entries(filtrosData).forEach(([k, f]) => {
      if (f?.de || f?.ate) {
        chips.push({
          chave: `d-${k}`,
          rotulo: `${k}: ${f.de || "…"} a ${f.ate || "…"}`,
          limpar: () => setFiltrosData((s) => ({ ...s, [k]: {} })),
        });
      }
    });
    return chips;
  }, [filtrosLista, filtrosTexto, filtrosNum, filtrosData]);

  function limparTodosFiltros() {
    setFiltrosLista({});
    setFiltrosTexto({});
    setFiltrosNum({});
    setFiltrosData({});
    setOrdenacao(null);
    setBusca("");
    setContratanteFiltro("__all__");
  }


  const pesagensFiltradas = useMemo(() => {
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = norm(busca.trim());
    const casaTexto = (chave: string, valor: string) => {
      const alvo = norm((filtrosTexto[chave] ?? "").trim());
      if (!alvo) return true;
      return norm(valor).includes(alvo);
    };
    const casaLista = (chave: string, valor: string | string[]) => {
      const sel = filtrosLista[chave] ?? [];
      if (!sel.length) return true;
      const arr = Array.isArray(valor) ? valor : [valor];
      return arr.some((v) => sel.includes(v));
    };
    const casaNum = (chave: string, valor: number | null) => {
      const f = filtrosNum[chave];
      if (!f || (!f.min && !f.max)) return true;
      if (valor == null) return false;
      if (f.min && valor < Number(f.min)) return false;
      if (f.max && valor > Number(f.max)) return false;
      return true;
    };
    const casaData = (chave: string, ms: number | null) => {
      const f = filtrosData[chave];
      if (!f || (!f.de && !f.ate)) return true;
      if (ms == null) return false;
      if (f.de && ms < new Date(`${f.de}T00:00:00`).getTime()) return false;
      if (f.ate && ms > new Date(`${f.ate}T23:59:59`).getTime()) return false;
      return true;
    };

    const cmpTexto = (a: string, b: string) => {
      const va = (a ?? "").trim();
      const vb = (b ?? "").trim();
      if (!va && !vb) return 0;
      if (!va) return Infinity;
      if (!vb) return -Infinity;
      return va.localeCompare(vb, "pt-BR");
    };
    const cmpNum = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return Infinity;
      if (b == null) return -Infinity;
      return a - b;
    };
    type Val = (typeof linhasGrid)[number]["v"];
    const comparadores: Record<string, (a: Val, b: Val) => number> = {
      Data: (a, b) => cmpNum(a.dataMs, b.dataMs),
      Obra: (a, b) => cmpTexto(a.obra, b.obra),
      Contratante: (a, b) => cmpTexto(a.contratante, b.contratante),
      Situação: (a, b) => cmpTexto(a.situacao, b.situacao),
      "Sinal Tolerância": (a, b) => cmpTexto(a.sinalTol, b.sinalTol),
      Nota: (a, b) => cmpTexto(a.nota, b.nota),
      Placa: (a, b) => cmpTexto(a.placa, b.placa),
      Carreta: (a, b) => cmpTexto(a.carreta, b.carreta),
      "Modelo/Marca": (a, b) => cmpTexto(a.modelo, b.modelo),
      Transportadora: (a, b) => cmpTexto(a.transportadora, b.transportadora),
      Descrição: (a, b) => cmpTexto(a.descricao, b.descricao),
      "Qtd/Peso NF": (a, b) => cmpNum(a.qtdNf, b.qtdNf),
      "Peso Calculado (t)": (a, b) => cmpNum(a.pesoCalcT, b.pesoCalcT),
      "Peso Carta Traço": (a, b) => cmpNum(a.pesoEsperado ?? null, b.pesoEsperado ?? null),
      "Valor NF": (a, b) => cmpNum(a.valorNf, b.valorNf),
      Entrada: (a, b) => cmpNum(a.entrada, b.entrada),
      Saída: (a, b) => cmpNum(a.saida, b.saida),
      Líquido: (a, b) => cmpNum(a.liquido, b.liquido),
      Duração: (a, b) => cmpNum(a.duracaoMin, b.duracaoMin),
      Fonte: (a, b) => cmpTexto(a.fonte, b.fonte),
      Usuário: (a, b) => cmpTexto(a.usuarios[0] ?? "", b.usuarios[0] ?? ""),
    };

    const base = linhasGrid.filter(({ p, v }) => {
        if (!dentroDoPeriodo(p.created_at, periodo)) return false;
        if (contratanteFiltro !== "__all__" && (p.contratante ?? "") !== contratanteFiltro) return false;
        if (!casaData("Data", v.dataMs)) return false;
        if (!casaLista("Obra", v.obra)) return false;
        if (!casaLista("Contratante", v.contratante)) return false;

        if (!casaLista("Situação", v.situacao)) return false;
        if (!casaLista("Sinal Tolerância", v.sinalTol)) return false;
        if (!casaLista("Transportadora", v.transportadora)) return false;
        if (!casaLista("Fonte", v.fonte)) return false;
        if (!casaLista("Usuário", v.usuarios)) return false;
        if (!casaTexto("Nota", v.nota)) return false;
        if (!casaTexto("Placa", v.placa)) return false;
        if (!casaTexto("Carreta", v.carreta)) return false;
        if (!casaTexto("Modelo/Marca", v.modelo)) return false;
        if (!casaTexto("Descrição", v.descricao)) return false;
        if (!casaNum("Qtd/Peso NF", v.qtdNf)) return false;
        if (!casaNum("Peso Calculado (t)", v.pesoCalcT)) return false;
        if (!casaNum("Peso Carta Traço", v.pesoEsperado ?? null)) return false;
        if (!casaNum("Valor NF", v.valorNf)) return false;
        if (!casaNum("Entrada", v.entrada)) return false;
        if (!casaNum("Saída", v.saida)) return false;
        if (!casaNum("Líquido", v.liquido)) return false;
        if (!casaNum("Duração", v.duracaoMin)) return false;
        if (!q) return true;
        return [v.nota, v.placa, v.transportadora, p.emissor ?? "", p.motorista ?? "", v.contratante, v.descricao]
          .filter(Boolean)
          .some((x) => norm(x as string).includes(q));
      });

    const cmp = ordenacao ? comparadores[ordenacao.coluna] : undefined;
    const ordenadas = cmp
      ? [...base].sort((a, b) => {
          const r = cmp(a.v, b.v);
          // valores vazios sempre no fim, independentemente da direção
          if (!Number.isFinite(r)) return r > 0 ? 1 : -1;
          return ordenacao!.direcao === "asc" ? r : -r;
        })
      : base;
    return ordenadas.map(({ p }) => p);
  }, [linhasGrid, busca, contratanteFiltro, periodo, filtrosLista, filtrosTexto, filtrosNum, filtrosData, ordenacao]);


  // Resumo de registros por obra: conta todos os registros carregados, sem
  // aplicar período nem o filtro da coluna Obra (para permitir alternar entre elas).
  const resumoObras = useMemo(() => {
    const map = new Map<string, number>();
    for (const { v } of linhasGrid) {
      const nome = v.obra || "Sem obra";
      map.set(nome, (map.get(nome) ?? 0) + 1);
    }
    return Array.from(map, ([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [linhasGrid]);




  // Paginação do grid (evita montar centenas de linhas de uma vez)
  const modoBloco = periodo !== "hoje" && periodo !== "tudo";
  const totalPaginas = Math.max(1, Math.ceil(pesagensFiltradas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const pesagensPagina = useMemo(() => {
    if (periodo === "tudo") {
      return pesagensFiltradas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
    }
    if (modoBloco) return pesagensFiltradas.slice(0, limiteAnteriores);
    return pesagensFiltradas;
  }, [pesagensFiltradas, paginaAtual, porPagina, periodo, modoBloco, limiteAnteriores]);
  useEffect(() => { setPagina(1); }, [busca, contratanteFiltro, porPagina, filtrosLista, filtrosTexto, filtrosNum, filtrosData, ordenacao, periodo]);
  useEffect(() => { setLimiteAnteriores(20); }, [periodo, busca, contratanteFiltro, filtrosLista, filtrosTexto, filtrosNum, filtrosData]);

  // Sem recebimento hoje mas com registros na base: abre em "Todo o período".
  useEffect(() => {
    if (autoPeriodoRef.current) return;
    if (!pesagens.length) return;
    if (periodo !== "hoje") { autoPeriodoRef.current = true; return; }
    const temHoje = pesagens.some((p) => dentroDoPeriodo(p.created_at, "hoje"));
    if (!temHoje) {
      autoPeriodoRef.current = true;
      setPeriodo("tudo");
      setAvisoPeriodoAuto(true);
    }
  }, [pesagens, periodo]);



  // ---- URLs assinadas apenas da página visível (+ registros abertos em diálogos)
  const paths = useMemo(() => {
    const lista = [...pesagensPagina];
    if (fotosDialog.pesagem) lista.push(fotosDialog.pesagem);
    if (ocorrDetDialog.pesagem) lista.push(ocorrDetDialog.pesagem);
    return Array.from(new Set(lista.flatMap((p) => p.evidencias.map((e) => e.storage_path))));
  }, [pesagensPagina, fotosDialog.pesagem, ocorrDetDialog.pesagem]);
  const { data: urlMap = {} } = useQuery(signedUrlsQueryOptions(paths)) as { data: Record<string, string> };





  function exportarCsv() {
    const cab = [
      "Contratante", "Situação", "Nota", "Placa", "Transportadora", "Descrição do produto",
      "Entrada (kg)", "Saída (kg)", "Líquido (kg)", "Duração", "Fonte NF", "Fonte peso", "Data",
    ];
    const linhas = pesagensFiltradas.map((p) => {
      const itens = ((p as unknown as { itens_nf?: Array<{ descricao?: string }> | null }).itens_nf ?? [])
        .map((it) => (it?.descricao ?? "").trim())
        .filter(Boolean);
      const descProduto = itens.length > 0 ? itens.join(" | ") : "";
      return [
        p.contratante ?? "", p.status, p.numero_nota ?? "", p.placa ?? "", p.transportadora ?? "",
        descProduto,
        p.peso_entrada ?? "", p.peso_saida ?? "", pesoLiquido(p) ?? "",
        duracaoStr(p), p.fonte_nota, p.fonte_peso_entrada ?? "", p.fonte_peso_saida ?? "", fmtDate(p.created_at),
      ];
    });
    const csv = [cab, ...linhas]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pesagens-${obraAtual?.nome ?? "obra"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const divergencia = useMemo(() => {
    if (peso === "" || pesoNf === "") return null;
    if (modo === "entrada") return null;
    const p = pendentes.find((x) => x.id === pesagemPendenteId);
    if (!p) return null;
    const liq = Math.abs(Number(p.peso_entrada) - Number(peso));
    return Math.abs(Number(pesoNf) - liq);
  }, [peso, pesoNf, pesagemPendenteId, pendentes, modo]);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] min-w-0 flex-col gap-4 p-3 sm:gap-6 sm:p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pesagem</h1>
          <p className="text-sm text-muted-foreground">
            Dupla pesagem — entrada (bruto) → saída (tara) — líquido = |entrada − saída|.
          </p>
        </div>
        <Tabs value={modo} onValueChange={(v) => trocarModo(v as "entrada" | "saida")} className="w-full sm:w-auto">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 overflow-visible bg-muted/40 p-2 sm:flex sm:w-auto sm:gap-3 sm:p-2.5 ring-1 ring-border/50">
            <TabsTrigger
              value="entrada"
              className="h-14 w-full gap-2 px-2 text-sm font-heading font-semibold sm:h-16 sm:w-auto sm:px-10 sm:text-lg btn-premium-amber data-[state=active]:animate-pulse-glow-amber"
            >
              <ArrowRightLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              Entrada (bruto)
            </TabsTrigger>
            <TabsTrigger
              value="saida"
              className="h-14 w-full gap-2 px-2 text-sm font-heading font-semibold sm:h-16 sm:w-auto sm:px-10 sm:text-lg btn-premium-success data-[state=active]:animate-pulse-glow-green"
            >
              <ArrowRightLeft className="h-5 w-5 rotate-180 sm:h-6 sm:w-6" />
              Saída (tara)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* SAÍDA — fluxo guiado: primeiro localizar a placa */}
      {modo === "saida" && saidaEtapa === "buscar" && (
        <Card className="overflow-hidden border-success/30 bg-card shadow-sm animate-soft-glow-green">
          <div className="flex items-center justify-between bg-success px-5 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-heading font-semibold tracking-tight">
              <Truck className="h-4 w-4" /> Pesagem de saída
            </div>
            <span className="rounded bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-heading font-bold uppercase tracking-wider text-white shadow-sm">
              Passo 1 de 2 — Placa
            </span>
          </div>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="busca-placa" className="text-xs font-bold uppercase tracking-wider text-success-foreground">
                Placa do caminhão que está saindo
              </Label>
              <div className="flex gap-2">
                <Input
                  id="busca-placa"
                  placeholder="Ex: ABC1D23"
                  value={buscaPlaca}
                  onChange={(e) => setBuscaPlaca(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") localizarPlaca(); }}
                  className="h-12 flex-1 border-2 border-success/30 bg-card font-mono text-lg font-bold uppercase tracking-widest focus-visible:border-success focus-visible:ring-success/30"
                  autoFocus
                  autoComplete="off"
                />
                <Button className="h-12 px-6 bg-success text-success-foreground hover:bg-success/90 shadow-sm" onClick={localizarPlaca}>
                  <Search className="mr-1 h-4 w-4" /> Localizar
                </Button>
              </div>
              <p className="text-[11px] text-success-foreground/80">
                O sistema busca a entrada correspondente no histórico e libera a captura de peso.
              </p>
            </div>

            {candidatos.length > 1 && (
              <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs font-semibold text-warning-foreground">
                  {candidatos.length} entradas pendentes para esta placa. Selecione:
                </p>
                <div className="space-y-1.5">
                  {candidatos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selecionarCandidato(c.id)}
                      className="flex w-full items-center justify-between rounded border border-border bg-card px-3 py-2 text-left text-xs transition hover:border-success hover:bg-success/5 hover:shadow-sm"
                    >
                      <div>
                        <div className="font-mono font-bold text-foreground">{c.placa ?? "—"}</div>
                        <div className="text-muted-foreground">
                          NF {c.numero_nota ?? "—"} · {c.transportadora ?? "—"} · Entrada {fmtDate(c.entrou_em)}
                        </div>
                      </div>
                      <span className="font-semibold text-success">{fmtKg(c.peso_entrada)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pendentes.length === 0 && (
              <div className="rounded border border-dashed border-success/30 bg-success/5 p-3 text-xs text-success-foreground/80">
                Nenhum caminhão aguardando saída no momento.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SAÍDA — banner de placa localizada */}
      {modo === "saida" && saidaEtapa === "pronto" && (() => {
        const p = pendentes.find((x) => x.id === pesagemPendenteId);
        if (!p) return null;
        return (
          <Card className="overflow-hidden border-success/30 bg-card shadow-sm animate-soft-glow-green">
            <div className="flex items-center justify-between bg-success px-5 py-3 text-white">
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4" />
                <span className="text-sm font-heading font-semibold">Placa Localizada</span>
                <span className="rounded border border-white/30 bg-white/20 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-white">
                  {p.placa ?? "—"}
                </span>
              </div>
              <button onClick={trocarPlaca} className="text-xs font-bold text-success hover:underline">
                Trocar placa
              </button>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-3 rounded-lg bg-success/10 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-tight text-success-foreground/70">Nota fiscal</p>
                  <p className="text-sm font-semibold text-success-foreground">{p.numero_nota ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-tight text-success-foreground/70">Entrada em</p>
                  <p className="text-sm font-semibold text-success-foreground">{fmtDate(p.entrou_em)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-tight text-success-foreground/70">Transportadora</p>
                  <p className="truncate text-sm font-semibold text-success-foreground">{p.transportadora ?? "—"}</p>
                </div>
                <div className="col-span-2 flex items-end justify-between border-t border-success/20 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-tight text-success-foreground/70">Peso de entrada</p>
                  <p className="text-lg font-black italic text-success-foreground">
                    {fmtKg(p.peso_entrada)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}





      {/* Painel de trabalho (bloqueado até que a saída esteja destravada) */}
      <div className={`grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 ${!saidaDestravada ? "pointer-events-none opacity-40" : ""}`}>

        {/* NOTA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> Nota fiscal / Veículo
              <Badge variant="outline" className="ml-auto">Fonte: {rotuloFonte(fonteNota)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative space-y-3">
            {ocrMut.isPending && <OcrProcessingOverlay />}
            {notaDuplicada && !ocrMut.isPending && (
              <DuplicataNotaAviso
                registro={notaDuplicada}
                onDescartar={limparForm}
              />
            )}

            {/* Seletor de modo Concreto */}
            <div className="rounded-lg border bg-muted/30 p-2 text-xs">
              <div className="mb-2 flex items-center justify-between font-semibold uppercase tracking-wider">
                <span>Modo de pesagem</span>
                <FlaskConical className="h-3 w-3 text-primary" />
              </div>
              <Select value={modoPesagem} onValueChange={(v: any) => setModoPesagem(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dupla">Dupla Pesagem (Padrão)</SelectItem>
                  <SelectItem value="unica_excecao">Pesagem Única (Exceção)</SelectItem>
                </SelectContent>
              </Select>
              {modoPesagem === "unica_excecao" && (
                <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Tara informada (kg)</Label>
                  <Input 
                    type="number" 
                    className="h-8 text-xs" 
                    placeholder="Tara manual"
                    value={taraInformada}
                    onChange={e => setTaraInformada(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <p className="text-[10px] text-warning font-medium">
                    * Requer conferência da engenharia.
                  </p>
                </div>
              )}
            </div>

            {/* OCR em destaque */}
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ScanLine className="h-4 w-4 text-primary" /> Receber a nota fiscal
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 animate-pulse-once"
                  onClick={() => notaCamRef.current?.click()}
                  disabled={ocrMut.isPending}
                >
                  {ocrMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
                  Tirar foto da nota
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => notaFileRef.current?.click()} disabled={ocrMut.isPending}>
                  <Upload className="mr-1 h-4 w-4" /> Enviar arquivo
                </Button>
                <input
                  ref={notaCamRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => { onNotaArquivo(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
                <input
                  ref={notaFileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(e) => { onNotaArquivo(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                A câmera abre no celular; no desktop, escolha um JPG/PNG/PDF. Os campos abaixo são preenchidos automaticamente.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2">
              {docNaoFiscalAgua ? (
                <Badge className="gap-1 bg-info text-white hover:bg-info">
                  <Droplet className="h-3 w-3" /> Documento não fiscal — ÁGUA
                </Badge>
              ) : (
                <span className="text-[11px] text-muted-foreground">Documento fiscal (NF-e / NFS-e / CT-e)</span>
              )}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-[11px]"
                onClick={() => setDocNaoFiscalAgua((v) => !v)}
              >
                {docNaoFiscalAgua ? "Voltar ao formulário completo" : "Marcar como documento não fiscal (água)"}
              </Button>
            </div>

            <div className={`grid grid-cols-1 gap-2 md:grid-cols-2 rounded-md ${ocrHighlight ? "animate-highlight-fade" : ""}`}>
              {!docNaoFiscalAgua && (
                <div className="md:col-span-2 flex gap-2">
                  <Input
                    placeholder="Chave da NF-e (44 dígitos)"
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    maxLength={54}
                  />
                  <Button variant="outline" onClick={buscarSefaz}>
                    <Search className="mr-1 h-4 w-4" /> SEFAZ
                  </Button>
                </div>
              )}
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="contratante" className="flex items-center gap-2">
                  Contratante (obra) *
                  {contratanteOrigem === "auto" && contratante.trim() !== "" ? (
                    <span className="rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      identificado pela nota
                    </span>
                  ) : contratanteOrigem === "manual" && contratante.trim() !== "" ? (
                    <span className="text-[10px] font-normal text-muted-foreground">selecionado manualmente</span>
                  ) : null}
                </Label>
                <SeletorObraContratante
                  obras={obras}
                  value={contratante}
                  invalido
                  placeholder="Selecione a obra contratante (cadastro de obras)"
                  onChange={(nome) => {
                    setContratante(nome);
                    setContratanteOrigem("manual");
                  }}
                />
                {contratante.trim() === "" && contratanteOrigem === "nao_identificado" ? (
                  <p className="text-[11px] font-medium text-destructive">
                    Não foi possível identificar a obra contratante — selecione na lista.
                  </p>
                ) : null}
              </div>
              <Campo label="Nº nota *" value={numeroNota} onChange={(v) => setNumeroNota(v.toUpperCase())} obrigatorio={tentouSalvar && faltaNumeroNota} />
              {!docNaoFiscalAgua && (
                <Campo label="Data emissão *" type="date" value={emissao} onChange={setEmissao} obrigatorio={tentouSalvar && faltaEmissao} />
              )}
              <Campo label="Emissor *" value={emissor} onChange={(v) => setEmissor(v.toUpperCase())} obrigatorio={tentouSalvar && faltaEmissor} />
              <Campo label="Transportadora *" value={transportadora} onChange={(v) => setTransportadora(v.toUpperCase())} obrigatorio={tentouSalvar && faltaTransportadora} />
              <Campo label="Placa (cavalo) *" value={placa} onChange={(v) => setPlaca(v.toUpperCase())} obrigatorio={tentouSalvar && faltaPlaca} />
              <Campo label="UF *" value={uf} onChange={(v) => setUf(v.toUpperCase().slice(0, 2))} obrigatorio={tentouSalvar && faltaUf} />
              <Campo label="Motorista *" value={motorista} onChange={(v) => setMotorista(v.toUpperCase())} obrigatorio={tentouSalvar && faltaMotorista} />
              <Campo label="Peso da NF (kg) *" type="number" value={pesoNf === "" ? "" : String(pesoNf)} onChange={(v) => setPesoNf(v === "" ? "" : Number(v))} obrigatorio={tentouSalvar && faltaPesoNf} />
              {!docNaoFiscalAgua && (
                <>
                  <Campo label="Modelo *" value={modelo} onChange={(v) => setModelo(v.toUpperCase())} obrigatorio={tentouSalvar && faltaModelo} />
                  <Campo label="Marca *" value={marca} onChange={(v) => setMarca(v.toUpperCase())} obrigatorio={tentouSalvar && faltaMarca} />
                  <Campo label="Carreta * (placa reboque)" value={carreta} onChange={(v) => setCarreta(v.toUpperCase())} obrigatorio={tentouSalvar && faltaCarreta} />
                  <Campo
                    label="Tara (kg)"
                    type="number"
                    value={taraInformada === "" ? "" : String(taraInformada)}
                    onChange={(v) => setTaraInformada(v === "" ? "" : Number(v))}
                    obrigatorio={tentouSalvar && faltaTara}
                  />
                  <Campo
                    label="Valor total da NF (R$) *"
                    type="number"
                    value={valorTotalNf === "" ? "" : String(valorTotalNf)}
                    onChange={(v) => setValorTotalNf(v === "" ? "" : Number(v))}
                    obrigatorio={tentouSalvar && faltaValorTotal}
                  />
                </>
              )}
            </div>

            {/* Itens da NF */}
            {!docNaoFiscalAgua && (
            <div className={`space-y-2 rounded-lg border-2 p-3 ${tentouSalvar && faltaItens ? "border-destructive bg-destructive/5" : "border-muted"}`}>
              <div className="flex items-center justify-between">
                <Label className={`text-xs font-semibold ${tentouSalvar && faltaItens ? "text-destructive" : ""}`}>
                  Itens da NF * {tentouSalvar && faltaItens && <span className="ml-1 text-[10px] font-normal">(obrigatório — informe ao menos 1 item completo)</span>}
                </Label>
                <div className="text-[10px] text-muted-foreground">
                  Qtd total: <strong className="tabular-nums">{qtdTotal.toLocaleString("pt-BR")}</strong>
                </div>
              </div>
              <div className="space-y-1.5">
                {itensNf.map((it, idx) => {
                  const faltaDesc = it.descricao.trim() === "";
                  const faltaQtd = it.quantidade === "" || Number(it.quantidade) <= 0;
                  const faltaVlr = it.valor_unitario === "" || Number(it.valor_unitario) < 0;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-start">
                      <Input
                        className={`col-span-5 h-8 text-xs uppercase px-2 py-1 ${tentouSalvar && faltaItens && faltaDesc ? "border-destructive bg-destructive/5" : ""}`}
                        placeholder="Descrição do produto"
                        value={it.descricao}
                        onChange={(e) => atualizarItem(idx, { descricao: e.target.value.toUpperCase() })}
                      />
                      <Input
                        className={`col-span-2 h-8 text-xs tabular-nums px-2 py-1 ${tentouSalvar && faltaItens && faltaQtd ? "border-destructive bg-destructive/5" : ""}`}
                        type="number"
                        inputMode="decimal"
                        placeholder="Qtd"
                        value={it.quantidade === "" ? "" : String(it.quantidade)}
                        onChange={(e) => atualizarItem(idx, { quantidade: e.target.value === "" ? "" : Number(e.target.value) })}
                      />
                      <Input
                        className="col-span-2 h-8 text-xs uppercase px-2 py-1"
                        placeholder="Un"
                        maxLength={6}
                        value={it.unidade}
                        onChange={(e) => atualizarItem(idx, { unidade: e.target.value.toUpperCase() })}
                        title="Unidade de medida (KG, T, UN, PC, M, M2, M3, L…)"
                      />
                      <Input
                        className={`col-span-2 h-8 text-xs tabular-nums px-2 py-1 ${tentouSalvar && faltaItens && faltaVlr ? "border-destructive bg-destructive/5" : ""}`}
                        type="number"
                        inputMode="decimal"
                        placeholder="Vlr un"
                        value={it.valor_unitario === "" ? "" : String(it.valor_unitario)}
                        onChange={(e) => atualizarItem(idx, { valor_unitario: e.target.value === "" ? "" : Number(e.target.value) })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="col-span-1 h-8 px-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removerItem(idx)}
                        disabled={itensNf.length <= 1}
                        title="Remover item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={adicionarItem}>
                + Adicionar item
              </Button>
            </div>
            )}


            {tentouSalvar && camposObrigatoriosPendentes.length > 0 && modo === "entrada" && (
              <div className="rounded-md border-2 border-destructive bg-destructive/5 p-2 text-xs text-destructive">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Campos obrigatórios pendentes
                </div>
                <div className="mt-1">{camposObrigatoriosPendentes.join(" · ")}</div>
              </div>
            )}

            {divergencia != null && (
              <div className="rounded border border-warning/30 bg-warning/5 p-2 text-xs text-warning">
                Divergência peso NF × líquido: <strong>{divergencia.toLocaleString("pt-BR")} kg</strong>
              </div>
            )}
          </CardContent>
        </Card>


        {/* PESO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScaleIcon className="h-4 w-4 text-primary" /> Peso
              {modoBalanca === "manual" ? (
                <Badge variant="outline" className="ml-auto gap-1 border-warning/30 text-warning">
                  Modo manual
                </Badge>
              ) : balancaConectada ? (
                <Badge variant="outline" className="ml-auto gap-1"><Wifi className="h-3 w-3 text-primary" />Balança</Badge>
              ) : (
                <Badge variant="outline" className="ml-auto gap-1 text-muted-foreground"><WifiOff className="h-3 w-3" />Sem balança</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* BLOCO: TRAÇO IDENTIFICADO (CONCRETO) */}
            {!docNaoFiscalAgua && (fornecedorIdentificado || emissor) && (
              <div
                className={`rounded-lg border p-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                  tracoIdentificado
                    ? "border-success/20 bg-success/20"
                    : "border-warning/20 bg-warning/5/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <FlaskConical className="h-3.5 w-3.5" /> Traço identificado
                    </span>
                    {tracoIdentificado && !tracoConfirmadoManual && !fornecedorConfirmadoManual && (
                      <Badge className="h-4 px-1.5 text-[9px] bg-success hover:bg-success border-none text-white">
                        AUTOMÁTICO
                      </Badge>
                    )}
                    {(tracoConfirmadoManual || fornecedorConfirmadoManual) && (
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[9px] border-warning/30 text-warning bg-warning/5"
                      >
                        CONFIRMADO MANUALMENTE
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-[10px] text-muted-foreground hover:text-primary"
                      onClick={() => {
                        const emissorLimpo = emissor.trim();
                        const descricoes = itensNf.map((i) => i.descricao).join(" ");
                        const match = identificarConcreto(emissorLimpo, descricoes, fornecedoresConcreto, dadosConcretoOcr ?? undefined);
                        const alvo = match?.fornecedor ?? casarFornecedorPorEmissor(emissorLimpo, fornecedoresConcreto);
                        setFornecedorConfirmadoManual(false);
                        setTracoConfirmadoManual(false);
                        setFornecedorIdentificado(alvo ?? null);
                        setTracoIdentificado(match?.traco ?? null);
                        setIsPadraoFallback(!!match?.isPadraoFallback);

                        if (alvo) toast.success(`Fornecedor vinculado: ${alvo.nome}`);
                        else toast.warning("Nenhum fornecedor cadastrado corresponde ao emissor da nota.");
                      }}
                    >
                      Revincular fornecedor
                    </Button>
                    {(tracoIdentificado || fornecedorIdentificado) && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-[10px] text-primary"
                        onClick={() => {
                          setTracoConfirmadoManual(true);
                          setTracoIdentificado(null);
                          setFornecedorConfirmadoManual(true);
                          setFornecedorIdentificado(null);
                        }}
                      >
                        Trocar tudo
                      </Button>
                    )}
                  </div>

                </div>

                <div className="space-y-3">
                  {/* Passo 1: Fornecedor */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground border border-border">
                        1
                      </div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">
                        Fornecedor
                      </Label>
                    </div>
                    <Select
                      value={fornecedorIdentificado?.id || ""}
                      onValueChange={(val) => {
                        const f = fornecedoresConcreto.find((x) => x.id === val);
                        setFornecedorIdentificado(f);
                        setFornecedorConfirmadoManual(true);
                        setTracoIdentificado(null);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-card">
                        <SelectValue placeholder="Selecione o fornecedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedoresConcreto
                          .filter((f) => f.ativo)
                          .map((f) => (
                            <SelectItem key={f.id} value={f.id} className="text-xs">
                              {f.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Passo 2: Carta de Traço */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground border border-border">
                        2
                      </div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">
                        Carta de traço
                      </Label>
                    </div>
                    {fornecedorIdentificado ? (
                      <div className="space-y-2">
                        {!tracoIdentificado && (
                          <div className="flex items-center gap-2 text-[10px] text-destructive font-semibold px-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            Atenção: A carta de traço é obrigatória para este fornecedor.
                          </div>
                        )}
                        <Select
                          value={tracoIdentificado?.id || ""}
                          onValueChange={(val) => {
                            const t = fornecedorIdentificado.tracos.find((x: any) => x.id === val);
                            setTracoIdentificado(t);
                            setTracoConfirmadoManual(true);
                          }}
                        >
                          <SelectTrigger
                            className={`h-9 text-xs bg-card ${
                              !tracoIdentificado ? "border-destructive ring-1 ring-destructive/20 focus:ring-destructive/30" : ""
                            }`}
                          >
                            <SelectValue placeholder="Selecione o traço..." />
                          </SelectTrigger>
                          <SelectContent>
                            {fornecedorIdentificado.tracos
                              ?.filter((t: any) => t.ativo)
                              .map((t: any) => (
                                <SelectItem key={t.id} value={t.id} className="text-xs">
                                  {t.codigo || "S/C"} · FCK {t.fck} · SLUMP {t.slump_nominal} · ρ{" "}
                                  {t.densidade_teorica}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="h-9 flex items-center px-3 rounded-md border border-muted bg-muted/50 text-[11px] text-muted-foreground italic">
                        Escolha o fornecedor primeiro
                      </div>
                    )}
                  </div>

                  {/* Resumo técnico se identificado */}
                  {tracoIdentificado && (
                    <div className={`mt-2 rounded-lg border p-3 shadow-sm transition-all duration-300 ${
                      isPadraoFallback 
                        ? 'border-success/30 bg-foreground text-white' 
                        : 'border-success/20 bg-success/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${
                            isPadraoFallback ? 'bg-success/20 text-success' : 'bg-success/10 text-success'
                          }`}>
                            {isPadraoFallback ? <ShieldCheck className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                          </div>
                          <div>
                            <h4 className={`text-[10px] font-bold uppercase tracking-tight ${
                              isPadraoFallback ? 'text-success' : 'text-success'
                            }`}>
                              {isPadraoFallback ? 'Referência Padrão Aplicada' : 'Traço identificado'}
                            </h4>
                            <p className={`text-[9px] font-medium leading-none ${
                              isPadraoFallback ? 'text-white/60' : 'text-success/80'
                            }`}>
                              {isPadraoFallback ? 'Densidade de referência padrão' : 'Traço específico da usina'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`h-5 text-[9px] font-bold px-1.5 ${
                          isPadraoFallback 
                            ? 'border-success/40 bg-success/10 text-success' 
                            : 'border-success/20 bg-success/5 text-success'
                        }`}>
                          FCK {tracoIdentificado.fck || "—"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="secondary" className={`text-[9px] font-medium border-border ${isPadraoFallback ? 'bg-white/10 text-white border-white/5' : 'bg-card'}`}>
                          SLUMP {tracoIdentificado.slump_nominal || "—"}±
                          {tracoIdentificado.slump_tolerancia || "2"}{" "}
                          {tracoIdentificado.slump_unidade || "cm"}
                        </Badge>
                        <Badge variant="secondary" className={`text-[9px] font-medium border-border ${isPadraoFallback ? 'bg-white/10 text-white border-white/5' : 'bg-card'}`}>
                          ρ {tracoIdentificado.densidade_teorica?.toLocaleString("pt-BR") || "—"} kg/m³
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-black/10">
                        <div className={`${isPadraoFallback ? 'text-white/60' : 'text-muted-foreground'}`}>
                          Volume <span className={`font-bold ${isPadraoFallback ? 'text-white' : 'text-foreground'}`}>{volumeNota.volume ? `${volumeNota.volume.toLocaleString("pt-BR")}` : "—"} m³</span>
                          <ArrowRightLeft className="inline h-3 w-3 mx-1 opacity-50" />
                          Esperado <span className={`font-bold ${isPadraoFallback ? 'text-white' : 'text-foreground'}`}>{resultadoConcreto?.esperado ? fmtKgPt(resultadoConcreto.esperado) : "—"}</span>
                        </div>

                        {resultadoConcreto && modo === "saida" ? (
                          <Badge
                            className={`text-[9px] h-4 ${
                              resultadoConcreto.status === "conforme"
                                ? "bg-success"
                                : resultadoConcreto.status === "abaixo"
                                  ? "bg-destructive"
                                  : "bg-warning"
                            }`}
                          >
                            {resultadoConcreto.status.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className={`text-[9px] italic ${isPadraoFallback ? 'text-white/40' : 'text-muted-foreground'}`}>
                            Aguardando saída
                          </span>
                        )}
                      </div>

                      {/* Volume da carga: sem ele não há Peso Carta Traço */}
                      <div className="mt-2 pt-2 border-t border-black/10 space-y-1.5">
                        {!volumeNota.volume && (
                          <div className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-[1px]" />
                            <p className="text-[10px] font-semibold leading-tight text-warning">
                              Volume não identificado na nota — informe o volume (m³) para calcular o Peso Carta Traço.
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Label className={`text-[10px] font-semibold ${isPadraoFallback ? 'text-white/70' : 'text-muted-foreground'}`}>
                            Volume da nota (m³)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            className="h-7 w-24 text-[11px]"
                            placeholder={volumeNota.volume ? String(volumeNota.volume) : "0"}
                            value={volumeManual}
                            onChange={(e) => setVolumeManual(e.target.value === "" ? "" : Number(e.target.value))}
                          />
                          <span className={`text-[9px] ${isPadraoFallback ? 'text-white/40' : 'text-muted-foreground'}`}>
                            {volumeNota.detalhe}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}


            {modoBalanca === "auto" ? (
              <>
                <div className="relative flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.02] py-10 sm:py-14 md:py-16 animate-fade-in shadow-inner">
                  {scale.leitura && (
                    <Badge
                      className={`absolute right-3 top-3 gap-1.5 ${
                        pesoAtualEstavel ? "bg-primary hover:bg-primary shadow-sm" : "bg-muted hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${pesoAtualEstavel ? "bg-card animate-pulse" : "bg-muted-foreground"}`} />
                      {pesoAtualEstavel ? "Estável" : "Instável"}
                    </Badge>
                  )}
                  <span className="mb-3 text-[11px] font-heading font-bold uppercase tracking-[0.2em] text-primary/60">
                    Leitura em tempo real
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-6xl font-black tabular-nums leading-none tracking-tighter text-primary sm:text-7xl md:text-8xl">
                      {pesoAtualBalanca != null ? pesoAtualBalanca.toLocaleString("pt-BR") : "—"}
                    </span>
                    <span className="text-2xl font-heading font-bold text-primary/40 sm:text-3xl">kg</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {balancaConectada ? (
                    <Button variant="secondary" className="flex-1" onClick={scale.desconectar} disabled={!saidaDestravada}>Desconectar</Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={scale.conectar}
                      disabled={!saidaDestravada}
                      title={!saidaDestravada ? "Informe a placa do caminhão antes de conectar." : undefined}
                    >
                      Conectar balança
                    </Button>
                  )}
                  <Button className="flex-1" onClick={capturarPesoBalanca} disabled={!pesoAtualEstavel || !saidaDestravada}>
                    Capturar peso
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs text-warning">
                <p className="font-semibold">Contingência mobile</p>
                <p className="mt-1 text-warning/90">
                  A leitura automática exige o computador da guarita ligado ao cabo serial RS-232.
                  Aqui, digite o peso lido no display da balança.
                </p>
              </div>
            )}
            {/* Nota fiscal importada — miniatura dentro do card Peso */}
            {(() => {
              const notasImp = evPend
                .map((ev, i) => ({ ...ev, __idx: i }))
                .filter((ev) => ev.tipo === "nota");
              if (notasImp.length === 0) {
                return (
                  <div className="rounded-lg border border-dashed border-info/20 bg-info/5/40 p-3 text-center text-[11px] text-muted-foreground">
                    <FileText className="mx-auto mb-1 h-4 w-4 text-info/70" />
                    Nenhuma nota importada — use o card ao lado para escanear.
                  </div>
                );
              }
              return (
                <div className="space-y-2 rounded-lg border border-info/20 bg-info/5/60 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-info">
                    <FileText className="h-3.5 w-3.5" /> Nota fiscal importada
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {notasImp.map((ev) => (
                      <div key={ev.__idx} className="group relative overflow-hidden rounded border border-info/20 bg-card">
                        <button
                          type="button"
                          onClick={() => abrirVisualizador({ file: ev.file, dataUrl: ev.preview, nome: ev.file.name })}
                          className="block w-full cursor-zoom-in"
                          title="Visualizar nota fiscal"

                        >
                          {ev.file.type.includes("pdf") || /\.pdf$/i.test(ev.file.name) ? (
                            <div className="flex h-32 w-full flex-col items-center justify-center gap-1 bg-muted/40 px-2 text-center">
                              <FileText className="h-7 w-7 text-info" />
                              <span className="text-[10px] font-semibold text-info">PDF</span>
                              <span className="line-clamp-2 text-[9px] text-muted-foreground">{ev.file.name}</span>
                            </div>
                          ) : (
                            <img src={ev.preview} alt="Nota fiscal" className="h-32 w-full object-cover" />
                          )}

                        </button>
                        <div className="flex items-center justify-between border-t border-info/30 bg-white/90 px-1.5 py-1 text-[10px] text-info">
                          <span className="font-medium">
                            {numeroNota ? `NF ${numeroNota}` : "NF importada"}
                          </span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setEvPend((prev) => prev.filter((_, j) => j !== ev.__idx))
                            }
                            title="Remover nota"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(emissor || pesoNf !== "") && (
                    <div className="text-[11px] leading-relaxed text-info/80">
                      {emissor && <div><span className="font-semibold">Emissor:</span> {emissor}</div>}
                      {pesoNf !== "" && (
                        <div>
                          <span className="font-semibold">Peso NF:</span>{" "}
                          <span className="tabular-nums">{Number(pesoNf).toLocaleString("pt-BR")} kg</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label htmlFor="peso" className="flex items-center gap-2">
                Peso {modo === "entrada" ? "de entrada" : "de saída"} (kg)
                {!isAdmin && (
                  <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-[10px] font-normal text-muted-foreground">
                    Edição manual restrita ao admin
                  </Badge>
                )}
                {isAdmin && pesoFonte === "manual" && peso !== "" && (
                  <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/5 text-[10px] font-normal text-warning">
                    Edição admin
                  </Badge>
                )}
              </Label>
              <Input
                id="peso"
                type="number"
                inputMode="decimal"
                pattern="[0-9]*"
                value={peso}
                onChange={(e) => {
                  if (!isAdmin) return;
                  setPeso(e.target.value === "" ? "" : Number(e.target.value));
                  setPesoFonte("manual");
                }}
                readOnly={!isAdmin}
                placeholder={isAdmin ? "Ex: 32450" : "Capture pela balança"}
                className={`${modoBalanca === "manual" ? "h-14 text-2xl font-bold tabular-nums" : ""} ${!isAdmin ? "cursor-not-allowed bg-muted/50 text-muted-foreground" : ""}`}
                disabled={!saidaDestravada}
                title={!isAdmin ? "Somente administradores podem digitar o peso manualmente" : undefined}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Fonte:
                <Badge variant={pesoFonte === "balanca" ? "default" : "outline"}>
                  {pesoFonte === "balanca" ? "Balança" : "Manual"}
                </Badge>
              </div>
            </div>

            {/* AÇÕES PRINCIPAIS */}
            {(() => {
              const bloqueado =
                todasObras || !saidaDestravada || !!notaDuplicada || ocrMut.isPending || ocorrenciaEmPreenchimento;
              const motivo = todasObras
                ? "Selecione uma obra no topo para registrar pesagens — a visão “Todas as obras” é somente consulta."
                : ocorrenciaEmPreenchimento
                ? "Ocorrência em preenchimento — finalize pelo botão “Registrar ocorrência e fechar pesagem”."
                : notaDuplicada
                ? "Esta nota fiscal já foi registrada — limpe o formulário para continuar."
                : ocrMut.isPending
                  ? "Aguarde o processamento da nota fiscal."
                  : !saidaDestravada
                    ? "Informe a placa e localize o registro de entrada para liberar a saída."
                    : null;

              return (
                <div className="mt-4 space-y-2 border-t pt-4 sm:static sticky bottom-0 -mx-6 bg-card/95 px-6 pb-1 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
                  <div className="flex items-center justify-center gap-1.5 text-center text-xs font-medium">
                    {bloqueado ? (
                      <span
                        className={
                          ocorrenciaEmPreenchimento
                            ? "flex items-center gap-1.5 text-warning"
                            : "text-muted-foreground"
                        }
                      >
                        {ocorrenciaEmPreenchimento && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                        {motivo ?? "Ação indisponível"}
                      </span>
                    ) : camposObrigatoriosPendentes.length > 0 ? (
                      <span className="flex items-center gap-1.5 text-destructive font-bold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Preencha os campos obrigatórios
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-success font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Pronto para salvar
                      </span>
                    )}
                  </div>

                  <Button
                    className={`h-auto w-full py-6 text-base font-semibold shadow-sm transition-all duration-300 ${
                      resultadoConcreto?.requerEngenharia ? 'bg-destructive text-destructive-foreground animate-pulse' : ''
                    } ${
                      !bloqueado && !salvarMut.isPending && camposObrigatoriosPendentes.length === 0
                        ? "shadow-emerald-500/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30"
                        : "opacity-70"
                    }`}
                    onClick={() => {
                      if (modo === "entrada") setTentouSalvar(true);
                      salvarMut.mutate();
                    }}
                    disabled={salvarMut.isPending || bloqueado || camposObrigatoriosPendentes.length > 0}
                  >
                    {salvarMut.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando…
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-5 w-5" />
                        {modo === "entrada" ? "Salvar entrada" : "Registrar saída (concluir)"}
                      </>
                    )}
                  </Button>
                  {ocorrenciaEmPreenchimento && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-warning/30 text-warning hover:bg-warning/5"
                      onClick={irParaOcorrencia}
                    >
                      <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Ir para ocorrência
                    </Button>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2 pb-2">

                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={limparForm}>
                      <Eraser className="mr-1 h-3.5 w-3.5" /> Limpar
                    </Button>
                    {modo === "saida" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setOpenRecusa(true)}
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" /> Negar recebimento
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>


        {/* EVIDÊNCIAS / OCORRÊNCIA */}
        <Card
          id="ocorrencia-card"
          className={`scroll-mt-24 transition-all ${
            ocorrenciaEmPreenchimento ? "border-warning shadow-md shadow-amber-500/10" : "border-warning/30"
          }`}
        >
          {ocorrenciaEmPreenchimento && (
            <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10/70 px-3 py-2 text-xs font-medium text-warning">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Modo ocorrência ativo — a gravação normal está bloqueada.
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-warning hover:bg-warning/60"
                onClick={limparOcorrencia}
              >
                Cancelar ocorrência
              </Button>
            </div>
          )}
          {ocorrenciaAlvoId && (
            <div className="mx-4 mt-4 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              Registrando ocorrência no registro da placa <strong>{placa || "—"}</strong>
              {numeroNota ? <> · NF {numeroNota}</> : null}
              {alvoTemPesoSaida ? " · peso de saída já aferido (bloqueado)." : " · sem peso de saída aferido."}
            </div>
          )}

          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Registrar ocorrência / evidência
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cenário anômalo no processo de pesagem. Ao registrar, envia e-mail aos setores e fecha a pesagem.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Chip de contexto */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{placa || "—"}</span>
                {uf && <span>/{uf}</span>}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                NF <span className="font-medium text-foreground">{numeroNota || "—"}</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{contratante || obraAtual?.nome || "—"}</span>
              </span>
            </div>

            {/* Toggle Entrada / Saída */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ocorreu na pesagem de
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["entrada", "saida"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOcorrEstagio(v)}
                    className={`rounded-md border py-2 text-sm font-semibold capitalize transition ${
                      ocorrEstagio === v
                        ? "border-success bg-success text-white shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {v === "saida" ? "Saída" : "Entrada"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo da ocorrência */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo de ocorrência
              </Label>
              <Select value={ocorrTipo} onValueChange={setOcorrTipo}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="— selecione —" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_OCORRENCIA.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ocorrTipo === "Outro" && (
                <Input
                  className="mt-1.5"
                  placeholder="Descreva o tipo"
                  value={ocorrTipoOutro}
                  onChange={(e) => setOcorrTipoOutro(e.target.value)}
                />
              )}
            </div>

            {/* Fotos de evidência */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Fotos de evidência
              </Label>
              <div className="flex items-center gap-2">
                <Select value={tipoEvidencia} onValueChange={(v) => setTipoEvidencia(v as TipoEvidencia)}>
                  <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_EV.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="flex-1" onClick={() => evRef.current?.click()}>
                  <Camera className="mr-1 h-4 w-4" /> Adicionar foto
                </Button>
                <input
                  ref={evRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => { adicionarEvidencia(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
                {evPend
                  .map((ev, i) => ({ ev, i }))
                  .filter(({ ev }) => ev.tipo !== "nota")
                  .map(({ ev, i }) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded border">
                      {ehArquivoPdf(ev.file.type, ev.file.name) ? (
                        <button
                          type="button"
                          onClick={() => abrirVisualizador({ file: ev.file, dataUrl: ev.preview, nome: ev.file.name })}
                          className="flex h-full w-full cursor-zoom-in flex-col items-center justify-center gap-1 bg-muted/40 px-1 text-center"
                          title="Visualizar PDF"
                        >
                          <FileText className="h-6 w-6 text-info" />
                          <span className="text-[9px] font-semibold text-info">PDF</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirVisualizador({ file: ev.file, dataUrl: ev.preview, nome: ev.file.name })}
                          className="block h-full w-full cursor-zoom-in"
                          title="Visualizar arquivo"
                        >
                          <img src={ev.preview} alt={ev.tipo} className="h-full w-full object-cover" />
                        </button>
                      )}

                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1 py-0.5 text-[10px] text-white">
                        <span className="uppercase">{ev.tipo}</span>
                        <button
                          type="button"
                          onClick={() => setEvPend((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                {evPend.filter((ev) => ev.tipo !== "nota").length === 0 && (
                  <div className="col-span-3 rounded border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Nenhuma evidência adicionada.
                  </div>
                )}
              </div>
            </div>

            {/* E-mail do fornecedor */}
            <div className="space-y-1.5 rounded-md border border-muted bg-muted/40 p-3">
              <Label htmlFor="email-forn" className="text-xs">E-mail do fornecedor (para recusa)</Label>
              <Input
                id="email-forn"
                type="email"
                placeholder="fornecedor@empresa.com.br"
                value={emailFornecedor}
                onChange={(e) => setEmailFornecedor(e.target.value)}
              />
            </div>

            {/* Relatório da ocorrência */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Relatório da ocorrência
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => melhorarMut.mutate()}
                  disabled={melhorarMut.isPending || !ocorrRelato.trim()}
                  className="h-7 border-success/30 bg-success/5 text-success hover:bg-success-soft"
                >
                  {melhorarMut.isPending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                  )}
                  Melhorar com IA
                </Button>
              </div>
              <Textarea
                rows={5}
                value={ocorrRelato}
                onChange={(e) => setOcorrRelato(e.target.value)}
                placeholder="Descreva o que aconteceu, quando e as providências... depois clique em Melhorar com IA."
              />
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileText className="h-3 w-3" />
                Assinatura automática ao final do e-mail:{" "}
                <span className="font-medium text-foreground">
                  {perfilOcorr?.nome || user?.email?.split("@")[0] || "—"}
                </span>
                {perfilOcorr?.email && <span>· {perfilOcorr.email}</span>}
              </div>
            </div>

            {/* Destinatários */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Destinatários do e-mail
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {destinatariosOcorrencia(obraAtual?.engenheiro_email).map((d) => {
                  const ehEngenheiro =
                    !!obraAtual?.engenheiro_email &&
                    d === obraAtual.engenheiro_email.trim().toLowerCase();
                  return (
                    <Badge key={d} variant="secondary" className="gap-1 py-1 text-[11px]">
                      <Lock className="h-3 w-3" />
                      {d}
                      {ehEngenheiro && (
                        <span className="text-muted-foreground">
                          · eng. da obra{obraAtual?.engenheiro_nome ? ` (${obraAtual.engenheiro_nome})` : ""}
                        </span>
                      )}
                    </Badge>
                  );
                })}
                {!obraAtual?.engenheiro_email && (
                  <span className="self-center text-[11px] text-muted-foreground">
                    Obra sem e-mail de engenheiro cadastrado.
                  </span>
                )}
                {ccList.map((c) => (
                  <Badge key={c} variant="outline" className="gap-1 py-1 text-[11px]">
                    {c}
                    <button
                      type="button"
                      onClick={() => setCcList((prev) => prev.filter((x) => x !== c))}
                      className="ml-0.5 rounded hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Input
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="Adicionar e-mail em Cc..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = ccInput.trim();
                      if (v && !ccList.includes(v)) setCcList([...ccList, v]);
                      setCcInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const v = ccInput.trim();
                    if (v && !ccList.includes(v)) setCcList([...ccList, v]);
                    setCcInput("");
                  }}
                >
                  + Cc
                </Button>
              </div>
            </div>

            {/* CTA principal */}
            <div className="space-y-1.5 pt-1">
              <Button
                type="button"
                onClick={() => {
                  const pesoJaGravado = ocorrenciaAlvoId ? alvoTemPesoSaida : false;
                  const pesoVazio = peso === "" || Number(peso) === 0;
                  if (ocorrEstagio === "saida" && pesoVazio && !pesoJaGravado) {
                    setConfirmSemPeso(true);
                    return;
                  }
                  ocorrenciaMut.mutate();
                }}
                disabled={
                  ocorrenciaMut.isPending ||
                  !(ocorrTipo === "Outro" ? ocorrTipoOutro.trim() : ocorrTipo.trim()) ||
                  ocorrRelato.trim().length < 10 ||
                  (ocorrEstagio === "saida" && !pesagemPendenteId && !ocorrenciaAlvoId)
                }
                className={`w-full bg-destructive py-6 text-base font-semibold text-white transition-all hover:bg-destructive/90 ${
                  ocorrenciaEmPreenchimento ? "ring-2 ring-destructive/30 ring-offset-2" : ""
                }`}

              >
                {ocorrenciaMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Registrar ocorrência e fechar pesagem
              </Button>
              <p className="text-center text-[11px] text-destructive/80">
                O e-mail com o relatório e as fotos será enviado aos destinatários acima.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>




      {/* HISTÓRICO */}
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3">
          <div className="flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center">
            <CardTitle className="text-base">
              Histórico ({pesagensFiltradas.length})
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {todasObras ? "— todas as obras" : obraAtual ? `— ${obraAtual.nome}` : ""}
              </span>
            </CardTitle>

            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-0.5">
              <span className="px-2 text-[11px] text-muted-foreground">Período:</span>
              {PERIODOS.map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => setPeriodo(op.valor)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                    periodo === op.valor
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
            {avisoPeriodoAuto && periodo === "tudo" && (
              <span className="rounded bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning">
                Sem recebimentos hoje — exibindo todo o período.
              </span>
            )}
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <Select value={contratanteFiltro} onValueChange={setContratanteFiltro}>
                <SelectTrigger className="h-9 w-full sm:w-[240px]">
                  <SelectValue placeholder="Contratante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os contratantes</SelectItem>
                  {contratantesDisponiveis.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar por placa, NF, transportadora..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full sm:w-[280px]"
              />
              {isAdmin && (
                <div className="flex items-center gap-2 mr-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded border text-[11px]">
                    <span className="font-medium text-muted-foreground">{selecionados.size} selecionados</span>
                    {selecionados.size > 0 && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-6 px-2 text-[10px] ml-1"
                        onClick={excluirLote}
                        disabled={excluirLoteMut.isPending || excluirMut.isPending}
                      >
                        {(excluirLoteMut.isPending || excluirMut.isPending) ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={exportarCsv}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>

            </div>
          </div>
          {resumoObras.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Registros por obra:</span>
              {resumoObras.map((o) => {
                const sel = (filtrosLista["Obra"] ?? []).includes(o.nome);
                return (
                  <button
                    key={o.nome}
                    type="button"
                    onClick={() => {
                      setFiltrosLista((s) => {
                        const atual = s["Obra"] ?? [];
                        return { ...s, Obra: atual.includes(o.nome) ? atual.filter((x) => x !== o.nome) : [...atual, o.nome] };
                      });
                      // Registros antigos ficariam escondidos pelo período "Hoje".
                      if (!sel) setPeriodo("tudo");
                    }}

                    className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                      sel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {o.nome} <span className="font-semibold">{o.qtd}</span>
                  </button>
                );
              })}
              <span className="text-[11px] text-muted-foreground">
                Total <span className="font-semibold text-foreground">{resumoObras.reduce((a, o) => a + o.qtd, 0)}</span>
              </span>
            </div>
          )}
          {filtrosAtivos.length > 0 && (
            <div className="flex animate-fade-in flex-wrap items-center gap-1.5">
              {filtrosAtivos.map((c) => (
                <Badge
                  key={c.chave}
                  variant="outline"
                  className="gap-1 border-primary/40 bg-primary/10 text-[11px] font-normal text-primary"
                >
                  {c.rotulo}
                  <button type="button" onClick={c.limpar} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={limparTodosFiltros}>
                Limpar tudo
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="overflow-hidden p-0">
          <div className="max-h-[70vh] overflow-auto overscroll-x-contain sm:max-h-[600px]">
            <table className="w-full text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 border-b bg-muted/95 backdrop-blur-sm text-left shadow-sm">
              <tr>
                {(() => {
                  const setLista = (k: string) => (v: string[]) => setFiltrosLista((s) => ({ ...s, [k]: v }));
                  const setTexto = (k: string) => (v: string) => setFiltrosTexto((s) => ({ ...s, [k]: v }));
                  const setNum = (k: string) => (v: FaixaNum) => setFiltrosNum((s) => ({ ...s, [k]: v }));
                  const th = (key: string, node: React.ReactNode) => {
                    const isPlaca = key === "Placa";
                    return (
                      <th 
                        key={key} 
                        className={`px-3 py-2 font-medium leading-tight whitespace-nowrap border-b border-r last:border-r-0 ${
                          isPlaca ? "sticky left-0 z-30 bg-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" : ""
                        }`}
                      >
                        {node}
                      </th>
                    );
                  };
                  const checkboxTudo = isAdmin && (
                    <div className="flex items-center justify-center pr-2">
                      <input 
                        type="checkbox" 
                        className="h-3.5 w-3.5 rounded border-border-strong text-primary focus:ring-primary"
                        checked={pesagensPagina.length > 0 && selecionados.size === pesagensPagina.length}
                        onChange={toggleTudo}
                      />
                    </div>
                  );
                  const setData = (k: string) => (v: FaixaData) => setFiltrosData((s) => ({ ...s, [k]: v }));
                  const ord = (k: string) => ({
                    ordenacao: (ordenacao?.coluna === k ? ordenacao.direcao : null) as "asc" | "desc" | null,
                    onOrdenar: () =>
                      setOrdenacao((atual) =>
                        atual?.coluna !== k
                          ? { coluna: k, direcao: "asc" }
                          : atual.direcao === "asc"
                            ? { coluna: k, direcao: "desc" }
                            : null,
                      ),
                  });
                  const items = [
                    th("Data", <ColunaFiltro tipo="data" titulo="Data" faixaData={filtrosData["Data"] ?? {}} onChange={setData("Data")} {...ord("Data")} />),
                    ...(todasObras
                      ? [th("Obra", <ColunaFiltro tipo="lista" titulo="Obra" opcoes={opcoesColuna.obra} selecionados={filtrosLista["Obra"] ?? []} onChange={setLista("Obra")} {...ord("Obra")} />)]
                      : []),
                    th("Contratante", <ColunaFiltro tipo="lista" titulo="Contratante" opcoes={opcoesColuna.contratante} selecionados={filtrosLista["Contratante"] ?? []} onChange={setLista("Contratante")} {...ord("Contratante")} />),
                    th("Situação", <ColunaFiltro tipo="lista" titulo="Situação" opcoes={opcoesColuna.situacao} selecionados={filtrosLista["Situação"] ?? []} onChange={setLista("Situação")} {...ord("Situação")} />),
                    th("SinalTol", <ColunaFiltro tipo="lista" titulo="Sinal Tolerância" opcoes={opcoesColuna.sinalTol} selecionados={filtrosLista["Sinal Tolerância"] ?? []} onChange={setLista("Sinal Tolerância")} {...ord("Sinal Tolerância")} />),
                    th("Nota", <ColunaFiltro tipo="texto" titulo="Nota" valor={filtrosTexto["Nota"] ?? ""} onChange={setTexto("Nota")} {...ord("Nota")} />),
                    th("Placa", <ColunaFiltro tipo="texto" titulo="Placa" valor={filtrosTexto["Placa"] ?? ""} onChange={setTexto("Placa")} {...ord("Placa")} />),
                    th("Carreta", <ColunaFiltro tipo="texto" titulo="Carreta" valor={filtrosTexto["Carreta"] ?? ""} onChange={setTexto("Carreta")} {...ord("Carreta")} />),
                    th("Modelo/Marca", <ColunaFiltro tipo="texto" titulo="Modelo/Marca" valor={filtrosTexto["Modelo/Marca"] ?? ""} onChange={setTexto("Modelo/Marca")} {...ord("Modelo/Marca")} />),
                    th("Transportadora", <ColunaFiltro tipo="lista" titulo="Transportadora" opcoes={opcoesColuna.transportadora} selecionados={filtrosLista["Transportadora"] ?? []} onChange={setLista("Transportadora")} {...ord("Transportadora")} />),
                    th("Descrição", <ColunaFiltro tipo="texto" titulo="Descrição do produto" valor={filtrosTexto["Descrição"] ?? ""} onChange={setTexto("Descrição")} {...ord("Descrição")} />),
                    th("Qtd", <ColunaFiltro tipo="numero" titulo="Qtd/Peso NF" faixa={filtrosNum["Qtd/Peso NF"] ?? {}} onChange={setNum("Qtd/Peso NF")} {...ord("Qtd/Peso NF")} />),
                    th("PesoCalc", <ColunaFiltro tipo="numero" titulo="Peso Calculado" faixa={filtrosNum["Peso Calculado (t)"] ?? {}} onChange={setNum("Peso Calculado (t)")} {...ord("Peso Calculado (t)")} />),
                    th("PesoCarta", <ColunaFiltro tipo="numero" titulo="Peso Carta Traço" faixa={filtrosNum["Peso Carta Traço"] ?? {}} onChange={setNum("Peso Carta Traço")} {...ord("Peso Carta Traço")} />),
                    th("ValorNF", <ColunaFiltro tipo="numero" titulo="Valor NF" faixa={filtrosNum["Valor NF"] ?? {}} onChange={setNum("Valor NF")} {...ord("Valor NF")} />),
                    th("Entrada", <ColunaFiltro tipo="numero" titulo="Entrada" faixa={filtrosNum["Entrada"] ?? {}} onChange={setNum("Entrada")} {...ord("Entrada")} />),
                    th("Saída", <ColunaFiltro tipo="numero" titulo="Saída" faixa={filtrosNum["Saída"] ?? {}} onChange={setNum("Saída")} {...ord("Saída")} />),
                    th("Líquido", <ColunaFiltro tipo="numero" titulo="Líquido" faixa={filtrosNum["Líquido"] ?? {}} onChange={setNum("Líquido")} {...ord("Líquido")} />),
                    th("Duração", <ColunaFiltro tipo="numero" titulo="Duração (min)" faixa={filtrosNum["Duração"] ?? {}} onChange={setNum("Duração")} {...ord("Duração")} />),
                    th("Fonte", <ColunaFiltro tipo="lista" titulo="Fonte" opcoes={opcoesColuna.fonte} selecionados={filtrosLista["Fonte"] ?? []} onChange={setLista("Fonte")} {...ord("Fonte")} />),
                    th("Usuário", <ColunaFiltro tipo="lista" titulo="Usuário" opcoes={opcoesColuna.usuario} selecionados={filtrosLista["Usuário"] ?? []} onChange={setLista("Usuário")} {...ord("Usuário")} />),
                    th("Ações", <div className="flex items-center gap-2">{checkboxTudo}<span>Ações</span></div>),
                  ];
                  return items;

                })()}
              </tr>

            </thead>
            <tbody>
              {pesagensPagina.map((p) => {
                const pExt = p as PesagemComEvidencias & {
                  modelo?: string | null;
                  marca?: string | null;
                  carreta?: string | null;
                  valor_total_nf?: number | string | null;
                  qtd_total?: number | string | null;
                  itens_nf?: Array<{ descricao?: string | null; quantidade?: number | null; unidade?: string | null; valor_unitario?: number | null }> | null;
                };
                const itensDesc = (pExt.itens_nf ?? [])
                  .map((it) => (it?.descricao ?? "").trim())
                  .filter(Boolean);
                const valorNf = pExt.valor_total_nf != null ? Number(pExt.valor_total_nf) : null;
                const itensNf = pExt.itens_nf ?? [];
                const unidadesNf = Array.from(
                  new Set(itensNf.map((it) => normalizarUnidade(it?.unidade)).filter(Boolean)),
                );
                const qtdTotalNum = paraNumero(pExt.qtd_total ?? null);
                const qtdResumo =
                  itensNf.length > 1 && unidadesNf.length > 1
                    ? `${itensNf.length} itens`
                    : fmtQtdUnidade(qtdTotalNum, unidadesNf[0] ?? "");
                const qtdTitulo = itensNf
                  .map((it) =>
                    `${(it?.descricao ?? "—").trim()}: ${fmtQtdUnidade(paraNumero(it?.quantidade ?? null), normalizarUnidade(it?.unidade))}`,
                  )
                  .join("\n");
                const pesoCalc = calcularPesoNfDaPesagem(pExt);
                return (
                <tr key={p.id} className="group border-b hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap border-b border-r">{fmtDate(p.created_at)}</td>
                  {todasObras && (
                    <td
                      className="px-3 py-2 max-w-[190px] truncate border-b border-r"
                      title={nomePorObra.get(p.obra_id) ?? undefined}
                    >
                      {nomePorObra.get(p.obra_id) ?? "—"}
                    </td>
                  )}

                  <td className="px-3 py-2 max-w-[200px] truncate border-b border-r" title={p.contratante ?? undefined}>{p.contratante ?? "—"}</td>
                  <td className="px-3 py-2 border-b border-r"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2 border-b border-r whitespace-nowrap">
                    {(() => {
                      const s = sinalPorPesagem.get(p.id);
                      if (!s || s.chave === "aguardando" || s.chave === "sem_base") {
                        return (
                          <span
                            className="text-muted-foreground"
                            title={s?.rotulo ?? undefined}
                          >
                            —
                          </span>
                        );
                      }
                      const detalhe = [
                        `Esperado: ${fmtKgPt(s.esperado ?? 0)} kg`,
                        `Líquido aferido: ${fmtKgPt(s.aferido ?? 0)} kg`,
                        `Diferença: ${fmtKgPt(s.difKg ?? 0)} kg (${(s.difPct ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`,
                        `Tolerância: ±${(s.tolPct ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
                        s.origem ? `Origem: ${s.origem}` : "",
                      ]
                        .filter(Boolean)
                        .join("\n");
                      const acima = s.chave === "acima";
                      return (
                        <span
                          title={detalhe}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-tight ${
                            acima
                              ? "bg-destructive/10 text-destructive"
                              : "bg-success/10 text-success"
                          }`}
                        >
                          {acima ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {acima ? "Acima da Tolerância" : "OK"}
                          <span className="font-normal normal-case tabular-nums">
                            {(s.difPct ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                          </span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 border-b border-r">{p.numero_nota ?? "—"}</td>
                  <td className="px-3 py-2 font-mono border-b border-r sticky left-0 z-10 bg-background group-hover:bg-muted/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">{p.placa ?? "—"}</td>
                  <td className="px-3 py-2 font-mono border-b border-r">{pExt.carreta ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate border-b border-r" title={`${pExt.modelo ?? ""} ${pExt.marca ?? ""}`.trim()}>
                    <div className="text-xs">{pExt.modelo ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{pExt.marca ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 border-b border-r">{p.transportadora ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[260px] align-top border-b border-r">
                    {itensDesc.length > 0 ? (
                      <div className="space-y-0.5" title={itensDesc.join("\n")}>
                        {itensDesc.slice(0, 3).map((d, i) => (
                          <div key={i} className="truncate text-[11px] leading-tight">• {d}</div>
                        ))}
                        {itensDesc.length > 3 && (
                          <div
                            className="text-[10px] text-muted-foreground"
                            title={itensDesc.slice(3).join("\n")}
                          >
                            +{itensDesc.length - 3} {itensDesc.length - 3 === 1 ? "item" : "itens"}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="truncate text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap border-b border-r" title={qtdTitulo || undefined}>{qtdResumo}</td>
                  <td
                    className="px-3 py-2 tabular-nums whitespace-nowrap border-b border-r"
                    title={
                      pesoCalc.itens
                        .map((i) =>
                          `${i.descricao || "—"}: ${i.pesoKg != null ? `${fmtToneladas(i.pesoKg)}${i.estimado ? ` (unidade estimada: ${i.unidade})` : ""}` : i.motivo}`,
                        )
                        .join("\n") || undefined
                    }
                  >
                    {pesoCalc.totalKg != null ? (
                      <span className={pesoCalc.parcial ? "text-warning" : undefined}>
                        {fmtToneladas(pesoCalc.totalKg)}
                        {pesoCalc.parcial && (
                          <span className="ml-1 text-[10px]">
                            (parcial {pesoCalc.convertidos}/{pesoCalc.total})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap font-medium text-primary border-b border-r">
                    {pesoEsperadoDe(p) != null ? fmtKg(pesoEsperadoDe(p)) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold border-b border-r">
                    {valorNf != null ? valorNf.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap border-b border-r">{fmtKg(p.peso_entrada)}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap border-b border-r">{fmtKg(p.peso_saida)}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums whitespace-nowrap border-b border-r">{fmtKg(pesoLiquido(p))}</td>
                  <td className="px-3 py-2 border-b border-r">{duracaoStr(p)}</td>
                  <td className="px-3 py-2 border-b border-r">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">{rotuloFonte(p.fonte_nota)}</Badge>
                      {(p.fonte_peso_entrada === "balanca" || p.fonte_peso_saida === "balanca") && <Badge variant="outline" className="text-[10px]">Balança</Badge>}
                    </div>
                  </td>

                  <td className="px-3 py-2 text-[11px] border-b border-r">
                    {(() => {
                      const pAny = p as PesagemComEvidencias & { criado_por?: string | null; saida_por?: string | null };
                      const entradaId = pAny.criado_por ?? null;
                      const saidaId = pAny.saida_por ?? null;
                      const entradaEmail = entradaId ? (emailMap[entradaId] ?? "—") : "—";
                      const saidaEmail = saidaId ? (emailMap[saidaId] ?? "—") : null;
                      const entradaNome = formatarNomeUsuario(entradaEmail);
                      const saidaNome = formatarNomeUsuario(saidaEmail);
                      const mesmo = entradaId && saidaId && entradaId === saidaId;
                      if (!saidaId || mesmo) {
                        return <span title={entradaEmail}>{entradaNome}</span>;
                      }
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span title={`Entrada: ${entradaEmail}`}><span className="text-muted-foreground">E:</span> {entradaNome}</span>
                          <span title={`Saída: ${saidaEmail}`}><span className="text-muted-foreground">S:</span> {saidaNome}</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {(() => {
                      const nota = p.evidencias.find((e) => e.tipo === "nota");
                      const notaUrl = nota ? urlMap[nota.storage_path] : undefined;
                      const temNota = !!nota;
                      const temFotos = p.evidencias.length > 0;
                      const nada = false; // menu sempre acessível para permitir "Ocorrências"
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="flex items-center gap-2">
                              {isAdmin && (
                                <div className="flex items-center justify-center pr-2">
                                  <input 
                                    type="checkbox" 
                                    className="h-3.5 w-3.5 rounded border-border-strong text-primary focus:ring-primary cursor-pointer"
                                    checked={selecionados.has(p.id)}
                                    onChange={() => toggleSelecao(p.id)}
                                  />
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                title="Ações"
                                disabled={nada}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>

                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Anexos</DropdownMenuLabel>
                            <DropdownMenuItem
                              disabled={!temNota || !notaUrl}
                              onClick={() => notaUrl && window.open(notaUrl, "_blank", "noopener,noreferrer")}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Ver NF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!temFotos}
                              onClick={() => setFotosDialog({ open: true, pesagem: p })}
                            >
                              <ImageIcon className="mr-2 h-4 w-4" /> Ver fotos
                              {temFotos && (
                                <span className="ml-auto text-[10px] text-muted-foreground">{p.evidencias.length}</span>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setLogsDialog({
                                  open: true,
                                  id: p.id,
                                  rotulo: [p.numero_nota && `NF ${p.numero_nota}`, p.placa].filter(Boolean).join(" · "),
                                })
                              }
                            >
                              <HistoryIcon className="mr-2 h-4 w-4" /> Logs do registro
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            {(p.status === "fechada_com_ocorrencia" || (p.ocorrencia_relato && p.ocorrencia_relato.trim())) ? (
                              <DropdownMenuItem onClick={() => setOcorrDetDialog({ open: true, pesagem: p })}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-warning" /> Ocorrências
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => abrirOcorrenciaRegistro(p)}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-warning" /> Registrar ocorrência
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                {calcularSinalRegistro(p).chave === "acima" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      dispararAlertaTolerancia(p.id, calcularSinalRegistro(p), true)
                                    }
                                  >
                                    <Send className="mr-2 h-4 w-4 text-destructive" /> Enviar alerta de tolerância (WhatsApp)
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => abrirEdicao(p)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Editar registro
                                </DropdownMenuItem>
                                {isSuperAdmin && (
                                  <DropdownMenuItem
                                    disabled={reprocessarMut.isPending}
                                    onClick={() => reprocessarMut.mutate(p.id)}
                                  >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${reprocessarMut.isPending ? "animate-spin" : ""}`} /> Reprocessar itens da NF
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}

                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={excluirMut.isPending}
                                  onClick={() => setAlertExcluir({ open: true, ids: [p.id] })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}
                  </td>
                </tr>
              );})}
              {pesagensFiltradas.length === 0 && (
                <tr>
                  <td colSpan={todasObras ? 20 : 19} className="p-8 text-center">
                    <div className="flex animate-fade-in flex-col items-center gap-2">
                      <span className="text-muted-foreground">
                        {periodo === "hoje"
                          ? `Nenhum recebimento hoje em ${obraAtual?.nome ?? "esta obra"}.`
                          : `Nenhuma pesagem no período para ${obraAtual?.nome ?? "esta obra"}.`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Troque a obra no seletor do topo da tela ou amplie o período.
                      </span>
                      {periodo !== "tudo" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPeriodo(periodo === "hoje" ? "7d" : "tudo")}
                        >
                          {periodo === "hoje" ? "Ver dias anteriores" : "Ver todo o período"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

            </tbody>
          </table>
          </div>
          {pesagensFiltradas.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
              <span>
                {periodo === "tudo"
                  ? `Mostrando ${(paginaAtual - 1) * porPagina + 1}–${Math.min(paginaAtual * porPagina, pesagensFiltradas.length)} de ${pesagensFiltradas.length}`
                  : `Mostrando ${pesagensPagina.length} de ${pesagensFiltradas.length}`}
              </span>
              {modoBloco && pesagensPagina.length < pesagensFiltradas.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setLimiteAnteriores((n) => n + 20)}
                >
                  Carregar mais 20 (restam {pesagensFiltradas.length - pesagensPagina.length})
                </Button>
              )}
              {periodo === "tudo" && (
                <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                  <span>Linhas:</span>
                  <Select value={String(porPagina)} onValueChange={(v) => setPorPagina(Number(v))}>
                    <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8" disabled={paginaAtual <= 1}
                    onClick={() => setPagina(1)}>«</Button>
                  <Button variant="outline" size="sm" className="h-8" disabled={paginaAtual <= 1}
                    onClick={() => setPagina((n) => Math.max(1, n - 1))}>Anterior</Button>
                  <span className="px-1 font-medium text-foreground">{paginaAtual} / {totalPaginas}</span>
                  <Button variant="outline" size="sm" className="h-8" disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPagina((n) => Math.min(totalPaginas, n + 1))}>Próxima</Button>
                  <Button variant="outline" size="sm" className="h-8" disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPagina(totalPaginas)}>»</Button>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>


      {/* Dialog: fotos/evidências */}
      <Dialog open={fotosDialog.open} onOpenChange={(o) => setFotosDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Fotos e evidências
              {fotosDialog.pesagem?.numero_nota && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">NF {fotosDialog.pesagem.numero_nota}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {(fotosDialog.pesagem?.evidencias ?? []).map((e) => {
              const url = urlMap[e.storage_path];
              const isPdf = ehArquivoPdf(e.nome, e.storage_path);
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={!url}
                  onClick={() => url && abrirVisualizador({ url, nome: e.nome ?? e.tipo, tipo: e.storage_path })}
                  className="group relative block w-full overflow-hidden rounded-md border bg-muted text-left disabled:cursor-not-allowed"
                  title={e.nome ?? e.tipo}
                >
                  {!url ? (
                    <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">Sem preview</div>
                  ) : isPdf ? (
                    <div className="flex h-32 flex-col items-center justify-center gap-1 bg-card px-2 text-center">
                      <FileText className="h-7 w-7 text-info" />
                      <span className="text-[10px] font-semibold text-info">PDF</span>
                      <span className="line-clamp-2 text-[9px] text-muted-foreground">{e.nome ?? "documento.pdf"}</span>
                    </div>
                  ) : (
                    <img src={url} alt={e.tipo} className="h-32 w-full object-cover transition group-hover:scale-105" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                    {e.tipo}
                  </div>
                </button>
              );

            })}
            {(fotosDialog.pesagem?.evidencias?.length ?? 0) === 0 && (
              <div className="col-span-full p-8 text-center text-sm text-muted-foreground">Nenhuma evidência anexada.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: edição de registro (somente super admin) */}
      <Dialog open={!!editForm} onOpenChange={(o) => !o && setEditForm(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-success" /> Editar registro
            </DialogTitle>
          </DialogHeader>
          {editForm && (() => {
            const f = editForm;
            const set = (patch: Partial<EditForm>) => setEditForm((s) => (s ? { ...s, ...patch } : s));
            // Qtd total acompanha a soma dos itens quando a unidade é homogênea,
            // garantindo que a correção de um item recalcule o declarado da NF.
            const sincronizarQtdTotal = (itens: EditForm["itens"]) => {
              const unidades = Array.from(
                new Set(itens.map((it) => normalizarUnidade(it.unidade)).filter(Boolean)),
              );
              if (unidades.length > 1) return {};
              const qtds = itens.map((it) => paraNumero(it.quantidade)).filter((n): n is number => n != null);
              if (!qtds.length) return {};
              const soma = qtds.reduce((a, b) => a + b, 0);
              return { qtd_total: String(Number(soma.toFixed(4))) };
            };
            const setItem = (i: number, patch: Partial<EditForm["itens"][number]>) =>
              setEditForm((s) => {
                if (!s) return s;
                const itens = s.itens.map((it, k) => (k === i ? { ...it, ...patch } : it));
                const sync =
                  "quantidade" in patch || "unidade" in patch ? sincronizarQtdTotal(itens) : {};
                return { ...s, itens, ...sync };
              });
            // Corrigir a "Qtd total" também corrige o item quando a NF tem um único item,
            // para o Peso Calculado (que deriva dos itens) refletir a correção.
            const setQtdTotal = (valor: string) =>
              setEditForm((s) => {
                if (!s) return s;
                const itens =
                  s.itens.length === 1
                    ? [{ ...s.itens[0], quantidade: valor }]
                    : s.itens;
                return { ...s, qtd_total: valor, itens };
              });

            const pesoCalcEdit = calcularPesoNf(
              f.itens.map((it) => ({
                descricao: it.descricao,
                quantidade: it.quantidade,
                unidade: it.unidade,
              })),
            );

            const nEnt = Number(String(f.peso_entrada).replace(",", "."));
            const nSai = Number(String(f.peso_saida).replace(",", "."));
            const liq =
              !Number.isNaN(nEnt) && !Number.isNaN(nSai) && f.peso_entrada !== "" && f.peso_saida !== ""
                ? Math.abs(nEnt - nSai)
                : null;
            const temDadosCarta = Boolean(
              f.traco_id ||
              f.resultado_afericao ||
              f.peso_esperado != null ||
              f.tolerancia_aplicada != null ||
              f.status_afericao ||
              f.volume_m3 != null,
            );
            const up = (v: string) => v.toUpperCase();
            return (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nota fiscal</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div><Label className="text-xs">Nº da nota</Label><Input value={f.numero_nota} onChange={(e) => set({ numero_nota: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Emissor</Label><Input value={f.emissor} onChange={(e) => set({ emissor: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Contratante (obra)</Label><SeletorObraContratante obras={obras} value={f.contratante} onChange={(nome) => set({ contratante: nome })} /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Chave da NF-e</Label><Input value={f.chave_nfe} onChange={(e) => set({ chave_nfe: e.target.value })} /></div>
                    <div><Label className="text-xs">UF</Label><Input maxLength={2} value={f.uf} onChange={(e) => set({ uf: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Valor total NF (R$)</Label><Input inputMode="decimal" value={f.valor_total_nf} onChange={(e) => set({ valor_total_nf: e.target.value })} /></div>
                    <div><Label className="text-xs">Qtd total</Label><Input inputMode="decimal" value={f.qtd_total} onChange={(e) => setQtdTotal(e.target.value)} /></div>
                    <div><Label className="text-xs">Peso da NF (kg)</Label><Input inputMode="decimal" value={f.peso_nf} onChange={(e) => set({ peso_nf: e.target.value })} /></div>
                    <div className="sm:col-span-3"><Label className="text-xs">Descrição do produto</Label><Textarea rows={2} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} /></div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Itens da NF</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => set({ itens: [...f.itens, { descricao: "", quantidade: "", unidade: "", valor_unitario: "" }] })}>
                      Adicionar item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {f.itens.map((it, idx) => {
                      const calcItem = calcularPesoItem({
                        descricao: it.descricao,
                        quantidade: it.quantidade,
                        unidade: it.unidade,
                      });
                      return (
                      <div key={idx} className="grid grid-cols-12 items-center gap-2">
                        <Input className="col-span-4" placeholder="Descrição" value={it.descricao} onChange={(e) => setItem(idx, { descricao: e.target.value.toUpperCase() })} />
                        <Input className="col-span-2" inputMode="decimal" placeholder="Qtd" value={it.quantidade} onChange={(e) => setItem(idx, { quantidade: e.target.value })} />
                        <Input className="col-span-1 uppercase" placeholder="Un" value={it.unidade} onChange={(e) => setItem(idx, { unidade: e.target.value.toUpperCase() })} />
                        <Input className="col-span-2" inputMode="decimal" placeholder="Vlr unit." value={it.valor_unitario} onChange={(e) => setItem(idx, { valor_unitario: e.target.value })} />
                        <div
                          className="col-span-2 text-right text-xs tabular-nums text-muted-foreground"
                          title={calcItem.pesoKg == null ? calcItem.motivo : undefined}
                        >
                          {calcItem.pesoKg != null ? fmtToneladas(calcItem.pesoKg) : "—"}
                        </div>
                        <Button type="button" size="icon" variant="ghost" className="col-span-1 text-destructive" onClick={() => set({ itens: f.itens.filter((_, k) => k !== idx), ...sincronizarQtdTotal(f.itens.filter((_, k) => k !== idx)) })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                    <span className="text-muted-foreground">Peso calculado (recalculado ao editar):</span>
                    <span className={`font-semibold tabular-nums ${pesoCalcEdit.parcial ? "text-warning" : "text-success"}`}>
                      {pesoCalcEdit.totalKg != null ? fmtToneladas(pesoCalcEdit.totalKg) : "—"}
                      {pesoCalcEdit.parcial && ` (parcial ${pesoCalcEdit.convertidos}/${pesoCalcEdit.total})`}
                    </span>
                  </div>
                </div>


                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Veículo</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div><Label className="text-xs">Placa</Label><Input value={f.placa} onChange={(e) => set({ placa: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Transportadora</Label><Input value={f.transportadora} onChange={(e) => set({ transportadora: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Motorista</Label><Input value={f.motorista} onChange={(e) => set({ motorista: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Modelo</Label><Input value={f.modelo} onChange={(e) => set({ modelo: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Marca</Label><Input value={f.marca} onChange={(e) => set({ marca: up(e.target.value) })} className="uppercase" /></div>
                    <div><Label className="text-xs">Carreta</Label><Input value={f.carreta} onChange={(e) => set({ carreta: up(e.target.value) })} className="uppercase" /></div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pesos</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div><Label className="text-xs">Peso entrada (kg)</Label><Input inputMode="decimal" value={f.peso_entrada} onChange={(e) => set({ peso_entrada: e.target.value })} /></div>
                    <div><Label className="text-xs">Peso saída (kg)</Label><Input inputMode="decimal" value={f.peso_saida} onChange={(e) => set({ peso_saida: e.target.value })} /></div>
                    <div>
                      <Label className="text-xs">Líquido (calculado)</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-semibold tabular-nums">
                        {liq != null ? fmtKg(liq) : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {(temDadosCarta || isAdmin) && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-4 w-1 bg-primary rounded-full"></div>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Apuração de Concreto (Carta Traço)</span>
                      {!f.traco_id && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-warning/40 text-warning bg-warning/5">
                          SEM CARTA VINCULADA
                        </Badge>
                      )}
                    </div>

                    {(() => {
                      const forn =
                        fornecedoresConcreto.find((fornecedor) => fornecedor.id === f.fornecedor_concreto_id) ??
                        fornecedoresConcreto.find((fornecedor) =>
                          fornecedor.tracos?.some((tracoItem: any) => tracoItem.id === f.traco_id),
                        );
                      const traco = forn?.tracos?.find((tracoItem: any) => tracoItem.id === f.traco_id);
                      const ap = f.resultado_afericao && typeof f.resultado_afericao === "object"
                        ? f.resultado_afericao
                        : {};
                      const numero = (...valores: unknown[]) => {
                        for (const valor of valores) {
                          if (valor != null && valor !== "" && Number.isFinite(Number(valor))) return Number(valor);
                        }
                        return null;
                      };
                      const rho = numero(ap.rho, traco?.densidade_teorica, traco?.densidade_pratica);
                      const esperado = numero(ap.esperado, f.peso_esperado);
                      const tolerancia = numero(ap.tol, f.tolerancia_aplicada, traco?.tolerancia_peso, forn?.tolerancia_padrao);
                      const volume = numero(ap.volume, f.volume_m3);
                      const aferido = numero(ap.aferido, liq);
                      const diferencaKg = numero(
                        f.diferenca_kg,
                        esperado != null && aferido != null ? aferido - esperado : null,
                      );
                      const diferencaPct = numero(
                        ap.desvioPct,
                        f.diferenca_pct,
                        esperado && diferencaKg != null ? (diferencaKg / esperado) * 100 : null,
                      );
                      const status = String(ap.status ?? f.status_afericao ?? "").toLowerCase();
                      const slump = numero(traco?.slump_nominal);
                      const slumpTexto = slump == null
                        ? "—"
                        : `${slump.toLocaleString("pt-BR")} ${traco?.slump_unidade ?? "cm"}`;

                      return (
                        <div className="rounded-lg border border-primary/10 bg-primary/[0.02] p-3 space-y-3">
                          {/* Seleção editável — permite corrigir a carta de traço */}
                          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
                                  Traço identificado
                                </span>
                                {f.carta_alterada && (
                                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-warning/30 text-warning bg-warning/5">
                                    ALTERADO MANUALMENTE
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-[10px] text-primary"
                                onClick={() => set({ traco_id: null, fornecedor_concreto_id: null, carta_alterada: true })}
                              >
                                Trocar tudo
                              </Button>
                            </div>

                            {!f.traco_id && (
                              <p className="text-[10px] leading-relaxed text-muted-foreground">
                                Selecione o fornecedor (usina) e a carta de traço para apurar o peso esperado deste registro.
                              </p>
                            )}



                            {/* Passo 1: fornecedor (usina) */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground border border-border">
                                  1
                                </div>
                                <Label className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
                                  Fornecedor
                                </Label>
                              </div>
                              <Select
                                value={forn?.id ?? ""}
                                onValueChange={(val) =>
                                  set({ fornecedor_concreto_id: val, traco_id: null, carta_alterada: true })
                                }
                              >
                                <SelectTrigger className={`h-9 text-xs bg-card ${!forn ? "border-warning/50" : ""}`}>

                                  <SelectValue placeholder={carregandoFornecedoresConcreto ? "Carregando…" : "Selecione o fornecedor..."} />
                                </SelectTrigger>
                                <SelectContent>
                                  {fornecedoresConcreto
                                    .filter((fc: any) => fc.ativo)
                                    .map((fc: any) => (
                                      <SelectItem key={fc.id} value={fc.id} className="text-xs">
                                        {fc.nome}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Passo 2: carta de traço */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground border border-border">
                                  2
                                </div>
                                <Label className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
                                  Carta de traço
                                </Label>
                              </div>
                              {forn ? (
                                <Select
                                  value={f.traco_id ?? ""}
                                  onValueChange={(val) => set({ traco_id: val, carta_alterada: true })}
                                >
                                  <SelectTrigger className={`h-9 text-xs bg-card ${!f.traco_id ? "border-warning/30" : ""}`}>
                                    <SelectValue placeholder="Selecione o traço..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {forn.tracos
                                      ?.filter((t: any) => t.ativo)
                                      .map((t: any) => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">
                                          {t.codigo || "S/C"} · FCK {t.fck} · SLUMP {t.slump_nominal} · ρ {t.densidade_teorica}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="h-9 flex items-center px-3 rounded-md border border-muted bg-muted/50 text-[11px] italic text-muted-foreground">
                                  Escolha o fornecedor primeiro
                                </div>
                              )}
                              {f.carta_alterada && (
                                <p className="text-[10px] text-muted-foreground">
                                  Peso esperado, tolerância e status serão reapurados ao salvar.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase">Fornecedor Usina</Label>
                              <div className="text-xs font-semibold">
                                {carregandoFornecedoresConcreto ? "Carregando…" : forn?.nome ?? "Cadastro atual não encontrado"}
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase">Carta de Traço</Label>
                              <div className="text-xs font-semibold">{traco?.codigo ?? (f.traco_id ? "Vínculo histórico" : "Não identificada")}</div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase">FCK</Label>
                              <div className="text-xs font-semibold">{traco?.fck != null ? `${traco.fck} MPa` : "—"}</div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase">Slump</Label>
                              <div className="text-xs font-semibold">{slumpTexto}</div>
                            </div>
                          </div>


                          <div className="grid grid-cols-2 gap-3 border-t border-primary/5 pt-3 sm:grid-cols-4">
                              <div>
                                <Label className="text-[10px] text-muted-foreground uppercase">Densidade (ρ)</Label>
                                <div className="text-xs font-medium">{rho != null ? `${rho.toLocaleString("pt-BR")} kg/m³` : "—"}</div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground uppercase">Peso Esperado</Label>
                                <div className="text-xs font-bold text-primary">{esperado != null ? fmtKgPt(esperado) : "—"}</div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground uppercase">Tolerância</Label>
                                <div className="text-xs font-medium">{tolerancia != null ? `${tolerancia.toLocaleString("pt-BR")}%` : "—"}</div>
                              </div>
                              {(() => {
                                const volumeNf = f.itens.reduce((acc, it) => {
                                  const un = (it.unidade || "").toUpperCase().replace("³", "3");
                                  const q = Number(String(it.quantidade).replace(",", "."));
                                  return un.includes("M3") && Number.isFinite(q) ? acc + q : acc;
                                }, 0);
                                const valorVolume = f.volume_m3 ?? (volumeNf > 0 ? volumeNf : "");
                                return (
                              <div>
                                <Label className="text-[10px] text-muted-foreground uppercase">Volume (m³)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  inputMode="decimal"
                                  className="h-7 text-xs"
                                  placeholder="0"
                                  value={valorVolume}
                                  onChange={(e) =>
                                    set({
                                      volume_m3: e.target.value === "" ? null : Number(e.target.value),
                                      volume_alterado: true,
                                    })
                                  }
                                />
                                {valorVolume === "" && (
                                  <p className="text-[9px] text-warning mt-0.5">
                                    Informe o volume (m³) para calcular o Peso Carta Traço.
                                  </p>
                                )}
                                {f.volume_alterado && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    Peso Carta Traço será recalculado (ρ × volume) ao salvar.
                                  </p>
                                )}
                              </div>
                                );
                              })()}

                              <div>
                                <Label className="text-[10px] text-muted-foreground uppercase">Peso Aferido</Label>
                                <div className="text-xs font-bold">{aferido != null ? fmtKgPt(aferido) : "—"}</div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground uppercase">Diferença</Label>
                                <div className="text-xs font-medium">
                                  {diferencaKg != null ? fmtKgPt(diferencaKg) : "—"}
                                  {diferencaPct != null ? ` (${diferencaPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : ""}
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground uppercase">Status</Label>
                                <div className="flex items-center">
                                  {status ? (
                                    <Badge variant="outline" className={`h-4 text-[9px] font-bold uppercase ${
                                      status === "conforme" ? "border-success text-success" :
                                      status === "abaixo" ? "border-destructive text-destructive" : "border-warning text-warning"
                                    }`}>
                                      {status}
                                    </Badge>
                                  ) : "—"}
                                </div>
                              </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })()}
          {(() => {
            const just = (editForm?.justificativa ?? "").trim();
            const pendente = just.length < 10;
            return (
              <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <Label
                  className={`text-xs ${pendente ? "font-bold text-destructive" : "text-foreground"}`}
                >
                  Justificativa da alteração *
                </Label>
                <Textarea
                  rows={2}
                  placeholder="Descreva o motivo da alteração (mín. 10 caracteres)"
                  value={editForm?.justificativa ?? ""}
                  onChange={(e) => setEditForm((s) => (s ? { ...s, justificativa: e.target.value } : s))}
                  className={`mt-1 text-xs ${pendente ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Esta alteração será registrada com seu nome, data e hora.
                </p>
                <DialogFooter className="mt-3">
                  <Button variant="outline" onClick={() => setEditForm(null)} disabled={editarMut.isPending}>Cancelar</Button>
                  <Button
                    onClick={() => editForm && editarMut.mutate(editForm)}
                    disabled={editarMut.isPending || pendente}
                    className={pendente ? "opacity-50" : ""}
                    title={pendente ? "Informe a justificativa para salvar" : undefined}
                  >
                    {editarMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar alterações
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}

        </DialogContent>
      </Dialog>


      <LogsPesagemDialog
        open={logsDialog.open}
        onOpenChange={(o) => setLogsDialog((s) => ({ ...s, open: o }))}
        pesagemId={logsDialog.id}
        rotulo={logsDialog.rotulo}
      />

      {/* Dialog: detalhes da ocorrência (visualização como e-mail) */}

      <Dialog open={ocorrDetDialog.open} onOpenChange={(o) => setOcorrDetDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Ocorrência registrada
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const p = ocorrDetDialog.pesagem;
            if (!p) return null;
            const pAny = p as PesagemComEvidencias & {
              ocorrencia_tipo?: string | null;
              ocorrencia_tipo_outro?: string | null;
              ocorrencia_relato?: string | null;
              ocorrencia_em?: string | null;
              ocorrencia_por?: string | null;
              ocorrencia_saida_tipo?: string | null;
              ocorrencia_saida_tipo_outro?: string | null;
              ocorrencia_saida_relato?: string | null;
              ocorrencia_saida_em?: string | null;
              ocorrencia_saida_por?: string | null;
            };
            const obraDoRegistro = obras.find((o) => o.id === p.obra_id);
            const obraNome = obraDoRegistro?.nome ?? null;
            const remetenteEmail = "Portal de Pesagem <nao-responda@imobsystems.com.br>";
            const fotos = (p.evidencias ?? []).filter((e) => e.tipo !== "nota");

            type Estagio = {
              key: "entrada" | "saida";
              label: string;
              tipoResolvido: string;
              relato: string;
              em: string | null | undefined;
              autorId: string | null | undefined;
            };

            const temEntrada = !!(pAny.ocorrencia_tipo || pAny.ocorrencia_relato);
            const temSaida = !!(pAny.ocorrencia_saida_tipo || pAny.ocorrencia_saida_relato);

            const estagios: Estagio[] = [];
            if (temEntrada) {
              estagios.push({
                key: "entrada",
                label: "ENTRADA",
                tipoResolvido: pAny.ocorrencia_tipo === "Outro"
                  ? (pAny.ocorrencia_tipo_outro ?? "Outro")
                  : (pAny.ocorrencia_tipo ?? "—"),
                relato: pAny.ocorrencia_relato ?? "",
                em: pAny.ocorrencia_em,
                autorId: pAny.ocorrencia_por,
              });
            }
            if (temSaida) {
              estagios.push({
                key: "saida",
                label: "SAÍDA",
                tipoResolvido: pAny.ocorrencia_saida_tipo === "Outro"
                  ? (pAny.ocorrencia_saida_tipo_outro ?? "Outro")
                  : (pAny.ocorrencia_saida_tipo ?? "—"),
                relato: pAny.ocorrencia_saida_relato ?? "",
                em: pAny.ocorrencia_saida_em,
                autorId: pAny.ocorrencia_saida_por,
              });
            }

            if (estagios.length === 0) {
              return <div className="p-6 text-center text-sm text-muted-foreground">Sem detalhes de ocorrência.</div>;
            }

            const renderEstagio = (est: Estagio) => {
              const autorEmail = est.autorId ? (emailMap as Record<string, string>)[est.autorId] ?? null : null;
              const perfilAutor = autorEmail
                ? { id: est.autorId ?? "", nome: null, cargo: null, setor: null, telefone: null, email: autorEmail }
                : null;
              const payload = montarPayloadOcorrencia({
                tipo: est.tipoResolvido,
                relato: est.relato,
                numeroNota: p.numero_nota,
                placa: p.placa,
                emissor: p.emissor,
                contratante: p.contratante,
                obraNome,
                engenheiroEmail: obraDoRegistro?.engenheiro_email ?? null,
                engenheiroNome: obraDoRegistro?.engenheiro_nome ?? null,
                pesoNfKg: p.peso_nf != null ? Number(p.peso_nf) : null,
                pesoLiquidoKg: p.peso_liquido != null ? Number(p.peso_liquido) : (p.peso_entrada != null && p.peso_saida != null ? Math.abs(Number(p.peso_entrada) - Number(p.peso_saida)) : null),
                perfil: perfilAutor,
              });
              const dataOcorr = est.em ? new Date(est.em).toLocaleString("pt-BR") : "—";
              return (
                <div className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="grid grid-cols-[80px_1fr] gap-y-1">
                      <span className="font-semibold text-muted-foreground">De:</span>
                      <span className="truncate">{remetenteEmail}</span>
                      <span className="font-semibold text-muted-foreground">Para:</span>
                      <span className="break-words">{payload.para.join(", ")}</span>
                      {payload.cc.length > 0 && (
                        <>
                          <span className="font-semibold text-muted-foreground">Cc:</span>
                          <span className="break-words">{payload.cc.join(", ")}</span>
                        </>
                      )}
                      <span className="font-semibold text-muted-foreground">Estágio:</span>
                      <span className="font-medium">{est.label}</span>
                      <span className="font-semibold text-muted-foreground">Data:</span>
                      <span>{dataOcorr}</span>
                      <span className="font-semibold text-muted-foreground">Assunto:</span>
                      <span className="font-medium">{payload.assunto}</span>
                    </div>
                  </div>

                  <div className="rounded-md border bg-background p-4 text-sm">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{payload.corpoTexto}</pre>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Anexos ({fotos.length})
                    </div>
                    {fotos.length === 0 ? (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Nenhuma foto anexada.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {fotos.map((e) => {
                          const url = (urlMap as Record<string, string>)[e.storage_path];
                          const isPdf = ehArquivoPdf(e.nome, e.storage_path);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              disabled={!url}
                              onClick={() => url && abrirVisualizador({ url, nome: e.nome ?? e.tipo, tipo: e.storage_path })}
                              className="group relative block w-full overflow-hidden rounded-md border bg-muted text-left disabled:cursor-not-allowed"
                              title={e.nome ?? e.tipo}
                            >
                              {!url ? (
                                <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">Sem preview</div>
                              ) : isPdf ? (
                                <div className="flex h-32 flex-col items-center justify-center gap-1 bg-card px-2 text-center">
                                  <FileText className="h-7 w-7 text-info" />
                                  <span className="text-[10px] font-semibold text-info">PDF</span>
                                  <span className="line-clamp-2 text-[9px] text-muted-foreground">{e.nome ?? "documento.pdf"}</span>
                                </div>
                              ) : (
                                <img src={url} alt={e.nome ?? e.tipo} className="h-32 w-full object-cover transition group-hover:scale-105" />
                              )}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[10px] font-medium text-white">
                                {e.nome ?? "foto"}
                              </div>
                            </button>
                          );
                        })}

                      </div>
                    )}
                  </div>
                </div>
              );
            };

            if (estagios.length === 1) {
              return renderEstagio(estagios[0]);
            }

            return (
              <Tabs defaultValue={estagios[0].key} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  {estagios.map((est) => (
                    <TabsTrigger key={est.key} value={est.key}>{est.label}</TabsTrigger>
                  ))}
                </TabsList>
                {estagios.map((est) => (
                  <TabsContent key={est.key} value={est.key} className="mt-4">
                    {renderEstagio(est)}
                  </TabsContent>
                ))}
              </Tabs>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOcorrDetDialog({ open: false, pesagem: null })}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Modal recusa */}
      <Dialog open={openRecusa} onOpenChange={setOpenRecusa}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Negar recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Registra a pesagem como <strong>Recusada</strong> e abre seu cliente de e-mail
              com o texto padrão preenchido para o fornecedor.
            </p>
            {divergencia != null && (
              <div className="rounded bg-warning/5 p-2 text-xs text-warning">
                Divergência apurada: <strong>{divergencia.toLocaleString("pt-BR")} kg</strong>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>E-mail do fornecedor</Label>
              <Input type="email" value={emailFornecedor} onChange={(e) => setEmailFornecedor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Textarea rows={3} value={obsRecusa} onChange={(e) => setObsRecusa(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRecusa(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => recusaMut.mutate()} disabled={recusaMut.isPending}>
              {recusaMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: registrar ocorrência sem peso aferido */}
      <AlertDialog open={confirmSemPeso} onOpenChange={setConfirmSemPeso}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Peso não aferido
            </AlertDialogTitle>
            <AlertDialogDescription>
              O campo de pesagem está sem valor. Deseja gravar e fechar o registro de pesagem mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>NÃO</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmSemPeso(false);
                ocorrenciaMut.mutate();
              }}
            >
              SIM, gravar e fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog 
        open={alertExcluir.open} 
        onOpenChange={(open) => !open && setAlertExcluir({ open: false, ids: [] })}
      >
        <AlertDialogContent className="border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground">
              {alertExcluir.ids.length > 1 
                ? `Você está prestes a excluir permanentemente ${alertExcluir.ids.length} registros.`
                : "Você está prestes a excluir este registro permanentemente."}
              {" "}Esta ação é <strong>irreversível</strong> e removerá todos os dados e evidências associadas. 
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={excluirLoteMut.isPending || excluirMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (alertExcluir.ids.length === 1) {
                  excluirMut.mutate(alertExcluir.ids[0]);
                } else {
                  excluirLoteMut.mutate(alertExcluir.ids);
                }
              }}
            >
              {(excluirLoteMut.isPending || excluirMut.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sim, excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VisualizadorArquivoDialog arquivo={arquivoVis} onOpenChange={fecharVisualizador} />
    </div>

  );
}

// ---- helpers de UI

function Campo({
  label, value, onChange, type = "text", className, obrigatorio,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; className?: string; obrigatorio?: boolean;
}) {
  const isObrigatorioOriginal = label.includes("*");
  const vazio = isObrigatorioOriginal && String(value).trim() === "";
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className={vazio ? "text-destructive font-bold" : ""}>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={vazio ? "border-destructive bg-destructive/5 focus-visible:ring-destructive/30" : ""}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: any }) {
  if (status === "rascunho_entrada" || status === "rascunho_saida") {
    return (
      <Badge variant="outline" className="border-border bg-border text-foreground">
        Rascunho
      </Badge>
    );
  }
  if (status === "aguardando_saida" || status === "aguardando_saida_ocorrencia") {
    return (
      <Badge variant="outline" className="border-info-soft bg-info-soft text-info">
        {status === "aguardando_saida_ocorrencia" && <AlertTriangle className="mr-1 h-3 w-3" />}
        Em análise
      </Badge>
    );
  }
  if (status === "concluida") {
    return (
      <Badge className="bg-success text-white hover:bg-success/90">
        Concluído
      </Badge>
    );
  }
  if (status === "recusado") return <Badge variant="destructive">Recusado</Badge>;
  if (status === "fechada_com_ocorrencia") return <Badge className="bg-abobora-dark hover:bg-abobora-dark">Fechada c/ocorrência</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}


function rotuloFonte(f: FonteNota) {
  if (f === "sefaz") return "SEFAZ";
  if (f === "ocr") return "OCR";
  if (f === "ocr_pendente") return "OCR (pendente)";
  return "Manual";
}

async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function OcrProcessingOverlay() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1400),
      setTimeout(() => setStep(3), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  const etapas = [
    "Enviando imagem",
    "Lendo texto (OCR)",
    "Extraindo campos da NF",
    "Validando duplicidade",
  ];
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/85 p-6 backdrop-blur-sm animate-fade-in">
      <div className="relative h-40 w-32 overflow-hidden rounded-md border-2 border-primary/50 bg-primary/5 shadow-lg">
        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_2px_var(--color-primary)] animate-scanner-line" />
        <div className="absolute inset-0 flex items-center justify-center">
          <ScanLine className="h-10 w-10 text-primary/60 animate-pulse" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold text-foreground">Processando nota fiscal…</p>
        <p className="text-xs text-muted-foreground">Não feche esta tela</p>
      </div>
      <ul className="w-full max-w-xs space-y-1.5">
        {etapas.map((label, i) => {
          const done = step > i;
          const active = step === i;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-xs transition-colors ${
                done ? "text-success" : active ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
              )}
              {label}
              {active ? "…" : ""}
            </li>
          );
        })}
      </ul>
      <div className="relative h-1 w-full max-w-xs overflow-hidden rounded-full bg-primary/10">
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer-bar" />
      </div>
    </div>
  );
}

function DuplicataNotaAviso({
  registro,
  onDescartar,
}: {
  registro: PesagemComEvidencias;
  onDescartar: () => void;
}) {
  const dataStr = registro.created_at
    ? new Date(registro.created_at).toLocaleString("pt-BR")
    : "—";
  const statusLabel =
    registro.status === "aguardando_saida"
      ? "Aguardando saída"
      : registro.status === "aguardando_saida_ocorrencia"
        ? "Aguardando saída c/ocorrência"
        : registro.status === "concluida"
          ? "Concluído"
          : registro.status === "recusado"
            ? "Recusado"
            : registro.status;
  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card p-4 shadow-xl animate-shake relative overflow-hidden group">
      {/* Indicador lateral de alerta */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/80" />
      
      <div className="mb-3 flex items-center gap-2.5 text-base font-bold text-primary">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <AlertCircle className="h-5 w-5 animate-pulse" />
        </div>
        <span className="tracking-tight uppercase">Esta nota já foi registrada</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg bg-muted/80 p-3 text-[13px] border border-border">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nº nota</span>
          <span className="font-semibold text-foreground">{registro.numero_nota || "—"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Emissor</span>
          <span className="font-semibold text-foreground line-clamp-1">{registro.emissor || "—"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Placa</span>
          <span className="font-semibold text-foreground">{registro.placa || "—"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
          <div className="mt-0.5">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold border-border bg-card text-foreground uppercase">
              {statusLabel}
            </Badge>
          </div>
        </div>
        <div className="col-span-2 flex flex-col pt-1 border-t border-border mt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data do registro</span>
          <span className="font-medium text-foreground italic">{dataStr}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onDescartar}
          className="h-9 px-4 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all font-bold text-xs gap-2 rounded-md"
        >
          <Eraser className="h-4 w-4" /> 
          DESCARTAR E LIMPAR
        </Button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md bg-primary/5 p-2.5 border border-primary/10">
        <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] leading-tight text-foreground">
          Para evitar <strong>entrada dupla</strong>, o botão de salvamento permanecerá bloqueado enquanto esta nota estiver no formulário.
        </p>
      </div>
    </div>
  );
}

