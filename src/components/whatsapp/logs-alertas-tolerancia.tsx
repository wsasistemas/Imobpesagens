import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AlertaLog = {
  id: string;
  pesagem_id: string;
  obra_id: string | null;
  coligada: string | null;
  placa: string | null;
  destinatario_nome: string | null;
  telefone: string | null;
  template: string | null;
  status: string;
  meta_message_id: string | null;
  erro_detalhe: string | null;
  created_at: string;
  mensagem_texto: string | null;
  campos_enviados: Record<string, string> | null;
  template_id: string | null;
  template_nome_real: string | null;
  reenvio_manual: boolean | null;
  destinatario_email: string | null;
  variaveis: unknown;
};

const STATUS_LABEL: Record<string, { rotulo: string; classe: string }> = {
  pendente: { rotulo: "Pendente", classe: "bg-warning hover:bg-warning" },
  enviado: { rotulo: "Enviado", classe: "bg-info hover:bg-info" },
  entregue: { rotulo: "Entregue", classe: "bg-success hover:bg-success" },
  lido: { rotulo: "Lido", classe: "bg-success/90 hover:bg-success/90" },
  falhou: { rotulo: "Falhou", classe: "bg-primary hover:bg-primary" },
};

/** Logs de alertas de tolerância enviados pelo canal oficial da Meta. */
export function LogsAlertasTolerancia() {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [placa, setPlaca] = useState("");
  const [obra, setObra] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [detalhe, setDetalhe] = useState<AlertaLog | null>(null);

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-alertas"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logs = [], isLoading } = useQuery<AlertaLog[]>({
    queryKey: ["whatsapp-alertas"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db
        .from("whatsapp_alertas")
        .select("*")
        .eq("tipo_alerta", "alerta_tolerancia_acima")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AlertaLog[];
    },
  });

  const nomeObra = useMemo(
    () => new Map(obras.map((o) => [o.id as string, o.nome as string])),
    [obras],
  );

  const filtrados = useMemo(() => {
    const deMs = de ? new Date(`${de}T00:00:00`).getTime() : null;
    const ateMs = ate ? new Date(`${ate}T23:59:59`).getTime() : null;
    const p = placa.trim().toUpperCase();
    return logs.filter((l) => {
      const ms = new Date(l.created_at).getTime();
      if (deMs != null && ms < deMs) return false;
      if (ateMs != null && ms > ateMs) return false;
      if (p && !(l.placa ?? "").toUpperCase().includes(p)) return false;
      if (obra !== "todas" && l.obra_id !== obra) return false;
      if (status !== "todos" && l.status !== status) return false;
      if (tipo === "manual" && l.reenvio_manual !== true) return false;
      if (tipo === "automatico" && l.reenvio_manual === true) return false;
      return true;
    });
  }, [logs, de, ate, placa, obra, status, tipo]);

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Logs de Alertas de Tolerância
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Obra</Label>
            <Select value={obra} onValueChange={setObra}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id as string} value={o.id as string}>{o.nome as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Placa</Label>
            <Input
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="ABC1D23"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de disparo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="automatico">Automático</SelectItem>
                <SelectItem value="manual">Reenvio manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando logs…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-2 py-2 font-medium">Data/hora</th>
                  <th className="px-2 py-2 font-medium">Obra</th>
                  <th className="px-2 py-2 font-medium">Coligada</th>
                  <th className="px-2 py-2 font-medium">Placa</th>
                  <th className="px-2 py-2 font-medium">Engenheiro</th>
                  <th className="px-2 py-2 font-medium">Telefone</th>
                  <th className="px-2 py-2 font-medium">Template</th>
                  <th className="px-2 py-2 font-medium">Mensagem</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Detalhe</th>
                  <th className="px-2 py-2 font-medium text-right">Ver</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const st = STATUS_LABEL[l.status] ?? { rotulo: l.status, classe: "bg-muted" };
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-2 py-1.5">{l.obra_id ? (nomeObra.get(l.obra_id) ?? "—") : "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{l.coligada ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono font-semibold">{l.placa ?? "—"}</td>
                      <td className="px-2 py-1.5">{l.destinatario_nome ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{l.telefone ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {l.template_nome_real ?? l.template ?? "—"}
                        {l.reenvio_manual ? (
                          <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">manual</Badge>
                        ) : null}
                      </td>
                      <td className="max-w-[320px] truncate px-2 py-1.5" title={l.mensagem_texto ?? ""}>
                        {l.mensagem_texto ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge className={st.classe}>{st.rotulo}</Badge>
                      </td>
                      <td className="max-w-[280px] truncate px-2 py-1.5 text-muted-foreground" title={l.erro_detalhe ?? ""}>
                        {l.erro_detalhe ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDetalhe(l)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">
                      Nenhum alerta registrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Detalhe do alerta de tolerância</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <Info rotulo="Data/hora" valor={new Date(detalhe.created_at).toLocaleString("pt-BR")} />
                <Info rotulo="Tipo" valor={detalhe.reenvio_manual ? "Reenvio manual" : "Automático"} />
                <Info rotulo="Obra" valor={detalhe.obra_id ? (nomeObra.get(detalhe.obra_id) ?? "—") : "—"} />
                <Info rotulo="Coligada" valor={detalhe.coligada ?? "—"} />
                <Info rotulo="Placa" valor={detalhe.placa ?? "—"} />
                <Info rotulo="Status" valor={STATUS_LABEL[detalhe.status]?.rotulo ?? detalhe.status} />
                <Info
                  rotulo="Destinatário"
                  valor={detalhe.destinatario_nome ?? detalhe.destinatario_email ?? "—"}
                />
                <Info rotulo="Telefone" valor={detalhe.telefone ?? "—"} />
                <Info rotulo="Template" valor={detalhe.template_nome_real ?? detalhe.template ?? "—"} />
                <Info rotulo="ID do template" valor={detalhe.template_id ?? "—"} />
                <Info rotulo="ID da mensagem" valor={detalhe.meta_message_id ?? "—"} />
              </div>

              <div>
                <p className="mb-1 font-medium">Variáveis enviadas</p>
                <div className="rounded-md border">
                  {Object.entries(detalhe.campos_enviados ?? {}).length === 0 ? (
                    <p className="p-2 text-muted-foreground">
                      Nenhuma variável registrada para este disparo.
                    </p>
                  ) : (
                    Object.entries(detalhe.campos_enviados ?? {}).map(([k, v]) => (
                      <div key={k} className="flex gap-2 border-b px-2 py-1 last:border-b-0">
                        <span className="w-32 shrink-0 font-mono text-muted-foreground">{k}</span>
                        <span className="break-all">{String(v)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1 font-medium">Mensagem enviada</p>
                <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2">
                  {detalhe.mensagem_texto ?? "Conteúdo não registrado para este disparo."}
                </p>
              </div>

              {detalhe.erro_detalhe && (
                <div>
                  <p className="mb-1 font-medium text-primary">Motivo do erro</p>
                  <p className="rounded-md border border-primary/30 bg-primary/5 p-2">{detalhe.erro_detalhe}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{rotulo}</p>
      <p className="break-all font-medium">{valor}</p>
    </div>
  );
}
