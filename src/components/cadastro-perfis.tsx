import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listarUsuarios } from "@/lib/admin.functions";
import { PERFIS, type AppRoleKey } from "@/lib/permissoes-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Descricao = { role: string; nome: string; descricao: string | null; ordem: number };

export function CadastroPerfis() {
  const qc = useQueryClient();
  const listar = useServerFn(listarUsuarios);
  const [editando, setEditando] = useState<Descricao | null>(null);
  const [texto, setTexto] = useState("");
  const [detalhe, setDetalhe] = useState<AppRoleKey | null>(null);

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ["perfil-descricoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfil_descricoes")
        .select("role, nome, descricao, ordem")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Descricao[];
    },
  });

  const { data: usuarios = [], error: usuariosErro } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: () => listar(),
    staleTime: 60_000,
    retry: false,
  });

  const contagem = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const u of usuarios) {
      for (const r of u.roles) {
        const arr = map.get(r) ?? [];
        arr.push(u.display_name ?? u.email);
        map.set(r, arr);
      }
    }
    return map;
  }, [usuarios]);

  const salvar = useMutation({
    mutationFn: async ({ role, descricao }: { role: string; descricao: string }) => {
      const { error } = await supabase
        .from("perfil_descricoes")
        .update({ descricao })
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Descrição atualizada.");
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["perfil-descricoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const lista = perfis.length
    ? perfis
    : PERFIS.map((p, i) => ({ role: p.role, nome: p.nome, descricao: null, ordem: i }));

  return (
    <div className="mt-4 space-y-4">
      {usuariosErro && (
        <div className="rounded border border-dashed border-warning/30 bg-warning-soft p-3 text-xs text-warning">
          Não foi possível carregar a lista de usuários vinculados aos perfis: seu usuário não tem permissão administrativa.
        </div>
      )}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Perfis do sistema ({lista.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando perfis...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Perfil</th>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Usuários</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => {
                    const users = contagem.get(p.role) ?? [];
                    return (
                      <tr key={p.role} className="border-b align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium">{p.nome}</div>
                          <div className="text-[10px] uppercase text-muted-foreground">{p.role}</div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{p.descricao ?? "—"}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline">{users.length}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-[11px]"
                              onClick={() => setDetalhe(p.role as AppRoleKey)}
                            >
                              <Users className="h-3 w-3" /> Ver usuários
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-[11px]"
                              onClick={() => {
                                setEditando(p as Descricao);
                                setTexto(p.descricao ?? "");
                              }}
                            >
                              <Pencil className="h-3 w-3" /> Editar descrição
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descrição — {editando?.nome}</DialogTitle>
          </DialogHeader>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button
              className="bg-primary text-white hover:bg-primary-hover"
              disabled={salvar.isPending}
              onClick={() => editando && salvar.mutate({ role: editando.role, descricao: texto.trim() })}
            >
              {salvar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Usuários — {lista.find((p) => p.role === detalhe)?.nome ?? detalhe}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto text-sm">
            {(contagem.get(detalhe ?? "") ?? []).map((n) => (
              <div key={n} className="rounded border px-3 py-2">{n}</div>
            ))}
            {(contagem.get(detalhe ?? "") ?? []).length === 0 && (
              <div className="text-muted-foreground">Nenhum usuário com este perfil.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
