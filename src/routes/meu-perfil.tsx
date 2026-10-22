import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { IdCard, KeyRound, Loader2, ShieldAlert, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getMyProfile, updateMyProfile } from "@/lib/ocorrencia.functions";

export const Route = createFileRoute("/meu-perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Portal de Pesagem" }] }),
  component: MeuPerfilPage,
});

function MeuPerfilPage() {
  const [obraId, setObraId] = useObraAtual();
  const { user, displayName, isAdmin, isOperador, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getPerfilFn = useServerFn(getMyProfile);
  const updatePerfilFn = useServerFn(updateMyProfile);

  const { data: perfil } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getPerfilFn(),
    staleTime: 5 * 60_000,
  });

  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome ?? displayName ?? "");
      setCargo(perfil.cargo ?? "");
      setSetor(perfil.setor ?? "");
      setTelefone(perfil.telefone ?? "");
    }
  }, [perfil, displayName]);

  const salvarPerfil = useMutation({
    mutationFn: async () => {
      await updatePerfilFn({
        data: {
          nome: nome.trim() || null,
          cargo: cargo.trim() || null,
          setor: setor.trim() || null,
          telefone: telefone.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar perfil."),
  });

  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");

  const alterar = useMutation({
    mutationFn: async () => {
      if (senha.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
      if (senha !== conf) throw new Error("As senhas não conferem.");
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { must_change_password: false },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Senha atualizada com sucesso.");
      setSenha("");
      setConf("");
      navigate({ to: "/pesagem" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar senha."),
  });

  return (
    <AppShell obraId={obraId} onObraChange={setObraId}>
      <div className="mx-auto max-w-4xl p-4 lg:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">Seus dados e segurança da conta.</p>

        {mustChangePassword && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Sua senha é provisória.</div>
              <div className="text-xs">Defina uma nova senha para continuar usando o Portal.</div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle2 className="h-4 w-4 text-primary" /> Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">E-mail</div>
                <div className="font-medium">{user?.email ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Perfil</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {isAdmin && (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">Admin</Badge>
                  )}
                  {isOperador && (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">Operador</Badge>
                  )}
                  {!isAdmin && !isOperador && <Badge variant="outline">Sem perfil</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <IdCard className="h-4 w-4 text-primary" /> Dados para assinatura de e-mail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João da Silva" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Cargo</Label>
                  <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Portaria" />
                </div>
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex.: Recebimento" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 90000-0000"
                />
              </div>
              <Button
                className="w-full bg-primary text-white hover:bg-primary-hover"
                onClick={() => salvarPerfil.mutate()}
                disabled={salvarPerfil.isPending}
              >
                {salvarPerfil.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Salvar dados do perfil
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" /> Alterar senha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={conf}
                  onChange={(e) => setConf(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  className="w-full bg-primary text-white hover:bg-primary-hover md:w-auto"
                  onClick={() => alterar.mutate()}
                  disabled={alterar.isPending || !senha || !conf}
                >
                  {alterar.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-1 h-4 w-4" />
                  )}
                  Salvar nova senha
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
