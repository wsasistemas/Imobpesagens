import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wifi, Bot, Bell, FileText, Save, Loader2, Send, Plus, Trash2, Download,
  CheckCircle2, XCircle, RefreshCw, Phone, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { infoZenvia, enviarWhatsApp, sincronizarTemplatesZenvia, type InfoZenvia } from "@/lib/whatsapp/whatsapp.functions";
import { AlertasToleranciaConfig } from "@/components/whatsapp/alertas-tolerancia-config";

const MODELOS_IA = [
  "google/gemini-3.7-flash",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
];

type RespostaAuto = { keywords: string; response: string };

type AutomacaoPayload = {
  respostas_automaticas?: RespostaAuto[];
  horario_inicio?: string;
  horario_fim?: string;
  msg_fora_horario?: string | null;
  ia_modelo?: string;
  ia_temperatura?: number;
  ia_max_tokens?: number;
  ia_prompt_base?: string | null;
  notif_novas_msgs?: boolean;
  notif_docs_recebidos?: boolean;
  notif_erros?: boolean;
  notif_relatorio_diario?: boolean;
  notif_email?: string | null;
  debug_mode?: boolean;
};

export function ConfiguracoesWhatsApp() {
  return (
    <Tabs defaultValue="conexao" className="mt-4">
      <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
        <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="conexao"><Wifi className="mr-1 h-4 w-4" />Zenvia</TabsTrigger>
        <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="alertas"><AlertTriangle className="mr-1 h-4 w-4" />Alertas de Tolerância</TabsTrigger>
        <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="ia"><Bot className="mr-1 h-4 w-4" />IA &amp; Automação</TabsTrigger>
        <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="notificacoes"><Bell className="mr-1 h-4 w-4" />Notificações</TabsTrigger>
        <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="templates"><FileText className="mr-1 h-4 w-4" />Templates</TabsTrigger>
        <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="numeros"><Phone className="mr-1 h-4 w-4" />Números</TabsTrigger>
      </TabsList>
      <TabsContent value="conexao"><AbaConexao /></TabsContent>
      <TabsContent value="alertas"><AlertasToleranciaConfig /></TabsContent>
      <TabsContent value="ia"><AbaAutomacao /></TabsContent>
      <TabsContent value="notificacoes"><AbaNotificacoes /></TabsContent>
      <TabsContent value="templates"><AbaTemplates /></TabsContent>
      <TabsContent value="numeros"><AbaNumeros /></TabsContent>
    </Tabs>
  );
}

