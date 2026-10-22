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
import { contasObraQueryOptions, salvarContaObra } from "@/lib/sucata/sucata-queries";
import { CLASSE_NUM, TIPOS_CONTA, type ContaObraRow } from "@/lib/sucata/tipos";

type Props = { obraId: string | null; podeEditar: boolean };

const VAZIO = {
  banco: "",
  agencia: "",
  conta: "",
  tipo_conta: TIPOS_CONTA[0]!,
  titular: "",
  titular_documento: "",
  chave_pix: "",
  observacoes: "",
  ativa: true,
};

export function CadastroContasObra({ obraId, podeEditar }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const { data: contas = [] } = useQuery(contasObraQueryOptions(obraId));
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<ContaObraRow | null>(null);
  const [form, setForm] = useState(VAZIO);

  const obra = obras.find((o) => o.id === obraId) ?? null;

  useEffect(() => {
    if (!aberto) return;
    setForm(
      edicao
        ? {
            banco: edicao.banco,
            agencia: edicao.agencia,
            conta: edicao.conta,
            tipo_conta: edicao.tipo_conta,
            titular: edicao.titular,
            titular_documento: edicao.titular_documento ?? "",
            chave_pix: edicao.chave_pix ?? "",
            observacoes: edicao.observacoes ?? "",
            ativa: edicao.situacao === "ATIVA",
          }
        : VAZIO,
    );
  }, [aberto, edicao]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!obraId || !obra) throw new Error("Selecione a obra no topo da tela.");
      if (!form.banco.trim() || !form.agencia.trim() || !form.conta.trim() || !form.titular.trim()) {
        throw new Error("Banco, agência, conta e titular são obrigatórios.");
      }
      return salvarContaObra(
        {
          obra_id: obraId,
          coligada_origem: obra.coligada,
          banco: form.banco.trim(),
          agencia: form.agencia.trim(),
          conta: form.conta.trim(),
          tipo_conta: form.tipo_conta,
          titular: form.titular.trim(),
          titular_documento: form.titular_documento.trim() || null,
          chave_pix: form.chave_pix.trim() || null,
          observacoes: form.observacoes.trim() || null,
          situacao: form.ativa ? "ATIVA" : "INATIVA",
        },
        edicao?.id ?? null,
      );
    },
    onSuccess: () => {
      toast.success("Conta da obra salva.");
      qc.invalidateQueries({ queryKey: ["sucata", "contas-obra"] });
      setAberto(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="font-heading text-base">Contas bancárias da obra</CardTitle>
          <p className="text-sm text-muted-foreground">
            São as contas aceitas no comprovante de pagamento da sucata. Contas fora de uso ficam INATIVAS.
          </p>
        </div>
        {podeEditar && (
          <Button
            onClick={() => {
              setEdicao(null);
              setAberto(true);
            }}
            disabled={!obraId}
          >
            <Plus className="mr-2 h-4 w-4" /> Nova conta
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!obraId && <p className="text-sm text-muted-foreground">Selecione a obra no topo da tela.</p>}
        {obraId && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Banco</th>
                  <th className="p-2 text-left">Agência</th>
                  <th className="p-2 text-left">Conta</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Titular</th>
                  <th className="p-2 text-left">Situação</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {contas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      Nenhuma conta cadastrada para esta obra.
                    </td>
                  </tr>
                )}
                {contas.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2 font-medium">{c.banco}</td>
                    <td className={`p-2 ${CLASSE_NUM}`}>{c.agencia}</td>
                    <td className={`p-2 ${CLASSE_NUM}`}>{c.conta}</td>
                    <td className="p-2">{c.tipo_conta}</td>
                    <td className="p-2">{c.titular}</td>
                    <td className="p-2">
                      {c.situacao === "ATIVA" ? (
                        <Badge className="border-success/30 bg-success-soft text-success" variant="outline">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge className="border-warning/30 bg-warning-soft text-warning" variant="outline">
                          Inativa
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {podeEditar && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEdicao(c);
                            setAberto(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {edicao ? "Editar conta da obra" : "Nova conta da obra"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Banco" valor={form.banco} onChange={(v) => setForm({ ...form, banco: v })} />
            <Campo rotulo="Tipo de conta" valor={form.tipo_conta} onChange={(v) => setForm({ ...form, tipo_conta: v })} />
            <Campo rotulo="Agência" valor={form.agencia} onChange={(v) => setForm({ ...form, agencia: v })} mono />
            <Campo rotulo="Conta" valor={form.conta} onChange={(v) => setForm({ ...form, conta: v })} mono />
            <Campo rotulo="Titular" valor={form.titular} onChange={(v) => setForm({ ...form, titular: v })} />
            <Campo
              rotulo="CNPJ / CPF do titular"
              valor={form.titular_documento}
              onChange={(v) => setForm({ ...form, titular_documento: v })}
              mono
            />
            <Campo rotulo="Chave PIX" valor={form.chave_pix} onChange={(v) => setForm({ ...form, chave_pix: v })} />
            <Campo
              rotulo="Observações"
              valor={form.observacoes}
              onChange={(v) => setForm({ ...form, observacoes: v })}
            />
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: v })} />
              <span className="text-sm">Conta ativa</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  mono,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{rotulo}</Label>
      <Input value={valor} onChange={(e) => onChange(e.target.value)} className={mono ? CLASSE_NUM : undefined} />
    </div>
  );
}
