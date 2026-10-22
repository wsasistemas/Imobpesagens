import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, ScanLine, Undo2 } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { formatarKg } from "@/lib/sucata/validadores";
import { contasObraQueryOptions } from "@/lib/sucata/sucata-queries";
import { evidenciasQueryOptions, processoQueryOptions, urlAssinada, vigentes } from "@/lib/sucata/evidencias-queries";
import { aprovarConferencia, devolverProcesso, lerComprovantePagamento } from "@/lib/sucata/nfa.functions";

export const Route = createFileRoute("/sucata/$id/conferencia")({
  head: () => ({
    meta: [
      { title: "Conferência e aprovação da sucata — Portal de Pesagem" },
      { name: "description", content: "Conferência do recibo do sucateiro e do comprovante de pagamento antes da solicitação da Nota Fiscal Avulsa." },
      { property: "og:title", content: "Conferência e aprovação da sucata — Portal de Pesagem" },
      { property: "og:description", content: "Recibo, comprovante de pagamento e aprovação do processo de sucata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConferenciaPage,
  errorComponent: () => <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar a conferência.</div>,
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Processo não encontrado.</div>,
});

const FASES_DEVOLUCAO = [
  { valor: "F06", rotulo: "F06 — Entrega no depósito e contraprova" },
  { valor: "F07", rotulo: "F07 — Aceite do peso pelo sucateiro" },
  { valor: "F08", rotulo: "F08 — Valor informado e recibo" },
  { valor: "F09", rotulo: "F09 — Foto do recibo" },
  { valor: "F10", rotulo: "F10 — Comprovante de pagamento" },
] as const;

function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ConferenciaPage() {
  const [obraId, setObraId] = useObraAtual();
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <Conteudo />
    </AppShell>
  );
}

function Conteudo() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, isAdministrativoObra } = useAuth();
  const podeAprovar = isAdmin || isSuperAdmin || isAdministrativoObra;

  const { data: processo } = useQuery(processoQueryOptions(id));
  const { data: evidencias = [] } = useQuery(evidenciasQueryOptions(id));
  const { data: contas = [] } = useQuery(contasObraQueryOptions(processo?.obra_id ?? null));

  const aprovar = useServerFn(aprovarConferencia);
  const devolver = useServerFn(devolverProcesso);
  const lerComprovante = useServerFn(lerComprovantePagamento);

  const [urlRecibo, setUrlRecibo] = useState<string | null>(null);
  const [urlComprovante, setUrlComprovante] = useState<string | null>(null);
  const [reciboValor, setReciboValor] = useState("");
  const [contaObraId, setContaObraId] = useState<string>("nao_cadastrada");
  const [contaLida, setContaLida] = useState("");
  const [pagamentoValor, setPagamentoValor] = useState("");
  const [pagamentoData, setPagamentoData] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [observacao, setObservacao] = useState("");
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [faseDevolucao, setFaseDevolucao] = useState<string>("F10");
  const [hash, setHash] = useState<string | null>(null);
  const [avisoOcr, setAvisoOcr] = useState<string | null>(null);

  const atuais = useMemo(() => vigentes(evidencias), [evidencias]);
  const recibo = atuais.find((e) => e.posicao === 10) ?? null;
  const comprovante = atuais.find((e) => e.posicao === 11) ?? null;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const a = recibo ? await urlAssinada(recibo.storage_path, 600) : null;
      const b = comprovante ? await urlAssinada(comprovante.storage_path, 600) : null;
      if (!vivo) return;
      setUrlRecibo(a);
      setUrlComprovante(b);
    })();
    return () => { vivo = false; };
  }, [recibo, comprovante]);

  useEffect(() => {
    if (!processo) return;
    if (processo.recibo_valor_lido !== null) setReciboValor(String(processo.recibo_valor_lido));
    if (processo.pagamento_valor !== null) setPagamentoValor(String(processo.pagamento_valor));
    if (processo.pagamento_data) setPagamentoData(processo.pagamento_data);
    if (processo.pagamento_conta_lida) setContaLida(processo.pagamento_conta_lida);
    if (processo.conta_obra_id) setContaObraId(processo.conta_obra_id);
    if (processo.pagamento_justificativa) setJustificativa(processo.pagamento_justificativa);
  }, [processo]);

  const valorAceite = processo?.valor_total ?? null;
  const numReciboLido = Number(reciboValor.replace(",", "."));
  const numPagamento = Number(pagamentoValor.replace(",", "."));
  const reciboConfere =
    valorAceite !== null && Number.isFinite(numReciboLido) && Math.abs(numReciboLido - valorAceite) < 0.01;
  const pagamentoConfere =
    valorAceite !== null && Number.isFinite(numPagamento) && Math.abs(numPagamento - valorAceite) < 0.01;
  const contaDivergente = contaObraId === "nao_cadastrada";

  const ocr = useMutation({
    mutationFn: async (arquivo: File) => {
      const base64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("Não foi possível ler o arquivo."));
        fr.readAsDataURL(arquivo);
      });
      return lerComprovante({ data: { processoId: id, arquivo: base64, mimeType: arquivo.type, filename: arquivo.name } });
    },
    onSuccess: (r) => {
      setHash(r.hash);
      setAvisoOcr(r.motivo ?? null);
      if (r.duplicado) {
        toast.error(`Este comprovante já foi usado no processo ${r.duplicado.numero}.`);
        setAvisoOcr(`Comprovante já utilizado no processo ${r.duplicado.numero}. Confira antes de aprovar.`);
      }
      if (r.valor !== null) setPagamentoValor(String(r.valor));
      if (r.data) setPagamentoData(r.data);
      const lida = [r.banco, r.agencia && `Ag. ${r.agencia}`, r.conta && `Conta ${r.conta}`, r.chave_pix && `PIX ${r.chave_pix}`, r.favorecido]
        .filter(Boolean)
        .join(" · ");
      if (lida) setContaLida(lida);
      const alvo = contas.find(
        (c) =>
          (r.conta && c.conta.replace(/\D/g, "") === r.conta.replace(/\D/g, "")) ||
          (r.chave_pix && (c.chave_pix ?? "") === r.chave_pix),
      );
      setContaObraId(alvo ? alvo.id : "nao_cadastrada");
      if (r.ok) toast.success("Comprovante lido. Confirme ou corrija os dados.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao ler o comprovante."),
  });

  const acaoAprovar = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(numPagamento) || numPagamento <= 0) throw new Error("Informe o valor pago.");
      if (!pagamentoData) throw new Error("Informe a data do pagamento.");
      if (contaDivergente && justificativa.trim().length < 5) {
        throw new Error("Conta creditada fora do cadastro da obra exige justificativa.");
      }
      return aprovar({
        data: {
          processoId: id,
          contaObraId: contaDivergente ? null : contaObraId,
          contaLida: contaLida.trim() || null,
          pagamentoValor: numPagamento,
          pagamentoData,
          comprovanteHash: hash,
          reciboValorLido: Number.isFinite(numReciboLido) && numReciboLido > 0 ? numReciboLido : null,
          contaDivergente,
          justificativa: contaDivergente ? justificativa.trim() : null,
          observacao: observacao.trim() || null,
        },
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      if (!r.emailOk) toast.warning(r.erro ?? "Aprovado, mas o e-mail à Contabilidade falhou.");
      else toast.success(`Aprovado e solicitado à Contabilidade (${r.destinatarios.join(", ")}).`);
      navigate({ to: "/sucata/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível aprovar."),
  });

  const acaoDevolver = useMutation({
    mutationFn: async () => {
      if (motivoDevolucao.trim().length < 5) throw new Error("Informe o motivo da devolução.");
      return devolver({ data: { processoId: id, motivo: motivoDevolucao.trim(), faseOrigem: faseDevolucao as "F10" } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      toast.success("Processo devolvido ao responsável.");
      navigate({ to: "/sucata/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível devolver."),
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-primary" />
        <div className="mr-auto">
          <h1 className={`font-heading text-xl font-semibold ${CLASSE_NUM}`}>{processo?.numero ?? "—"}</h1>
          <p className="text-sm text-muted-foreground">
            Conferência do recibo e do comprovante de pagamento — administrativo da obra.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/sucata/$id" params={{ id }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Processo
          </Link>
        </Button>
      </div>

      {processo?.aprovado_em && (
        <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success">
          Processo aprovado. Solicitação de NFA enviada à Contabilidade.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">Recibo do sucateiro (010)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {urlRecibo ? (
              <img src={urlRecibo} alt="Recibo do sucateiro" className="max-h-72 w-full rounded-lg border object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Foto 010 ainda não capturada.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor lido no recibo</Label>
                <Input
                  value={reciboValor}
                  onChange={(e) => setReciboValor(e.target.value)}
                  inputMode="decimal"
                  className={CLASSE_NUM}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor informado no aceite</Label>
                <p className={`pt-2 text-sm font-semibold ${CLASSE_NUM}`}>{moeda(valorAceite)}</p>
              </div>
            </div>
            <Selo confere={reciboConfere} vazio={!reciboValor.trim()} />
            <p className="text-xs text-muted-foreground">
              Peso aferido: <span className={CLASSE_NUM}>{formatarKg(processo?.peso_aferido_kg)}</span> ·{" "}
              Valor por tonelada: <span className={CLASSE_NUM}>{moeda(processo?.valor_por_tonelada)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">Comprovante de pagamento (011)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {urlComprovante ? (
              <img src={urlComprovante} alt="Comprovante de pagamento" className="max-h-72 w-full rounded-lg border object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Foto 011 ainda não capturada.</p>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Leitura automática do comprovante</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                disabled={ocr.isPending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) ocr.mutate(f);
                }}
              />
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ScanLine className="h-3 w-3" /> {ocr.isPending ? "Lendo o comprovante..." : "Envie o arquivo do comprovante para preencher os campos."}
              </p>
              {avisoOcr && (
                <p className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" /> {avisoOcr}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Conta creditada</Label>
                <Select value={contaObraId} onValueChange={setContaObraId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {contas
                      .filter((c) => c.situacao === "ATIVA" || c.id === processo?.conta_obra_id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.banco} · Ag. {c.agencia} · Conta {c.conta} — {c.titular}
                        </SelectItem>
                      ))}
                    <SelectItem value="nao_cadastrada">Conta fora do cadastro da obra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Dados lidos no comprovante</Label>
                <Input value={contaLida} onChange={(e) => setContaLida(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor pago</Label>
                <Input
                  value={pagamentoValor}
                  onChange={(e) => setPagamentoValor(e.target.value)}
                  inputMode="decimal"
                  className={CLASSE_NUM}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data do pagamento</Label>
                <Input type="date" value={pagamentoData} onChange={(e) => setPagamentoData(e.target.value)} className={CLASSE_NUM} />
              </div>
            </div>

            <Selo confere={pagamentoConfere} vazio={!pagamentoValor.trim()} />

            {contaDivergente && (
              <div className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft p-3">
                <p className="flex items-center gap-1 text-sm font-medium text-warning">
                  <AlertTriangle className="h-4 w-4" /> Conta fora do cadastro da obra — justificativa obrigatória
                </p>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={3}
                  placeholder="Explique por que o pagamento saiu para uma conta não cadastrada."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Parecer do administrativo da obra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => acaoAprovar.mutate()} disabled={!podeAprovar || acaoAprovar.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar conferência
            </Button>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">Devolver ao responsável</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select value={faseDevolucao} onValueChange={setFaseDevolucao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FASES_DEVOLUCAO.map((f) => (
                    <SelectItem key={f.valor} value={f.valor}>{f.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="sm:col-span-2">
                <Textarea
                  value={motivoDevolucao}
                  onChange={(e) => setMotivoDevolucao(e.target.value)}
                  rows={2}
                  placeholder="Motivo da devolução (obrigatório)"
                />
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => acaoDevolver.mutate()}
              disabled={!podeAprovar || acaoDevolver.isPending}
            >
              <Undo2 className="mr-2 h-4 w-4" /> Devolver ao responsável
            </Button>
          </div>
          {!podeAprovar && (
            <p className="text-sm text-muted-foreground">
              Seu perfil não permite aprovar ou devolver este processo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Selo({ confere, vazio }: { confere: boolean; vazio: boolean }) {
  if (vazio) {
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
        Pendente de conferência
      </Badge>
    );
  }
  return confere ? (
    <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
      Confere com o valor do aceite
    </Badge>
  ) : (
    <Badge variant="outline" className="border-primary-dark bg-primary-soft text-primary-dark">
      Divergente do valor do aceite
    </Badge>
  );
}
