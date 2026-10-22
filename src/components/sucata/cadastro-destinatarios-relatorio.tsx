import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { obrasQueryOptions } from "@/lib/pesagem-queries";
import { useAuth } from "@/hooks/useAuth";
import {
  destinatariosRelatorioQueryOptions,
  salvarDestinatarioRelatorio,
  type DestinatarioRow,
} from "@/lib/sucata/relatorio-queries";
import { CORES_STATUS } from "@/lib/sucata/tipos";

const VAZIO = { nome: "", email: "", papel: "", ativo: true };

export function CadastroDestinatariosRelatorio({
  obraId,
  podeEditar,
}: {
  obraId: string | null;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const obra = obras.find((o) => o.id === obraId) ?? null;
  const coligada = obra?.coligada ?? null;
  const { data: lista = [] } = useQuery(destinatariosRelatorioQueryOptions(coligada));

  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<DestinatarioRow | null>(null);
  const [form, setForm] = useState(VAZIO);

  useEffect(() => {
    if (!aberto) return;
    setForm(
      edicao
        ? { nome: edicao.nome, email: edicao.email, papel: edicao.papel ?? "", ativo: edicao.ativo }
        : VAZIO,
    );
  }, [aberto, edicao]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!coligada) throw new Error("Selecione a obra no topo da tela.");
      if (!form.nome.trim()) throw new Error("Informe o nome do destinatário.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) throw new Error("E-mail inválido.");
      return salvarDestinatarioRelatorio(
        {
          coligada,
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          papel: form.papel.trim() || null,
          ativo: form.ativo,
        },
        edicao?.id ?? null,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata", "destinatarios-relatorio"] });
      toast.success("Destinatário salvo.");
      setAberto(false);
      setEdicao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <CardTitle className="font-heading text-base">
          Destinatários do relatório {coligada ? `— coligada ${coligada}` : ""}
        </CardTitle>
        {podeEditar && (
          <Button
            size="sm"
            className="bg-primary hover:bg-primary-dark"
            onClick={() => {
              setEdicao(null);
              setAberto(true);
            }}
            disabled={!coligada}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo destinatário
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {!coligada && <p className="text-sm text-muted-foreground">Selecione a obra no topo da tela.</p>}
        {coligada && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum destinatário cadastrado para esta coligada.</p>
        )}
        {lista.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <div className="mr-auto">
              <div className="font-medium">{d.nome}</div>
              <div className="text-muted-foreground">
                {d.email}
                {d.papel ? ` · ${d.papel}` : ""}
              </div>
            </div>
            <Badge variant="outline" className={d.ativo ? CORES_STATUS.concluido : CORES_STATUS.bloqueado}>
              {d.ativo ? "Ativo" : "Inativo"}
            </Badge>
            {podeEditar && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEdicao(d);
                  setAberto(true);
                }}
              >
                <Pencil className="mr-1 h-4 w-4" /> Editar
              </Button>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {edicao ? "Editar destinatário" : "Novo destinatário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Papel (opcional)</Label>
              <Input
                value={form.papel}
                onChange={(e) => setForm({ ...form, papel: e.target.value })}
                placeholder="Engenheiro responsável, administrativo, contabilidade..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <span className="text-sm">Ativo (recebe os relatórios)</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary-dark"
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
