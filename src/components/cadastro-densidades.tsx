import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Building2, Scale, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useDensidades, useFornecedoresSugestoes, type DensidadeMaterial, type UnidadeBase,
} from "@/lib/densidades";

const UNIDADES: { value: UnidadeBase; label: string; sufixo: string }[] = [
  { value: "M3", label: "M³ (sólido/volume)", sufixo: "kg/m³" },
  { value: "L", label: "L (líquido)", sufixo: "kg/L" },
  { value: "SC", label: "SC (saco)", sufixo: "kg por saco" },
];

const sufixoDe = (u: UnidadeBase) => UNIDADES.find((x) => x.value === u)?.sufixo ?? "";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function CadastroDensidades() {
  const { isAdmin } = useAuth();
  const {
    materiais, excecoes, isLoading,
    salvarMaterial, removerMaterial, salvarExcecao, removerExcecao,
  } = useDensidades();
  const { data: sugestoesFornecedor = [] } = useFornecedoresSugestoes();

  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Partial<DensidadeMaterial> | null>(null);
  const [palavras, setPalavras] = useState("");
  const [vincFornecedor, setVincFornecedor] = useState("");
  const [vincDens, setVincDens] = useState("");
  const [vincId, setVincId] = useState<string | null>(null);
  const [excMaterial, setExcMaterial] = useState<DensidadeMaterial | null>(null);
  const [excNome, setExcNome] = useState("");
  const [excDens, setExcDens] = useState<string>("");

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return materiais.filter(
      (m) =>
        !b ||
        m.material.toLowerCase().includes(b) ||
        (m.palavras_chave ?? []).some((p) => p.toLowerCase().includes(b)),
    );
  }, [materiais, busca]);

  const excecoesDe = (id: string) => excecoes.filter((e) => e.densidade_material_id === id);

  const limparVinculo = () => {
    setVincFornecedor("");
    setVincDens("");
    setVincId(null);
  };

  const abrirNovo = () => {
    setEdit({ material: "", palavras_chave: [], unidade_base: "M3", densidade: 0, ordem: 100, ativo: true });
    setPalavras("");
    limparVinculo();
  };

  const abrirEdicao = (m: DensidadeMaterial) => {
    setEdit({ ...m });
    setPalavras((m.palavras_chave ?? []).join("; "));
    const exc = excecoesDe(m.id);
    if (exc.length === 1) {
      setVincFornecedor(exc[0].fornecedor_nome);
      setVincDens(String(exc[0].densidade));
      setVincId(exc[0].id);
    } else {
      limparVinculo();
    }
  };

  const salvar = async () => {
    if (!edit) return;
    if (!String(edit.material ?? "").trim()) return toast.error("Informe o material.");
    const dens = Number(edit.densidade);
    if (!Number.isFinite(dens) || dens <= 0) return toast.error("Informe a densidade/peso.");
    const chaves = palavras.split(/[;,\n]/).map((p) => p.trim()).filter(Boolean);
    if (!chaves.length) return toast.error("Informe ao menos uma palavra-chave.");

    // Vínculo por fornecedor é opcional, mas os dois campos andam juntos.
    const vNome = vincFornecedor.trim();
    const vDens = Number(String(vincDens).replace(",", "."));
    const temNome = !!vNome;
    const temDens = String(vincDens).trim() !== "" && Number.isFinite(vDens) && vDens > 0;
    if (temNome !== temDens) {
      return toast.error("Preencha fornecedor e densidade, ou deixe ambos em branco.");
    }

    try {
      const materialId = await salvarMaterial.mutateAsync({
        ...edit,
        palavras_chave: chaves,
        densidade: dens,
      });
      if (temNome && temDens) {
        await salvarExcecao.mutateAsync({
          id: vincId ?? undefined,
          densidade_material_id: materialId,
          fornecedor_nome: vNome,
          densidade: vDens,
        });
      }
      toast.success("Densidade salva.");
      setEdit(null);
      limparVinculo();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    }
  };

  const salvarExc = async () => {
    if (!excMaterial) return;
    const dens = Number(String(excDens).replace(",", "."));
    if (!excNome.trim()) return toast.error("Informe o fornecedor.");
    if (!Number.isFinite(dens) || dens <= 0) return toast.error("Informe a densidade da exceção.");
    try {
      await salvarExcecao.mutateAsync({
        densidade_material_id: excMaterial.id,
        fornecedor_nome: excNome,
        densidade: dens,
      });
      toast.success("Exceção salva.");
      setExcNome("");
      setExcDens("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar a exceção.");
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Apenas Administradores e Super Admin podem manter o cadastro de densidades.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-primary" /> Densidades de materiais
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Usadas para converter itens da NF em kg. Precedência: carta de traço &gt; exceção do
              fornecedor &gt; densidade padrão do material.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-56 pl-8"
                placeholder="Buscar material..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" /> Novo material
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  {["Material", "Palavras-chave", "Un.", "Densidade", "Ordem", "Exceções", "Situação", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>Carregando...</td></tr>
                ) : lista.length === 0 ? (
                  <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>Nenhum material cadastrado.</td></tr>
                ) : lista.map((m) => {
                  const exc = excecoesDe(m.id);
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{m.material}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{(m.palavras_chave ?? []).join(" · ")}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{m.unidade_base}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(m.densidade)} {sufixoDe(m.unidade_base)}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{m.ordem}</td>
                      <td className="px-3 py-2">
                        <Button variant="outline" size="sm" onClick={() => { setExcMaterial(m); setExcNome(""); setExcDens(""); }}>
                          <Building2 className="mr-1 h-3.5 w-3.5" />
                          {exc.length ? `${exc.length}` : "Nenhuma"}
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {m.ativo
                          ? <Badge className="bg-success hover:bg-success">Ativo</Badge>
                          : <Badge variant="secondary">Inativo</Badge>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => abrirEdicao(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm(`Excluir "${m.material}" e suas exceções?`)) return;
                            try {
                              await removerMaterial.mutateAsync(m.id);
                              toast.success("Material excluído.");
                            } catch (e: any) { toast.error(e?.message ?? "Falha ao excluir."); }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-primary" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Material */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar material" : "Novo material"}</DialogTitle>
            <DialogDescription>
              As palavras-chave são comparadas com a descrição do produto da nota fiscal (todas devem estar presentes).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Input
                value={edit?.material ?? ""}
                onChange={(e) => setEdit((s) => ({ ...s, material: e.target.value }))}
                placeholder="Ex.: Areia média lavada"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Palavras-chave (separe por ; )</Label>
              <Input value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder="AREIA; MEDIA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unidade base</Label>
                <Select
                  value={edit?.unidade_base ?? "M3"}
                  onValueChange={(v) => setEdit((s) => ({ ...s, unidade_base: v as UnidadeBase }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Densidade ({sufixoDe((edit?.unidade_base ?? "M3") as UnidadeBase)})</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={edit?.densidade ?? ""}
                  onChange={(e) => setEdit((s) => ({ ...s, densidade: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={edit?.ordem ?? 100}
                  onChange={(e) => setEdit((s) => ({ ...s, ordem: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={edit?.ativo ?? true}
                  onCheckedChange={(v) => setEdit((s) => ({ ...s, ativo: v }))}
                />
                <Label>Ativo</Label>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-dashed p-3">
              <div>
                <Label className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  Densidade específica por fornecedor (opcional)
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vence a densidade padrão deste material. Pode ficar em branco.
                </p>
              </div>

              {edit?.id && excecoesDe(edit.id).length > 1 && (
                <div className="space-y-1">
                  {excecoesDe(edit.id).map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
                      <span className="font-medium">{e.fornecedor_nome}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {fmt(e.densidade)} {sufixoDe((edit?.unidade_base ?? "M3") as UnidadeBase)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={async () => {
                            try {
                              await removerExcecao.mutateAsync(e.id);
                              if (vincId === e.id) limparVinculo();
                              toast.success("Exceção removida.");
                            } catch (err: any) { toast.error(err?.message ?? "Falha ao remover."); }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    Use os campos abaixo para adicionar mais um fornecedor.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-[1fr,140px] items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Fornecedor</Label>
                  <Input
                    list="densidades-fornecedores"
                    value={vincFornecedor}
                    onChange={(e) => setVincFornecedor(e.target.value)}
                    placeholder="Ex.: D'ANGELOS AREAL"
                  />
                  <datalist id="densidades-fornecedores">
                    {sugestoesFornecedor.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>Densidade ({sufixoDe((edit?.unidade_base ?? "M3") as UnidadeBase)})</Label>
                  <Input
                    value={vincDens}
                    onChange={(e) => setVincDens(e.target.value)}
                    placeholder="1480"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvarMaterial.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exceções por fornecedor */}
      <Dialog open={!!excMaterial} onOpenChange={(o) => !o && setExcMaterial(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Exceções por fornecedor — {excMaterial?.material}</DialogTitle>
            <DialogDescription>
              Densidade específica de um fornecedor para este material. Vence a densidade padrão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {excMaterial && excecoesDe(excMaterial.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma exceção cadastrada.</p>
            ) : excMaterial && excecoesDe(excMaterial.id).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{e.fornecedor_nome}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  {fmt(e.densidade)} {sufixoDe(excMaterial.unidade_base)}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        await removerExcecao.mutateAsync(e.id);
                        toast.success("Exceção removida.");
                      } catch (err: any) { toast.error(err?.message ?? "Falha ao remover."); }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-primary" />
                  </Button>
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr,140px] items-end gap-3 border-t pt-3">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                value={excNome}
                onChange={(e) => setExcNome(e.target.value)}
                placeholder="Ex.: D'ANGELOS AREAL"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Densidade</Label>
              <Input value={excDens} onChange={(e) => setExcDens(e.target.value)} placeholder="1480" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExcMaterial(null)}>Fechar</Button>
            <Button onClick={salvarExc} disabled={salvarExcecao.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar exceção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
