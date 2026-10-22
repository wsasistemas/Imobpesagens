import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Pencil, Plus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type ObraCadastro = {
  id: string;
  nome: string;
  cnpj: string;
  coligada: string;
  ativo: boolean;
  endereco: string | null;
  engenheiro_nome: string | null;
  engenheiro_email: string | null;
};

const SELECT_COLS = "id, nome, cnpj, coligada, ativo, endereco, engenheiro_nome, engenheiro_email";

function soDigitos(v: string) {
  return v.replace(/\D+/g, "");
}

function mascaraCnpj(v: string) {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function cnpjValido(v: string) {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string, pesoInicial: number) => {
    let soma = 0;
    let peso = pesoInicial;
    for (const ch of base) {
      soma += Number(ch) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12), 5);
  const d2 = calc(c.slice(0, 12) + String(d1), 6);
  return c.endsWith(`${d1}${d2}`);
}

const schema = z.object({
  nome: z.string().trim().min(3, "Informe o nome / razão social (mín. 3 caracteres).").max(160),
  coligada: z.string().trim().max(80).optional(),
  cnpj: z.string().trim().refine(cnpjValido, "CNPJ inválido."),
  endereco: z.string().trim().max(240).optional(),
  engenheiro_nome: z.string().trim().max(120).optional(),
  engenheiro_email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "E-mail do engenheiro inválido."),
});

type FormState = {
  id: string | null;
  nome: string;
  coligada: string;
  cnpj: string;
  endereco: string;
  engenheiro_nome: string;
  engenheiro_email: string;
  ativo: boolean;
};

const FORM_VAZIO: FormState = {
  id: null, nome: "", coligada: "", cnpj: "", endereco: "",
  engenheiro_nome: "", engenheiro_email: "", ativo: true,
};

export function CadastroObras() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ["obras-cadastro"],
    queryFn: async (): Promise<ObraCadastro[]> => {
      const { data, error } = await supabase.from("obras").select(SELECT_COLS).order("nome");
      if (error) throw error;
      return (data ?? []) as ObraCadastro[];
    },
  });

  const cnpjsExistentes = useMemo(
    () => new Map(obras.map((o) => [soDigitos(o.cnpj ?? ""), o.id])),
    [obras],
  );

  async function invalidar() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["obras-cadastro"] }),
      qc.invalidateQueries({ queryKey: ["obras"], refetchType: "all" }),
    ]);
  }

  const salvarMut = useMutation({
    mutationFn: async (f: FormState) => {
      const parsed = schema.safeParse({
        nome: f.nome,
        coligada: f.coligada,
        cnpj: f.cnpj,
        endereco: f.endereco,
        engenheiro_nome: f.engenheiro_nome,
        engenheiro_email: f.engenheiro_email,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");

      const cnpjDigitos = soDigitos(f.cnpj);
      const dono = cnpjsExistentes.get(cnpjDigitos);
      if (dono && dono !== f.id) throw new Error("Já existe uma obra cadastrada com este CNPJ.");

      const payload = {
        nome: parsed.data.nome,
        coligada: parsed.data.coligada?.trim() || parsed.data.nome,
        cnpj: mascaraCnpj(f.cnpj),
        endereco: parsed.data.endereco?.trim() || null,
        engenheiro_nome: parsed.data.engenheiro_nome?.trim() || null,
        engenheiro_email: parsed.data.engenheiro_email?.trim().toLowerCase() || null,
        ativo: f.ativo,
      };

      if (f.id) {
        const { error } = await supabase.from("obras").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obras").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(form?.id ? "Obra atualizada." : "Obra cadastrada.");
      setForm(null);
      await invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a obra."),
  });

  const situacaoMut = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("obras").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Situação da obra atualizada.");
      await invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível alterar a situação."),
  });

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> Cadastro de obras
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Obras inativas deixam de aparecer no seletor de obras, sem afetar o histórico de pesagens.
          </p>
        </div>
        <Button size="sm" onClick={() => setForm({ ...FORM_VAZIO })}>
          <Plus className="mr-1 h-4 w-4" /> Nova obra
        </Button>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Nome / Razão social</th>
                <th className="p-2 text-left">CNPJ</th>
                <th className="p-2 text-left">Endereço</th>
                <th className="p-2 text-left">Engenheiro responsável</th>
                <th className="p-2 text-left">E-mail</th>
                <th className="p-2 text-left">Situação</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando obras…</td></tr>
              ) : obras.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma obra cadastrada.</td></tr>
              ) : (
                obras.map((o) => (
                  <tr key={o.id} className="border-t align-top">
                    <td className="p-2 font-medium">{o.nome}</td>
                    <td className="p-2 tabular-nums">{o.cnpj}</td>
                    <td className="p-2 max-w-[260px]">{o.endereco ?? "—"}</td>
                    <td className="p-2">{o.engenheiro_nome ?? "—"}</td>
                    <td className="p-2">{o.engenheiro_email ?? "—"}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={o.ativo}
                          disabled={situacaoMut.isPending}
                          onCheckedChange={(v) => situacaoMut.mutate({ id: o.id, ativo: v })}
                          aria-label="Ativar ou inativar obra"
                        />
                        <Badge variant={o.ativo ? "default" : "secondary"}>{o.ativo ? "Ativa" : "Inativa"}</Badge>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setForm({
                            id: o.id,
                            nome: o.nome ?? "",
                            coligada: o.coligada ?? "",
                            cnpj: o.cnpj ?? "",
                            endereco: o.endereco ?? "",
                            engenheiro_nome: o.engenheiro_nome ?? "",
                            engenheiro_email: o.engenheiro_email ?? "",
                            ativo: o.ativo,
                          })
                        }
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar obra" : "Nova obra"}</DialogTitle>
            <DialogDescription>Dados cadastrais da obra e do engenheiro responsável.</DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="obra-nome">Nome / Razão social *</Label>
                <Input
                  id="obra-nome"
                  value={form.nome}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Construtora Exemplo Ltda"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="obra-cnpj">CNPJ *</Label>
                  <Input
                    id="obra-cnpj"
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: mascaraCnpj(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="obra-coligada">Coligada</Label>
                  <Input
                    id="obra-coligada"
                    value={form.coligada}
                    maxLength={80}
                    onChange={(e) => setForm({ ...form, coligada: e.target.value })}
                    placeholder="Ex.: Coligada 01"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="obra-endereco">Endereço</Label>
                <Input
                  id="obra-endereco"
                  value={form.endereco}
                  maxLength={240}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Rua, número, bairro, cidade/UF"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="obra-eng">Nome do engenheiro responsável</Label>
                  <Input
                    id="obra-eng"
                    value={form.engenheiro_nome}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, engenheiro_nome: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="obra-eng-email">E-mail do engenheiro</Label>
                  <Input
                    id="obra-eng-email"
                    type="email"
                    value={form.engenheiro_email}
                    maxLength={160}
                    onChange={(e) => setForm({ ...form, engenheiro_email: e.target.value })}
                    placeholder="engenheiro@empresa.com.br"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border p-3">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                  aria-label="Obra ativa"
                />
                <span className="text-xs text-muted-foreground">
                  {form.ativo ? "Obra ativa (aparece no seletor de obras)" : "Obra inativa"}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={salvarMut.isPending} onClick={() => form && salvarMut.mutate(form)}>
              {salvarMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
