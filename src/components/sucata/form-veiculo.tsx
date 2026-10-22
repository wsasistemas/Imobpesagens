import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { salvarVeiculo, veiculosQueryOptions } from "@/lib/sucata/sucata-queries";
import { CLASSE_NUM, type VeiculoRow } from "@/lib/sucata/tipos";
import { formatarKg, normalizarPlaca } from "@/lib/sucata/validadores";

export function VeiculosSucateiro({ sucateiroId }: { sucateiroId: string }) {
  const qc = useQueryClient();
  const { data: veiculos = [] } = useQuery(veiculosQueryOptions(sucateiroId));
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<VeiculoRow | null>(null);

  const [placa, setPlaca] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [motorista, setMotorista] = useState("");
  const [situacao, setSituacao] = useState("ATIVO");

  useEffect(() => {
    if (!aberto) return;
    setPlaca(edicao?.placa ?? "");
    setTipoVeiculo(edicao?.tipo_veiculo ?? "");
    setCapacidade(edicao?.capacidade_kg ? String(edicao.capacidade_kg) : "");
    setMotorista(edicao?.motorista_habitual ?? "");
    setSituacao(edicao?.situacao ?? "ATIVO");
  }, [aberto, edicao]);

  const salvar = useMutation({
    mutationFn: async () => {
      const pl = normalizarPlaca(placa);
      if (pl.length < 7) throw new Error("Informe a placa completa.");
      return salvarVeiculo(
        {
          sucateiro_id: sucateiroId,
          placa: pl,
          tipo_veiculo: tipoVeiculo.trim() || null,
          capacidade_kg: capacidade ? Number(capacidade) : null,
          motorista_habitual: motorista.trim() || null,
          situacao,
        },
        edicao?.id ?? null,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata", "veiculos"] });
      toast.success("Veículo salvo.");
      setAberto(false);
      setEdicao(null);
    },
    onError: (e: { message?: string }) => {
      const msg = e.message ?? "";
      toast.error(
        msg.includes("sucata_veiculos_placa_ativa_uidx")
          ? "Esta placa já está ativa em outro veículo."
          : msg || "Não foi possível salvar o veículo.",
      );
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEdicao(null); setAberto(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo veículo
        </Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Placa</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Capacidade (kg)</th>
              <th className="p-2 text-left">Motorista habitual</th>
              <th className="p-2 text-left">Situação</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {veiculos.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum veículo cadastrado.</td></tr>
            )}
            {veiculos.map((v) => (
              <tr key={v.id} className="border-t">
                <td className={`p-2 font-semibold ${CLASSE_NUM}`}>{v.placa}</td>
                <td className="p-2">{v.tipo_veiculo ?? "—"}</td>
                <td className={`p-2 ${CLASSE_NUM}`}>{formatarKg(v.capacidade_kg)}</td>
                <td className="p-2">{v.motorista_habitual ?? "—"}</td>
                <td className="p-2">
                  <Badge variant="outline" className={v.situacao === "ATIVO"
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-primary-dark/30 bg-primary-dark/10 text-primary-dark"}>
                    {v.situacao === "ATIVO" ? "Ativo" : "Bloqueado"}
                  </Badge>
                </td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEdicao(v); setAberto(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{edicao ? "Editar veículo" : "Novo veículo"}</DialogTitle>
            <DialogDescription>A mesma placa não pode estar ativa em dois veículos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Placa</Label>
              <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} className={CLASSE_NUM} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Tipo de veículo</Label>
              <Input value={tipoVeiculo} onChange={(e) => setTipoVeiculo(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Capacidade (kg)</Label>
              <Input type="number" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} className={CLASSE_NUM} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Motorista habitual</Label>
              <Input value={motorista} onChange={(e) => setMotorista(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Situação</Label>
              <Select value={situacao} onValueChange={setSituacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
