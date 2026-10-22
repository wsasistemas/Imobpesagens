import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import {
  IDIOMA_PADRAO,
  TEMPLATE_PADRAO,
  inspecionarTemplateAlerta,
  statusMetaWhatsApp,
  testarAlertaTolerancia,
} from "@/lib/whatsapp/alerta-tolerancia.functions";

type VarTeste = { nome: string; valor: string };

const VARS_PADRAO: VarTeste[] = [
  { nome: "placa", valor: "" },
  { nome: "data", valor: "" },
  { nome: "empreendimento", valor: "" },
  { nome: "fornecedor", valor: "" },
];

/** Configuração "Alertas de Tolerância" (WhatsApp Business Platform oficial da Meta). */
export function AlertasToleranciaConfig() {
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin } = useAuth();
  const podeEditar = Boolean(isAdmin || isSuperAdmin);

  const statusFn = useServerFn(statusMetaWhatsApp);
  const testarFn = useServerFn(testarAlertaTolerancia);
  const inspecionarFn = useServerFn(inspecionarTemplateAlerta);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any;
    },
  });

  const [provedor, setProvedor] = useState<"zenvia" | "meta">("zenvia");
  const [ativo, setAtivo] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const [idioma, setIdioma] = useState(IDIOMA_PADRAO);
  const [templateId, setTemplateId] = useState("");
  const [telTeste, setTelTeste] = useState("");
  const [varsTeste, setVarsTeste] = useState<VarTeste[]>(VARS_PADRAO);
  const [inspecao, setInspecao] = useState<{
    ok: boolean;
    nome?: string | null;
    status?: string | null;
    sender?: string | null;
    variaveis: string[];
    faltantes: string[];
    erro?: string;
  } | null>(null);
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!cfg) return;
    setProvedor((cfg.provedor ?? "zenvia") === "meta" ? "meta" : "zenvia");
    setAtivo(cfg.alertas_tolerancia_ativo ?? false);
    setPhoneNumberId(cfg.meta_phone_number_id ?? "");
    setWabaId(cfg.meta_waba_id ?? "");
    setTemplate(cfg.alerta_template_nome ?? TEMPLATE_PADRAO);
    setTemplateId(cfg.alerta_template_id ?? "");
    setIdioma(cfg.alerta_template_idioma ?? IDIOMA_PADRAO);
  }, [cfg]);

  const conexao = useQuery({
    queryKey: ["meta-status", cfg?.provedor ?? "", cfg?.meta_phone_number_id ?? "", cfg?.sender_id ?? ""],
    enabled: podeEditar,
    staleTime: 60_000,
    queryFn: async () => await statusFn({ data: undefined }),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        provedor,
        alertas_tolerancia_ativo: ativo,
        meta_phone_number_id: phoneNumberId.trim() || null,
        meta_waba_id: wabaId.trim() || null,
        alerta_template_nome: template.trim() || TEMPLATE_PADRAO,
        alerta_template_id: templateId.trim() || null,
        alerta_template_idioma: idioma.trim() || IDIOMA_PADRAO,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      if (cfg?.id) {
        const { error } = await db.from("whatsapp_config").update(payload).eq("id", cfg.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("whatsapp_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração dos alertas salva.");
      qc.invalidateQueries({ queryKey: ["whatsapp-config"] });
      qc.invalidateQueries({ queryKey: ["meta-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const testar = useMutation({
    mutationFn: async () => {
      const campos: Record<string, string> = {};
      for (const v of varsTeste) {
        const nome = v.nome.trim();
        if (nome) campos[nome] = v.valor;
      }
      return await testarFn({
        data: {
          telefone: telTeste,
          variaveis: Object.keys(campos).length > 0 ? campos : undefined,
          // Usa o ID digitado na tela mesmo antes de salvar.
          templateId: templateId.trim() || undefined,
        },
      });
    },
    onSuccess: (r) => {
      if (r.ok) {
        setResultadoTeste({ ok: true, msg: `Mensagem de teste enviada${r.messageId ? ` (ID: ${r.messageId})` : ""}.` });
        toast.success("Template de teste enviado.");
      } else {
        setResultadoTeste({ ok: false, msg: r.erro ?? "Falha no envio de teste." });
        toast.error(r.erro ?? "Falha no envio de teste.");
      }
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Falha no envio de teste.";
      setResultadoTeste({ ok: false, msg });
      toast.error(msg);
    },
  });

  const inspecionar = useMutation({
    mutationFn: async () => await inspecionarFn({ data: { templateId: templateId.trim() || undefined } }),
    onSuccess: (r) => {
      setInspecao(r);
      if (!r.ok) {
        toast.error(r.erro ?? "Não foi possível inspecionar o template.");
        return;
      }
      if (r.variaveis.length > 0) {
        setVarsTeste((atual) =>
          r.variaveis.map((nome) => ({
            nome,
            valor: atual.find((v) => v.nome === nome)?.valor ?? "",
          })),
        );
      }
      toast.success(`Template "${r.nome ?? "—"}" inspecionado: ${r.variaveis.length} variável(is).`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao inspecionar o template."),
  });

  const variaveisIncompletas = varsTeste.some((v) => v.nome.trim() && !v.valor.trim());

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Alertas de Tolerância
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Disparar alerta no WhatsApp</div>
              <div className="text-xs text-muted-foreground">
                Envia o template oficial ao engenheiro responsável quando a pesagem fecha acima da tolerância.
              </div>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!podeEditar} />
          </div>

          <div className="space-y-1.5">
            <Label>Provedor de envio</Label>
            <div className="flex gap-2">
              {(["zenvia", "meta"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={provedor === p ? "default" : "outline"}
                  className={provedor === p ? "bg-primary hover:bg-primary-hover" : ""}
                  onClick={() => setProvedor(p)}
                  disabled={!podeEditar}
                >
                  {p === "zenvia" ? "Zenvia" : "Meta oficial"}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se o número e o template estão na Zenvia, mantenha <strong>Zenvia</strong>: o envio usa o
              token e o remetente da aba Zenvia. Use <strong>Meta oficial</strong> apenas se o número
              estiver hospedado no seu próprio WABA.
            </p>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">
                {provedor === "zenvia" ? "Conexão com a Zenvia" : "Conexão com a Meta"}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => conexao.refetch()}
                disabled={!podeEditar || conexao.isFetching}
              >
                {conexao.isFetching ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Testar conexão
              </Button>
            </div>
            {conexao.data?.ok ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-success hover:bg-success">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
                </Badge>
                <span className="font-mono">{conexao.data.numero ?? "—"}</span>
                <span className="text-muted-foreground">{conexao.data.nomeExibicao ?? ""}</span>
                {conexao.data.qualidade && (
                  <Badge variant="outline">Qualidade: {conexao.data.qualidade}</Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <XCircle className="h-3 w-3 text-primary" />
                {conexao.data?.erro ?? "Sem conexão validada. Informe o número remetente e teste."}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {provedor === "meta" && (
            <div className="space-y-1.5">
              <Label>Número remetente (Phone Number ID)</Label>
              <Input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Ex.: 123456789012345"
                disabled={!podeEditar}
              />
            </div>
            )}
            {provedor === "meta" && (
            <div className="space-y-1.5">
              <Label>
                WABA ID <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="ID da conta WhatsApp Business"
                disabled={!podeEditar}
              />
            </div>
            )}
            <div className="space-y-1.5">
              <Label>Nome do template aprovado</Label>
              <Input
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={TEMPLATE_PADRAO}
                disabled={!podeEditar}
              />
            </div>
            {provedor === "meta" && (
            <div className="space-y-1.5">
              <Label>Idioma do template</Label>
              <Input
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                placeholder={IDIOMA_PADRAO}
                disabled={!podeEditar}
              />
            </div>
            )}
          </div>

          <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">
            {provedor === "zenvia" ? (
              <>
                O envio usa o <strong>Token da API</strong> e o <strong>Remetente</strong> cadastrados na
                aba Zenvia. Informe o <strong>ID do template</strong> aprovado na Zenvia e clique em{" "}
                <strong>Inspecionar</strong> para carregar as variáveis reais do modelo. Variáveis
                suportadas: <strong>{"{{placa}}"}</strong>, <strong>{"{{data}}"}</strong>,{" "}
                <strong>{"{{empreendimento}}"}</strong> e <strong>{"{{fornecedor}}"}</strong>. Nada de
                token fica no navegador.
              </>
            ) : (
              <>
                Quando o <strong>ID do Template</strong> é informado, o servidor lê o nome e o idioma reais
                direto da Meta e usa esse modelo no envio. Variáveis na ordem: <strong>{"{{1}}"}</strong>{" "}
                placa, <strong>{"{{2}}"}</strong> data, <strong>{"{{3}}"}</strong> empreendimento e{" "}
                <strong>{"{{4}}"}</strong> fornecedor. O token da Meta fica somente no servidor.
              </>
            )}
          </p>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="h-4 w-4 text-primary" />
              Teste do template (Admin/SuperAdmin)
            </div>

            {inspecao?.ok && inspecao.sender && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
                <span className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  Sender deste template: <strong>{inspecao.sender}</strong>
                  {inspecao.status && <Badge variant="outline">{inspecao.status}</Badge>}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => inspecionar.mutate()}
                  disabled={!podeEditar || inspecionar.isPending}
                >
                  {inspecionar.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3 w-3" />
                  )}
                  Sincronizar
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Template ID{provedor === "zenvia" ? " (Zenvia)" : " (Meta)"}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder={
                    provedor === "zenvia"
                      ? "921ff41e-f871-43d8-b9f6-ac8a38a1b0f2"
                      : "Ex.: 1234567890123456"
                  }
                  disabled={!podeEditar}
                  className="font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => inspecionar.mutate()}
                    disabled={!podeEditar || inspecionar.isPending || !templateId.trim()}
                  >
                    {inspecionar.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-1 h-4 w-4" />
                    )}
                    Inspecionar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => testar.mutate()}
                    disabled={
                      !podeEditar ||
                      testar.isPending ||
                      variaveisIncompletas ||
                      telTeste.replace(/\D/g, "").length < 10
                    }
                  >
                    <FlaskConical className="mr-1 h-4 w-4" />
                    Testar
                  </Button>
                </div>
              </div>
            </div>

            {inspecao?.ok && inspecao.faltantes.length > 0 && (
              <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[11px] text-warning">
                O template aprovado não contém:{" "}
                {inspecao.faltantes.map((f) => `{{${f}}}`).join(", ")}. Atualize o modelo no provedor
                para usá-las no alerta automático.
              </p>
            )}
            {inspecao && !inspecao.ok && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                {inspecao.erro ?? "Não foi possível inspecionar o template."}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variáveis do template</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => setVarsTeste((v) => [...v, { nome: "", valor: "" }])}
                  disabled={!podeEditar}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar variável
                </Button>
              </div>
              {varsTeste.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={v.nome}
                    onChange={(e) =>
                      setVarsTeste((atual) =>
                        atual.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)),
                      )
                    }
                    placeholder="nome"
                    disabled={!podeEditar}
                    className="max-w-40 font-mono text-xs"
                  />
                  <Input
                    value={v.valor}
                    onChange={(e) =>
                      setVarsTeste((atual) =>
                        atual.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)),
                      )
                    }
                    placeholder="Valor da variável"
                    disabled={!podeEditar}
                    className={
                      v.nome.trim() && !v.valor.trim()
                        ? "border-warning focus-visible:ring-warning"
                        : ""
                    }
                  />
                  {v.nome.trim() && (
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                      {`{{${v.nome.trim()}}}`}
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setVarsTeste((atual) => atual.filter((_, j) => j !== i))}
                    disabled={!podeEditar}
                    aria-label="Remover variável"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Número de destino</Label>
                <Input
                  value={telTeste}
                  onChange={(e) => setTelTeste(e.target.value)}
                  placeholder="5511999999999"
                  inputMode="tel"
                  disabled={!podeEditar}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => testar.mutate()}
                disabled={
                  !podeEditar ||
                  testar.isPending ||
                  variaveisIncompletas ||
                  telTeste.replace(/\D/g, "").length < 10
                }
              >
                {testar.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Enviar teste
              </Button>
            </div>

            {resultadoTeste && (
              <p
                className={`rounded-md border px-3 py-2 text-[11px] ${
                  resultadoTeste.ok
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                }`}
              >
                {resultadoTeste.msg}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              className="bg-primary hover:bg-primary-hover"
              onClick={() => salvar.mutate()}
              disabled={!podeEditar || salvar.isPending}
            >
              {salvar.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>

          {!podeEditar && (
            <p className="text-[11px] text-muted-foreground">
              Apenas Administrador e SuperAdmin podem alterar esta configuração.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
