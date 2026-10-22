import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MENUS, PADRAO, PERFIS, type AppRoleKey, type MenuKey } from "@/lib/permissoes-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Matriz = Record<string, Record<string, boolean>>;

function toMatriz(rows: { role: string; menu_key: string; permitido: boolean }[]): Matriz {
  const m: Matriz = {};
  for (const p of PERFIS) m[p.role] = { ...PADRAO[p.role] };
  for (const r of rows) {
    m[r.role] = { ...(m[r.role] ?? {}), [r.menu_key]: r.permitido };
  }
  return m;
}

export function PermissoesMenu() {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Matriz | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["perfil-menu-permissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfil_menu_permissoes")
        .select("role, menu_key, permitido");
      if (error) throw error;
      return toMatriz(data ?? []);
    },
  });

  useEffect(() => {
    if (data) setLocal(data);
  }, [data]);

  const matriz = local ?? data ?? null;

  const alterado = useMemo(() => {
    if (!matriz || !data) return false;
    return JSON.stringify(matriz) !== JSON.stringify(data);
  }, [matriz, data]);

  const salvar = useMutation({
    mutationFn: async (m: Matriz) => {
      const rows = PERFIS.flatMap((p) =>
        MENUS.map((menu) => ({
          role: p.role,
          menu_key: menu.key,
          permitido: p.role === "superadmin" ? true : !!m[p.role]?.[menu.key],
        })),
      );
      const { error } = await supabase
        .from("perfil_menu_permissoes")
        .upsert(rows, { onConflict: "role,menu_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões salvas.");
      qc.invalidateQueries({ queryKey: ["perfil-menu-permissoes"] });
      qc.invalidateQueries({ queryKey: ["menus-permitidos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar permissões."),
  });

  const toggle = (role: AppRoleKey, menu: MenuKey) => {
    if (role === "superadmin") return;
    setLocal((prev) => {
      const base = prev ?? data ?? ({} as Matriz);
      return { ...base, [role]: { ...(base[role] ?? {}), [menu]: !base[role]?.[menu] } };
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Permissões por menu
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-[11px]"
                onClick={() => setLocal(JSON.parse(JSON.stringify(PADRAO)) as Matriz)}
              >
                <RotateCcw className="h-3 w-3" /> Restaurar padrão
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1 bg-primary text-white hover:bg-primary-hover"
                disabled={!matriz || salvar.isPending || !alterado}
                onClick={() => matriz && salvar.mutate(matriz)}
              >
                {salvar.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Salvar permissões
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || !matriz ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando permissões...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Menu</th>
                    {PERFIS.map((p) => (
                      <th key={p.role} className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {p.nome}
                          {p.role === "superadmin" && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MENUS.map((menu) => (
                    <tr key={menu.key} className="border-b">
                      <td className="px-3 py-3">
                        <div className="font-medium">{menu.nome}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">{menu.grupo}</div>
                      </td>
                      {PERFIS.map((p) => (
                        <td key={p.role} className="px-3 py-3 text-center">
                          <Checkbox
                            checked={p.role === "superadmin" ? true : !!matriz[p.role]?.[menu.key]}
                            disabled={p.role === "superadmin"}
                            onCheckedChange={() => toggle(p.role, menu.key)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        O perfil SuperAdmin tem acesso a todos os menus e não pode ser alterado. As mudanças passam a valer
        no menu lateral assim que forem salvas.
      </p>
    </div>
  );
}
