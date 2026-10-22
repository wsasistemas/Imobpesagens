import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, CloudUpload, Lock, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { formatarDataHora, formatarKg } from "@/lib/sucata/validadores";
import {
  POSICOES_EVIDENCIA, ROTULO_BLOCO, codigoDe, posicoesDoBloco, type BlocoEvidencia,
} from "@/lib/sucata/posicoes-evidencia";
import {
  capturarEvidencia, esvaziarFila, evidenciasQueryOptions, listarFila, processoQueryOptions,
  salvarPesoDeposito, vigentes,
} from "@/lib/sucata/evidencias-queries";

export function CapturaEvidencias({ processoId }: { processoId: string }) {
  const qc = useQueryClient();
  const { data: processo } = useQuery(processoQueryOptions(processoId));
  const { data: evidencias = [] } = useQuery(evidenciasQueryOptions(processoId));
  const [bloco, setBloco] = useState<BlocoEvidencia>("A");
  const [naFila, setNaFila] = useState(0);
  const [substituir, setSubstituir] = useState<{ posicao: number; id: string; versao: number } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pesoDeposito, setPesoDeposito] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const alvoRef = useRef<{ posicao: number; substituiId: string | null; versao: number } | null>(null);

  const atuais = useMemo(() => vigentes(evidencias), [evidencias]);
  const feitas = useMemo(() => new Set(atuais.map((e) => e.posicao)), [atuais]);
  const doBloco = posicoesDoBloco(bloco);
  const concluidasBloco = doBloco.filter((p) => feitas.has(p.posicao)).length;
  const proxima = POSICOES_EVIDENCIA.find((p) => !feitas.has(p.posicao)) ?? null;

  const atualizarFila = async () => setNaFila((await listarFila(processoId)).length);

  useEffect(() => {
    void atualizarFila();
    const aoVoltar = async () => {
      const n = await esvaziarFila(processoId);
      if (n > 0) {
        toast.success(`${n} foto(s) enviada(s) automaticamente.`);
        void qc.invalidateQueries({ queryKey: ["sucata"] });
      }
      void atualizarFila();
    };
    window.addEventListener("online", aoVoltar);
    void aoVoltar();
    return () => window.removeEventListener("online", aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId]);

  const enviar = useMutation({
    mutationFn: async (arquivo: File) => {
      const alvo = alvoRef.current;
      if (!alvo) throw new Error("Nenhuma posição selecionada.");
      return capturarEvidencia({
        processoId,
        posicao: alvo.posicao,
        arquivo,
        substituiId: alvo.substituiId,
        motivo: alvo.substituiId ? motivo.trim() : null,
        versao: alvo.versao,
      });
    },
    onSuccess: (r) => {
      if (r.enviado) toast.success("Foto registrada.");
      else toast.warning("Sem conexão: a foto ficou na fila e será enviada sozinha.");
      setSubstituir(null);
      setMotivo("");
      alvoRef.current = null;
      void qc.invalidateQueries({ queryKey: ["sucata"] });
      void atualizarFila();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirCamera = (posicao: number, substituiId: string | null, versao: number) => {
    alvoRef.current = { posicao, substituiId, versao };
    inputRef.current?.click();
  };

  const gravarPeso = useMutation({
    mutationFn: async () => {
      const n = Number(pesoDeposito.replace(",", "."));
      if (!n || n <= 0) throw new Error("Informe o peso lido na balança do depósito.");
      await salvarPesoDeposito(processoId, n);
    },
    onSuccess: () => {
      toast.success("Peso do depósito registrado.");
      setPesoDeposito("");
      void qc.invalidateQueries({ queryKey: ["sucata"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aferido = Number(processo?.peso_aferido_kg ?? 0);
  const deposito = Number(processo?.peso_deposito_kg ?? 0);
  const divergencia = aferido > 0 && deposito > 0 ? ((deposito - aferido) / aferido) * 100 : null;

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) enviar.mutate(f);
        }}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">
            Evidências do processo <span className={CLASSE_NUM}>{processo?.numero ?? "—"}</span>
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Placa <span className={CLASSE_NUM}>{processo?.placa ?? "—"}</span> ·{" "}
            <span className={CLASSE_NUM}>{feitas.size}</span> de 12 fotos
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {naFila > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft p-2 text-sm text-warning">
              <CloudUpload className="h-4 w-4" />
              <span className={CLASSE_NUM}>{naFila}</span> foto(s) aguardando envio
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={async () => {
                  const n = await esvaziarFila(processoId);
                  if (n > 0) void qc.invalidateQueries({ queryKey: ["sucata"] });
                  void atualizarFila();
                  toast[n > 0 ? "success" : "info"](n > 0 ? `${n} foto(s) enviada(s).` : "Ainda sem conexão.");
                }}
              >
                Tentar agora
              </Button>
            </div>
          )}

          <Tabs value={bloco} onValueChange={(v) => setBloco(v as BlocoEvidencia)}>
            <TabsList className="w-full">
              <TabsTrigger value="A" className="flex-1">Caminhão</TabsTrigger>
              <TabsTrigger value="C" className="flex-1">Documentos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {ROTULO_BLOCO[bloco]}
          </div>
          <Progress value={doBloco.length ? (concluidasBloco / doBloco.length) * 100 : 0} />
          <div className="text-xs text-muted-foreground">
            <span className={CLASSE_NUM}>{concluidasBloco}</span> de{" "}
            <span className={CLASSE_NUM}>{doBloco.length}</span> concluídas neste bloco
          </div>
        </CardContent>
      </Card>

      {proxima && proxima.bloco !== bloco && (
        <div className="rounded-lg border border-primary-dark/30 bg-primary-dark/10 p-3 text-sm text-primary-dark">
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4" /> Sequência incompleta
          </div>
          <div className="mt-1">
            A próxima foto obrigatória é <span className={CLASSE_NUM}>{codigoDe(proxima.posicao)}</span> —{" "}
            {proxima.rotulo}.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {doBloco.map((p) => {
          const feita = atuais.find((e) => e.posicao === p.posicao);
          const ehProxima = proxima?.posicao === p.posicao;
          return (
            <Card key={p.posicao} className={ehProxima ? "border-primary/50" : undefined}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <div className={`w-10 text-lg font-bold ${CLASSE_NUM}`}>{codigoDe(p.posicao)}</div>
                <div className="min-w-40 flex-1">
                  <div className="font-medium">{p.rotulo}</div>
                  <div className="text-xs text-muted-foreground">{p.responsavel}</div>
                  {feita && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={CLASSE_NUM}>{formatarDataHora(feita.capturado_em)}</span>
                      <span>· versão <span className={CLASSE_NUM}>{feita.versao}</span></span>
                      {feita.lat !== null && feita.lng !== null && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> com localização
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {feita ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
                      <Check className="mr-1 h-3 w-3" /> Concluída
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSubstituir({ posicao: p.posicao, id: feita.id, versao: feita.versao + 1 })}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" /> Substituir
                    </Button>
                  </div>
                ) : ehProxima ? (
                  <Button
                    size="lg"
                    disabled={enviar.isPending}
                    onClick={() => abrirCamera(p.posicao, null, 1)}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {enviar.isPending ? "Enviando..." : "Capturar"}
                  </Button>
                ) : (
                  <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                    Aguardando
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {bloco === "B" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">Balança do depósito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">Peso lido na balança do depósito (kg)</Label>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  value={pesoDeposito}
                  onChange={(e) => setPesoDeposito(e.target.value)}
                  className={CLASSE_NUM}
                  placeholder={processo?.peso_deposito_kg ? formatarKg(processo.peso_deposito_kg) : "0"}
                />
                <Button onClick={() => gravarPeso.mutate()} disabled={gravarPeso.isPending}>
                  Gravar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Aferido na obra</div>
                <div className={`font-semibold ${CLASSE_NUM}`}>{formatarKg(processo?.peso_aferido_kg)} kg</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Depósito</div>
                <div className={`font-semibold ${CLASSE_NUM}`}>
                  {processo?.peso_deposito_kg ? `${formatarKg(processo.peso_deposito_kg)} kg` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Divergência</div>
                <div className={`font-semibold ${CLASSE_NUM}`}>
                  {divergencia === null
                    ? "—"
                    : `${divergencia > 0 ? "+" : ""}${divergencia.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!substituir} onOpenChange={(o) => { if (!o) { setSubstituir(null); setMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Substituir foto {substituir ? codigoDe(substituir.posicao) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Motivo da substituição (obrigatório)</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
            <p className="text-xs text-muted-foreground">
              A foto anterior continua guardada como versão antiga. Nada é apagado.
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={motivo.trim().length < 5 || enviar.isPending}
              onClick={() => {
                if (!substituir) return;
                abrirCamera(substituir.posicao, substituir.id, substituir.versao);
              }}
            >
              <Camera className="mr-2 h-4 w-4" /> Capturar nova foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
