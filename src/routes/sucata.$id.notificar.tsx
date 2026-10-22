import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Send, Unlock } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { formatarDataHora } from "@/lib/sucata/validadores";
import { enviarAceiteSucateiro, previaEmailAceite, reabrirPeso } from "@/lib/sucata/aceite.functions";

export const Route = createFileRoute("/sucata/$id/notificar")({
  head: () => ({
    meta: [
      { title: "Enviar peso aferido ao sucateiro — Portal de Pesagem" },
      {
        name: "description",
        content: "Confira a prévia do e-mail de aceite do peso aferido e envie o link de coleta ao sucateiro.",
      },
      { property: "og:title", content: "Enviar peso aferido ao sucateiro — Portal de Pesagem" },
      { property: "og:description", content: "Prévia e envio do e-mail de aceite do peso aferido da coleta de sucata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificarPage,
  errorComponent: () => <div className="p-6 text-sm text-muted-foreground">Não foi possível abrir esta tela.</div>,
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Processo não encontrado.</div>,
});

function NotificarPage() {
  const { id } = Route.useParams();
  const [obraId, setObraId] = useObraAtual();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const previa = useServerFn(previaEmailAceite);
  const enviar = useServerFn(enviarAceiteSucateiro);
  const reabrir = useServerFn(reabrirPeso);
  const [motivo, setMotivo] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["sucata", "previa-aceite", id],
    queryFn: () => previa({ data: { processoId: id } }),
    staleTime: 10_000,
  });

  const envio = useMutation({
    mutationFn: () => enviar({ data: { processoId: id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      if (r.ok) toast.success(`E-mail enviado para ${r.destinatario}.`);
      else toast.error(`Registrado, mas o envio falhou: ${r.erro ?? "erro desconhecido"}`);
      navigate({ to: "/sucata/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabertura = useMutation({
    mutationFn: () => reabrir({ data: { processoId: id, motivo: motivo.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      toast.success("Peso reaberto. Envie um novo link ao sucateiro.");
      setMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Mail className="h-6 w-6 text-primary" />
          <div className="mr-auto">
            <h1 className="font-heading text-xl font-semibold">Enviar o peso aferido ao sucateiro</h1>
            <p className="text-sm text-muted-foreground">
              O corpo do e-mail é padronizado e não pode ser editado. Todos os dados vêm do processo.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/sucata/$id" params={{ id }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao processo
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Montando a prévia...
          </div>
        )}
        {error && <div className="p-4 text-sm text-primary">{(error as Error).message}</div>}

        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base">Dados do envio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <Label className="mb-1 block text-xs">Destinatário (e-mail de coleta do sucateiro)</Label>
                  <Input readOnly value={data.destinatario ?? "não cadastrado"} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Assunto</Label>
                  <Input readOnly value={data.assunto} />
                </div>
                <div className="divide-y rounded-lg border">
                  {data.variaveis.map((v) => (
                    <div key={v.rotulo} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-muted-foreground">{v.rotulo}</span>
                      <span className={CLASSE_NUM}>{v.valor}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  O link é pessoal, vale {data.validadeDias} dias, é reenviado automaticamente após {data.reenvioHoras} horas
                  sem resposta e gera aviso ao administrativo depois de {data.alertaDias} dias.
                </p>
                {data.jaNotificado && (
                  <p className="text-xs text-warning">
                    Já existe um link ativo (válido até{" "}
                    <span className={CLASSE_NUM}>{formatarDataHora(data.expiraEm)}</span>). Enviar de novo cancela o link
                    anterior.
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={!data.destinatario || !!data.aceiteEm || envio.isPending}
                  onClick={() => envio.mutate()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {envio.isPending ? "Enviando..." : data.jaNotificado ? "Reenviar o link agora" : "Enviar e-mail de aceite"}
                </Button>
                {data.aceiteEm && (
                  <div className="space-y-2 rounded-lg border border-success/30 bg-success-soft p-3 text-success">
                    <div>
                      Peso já aceito em <span className={CLASSE_NUM}>{formatarDataHora(data.aceiteEm)}</span>. Os pesos
                      estão travados.
                    </div>
                    <Label className="mb-1 block text-xs">Motivo para reabrir o peso (só TI)</Label>
                    <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo" />
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={motivo.trim().length < 5 || reabertura.isPending}
                      onClick={() => reabertura.mutate()}
                    >
                      <Unlock className="mr-2 h-4 w-4" /> Reabrir peso
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base">Prévia do e-mail</CardTitle>
              </CardHeader>
              <CardContent>
                <iframe
                  title="Prévia do e-mail de aceite"
                  className="h-[640px] w-full rounded-lg border bg-card"
                  sandbox=""
                  srcDoc={data.html}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