function useConfig() {
  return useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useInfoZenvia() {
  const fn = useServerFn(infoZenvia);
  return useQuery<InfoZenvia>({
    queryKey: ["whatsapp-info-zenvia"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await fn({ data: undefined })) as InfoZenvia,
  });
}

// ---------------- Conexão ----------------

function AbaConexao() {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useConfig();
  const info = useInfoZenvia();
  const enviarFn = useServerFn(enviarWhatsApp);

  const [apiToken, setApiToken] = useState("");
  const [senderId, setSenderId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [telTeste, setTelTeste] = useState("");
  const [msgTeste, setMsgTeste] = useState("Teste de conexão do Portal de Pesagem.");

  useEffect(() => {
    if (!cfg) return;
    setApiToken(cfg.api_token ?? "");
    setSenderId(cfg.sender_id ?? "");
    setWebhookUrl(cfg.webhook_url ?? "");
    setAtivo(cfg.is_active ?? true);
  }, [cfg]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        provedor: "zenvia",
        api_token: apiToken.trim() || null,
        sender_id: senderId.trim() || null,
        webhook_url: webhookUrl.trim() || null,
        is_active: ativo,
      };
      if (cfg?.id) {
        const { error } = await supabase.from("whatsapp_config").update(payload).eq("id", cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Configuração salva.");
      await qc.invalidateQueries({ queryKey: ["whatsapp-config"] });
      await qc.invalidateQueries({ queryKey: ["whatsapp-info-zenvia"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const teste = useMutation({
    mutationFn: async () =>
      (await enviarFn({ data: { telefone: telTeste, mensagem: msgTeste } })) as {
        ok: boolean;
        erro?: string;
      },
    onSuccess: (r) => (r.ok ? toast.success("Mensagem enviada.") : toast.error(r.erro ?? "Falha no envio.")),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no envio."),
  });

  const conectado = !!info.data?.configurado && !info.data?.erro;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Conexão Zenvia</CardTitle>
          {info.isLoading ? (
            <Badge variant="outline"><Loader2 className="mr-1 h-3 w-3 animate-spin" />verificando</Badge>
          ) : conectado ? (
            <Badge className="bg-success"><CheckCircle2 className="mr-1 h-3 w-3" />conectado</Badge>
          ) : (
            <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />sem conexão</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Token da API (X-API-Token)</Label>
            <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <Label className="text-xs">Remetente (sender)</Label>
            {info.data?.senders?.length ? (
              <Select value={senderId} onValueChange={setSenderId}>
                <SelectTrigger><SelectValue placeholder="Selecione o remetente" /></SelectTrigger>
                <SelectContent>
                  {info.data.senders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.phone ?? s.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="5521999999999" />
            )}
          </div>
          <div>
            <Label className="text-xs">URL do webhook (recebimento)</Label>
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://.../api/public/whatsapp/webhook" />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Integração ativa</div>
              <div className="text-xs text-muted-foreground">Desligado, nenhum envio é feito.</div>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
          {info.data?.erro && <p className="text-xs text-destructive">{info.data.erro}</p>}
          <div className="flex gap-2">
            <Button onClick={() => salvar.mutate()} disabled={isLoading || salvar.isPending}>
              {salvar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={() => info.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />Testar conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Envio de teste</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Telefone (com DDD)</Label>
            <Input value={telTeste} onChange={(e) => setTelTeste(e.target.value)} placeholder="21999998888" />
          </div>
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea rows={3} value={msgTeste} onChange={(e) => setMsgTeste(e.target.value)} />
          </div>
          <Button onClick={() => teste.mutate()} disabled={teste.isPending || telTeste.replace(/\D/g, "").length < 10}>
            {teste.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            Enviar teste
          </Button>
          <p className="text-xs text-muted-foreground">
            Fora da janela de 24h, a Zenvia só entrega mensagens por template aprovado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Automação / IA ----------------

function useAutomacao() {
  return useQuery({
    queryKey: ["whatsapp-automacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_automacao_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useSalvarAutomacao() {
  const qc = useQueryClient();
  const { data: atual } = useAutomacao();
  return useMutation({
    mutationFn: async (payload: AutomacaoPayload) => {
      if (atual?.id) {
        const { error } = await supabase.from("whatsapp_automacao_config").update(payload).eq("id", atual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_automacao_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Configuração salva.");
      await qc.invalidateQueries({ queryKey: ["whatsapp-automacao"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });
}

function AbaAutomacao() {
  const { data: auto } = useAutomacao();
  const salvar = useSalvarAutomacao();

  const [respostas, setRespostas] = useState<RespostaAuto[]>([]);
  const [inicio, setInicio] = useState("08:00");
  const [fim, setFim] = useState("18:00");
  const [foraHorario, setForaHorario] = useState("Estamos fora do horário de atendimento.");
  const [modelo, setModelo] = useState(MODELOS_IA[0]);
  const [temperatura, setTemperatura] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!auto) return;
    const rs = Array.isArray(auto.respostas_automaticas) ? (auto.respostas_automaticas as unknown as RespostaAuto[]) : [];
    setRespostas(rs);
    setInicio(auto.horario_inicio ?? "08:00");
    setFim(auto.horario_fim ?? "18:00");
    setForaHorario(auto.msg_fora_horario ?? "");
    setModelo(auto.ia_modelo ?? MODELOS_IA[0]);
    setTemperatura(Number(auto.ia_temperatura ?? 0.7));
    setMaxTokens(auto.ia_max_tokens ?? 1024);
    setPrompt(auto.ia_prompt_base ?? "");
  }, [auto]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Respostas automáticas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {respostas.map((r, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <Input
                placeholder="Palavras-chave (separadas por vírgula)"
                value={r.keywords}
                onChange={(e) => setRespostas(respostas.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))}
              />
              <Textarea
                rows={2}
                placeholder="Resposta"
                value={r.response}
                onChange={(e) => setRespostas(respostas.map((x, j) => (j === i ? { ...x, response: e.target.value } : x)))}
              />
              <Button variant="ghost" size="sm" onClick={() => setRespostas(respostas.filter((_, j) => j !== i))}>
                <Trash2 className="mr-1 h-4 w-4" />Remover
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRespostas([...respostas, { keywords: "", response: "" }])}>
            <Plus className="mr-1 h-4 w-4" />Nova resposta
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Início do atendimento</Label>
              <Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fim do atendimento</Label>
              <Input type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Mensagem fora do horário</Label>
            <Textarea rows={2} value={foraHorario} onChange={(e) => setForaHorario(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Assistente de IA</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Modelo</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELOS_IA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Temperatura</Label>
              <Input type="number" step="0.1" min="0" max="2" value={temperatura} onChange={(e) => setTemperatura(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Máx. de tokens</Label>
              <Input type="number" min="128" max="8192" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Prompt base</Label>
            <Textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Você é o assistente do Portal de Pesagem..." />
          </div>
          <Button
            onClick={() =>
              salvar.mutate({
                respostas_automaticas: respostas,
                horario_inicio: inicio,
                horario_fim: fim,
                msg_fora_horario: foraHorario,
                ia_modelo: modelo,
                ia_temperatura: temperatura,
                ia_max_tokens: maxTokens,
                ia_prompt_base: prompt,
              })
            }
            disabled={salvar.isPending}
          >
            {salvar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Notificações ----------------

function AbaNotificacoes() {
  const { data: auto } = useAutomacao();
  const salvar = useSalvarAutomacao();
  const [novasMsgs, setNovasMsgs] = useState(false);
  const [docs, setDocs] = useState(false);
  const [erros, setErros] = useState(true);
  const [relatorio, setRelatorio] = useState(false);
  const [email, setEmail] = useState("");
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    if (!auto) return;
    setNovasMsgs(!!auto.notif_novas_msgs);
    setDocs(!!auto.notif_docs_recebidos);
    setErros(auto.notif_erros ?? true);
    setRelatorio(!!auto.notif_relatorio_diario);
    setEmail(auto.notif_email ?? "");
    setDebug(!!auto.debug_mode);
  }, [auto]);

  const linhas: { label: string; desc: string; valor: boolean; set: (v: boolean) => void }[] = [
    { label: "Novas mensagens", desc: "Avisa por e-mail quando chegar mensagem.", valor: novasMsgs, set: setNovasMsgs },
    { label: "Documentos recebidos", desc: "Avisa quando um anexo for recebido.", valor: docs, set: setDocs },
    { label: "Erros de envio", desc: "Avisa quando um envio falhar.", valor: erros, set: setErros },
    { label: "Relatório diário", desc: "Resumo diário de envios e respostas.", valor: relatorio, set: setRelatorio },
    { label: "Modo depuração", desc: "Registra detalhes técnicos das chamadas.", valor: debug, set: setDebug },
  ];

  return (
    <Card className="mt-0">
      <CardHeader><CardTitle className="text-base">Notificações</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {linhas.map((l) => (
          <div key={l.label} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">{l.label}</div>
              <div className="text-xs text-muted-foreground">{l.desc}</div>
            </div>
            <Switch checked={l.valor} onCheckedChange={l.set} />
          </div>
        ))}
        <div>
          <Label className="text-xs">E-mail para avisos</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="engenharia@empresa.com.br" />
        </div>
        <Button
          onClick={() =>
            salvar.mutate({
              notif_novas_msgs: novasMsgs,
              notif_docs_recebidos: docs,
              notif_erros: erros,
              notif_relatorio_diario: relatorio,
              notif_email: email.trim() || null,
              debug_mode: debug,
            })
          }
          disabled={salvar.isPending}
        >
          {salvar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------- Templates ----------------

function AbaTemplates() {
  const qc = useQueryClient();
  const sincronizarFn = useServerFn(sincronizarTemplatesZenvia);
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("funcao_label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sincronizar = useMutation({
    mutationFn: async () => (await sincronizarFn({ data: undefined })) as { importados: number; erro?: string },
    onSuccess: async (r) => {
      if (r.erro) toast.error(r.erro);
      else toast.success(`${r.importados} template(s) sincronizado(s).`);
      await qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao sincronizar."),
  });

  return (
    <Card className="mt-0">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Templates aprovados</CardTitle>
        <Button size="sm" variant="outline" onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending}>
          {sincronizar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          Sincronizar com a Zenvia
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum template importado. Clique em “Sincronizar com a Zenvia”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Função</th>
                  <th className="py-2 pr-3">Template</th>
                  <th className="py-2 pr-3">Remetente</th>
                  <th className="py-2 pr-3">Variáveis</th>
                  <th className="py-2 pr-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{t.funcao_label}</td>
                    <td className="py-2 pr-3 font-mono">{t.template_id}</td>
                    <td className="py-2 pr-3">{t.sender_id}</td>
                    <td className="py-2 pr-3">{(t.variaveis ?? []).join(", ")}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={t.sender_status === "APPROVED" ? "default" : "outline"}>{t.sender_status ?? "—"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Números ----------------

function AbaNumeros() {
  const qc = useQueryClient();
  const { data: numeros = [] } = useQuery({
    queryKey: ["whatsapp-numeros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_numeros").select("*").order("prioridade");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [label, setLabel] = useState("");
  const [sender, setSender] = useState("");
  const [limite, setLimite] = useState(1000);

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("whatsapp_numeros").insert({
        label: label.trim(),
        sender_id: sender.trim() || null,
        limite_diario: limite,
        provedor: "zenvia",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setLabel("");
      setSender("");
      toast.success("Número cadastrado.");
      await qc.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cadastrar."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_numeros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Números disponíveis</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {numeros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum número cadastrado.</p>}
          {numeros.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">{n.label}</div>
                <div className="text-xs text-muted-foreground">
                  {n.sender_id ?? "sem remetente"} · {n.enviados_hoje}/{n.limite_diario} hoje · saúde {n.health_score}%
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={n.status === "ativo" ? "default" : "outline"}>{n.status}</Badge>
                <Button variant="ghost" size="icon" onClick={() => remover.mutate(n.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Novo número</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Identificação</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Engenharia – RJ" />
          </div>
          <div>
            <Label className="text-xs">Remetente (sender)</Label>
            <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="5521999999999" />
          </div>
          <div>
            <Label className="text-xs">Limite diário</Label>
            <Input type="number" min={1} value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
          </div>
          <Button onClick={() => criar.mutate()} disabled={!label.trim() || criar.isPending}>
            <Plus className="mr-1 h-4 w-4" />Cadastrar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
