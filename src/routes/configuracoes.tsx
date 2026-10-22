import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Trash2, Loader2, ShieldAlert, KeyRound, Users, FileText, Check, X, Scale,
  Pencil, Copy, RefreshCw, Wrench, FlaskConical, Settings2, RotateCcw, Building2, ShieldCheck, MessageCircle, UserPlus

} from "lucide-react";
import { TesteBalanca } from "@/components/teste-balanca";
import { DashboardConcreto } from "@/components/dashboard-concreto";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { CadastroObras } from "@/components/cadastro-obras";
import { CadastroPerfis } from "@/components/cadastro-perfis";
import { PERFIS, type AppRoleKey } from "@/lib/permissoes-menu";
import { PermissoesMenu } from "@/components/permissoes-menu";
import { ConfiguracoesWhatsApp } from "@/components/whatsapp/configuracoes-whatsapp";

import { DashboardTolerancias } from "@/components/dashboard-tolerancias";
import { CadastroDensidades } from "@/components/cadastro-densidades";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { obrasQueryOptions } from "@/lib/pesagem-queries";
import {
  listarUsuarios, concederAcesso, revogarAcesso, definirRole, inserirNotaManual,
  listarColigadas, definirColigadasUsuario,
  atualizarUsuario, redefinirSenhaUsuario, criarUsuario, reprocessarPesosNf, type UsuarioAdmin,
  type ResultadoReprocessamento,
} from "@/lib/admin.functions";
import { reprocessarHistoricoConcreto, reverterRecalculoConcreto, simularAmostraConcreto } from "@/lib/recalculo.functions";

import { enviarEmailResend } from "@/lib/email/resend.functions";
import { toast } from "sonner";



export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Portal de Pesagem" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    aba: typeof search.aba === "string" ? search.aba : undefined,
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const [obraId, setObraId] = useObraAtual();
  const { isAdmin, loading, user } = useAuth();
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="configuracoes">
      <div className="mx-auto max-w-6xl p-4 lg:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Obras, acessos de operadores, notas fiscais e certificados SEFAZ.
        </p>

        {loading ? null : !isAdmin ? (
          <Card className="mt-6">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Você não tem permissão de administrador. Solicite acesso a um administrador.
            </CardContent>
          </Card>
        ) : (
          <Tabs
            value={aba ?? "acessos"}
            onValueChange={(v) => navigate({ search: { aba: v }, replace: true })}
            className="mt-6"
          >
            <TabsList className="hidden">
              <TabsTrigger value="obras">Obras</TabsTrigger>
              <TabsTrigger value="acessos">Operadores</TabsTrigger>
              <TabsTrigger value="perfis">Perfis</TabsTrigger>
              <TabsTrigger value="permissoes">Permissões por Menu</TabsTrigger>
              <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
              <TabsTrigger value="sefaz">SEFAZ</TabsTrigger>
              <TabsTrigger value="balanca">Balança</TabsTrigger>
              <TabsTrigger value="concreto">Concreto</TabsTrigger>
              <TabsTrigger value="tolerancias">Tolerâncias</TabsTrigger>
              <TabsTrigger value="densidades">Densidades</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
              {user?.email?.toLowerCase() === "wsasistemas.ia@gmail.com" && (
                <TabsTrigger value="email-teste">Teste de e-mail</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="obras"><CadastroObras /></TabsContent>
            <TabsContent value="perfis"><CadastroPerfis /></TabsContent>
            <TabsContent value="permissoes"><PermissoesMenu /></TabsContent>
            <TabsContent value="acessos"><AcessosAdmin userId={user?.id} /></TabsContent>

            <TabsContent value="notas"><NotasAdmin userId={user?.id} /></TabsContent>
            <TabsContent value="sefaz"><SefazAdmin userId={user?.id} /></TabsContent>
            <TabsContent value="balanca"><TesteBalanca /></TabsContent>
            <TabsContent value="concreto"><DashboardConcreto /></TabsContent>
            <TabsContent value="tolerancias"><DashboardTolerancias /></TabsContent>
            <TabsContent value="densidades"><CadastroDensidades /></TabsContent>
            <TabsContent value="whatsapp"><ConfiguracoesWhatsApp /></TabsContent>
            <TabsContent value="manutencao">
              <ManutencaoPesos />
              <ManutencaoConcreto />
            </TabsContent>

            {user?.email?.toLowerCase() === "wsasistemas.ia@gmail.com" && (
              <TabsContent value="email-teste"><TesteEmailResend defaultTo={user.email} /></TabsContent>
            )}
          </Tabs>
        )}

      </div>
    </AppShell>
  );
}

