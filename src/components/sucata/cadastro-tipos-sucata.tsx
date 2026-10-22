import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { salvarTipoSucata, tiposSucataQueryOptions } from "@/lib/sucata/sucata-queries";
import { CLASSE_NUM, type TipoSucataRow } from "@/lib/sucata/tipos";

function fmtBRL(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CadastroTiposSucata({ podeEditar }: { podeEditar: boolean }) {
  const qc = useQueryClient();
  const { data: tipos = [] } = useQuery(tiposSucataQueryOptions());
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<TipoSucataRow | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [ativo, setAtivo] = useState(true);
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setCodigo(edicao?.codigo ?? "");
    setNome(edicao?.nome ?? "");
    setOrdem(String(edicao?.ordem ?? tipos.length + 1));
    setAtivo(edicao?.ativo ?? true);
    setValorMin(edicao?.valor_ton_min !== null && edicao?.valor_ton_min !== undefined ? String(edicao.valor_ton_min) : "");
    setValorMax(edicao?.valor_ton_max !== null && edicao?.valor_ton_max !== undefined ? String(edicao.valor_ton_max) : "");
  }, [aberto, edicao, tipos.length]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!codigo.trim() || !nome.trim()) throw new Error("Código e nome são obrigatórios.");
      const min = valorMin.trim() === "" ? null : Number(valorMin.replace(",", "."));
      const max = valorMax.trim() === "" ? null : Number(valorMax.replace(",", "."));
      if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max)))
        throw new Error("Faixa de referência inválida.");
      if (min !== null && max !== null && min > max)
        throw new Error("O valor mínimo por tonelada não pode ser maior que o máximo.");
      return salvarTipoSucata(
        {
          codigo: codigo.trim().toUpperCase(),
          nome: nome.trim(),
          ordem: Number(ordem) || 0,
          ativo,
          valor_ton_min: valorMin.trim() === "" ? null : Number(valorMin.replace(",", ".")),
          valor_ton_max: valorMax.trim() === "" ? null : Number(valorMax.replace(",", ".")),
        },
        edicao?.id ?? null,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata", "tipos"] });
      toast.success("Tipo de sucata salvo.");
      setAberto(false);
      setEdicao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="font-heading text-base">Tipos de sucata</CardTitle>
        {podeEditar && (
          <Button size="sm" onClick={() => { setEdicao(null); setAberto(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo tipo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Ordem</th>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Faixa R$/t</th>
                <th className="p-2 text-left">Situação</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className={`p-2 ${CLASSE_NUM}`}>{t.ordem}</td>
                  <td className={`p-2 ${CLASSE_NUM}`}>{t.codigo}</td>
                  <td className="p-2">{t.nome}</td>
                  <td className={`p-2 ${CLASSE_NUM}`}>
                    {t.valor_ton_min === null && t.valor_ton_max === null
                      ? "—"
                      : `${fmtBRL(t.valor_ton_min)} a ${fmtBRL(t.valor_ton_max)}`}
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className={t.ativo
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-warning/30 bg-warning-soft text-warning"}>
                      {t.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="p-2 text-right">
                    {podeEditar && (
                      <Button size="sm" variant="ghost" onClick={() => { setEdicao(t); setAberto(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{edicao ? "Editar tipo" : "Novo tipo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="mb-1 block text-xs">Código</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={CLASSE_NUM} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Ordem</Label>
              <Input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className={CLASSE_NUM} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Valor mínimo por tonelada (R$)</Label>
                <Input inputMode="decimal" value={valorMin} onChange={(e) => setValorMin(e.target.value)} className={CLASSE_NUM} placeholder="Opcional" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Valor máximo por tonelada (R$)</Label>
                <Input inputMode="decimal" value={valorMax} onChange={(e) => setValorMax(e.target.value)} className={CLASSE_NUM} placeholder="Opcional" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A faixa serve só de referência: se o valor informado pelo sucateiro ficar fora dela, ele recebe um aviso e o
              processo é marcado para conferência.
            </p>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <span className="text-sm">Ativo</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
