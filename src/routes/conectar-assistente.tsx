import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bot, Check, ClipboardCopy, RefreshCw, Terminal, MessageSquare, Sparkles, ExternalLink, ChevronRight, ShieldCheck } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/conectar-assistente")({
  head: () => ({
    meta: [
      { title: "Conectar Assistente — Portal de Pesagem" },
      { name: "description", content: "Conecte ChatGPT, Claude ou outro assistente de IA ao Portal de Pesagem via MCP." },
    ],
  }),
  component: ConectarAssistentePage,
});

function useMcpUrl() {
  return useMemo(() => new URL("/mcp", typeof window !== "undefined" ? window.location.origin : "https://example.com").toString(), []);
}

function slugifyAppName() {
  const raw = "portal-pesagem";
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  if (!slug) return "lovable-app";
  const reserved = new Set(["workspace", "computer-use", "claude-in-chrome", "claude-preview", "claude-browser"]);
  return reserved.has(slug) ? `${slug}-app` : slug;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label ?? "Texto"} copiado para a área de transferência`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2">
      {copied ? <Check className="h-4 w-4 text-success" /> : <ClipboardCopy className="h-4 w-4" />}
      {copied ? "Copiado" : label ?? "Copiar"}
    </Button>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {number}
      </span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  );
}

function ConectarAssistentePage() {
  const [obraId, setObraId] = useObraAtual();
  const mcpUrl = useMcpUrl();
  const appSlug = useMemo(() => slugifyAppName(), []);
  const claudeCodeCommand = `claude mcp add --scope user --transport http ${appSlug} '${mcpUrl.replace(/'/g, "'\\''")}'`;
  const claudePrefilledUrl = useMemo(() => {
    const name = encodeURIComponent("Portal de Pesagem");
    const url = encodeURIComponent(mcpUrl);
    return `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${name}&connectorUrl=${url}`;
  }, [mcpUrl]);

  return (
    <AppShell obraId={obraId} onObraChange={setObraId}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-3 sm:gap-6 sm:p-4 lg:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conectar assistente de IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use ChatGPT, Claude, Claude Code ou outro cliente MCP para consultar dados do Portal de Pesagem com sua conta do Portal.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">URL do servidor MCP</CardTitle>
            </div>
            <CardDescription>
              Copie e cole essa URL no assistente. Ela aponta automaticamente para o domínio em que o app está aberto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <code className="break-all rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm">
                {mcpUrl}
              </code>
              <div className="flex gap-2">
                <CopyButton text={mcpUrl} label="Copiar URL" />
                <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground">
                  <a href="/.mcp/list-tools" target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Ferramentas
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="chatgpt" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-4 sm:grid-cols-4">
            <TabsTrigger value="chatgpt" className="gap-2">
              <MessageSquare className="h-4 w-4" /> <span className="hidden sm:inline">ChatGPT</span>
              <span className="sm:hidden">GPT</span>
            </TabsTrigger>
            <TabsTrigger value="claude" className="gap-2">
              <Bot className="h-4 w-4" /> Claude
            </TabsTrigger>
            <TabsTrigger value="claude-code" className="gap-2">
              <Terminal className="h-4 w-4" /> Claude Code
            </TabsTrigger>
            <TabsTrigger value="outros" className="gap-2">
              <Sparkles className="h-4 w-4" /> Outros
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chatgpt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5 text-primary" /> Conectar no ChatGPT
                </CardTitle>
                <CardDescription>Siga os passos para criar um app MCP no ChatGPT e acessar os dados do portal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-3">
                  <Step number={1}>
                    Abra{" "}
                    <a
                      href="https://chatgpt.com/#settings/Connectors/Advanced"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Configurações &gt; Connectors / Apps <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    e ative o <strong>Developer mode</strong>, se ainda não estiver ativo.
                  </Step>
                  <Step number={2}>Clique em <strong>Create app</strong> ao lado do botão de voltar.</Step>
                  <Step number={3}>Dê um nome ao app (por exemplo, "Portal de Pesagem") e cole a URL do servidor MCP.</Step>
                  <Step number={4}>Clique em <strong>Create</strong>.</Step>
                  <Step number={5}>No compositor de chat, ative o app e peça algo como: <em>"Liste as pesagens de hoje"</em> ou <em>"Resuma a conferência do fornecedor X"</em>.</Step>
                </ol>

                <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">Para atualizar o app depois de uma mudança:</p>
                  <ol className="space-y-2">
                    <Step number={1}>Abra as preferências do app em ChatGPT.</Step>
                    <Step number={2}>Clique em <strong>Refresh</strong> ao lado de "Information".</Step>
                    <Step number={3}>Se a URL mudou, cole a URL atual novamente.</Step>
                    <Step number={4}>Inicie um novo chat e peça ao ChatGPT para usar o app.</Step>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claude" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-5 w-5 text-primary" /> Conectar no Claude
                </CardTitle>
                <CardDescription>Adicione um connector customizado no Claude com a URL do servidor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                  <Button asChild variant="default" size="sm" className="gap-2">
                    <a href={claudePrefilledUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir Claude com campos preenchidos
                    </a>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Se o link não abrir a tela corretamente, siga os passos:</p>
                <ol className="space-y-3">
                  <Step number={1}>Vá em <strong>Claude &gt; Connectors</strong> e escolha <strong>Add custom connector</strong>.</Step>
                  <Step number={2}>Preencha o nome ("Portal de Pesagem") e cole a URL do servidor MCP.</Step>
                  <Step number={3}>Clique em <strong>Add</strong>.</Step>
                  <Step number={4}>Ative o connector no compositor de chat e peça algo como: <em>"Liste as obras que tenho acesso"</em>.</Step>
                </ol>

                <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">Para atualizar o connector depois:</p>
                  <ol className="space-y-2">
                    <Step number={1}>Abra a página de Connectors no Claude.</Step>
                    <Step number={2}>Selecione o connector do Portal de Pesagem.</Step>
                    <Step number={3}>Clique em refresh/update e cole a URL atual, se necessário.</Step>
                    <Step number={4}>Peça ao Claude para usar o app.</Step>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claude-code" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-5 w-5 text-primary" /> Conectar no Claude Code
                </CardTitle>
                <CardDescription>Instale o servidor MCP diretamente pelo terminal com um comando.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <code className="break-all rounded-md bg-background px-3 py-2 text-sm font-mono text-foreground shadow-sm">
                    {claudeCodeCommand}
                  </code>
                  <CopyButton text={claudeCodeCommand} label="Copiar comando" />
                </div>
                <ol className="space-y-3">
                  <Step number={1}>Abra um terminal e cole o comando acima.</Step>
                  <Step number={2}>Inicie o Claude Code e rode <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/mcp</code> para confirmar a conexão.</Step>
                  <Step number={3}>Se o app proteger as ferramentas, faça login com sua conta do Portal quando solicitado.</Step>
                  <Step number={4}>Peça ao Claude Code para consultar o portal, por exemplo: <em>"Liste as pesagens da obra atual"</em>.</Step>
                </ol>

                <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">Para atualizar a conexão depois:</p>
                  <ol className="space-y-2">
                    <Step number={1}>Inicie uma nova sessão do Claude Code — ela recarrega as ferramentas automaticamente.</Step>
                    <Step number={2}>Se a URL mudar, remova a conexão: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">claude mcp remove {appSlug}</code></Step>
                    <Step number={3}>Cole o comando de instalação novamente com a URL atualizada.</Step>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outros" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-primary" /> Outros clientes MCP
                </CardTitle>
                <CardDescription>Qualquer assistente compatível com servidores MCP remotos pode se conectar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-3">
                  <Step number={1}>Abra as configurações de MCP ou connectors do assistente.</Step>
                  <Step number={2}>Crie uma nova conexão remota do tipo <strong>HTTP / Streamable HTTP</strong> ou <strong>Custom MCP server</strong>.</Step>
                  <Step number={3}>Cole a URL do servidor MCP no campo de endpoint.</Step>
                  <Step number={4}>Finalize e, se solicitado, autentique com sua conta do Portal.</Step>
                  <Step number={5}>Ative a conexão e peça ao assistente para consultar o portal.</Step>
                </ol>

                <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">Para atualizar a conexão depois:</p>
                  <ol className="space-y-2">
                    <Step number={1}>Abra as configurações do MCP server no cliente.</Step>
                    <Step number={2}>Atualize o endpoint com a URL atual, se necessário.</Step>
                    <Step number={3}>Recarregue ou reconecte o servidor.</Step>
                    <Step number={4}>Inicie uma nova conversa para carregar a lista atualizada de ferramentas.</Step>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Segurança e permissões</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                O assistente acessa apenas os dados que sua conta do Portal já pode ver. A autenticação é feita por OAuth e respeita as permissões de Admin ou Operador. Nunca compartilhe senhas ou tokens com o assistente.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Sempre atualize após mudanças</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Os assistentes armazenam a lista de ferramentas em cache. Sempre que o app for atualizado, use a opção de refresh do cliente para recarregar as ferramentas disponíveis.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ChevronRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">O que perguntar</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Exemplos: <em>"Liste as pesagens de hoje"</em>, <em>"Detalhe a pesagem do caminhão ABC-1234"</em>, <em>"Resumo de conferência do fornecedor X nesta semana"</em>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