// ---------------- MANUTENÇÃO ----------------

function ManutencaoPesos() {
  const qc = useQueryClient();
  const reprocessarFn = useServerFn(reprocessarPesosNf);
  const [resultado, setResultado] = useState<ResultadoReprocessamento | null>(null);

  const mut = useMutation({
    mutationFn: async () => (await reprocessarFn({ data: undefined })) as ResultadoReprocessamento,
    onSuccess: async (r) => {
      setResultado(r);
      toast.success(`${r.atualizados} de ${r.analisados} registros recalculados.`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pesagens"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["dashboard"], refetchType: "all" }),
      ]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reprocessar."),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Reprocessar pesos das notas fiscais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Recalcula o peso declarado de todos os registros a partir dos itens da nota fiscal
          (conversão por unidade e densidade) e sinaliza notas com unidade suspeita.
          Use após corrigir dados de notas já lançadas.
        </p>

        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {mut.isPending ? "Reprocessando..." : "Reprocessar agora"}
        </Button>

        {mut.isPending && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        )}

        {resultado && !mut.isPending && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Analisados</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{resultado.analisados}</div>
            </div>
            <div className="rounded-lg border bg-muted p-3">
              <div className="text-[11px] uppercase tracking-wide text-primary/70">Recalculados</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-primary">{resultado.atualizados}</div>
            </div>
            <div className="rounded-lg border bg-wine-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-primary/70">Unidade suspeita</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-primary">{resultado.suspeitos}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManutencaoConcreto() {
  const qc = useQueryClient();
  const recalcularFn = useServerFn(reprocessarHistoricoConcreto);
  const reverterFn = useServerFn(reverterRecalculoConcreto);
  const [resultado, setResultado] = useState<any>(null);

  const recalcularMut = useMutation({
    mutationFn: async () => await recalcularFn({ data: undefined }),
    onSuccess: (r) => {
      setResultado(r);
      toast.success("Recálculo concluído com sucesso.");
      qc.invalidateQueries({ queryKey: ["pesagens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro no recálculo"),
  });

  const reverterMut = useMutation({
    mutationFn: async () => await reverterFn({ data: undefined }),
    onSuccess: (r) => {
      toast.success(`${r.revertidos} registros revertidos.`);
      qc.invalidateQueries({ queryKey: ["pesagens"] });
      setResultado(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao reverter"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recálculo de Histórico (Concreto)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Recalcula as notas de concreto usando a regra técnica (Volume × Densidade Teórica) e tolerância de 4%. 
            O sistema também identifica volumetria derivada pelo consumo de cimento para notas que possuem este insumo detalhado.
            Os valores originais são preservados em campos de auditoria. 
            Registros marcados como "Não Identificados" são aqueles onde o emissor é um fornecedor de concreto cadastrado, mas o traço específico (FCK, Slump ou Código) não foi localizado na descrição dos itens ou nos dados adicionais da nota fiscal (campo "DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES").
          </p>

          <div className="flex gap-2">
            <Button onClick={() => recalcularMut.mutate()} disabled={recalcularMut.isPending} className="bg-primary hover:bg-primary-hover">
              {recalcularMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Recalcular histórico de concreto
            </Button>

            <Button onClick={() => reverterMut.mutate()} disabled={reverterMut.isPending} variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
              {reverterMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Reverter recálculo
            </Button>
          </div>

          {resultado && (
            <div className="mt-4 rounded-lg border bg-muted p-4">
              <h4 className="mb-2 font-medium">Relatório de Recálculo</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Processados</div>
                  <div className="text-lg font-bold">{resultado.totalProcessados}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Mudaram Status</div>
                  <div className="text-lg font-bold text-primary">{resultado.totalStatusMudou}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Reprovado → OK</div>
                  <div className="text-lg font-bold text-primary">{resultado.stats.reprovado_para_conforme}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Não Identificados</div>
                  <div className="text-lg font-bold text-primary">{resultado.totalNaoIdentificado}</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Executado em: {new Date(resultado.executadoEm).toLocaleString("pt-BR")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <PainelAmostraConcreto />
    </div>
  );
}

function PainelAmostraConcreto() {
  const simularFn = useServerFn(simularAmostraConcreto);
  const [limite, setLimite] = useState(50);
  const [amostra, setAmostra] = useState<any[]>([]);

  const mut = useMutation({
    mutationFn: async () => await simularFn({ data: { limite } }),
    onSuccess: (data) => setAmostra(data),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro na simulação"),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Simulação de Amostra (Anterior vs Novo)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="grid w-full max-w-[120px] items-center gap-1.5">
            <Label htmlFor="limite">Qtd. Notas</Label>
            <Input 
              id="limite" 
              type="number" 
              value={limite} 
              onChange={(e) => setLimite(Number(e.target.value))} 
            />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            Gerar Comparativo
          </Button>
        </div>

        {amostra.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-md border">
            <table className="w-full text-[11px]">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Nota / Emissor</th>
                  <th className="px-3 py-2">Anterior (Peso/Status)</th>
                  <th className="px-3 py-2">Simulado (Traço/Peso/Status)</th>
                  <th className="px-3 py-2 text-center">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {amostra.map((item) => (
                  <tr key={item.id} className={`border-b ${item.mudou ? 'bg-wine-50/50' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">NF {item.numero_nota}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{item.emissor}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{item.anterior.peso_esperado?.toFixed(0)} kg</div>
                      <Badge variant="outline" className="mt-1 h-5 text-[9px] uppercase">
                        {item.anterior.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-primary">{item.novo.traco_nome}</div>
                      <div className="text-[10px]">{item.novo.peso_esperado?.toFixed(0)} kg (ρ: {item.novo.densidade})</div>
                      <Badge className="mt-1 h-5 bg-accent text-[9px] text-primary hover:bg-accent uppercase">
                        {item.novo.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.mudou ? (
                        <div className="flex items-center justify-center gap-1 text-primary">
                          <RefreshCw className="h-3 w-3" />
                          <span className="font-bold">Alterado</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Sem mudança</span>
                      )}
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


// ---------------- ACESSOS ----------------

function AcessosAdmin({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  
  const listar = useServerFn(listarUsuarios);
  const setRole = useServerFn(definirRole);
  const atualizar = useServerFn(atualizarUsuario);
  const redefinir = useServerFn(redefinirSenhaUsuario);

  const { data: usuarios = [], isLoading, error } = useQuery({
    queryKey: ["admin-usuarios"],
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: () => listar(),
  });

  const [filtro, setFiltro] = useState("");
  const filtrados = useMemo(
    () =>
      usuarios.filter((u) =>
        (u.email + " " + (u.display_name ?? "")).toLowerCase().includes(filtro.toLowerCase()),
      ),
    [usuarios, filtro],
  );

  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin-usuarios"] });

  const toggleRole = useMutation({
    mutationFn: (args: {
      userId: string;
      role: AppRoleKey;
      conceder: boolean;
    }) =>
      setRole({ data: args }),
    onSuccess: invalidar,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const [editing, setEditing] = useState<UsuarioAdmin | null>(null);
  const [resetting, setResetting] = useState<UsuarioAdmin | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ email: string; senha: string } | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const resetMut = useMutation({
    mutationFn: (uid: string) => redefinir({ data: { userId: uid } }),
    onSuccess: (r, uid) => {
      const alvo = usuarios.find((x) => x.id === uid);
      setSenhaGerada({ email: alvo?.email ?? "", senha: r.senhaProvisoria });
      setResetting(null);
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao redefinir senha."),
  });

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Operadores ({usuarios.length})</CardTitle>
            <Button size="sm" className="ml-auto shrink-0" onClick={() => setNovoAberto(true)}>
              <UserPlus className="h-4 w-4" /> Novo usuário
            </Button>
            <Input
              className="w-full sm:w-[280px]"
              placeholder="Buscar por nome ou e-mail..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários...
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Falha ao carregar."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Usuário</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Perfis</th>
                    <th className="px-3 py-2">Coligadas</th>
                    <th className="px-3 py-2">Último acesso</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => {
                    const isOp = u.roles.includes("operador");
                    const isAdm = u.roles.includes("admin");
                    return (
                    <tr key={u.id} className="border-b align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium">{u.display_name ?? u.email.split("@")[0]}</div>
                        <div className="text-[11px] text-muted-foreground">{u.email}</div>
                        <div className="text-[10px] text-muted-foreground">
                          criado {new Date(u.criado_em).toLocaleDateString("pt-BR")}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {!u.ativo ? (
                          <Badge variant="outline" className="border-destructive/30 text-destructive">Bloqueado</Badge>
                        ) : isOp || isAdm ? (
                          <div className="flex flex-col items-start gap-1">
                            <Badge className="bg-accent text-primary hover:bg-accent">Ativo</Badge>
                            {isOp && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px] text-muted-foreground"
                                onClick={() => toggleRole.mutate({ userId: u.id, role: "operador", conceder: false })}
                                disabled={toggleRole.isPending}
                              >
                                <X className="mr-1 h-3 w-3" />Remover operador
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className="text-primary">Pendente</Badge>
                            <Button
                              size="sm"
                              className="h-7 bg-primary text-white hover:bg-primary-hover"
                              onClick={() => toggleRole.mutate({ userId: u.id, role: "operador", conceder: true })}
                              disabled={toggleRole.isPending}
                            >
                              <Check className="mr-1 h-3 w-3" />Ativar operador
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {PERFIS.filter((p) => u.roles.includes(p.role)).map((p) => (
                            <Badge key={p.role} className="bg-primary text-[10px] text-white hover:bg-primary">
                              {p.nome}
                            </Badge>
                          ))}
                          {!PERFIS.some((p) => u.roles.includes(p.role)) && (
                            <span className="text-[11px] text-muted-foreground">Sem perfil</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {isAdm || u.roles.includes("superadmin") ? (
                          <Badge variant="outline" className="text-primary">Todas</Badge>
                        ) : u.coligadas.length ? (
                          <div className="flex max-w-[180px] flex-wrap gap-1">
                            {u.coligadas.map((c) => (
                              <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Nenhuma</span>
                        )}
                        {(u.engenheiroTodas || u.engenheiroColigadas.length > 0) && (
                          <div className="mt-1 text-[10px] text-primary">
                            Eng. resp.:{" "}
                            {u.engenheiroTodas
                              ? "todas as coligadas"
                              : u.engenheiroColigadas.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                        {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString("pt-BR") : "nunca"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => setEditing(u)}
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-wine-100 text-[11px] text-primary hover:bg-wine-50"
                            onClick={() => setResetting(u)}
                          >
                            <KeyRound className="h-3 w-3" /> Redefinir senha
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filtrados.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum usuário.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Novos usuários se cadastram na tela de login com o próprio e-mail. Eles só entram
        no sistema após um admin clicar em <strong>Ativar operador</strong> aqui.
      </div>

      <EditarUsuarioDialog
        open={!!editing}
        usuario={editing}
        meuUserId={userId}
        onClose={() => setEditing(null)}
        onSaved={() => { invalidar(); setEditing(null); }}
        atualizarFn={(args) => atualizar({ data: args })}
        definirRoleFn={(args) => setRole({ data: args })}
      />

      <AlertDialog open={!!resetting} onOpenChange={(v) => !v && setResetting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova senha provisória será gerada para{" "}
              <strong>{resetting?.email}</strong>. O usuário será obrigado a
              trocar a senha no próximo acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary-hover"
              onClick={(e) => {
                e.preventDefault();
                if (resetting) resetMut.mutate(resetting.id);
              }}
              disabled={resetMut.isPending}
            >
              {resetMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Gerar senha provisória
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NovoUsuarioDialog
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        onCriado={(r) => {
          setNovoAberto(false);
          invalidar();
          if (r.senhaProvisoria) setSenhaGerada({ email: r.email, senha: r.senhaProvisoria });
          else toast.success(`${r.email} já tinha login em outro sistema WSA: acesso liberado com a senha que já usa.`);
        }}
      />

      <Dialog open={!!senhaGerada} onOpenChange={(v) => !v && setSenhaGerada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Senha provisória gerada
            </DialogTitle>
            <DialogDescription>
              Copie e entregue ao usuário <strong>{senhaGerada?.email}</strong>. Esta senha só
              aparecerá agora — ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code className="flex-1 font-mono text-sm">{senhaGerada?.senha}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!senhaGerada) return;
                try {
                  await navigator.clipboard.writeText(senhaGerada.senha);
                  toast.success("Senha copiada.");
                } catch {
                  toast.error("Não foi possível copiar.");
                }
              }}
            >
              <Copy className="mr-1 h-3 w-3" /> Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSenhaGerada(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Novo usuário do Portal de Pesagem. Login único do ImobSystem: se o e-mail já tem login em outro sistema WSA,
 * o acesso é liberado com a senha que a pessoa já usa; se não tem, o login é criado com senha provisória.
 */
function NovoUsuarioDialog({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (r: { email: string; senhaProvisoria: string | null }) => void;
}) {
  const criar = useServerFn(criarUsuario);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [roles, setRoles] = useState<AppRoleKey[]>(["operador"]);

  useEffect(() => {
    if (aberto) {
      setNome("");
      setEmail("");
      setCelular("");
      setRoles(["operador"]);
    }
  }, [aberto]);

  const mut = useMutation({
    mutationFn: () =>
      criar({ data: { nome, email, celular: celular || undefined, roles } }),
    onSuccess: (r) => onCriado({ email: email.trim().toLowerCase(), senhaProvisoria: r.senhaProvisoria }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar o usuário."),
  });

  const alternar = (role: AppRoleKey) =>
    setRoles((atual) => (atual.includes(role) ? atual.filter((r) => r !== role) : [...atual, role]));

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Novo usuário
          </DialogTitle>
          <DialogDescription>
            Se o e-mail já tiver login em outro sistema da WSA Sistemas, a pessoa entra com a senha que já usa.
            Se não tiver, o sistema gera uma senha provisória para você entregar.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="novo-nome">Nome</Label>
            <Input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-email">E-mail</Label>
            <Input id="novo-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-celular">Celular (opcional)</Label>
            <Input id="novo-celular" value={celular} onChange={(e) => setCelular(formatarCelular(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Perfis</Label>
            <div className="flex flex-wrap gap-2">
              {PERFIS.map((p) => (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => alternar(p.role)}
                  className={
                    roles.includes(p.role)
                      ? "rounded-full border border-primary bg-primary-soft px-3 py-1 text-xs font-semibold text-primary"
                      : "rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
                  }
                >
                  {p.nome}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={mut.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mut.isPending || roles.length === 0}>
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Criar acesso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatarCelular(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function EditarUsuarioDialog({
  open, usuario, meuUserId, onClose, onSaved, atualizarFn, definirRoleFn,
}: {
  open: boolean;
  usuario: UsuarioAdmin | null;
  meuUserId?: string;
  onClose: () => void;
  onSaved: () => void;
  atualizarFn: (args: {
    userId: string;
    displayName?: string;
    email?: string;
    celular?: string;
    ativo?: boolean;
  }) => Promise<{ ok: true }>;
  definirRoleFn: (args: {
    userId: string;
    role: AppRoleKey;
    conceder: boolean;
  }) => Promise<{ ok: true }>;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [coligadas, setColigadas] = useState<string[]>([]);
  const [engColigada, setEngColigada] = useState<string | null>(null);
  const [engTodas, setEngTodas] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [roles, setRoles] = useState<AppRoleKey[]>([]);

  const { data: descricoes = {} } = useQuery({
    queryKey: ["perfil-descricoes"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("perfil_descricoes").select("role, nome, descricao");
      const mapa: Record<string, { nome: string; descricao: string | null }> = {};
      for (const d of data ?? []) mapa[d.role] = { nome: d.nome, descricao: d.descricao };
      return mapa;
    },
  });


  const listarColigadasFn = useServerFn(listarColigadas);
  const salvarColigadasFn = useServerFn(definirColigadasUsuario);
  const { data: coligadasDisponiveis = [] } = useQuery({
    queryKey: ["coligadas"],
    queryFn: () => listarColigadasFn(),
    staleTime: 5 * 60_000,
  });

  const verTodas = !!usuario && (usuario.roles.includes("admin") || usuario.roles.includes("superadmin"));

  useEffect(() => {
    if (usuario) {
      setNome(usuario.display_name ?? "");
      setEmail(usuario.email);
      setCelular(usuario.phone ? formatarCelular(usuario.phone) : "");
      setAtivo(usuario.ativo);
      setColigadas(usuario.coligadas ?? []);
      setEngColigada(usuario.engenheiroColigadas?.[0] ?? null);
      setEngTodas(usuario.engenheiroTodas === true);
      setWhatsapp(usuario.whatsapp ? `+${usuario.whatsapp}` : "");
      setRoles(PERFIS.filter((p) => usuario.roles.includes(p.role)).map((p) => p.role));
    }
  }, [usuario]);

  const emailValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const rolesOriginais = usuario
    ? PERFIS.filter((p) => usuario.roles.includes(p.role)).map((p) => p.role)
    : [];
  const rolesIncluidas = roles.filter((r) => !rolesOriginais.includes(r));
  const rolesRemovidas = rolesOriginais.filter((r) => !roles.includes(r));
  const souEu = !!usuario && !!meuUserId && usuario.id === meuUserId;
  const nomePerfil = (role: AppRoleKey) =>
    descricoes[role]?.nome ?? PERFIS.find((p) => p.role === role)?.nome ?? role;

  const alternarRole = (role: AppRoleKey) =>
    setRoles((atual) =>
      atual.includes(role) ? atual.filter((r) => r !== role) : [...atual, role],
    );

  const salvar = useMutation({
    mutationFn: async () => {
      if (!usuario) return;
      const emailNormalizado = email.trim().toLowerCase();
      await atualizarFn({
        userId: usuario.id,
        displayName: nome.trim(),
        email:
          emailNormalizado && emailNormalizado !== usuario.email.toLowerCase()
            ? emailNormalizado
            : undefined,
        celular: celular.replace(/\D/g, ""),
        ativo,
      });
      await salvarColigadasFn({
        data: {
          userId: usuario.id,
          coligadas: coligadas.map((cod) => ({
            codcoligada: cod,
            nome: coligadasDisponiveis.find((c) => c.codcoligada === cod)?.nome,
            engenheiroResponsavel: !engTodas && engColigada === cod,
          })),
          whatsapp: whatsapp.replace(/\D/g, ""),
          engenheiroTodas: verTodas ? engTodas : false,
        },
      });
      // Perfis de acesso: aplica as inclusões e exclusões escolhidas no cadastro.
      for (const role of rolesIncluidas) {
        await definirRoleFn({ userId: usuario.id, role, conceder: true });
      }
      for (const role of rolesRemovidas) {
        await definirRoleFn({ userId: usuario.id, role, conceder: false });
      }
    },
    onSuccess: () => {
      const partes = [
        ...rolesIncluidas.map((r) => `+ ${nomePerfil(r)}`),
        ...rolesRemovidas.map((r) => `− ${nomePerfil(r)}`),
      ];
      toast.success(
        partes.length ? `Usuário atualizado. Perfis: ${partes.join(", ")}` : "Usuário atualizado.",
      );
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>Atualize os dados de cadastro do usuário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome de exibição</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Wagner Antunes" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com.br"
              className={!emailValido ? "border-destructive focus-visible:ring-destructive/30" : ""}
            />
            {!emailValido && (
              <p className="text-[11px] text-destructive">
                Informe um e-mail válido.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>
              Celular <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              value={celular}
              onChange={(e) => setCelular(formatarCelular(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Usuário ativo</div>
              <div className="text-xs text-muted-foreground">
                Quando desativado, o usuário não consegue acessar o Portal.
              </div>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Perfis de acesso</div>
              <div className="text-xs text-muted-foreground">
                Marque os perfis deste usuário. As mudanças valem ao salvar.
              </div>
            </div>
            <div className="space-y-2">
              {PERFIS.map((p) => {
                const marcado = roles.includes(p.role);
                const travado =
                  souEu && marcado && (p.role === "admin" || p.role === "superadmin");
                return (
                  <label
                    key={p.role}
                    className={`flex items-start gap-2 rounded-md border p-2 ${travado ? "opacity-70" : "cursor-pointer hover:bg-muted/40"}`}
                  >
                    <Checkbox
                      checked={marcado}
                      disabled={travado}
                      onCheckedChange={() => !travado && alternarRole(p.role)}
                      className="mt-0.5"
                    />
                    <span className="text-xs">
                      <span className="font-medium">{nomePerfil(p.role)}</span>
                      {descricoes[p.role]?.descricao && (
                        <span className="block text-[11px] text-muted-foreground">
                          {descricoes[p.role]?.descricao}
                        </span>
                      )}
                      {travado && (
                        <span className="block text-[11px] text-primary">
                          Você não pode remover o seu próprio perfil de administrador.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {roles.length === 0 && (
              <p className="rounded-md bg-warning-soft p-2 text-[11px] text-warning">
                Sem nenhum perfil marcado, o usuário fica sem acesso ao sistema.
              </p>
            )}
          </div>



          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Coligadas permitidas</div>
                <div className="text-xs text-muted-foreground">
                  {verTodas
                    ? "Perfis Administrador/SuperAdmin acessam todas as coligadas."
                    : "O usuário só verá registros das coligadas marcadas."}
                </div>
              </div>
              {!verTodas && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() =>
                    setColigadas(
                      coligadas.length === coligadasDisponiveis.length
                        ? []
                        : coligadasDisponiveis.map((c) => c.codcoligada),
                    )
                  }
                >
                  {coligadas.length === coligadasDisponiveis.length ? "Limpar" : "Selecionar todas"}
                </Button>
              )}
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {coligadasDisponiveis.map((c) => {
                const marcada = coligadas.includes(c.codcoligada);
                return (
                  <label
                    key={c.codcoligada}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={(v) =>
                        setColigadas((prev) =>
                          v ? [...prev, c.codcoligada] : prev.filter((x) => x !== c.codcoligada),
                        )
                      }
                    />
                    <span className="font-mono font-semibold">{c.codcoligada}</span>
                    <span className="text-muted-foreground">– {c.nome}</span>
                  </label>
                );
              })}
              {!coligadasDisponiveis.length && (
                <div className="text-[11px] text-muted-foreground">
                  Nenhuma coligada encontrada no cadastro de Obras.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Engenheiro responsável</div>
              <div className="text-xs text-muted-foreground">
                Recebe os alertas de tolerância por WhatsApp da coligada escolhida.
              </div>
            </div>
            {verTodas && (
              <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-2.5">
                <div>
                  <div className="text-xs font-medium">Engenheiro responsável por todas as coligadas</div>
                  <div className="text-[11px] text-muted-foreground">
                    Perfis Administrador/SuperAdmin podem receber os alertas de tolerância de
                    qualquer obra, somando-se ao engenheiro da coligada.
                  </div>
                </div>
                <Switch checked={engTodas} onCheckedChange={setEngTodas} />
              </div>
            )}
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              value={engTodas ? "" : engColigada ?? ""}
              disabled={engTodas}
              onChange={(e) => setEngColigada(e.target.value || null)}
            >
              <option value="">
                {engTodas ? "Abrange todas as coligadas" : "Não é engenheiro responsável"}
              </option>
              {coligadas.map((cod) => (
                <option key={cod} value={cod}>
                  {cod} – {coligadasDisponiveis.find((c) => c.codcoligada === cod)?.nome ?? ""}
                </option>
              ))}
            </select>
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp (E.164)</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+55 11 99999-9999"
                inputMode="tel"
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Necessário para o envio dos alertas oficiais de tolerância.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
          <Button
            className="bg-primary hover:bg-primary-hover"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !emailValido || !nome.trim()}
          >
            {salvar.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}


// ---------------- NOTAS FISCAIS ----------------

function NotasAdmin({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: obras = [] } = useQuery(obrasQueryOptions(userId));
  const inserir = useServerFn(inserirNotaManual);

  const [obraSel, setObraSel] = useState("");
  const [chave, setChave] = useState("");
  const [numero, setNumero] = useState("");
  const [emissao, setEmissao] = useState("");
  const [emissor, setEmissor] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [placa, setPlaca] = useState("");
  const [uf, setUf] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState<number | "">("");

  const { data: notas = [] } = useQuery({
    queryKey: ["notas", obraSel],
    enabled: !!obraSel,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("id, chave, numero, emissor, transportadora, placa, uf, descricao, peso, emissao, fonte, created_at")
        .eq("obra_id", obraSel)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: () =>
      inserir({
        data: {
          obraId: obraSel,
          chave: chave.replace(/\D/g, ""),
          numero: numero || undefined,
          emissao: emissao || undefined,
          emissor: emissor || undefined,
          transportadora: transportadora || undefined,
          placa: placa || undefined,
          uf: uf || undefined,
          descricao: descricao || undefined,
          peso: peso === "" ? null : Number(peso),
        },
      }),
    onSuccess: () => {
      toast.success("Nota inserida no cache SEFAZ.");
      setChave(""); setNumero(""); setEmissao(""); setEmissor("");
      setTransportadora(""); setPlaca(""); setUf(""); setDescricao(""); setPeso("");
      qc.invalidateQueries({ queryKey: ["notas", obraSel] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Inserir NF-e manualmente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border border-wine-100 bg-wine-50 p-2 text-xs text-primary">
            Popula o cache local usado no lookup "Buscar SEFAZ". Útil enquanto a varredura
            automática não estiver ativa.
          </div>
          <div className="space-y-1.5">
            <Label>Obra</Label>
            <Select value={obraSel} onValueChange={setObraSel}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Chave (44 dígitos)</Label>
            <Input value={chave} onChange={(e) => setChave(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Nº</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Emissão</Label><Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Emissor</Label><Input value={emissor} onChange={(e) => setEmissor(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Transportadora</Label><Input value={transportadora} onChange={(e) => setTransportadora(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Placa</Label><Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} /></div>
            <div className="space-y-1.5"><Label>UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Peso (kg)</Label><Input type="number" value={peso} onChange={(e) => setPeso(e.target.value === "" ? "" : Number(e.target.value))} /></div>
          <Button onClick={() => criar.mutate()} disabled={!obraSel || criar.isPending}>
            {criar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Adicionar ao cache
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader><CardTitle className="text-base">Notas no cache {obraSel ? `(${notas.length})` : ""}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!obraSel ? (
            <div className="p-6 text-xs text-muted-foreground">Selecione uma obra para listar.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Chave</th>
                    <th className="px-3 py-2">Nº</th>
                    <th className="px-3 py-2">Emissor</th>
                    <th className="px-3 py-2">Placa</th>
                    <th className="px-3 py-2">Peso</th>
                    <th className="px-3 py-2">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map((n) => (
                    <tr key={n.id} className="border-b">
                      <td className="px-3 py-2 font-mono text-[10px]">{n.chave.slice(0, 8)}…{n.chave.slice(-6)}</td>
                      <td className="px-3 py-2">{n.numero ?? "—"}</td>
                      <td className="px-3 py-2">{n.emissor ?? "—"}</td>
                      <td className="px-3 py-2">{n.placa ?? "—"}</td>
                      <td className="px-3 py-2">{n.peso ? `${n.peso} kg` : "—"}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{n.fonte}</Badge></td>
                    </tr>
                  ))}
                  {notas.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem notas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- SEFAZ ----------------

function SefazAdmin({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: obras = [] } = useQuery(obrasQueryOptions(userId));
  const { data: certs = [] } = useQuery({
    queryKey: ["sefaz-certs"],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sefaz_certificados").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [obraSel, setObraSel] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nomeArq, setNomeArq] = useState("");
  const [ambiente, setAmbiente] = useState<"producao" | "homologacao">("producao");

  const criar = useMutation({
    mutationFn: async () => {
      if (!obraSel || !cnpj) throw new Error("Selecione obra e informe CNPJ.");
      const { error } = await supabase.from("sefaz_certificados").insert({
        obra_id: obraSel,
        cnpj: cnpj.replace(/\D/g, ""),
        certificado_nome: nomeArq || null,
        ambiente,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado registrado. Envie o .pfx e a senha a um administrador do banco para o Vault.");
      setCnpj(""); setNomeArq("");
      qc.invalidateQueries({ queryKey: ["sefaz-certs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sefaz_certificados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sefaz-certs"] }),
  });

  const nomeObra = (id: string) => obras.find((o) => o.id === id)?.nome ?? id;

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Novo certificado (.pfx)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border border-wine-100 bg-wine-50 p-2 text-xs text-primary">
            Aqui você registra o metadado. O .pfx e a senha vão para o Vault do banco por um
            administrador (nunca trafegam pelo cliente). Sem isso, a varredura fica ociosa.
          </div>
          <div className="space-y-1.5">
            <Label>Obra</Label>
            <Select value={obraSel} onValueChange={setObraSel}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Ambiente</Label>
              <Select value={ambiente} onValueChange={(v) => setAmbiente(v as "producao" | "homologacao")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="producao">Produção</SelectItem>
                  <SelectItem value="homologacao">Homologação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome de referência (opcional)</Label>
            <Input value={nomeArq} onChange={(e) => setNomeArq(e.target.value)} />
          </div>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
            {criar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Registrar certificado
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Certificados ({certs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {certs.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border p-2">
              <div>
                <div className="text-sm font-medium">{c.certificado_nome ?? c.cnpj}</div>
                <div className="text-xs text-muted-foreground">
                  {nomeObra(c.obra_id)} · CNPJ {c.cnpj} · {c.ambiente}
                  {c.ultimo_nsu ? ` · NSU ${c.ultimo_nsu}` : " · sem varredura ainda"}
                  {c.vault_secret_name ? " · Vault OK" : " · aguardando Vault"}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remover.mutate(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {certs.length === 0 && <div className="text-xs text-muted-foreground">Nenhum certificado.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- TESTE E-MAIL (Super Admin) ----------------

function TesteEmailResend({ defaultTo }: { defaultTo: string }) {
  const enviar = useServerFn(enviarEmailResend);
  const [para, setPara] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [assunto, setAssunto] = useState("Teste de e-mail — Portal de Pesagem");
  const [corpo, setCorpo] = useState(
    "Este é um e-mail de teste enviado pelo Portal de Pesagem via Resend (imobsystems.com.br).\n\nSe você recebeu esta mensagem, o envio de notificações está funcionando corretamente.",
  );

  const mut = useMutation({
    mutationFn: async () => {
      const ccList = cc
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return enviar({
        data: {
          para: [para.trim()],
          ...(ccList.length > 0 ? { cc: ccList } : {}),
          assunto: assunto.trim(),
          corpoTexto: corpo,
        },
      });
    },
    onSuccess: (r) => toast.success(`E-mail enviado com sucesso. ID: ${r.id || "—"}`),
    onError: (e) => toast.error(`Falha ao enviar: ${e instanceof Error ? e.message : "erro"}`),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Teste de envio de e-mail (Resend)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-wine-100 bg-wine-50 p-3 text-xs text-primary">
          Remetente: <strong>nao-responda@imobsystems.com.br</strong> · Gateway: <strong>Resend</strong>
        </div>
        <div className="grid gap-1">
          <Label>Destinatário</Label>
          <Input type="email" value={para} onChange={(e) => setPara(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>C.C. (opcional)</Label>
          <Input
            type="text"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="separe múltiplos e-mails por vírgula"
          />
        </div>
        <div className="grid gap-1">
          <Label>Assunto</Label>
          <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>Mensagem</Label>
          <Textarea rows={6} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !para.trim() || !assunto.trim() || !corpo.trim()}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar e-mail de teste
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

