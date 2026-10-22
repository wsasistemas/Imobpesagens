import { useMemo, useState } from "react";
import {
  Plus, Trash2, Layers, Building2, ArrowLeft, ChevronsUpDown, Check, X, Link2, Unlink, Lock, ArrowRight, Save, Pencil, RotateCcw, FileSpreadsheet
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToleranciasPadrao, useGerenciamentoFornecedores, useOverridesFornecedor, validarCNPJ, formatarCNPJ, type Condicao, type ToleranciaPadrao, type FornecedorMaterial } from "@/lib/tolerancias-heranca";
import { useQuery } from "@tanstack/react-query";
import { pesagensQueryOptions } from "@/lib/pesagem-queries";
import { construirMapaFornecedores } from "@/lib/fornecedor";
import { toast } from "sonner";
import { baixarCsv } from "@/lib/exportar-csv";

const PADRAO = "__padrao__";

export function DashboardTolerancias() {
  const { isAdmin: isAdminRole, isSuperAdmin } = useAuth();
  const isAdmin = isAdminRole || isSuperAdmin;
  const { categorias, adicionar: addPadrao, atualizar: updatePadrao, remover: removePadrao, isLoading: loadingPadrao } = useToleranciasPadrao();
  const { fornecedores, vincular, desvincular, atualizar: updateForn, revincular, excluirFisicamente, isLoading: loadingForn } = useGerenciamentoFornecedores();
  const { overrides, definir: setOverride, remover: removeOverride, isLoading: loadingOver } = useOverridesFornecedor();

  const [fornecedorEdit, setFornecedorEdit] = useState<FornecedorMaterial | null>(null);

  const [contexto, setContexto] = useState<string | null>(null);
  const [vincularAberto, setVincularAberto] = useState(false);
  const [trocarAberto, setTrocarAberto] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCat, setNewCat] = useState<Partial<ToleranciaPadrao>>({
    categoria: "", condicao: "Seco", tolerancia: 2, palavras_chave: ""
  });

  const { data: pesagens = [] } = useQuery(pesagensQueryOptions(null));
  const emissoresVistos = useMemo(() => {
    const mapa = construirMapaFornecedores(pesagens);
    const vinculados = new Set(fornecedores.map(f => f.razao_social.toUpperCase()));
    return Array.from(mapa.values())
      .map(f => ({ nome: f.rotulo, cnpj: f.cnpj }))
      .filter(f => f.nome && !vinculados.has(f.nome.toUpperCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [pesagens, fornecedores]);

  const fornecedorAtual = contexto && contexto !== PADRAO ? fornecedores.find(f => f.id === contexto) : null;

  const handleVincular = async (dados: { razao_social: string; cnpj: string | null }) => {
    try {
      const criado = await vincular.mutateAsync(dados);
      toast.success(`${dados.razao_social} vinculado.`);
      setVincularAberto(false);
      setContexto(criado.id);
    } catch (e: any) {
      toast.error(e.message || "Erro ao vincular.");
    }
  };

  const handleSalvarOverride = async (materialId: string, valor: string) => {
    if (!fornecedorAtual) return;
    const v = valor.trim().replace(",", ".");
    try {
      if (!v) {
        await removeOverride.mutateAsync({ fornecedor_id: fornecedorAtual.id, tolerancia_padrao_id: materialId });
      } else {
        const num = Number(v);
        if (isNaN(num)) throw new Error("Valor inválido");
        await setOverride.mutateAsync({ fornecedor_id: fornecedorAtual.id, tolerancia_padrao_id: materialId, tolerancia: num });
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    }
  };

  const exportarTudo = () => {
    const header = ["Fornecedor", "CNPJ", "Origem", "Categoria", "Condição", "Palavras-chave", "Tolerância padrão (%)", "Tolerância específica (%)", "Tolerância aplicada (%)"];
    const rows: (string | number)[][] = [];
    for (const cat of categorias) {
      rows.push(["PADRÃO (GERAL)", "", "padrão", cat.categoria, cat.condicao, cat.palavras_chave ?? "", cat.tolerancia, "", cat.tolerancia]);
    }
    for (const f of fornecedores.filter(f => f.vinculado)) {
      for (const cat of categorias) {
        const ov = overrides.find(o => o.fornecedor_id === f.id && o.tolerancia_padrao_id === cat.id);
        rows.push([
          f.razao_social,
          f.cnpj ? formatarCNPJ(f.cnpj) : "",
          ov ? "específica" : "herda padrão",
          cat.categoria,
          cat.condicao,
          cat.palavras_chave ?? "",
          cat.tolerancia,
          ov ? ov.tolerancia : "",
          ov ? ov.tolerancia : cat.tolerancia,
        ]);
      }
    }
    baixarCsv("tolerancias", [header, ...rows]);
    toast.success("Exportação gerada.");
  };

  const exportarContexto = () => {
    if (fornecedorAtual) {
      const header = ["Categoria", "Condição", "Tolerância padrão (%)", "Tolerância específica (%)", "Tolerância aplicada (%)", "Status"];
      const rows = categorias.map(cat => {
        const ov = overrides.find(o => o.fornecedor_id === fornecedorAtual.id && o.tolerancia_padrao_id === cat.id);
        return [cat.categoria, cat.condicao, cat.tolerancia, ov ? ov.tolerancia : "", ov ? ov.tolerancia : cat.tolerancia, ov ? "Sobrescrito" : "Herda"];
      });
      baixarCsv(`tolerancias-${fornecedorAtual.razao_social.toLowerCase().replace(/\s+/g, "-")}`, [header, ...rows]);
    } else {
      const header = ["Categoria", "Condição", "Palavras-chave", "Tolerância ±%"];
      const rows = categorias.map(cat => [cat.categoria, cat.condicao, cat.palavras_chave ?? "", cat.tolerancia]);
      baixarCsv("tolerancias-padrao", [header, ...rows]);
    }
    toast.success("Exportação gerada.");
  };

  if (!contexto) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tolerâncias por material</h1>
            <p className="text-sm text-muted-foreground mt-1">Tabela padrão (base) e tabelas específicas por fornecedor.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-10 px-4 rounded-lg font-medium" onClick={exportarTudo}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar para Excel
            </Button>
            <Button className="bg-primary hover:bg-primary/90 h-10 px-6 rounded-lg font-medium" onClick={() => setVincularAberto(true)}>
              <Link2 className="mr-2 h-4 w-4" /> Vincular fornecedor
            </Button>
          </div>
        </div>


        <button type="button" onClick={() => setContexto(PADRAO)} className="w-full text-left group">
          <Card className="border-none bg-primary text-white transition-all hover:bg-primary/90 overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
                <Layers className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">Padrão (Geral)</h3>
                  {isAdmin ? (
                    <Badge variant="outline" className="h-5 bg-white/10 border-white/20 text-[10px] text-white/80 font-normal uppercase px-2">
                      <Lock className="mr-1 h-3 w-3" /> admin
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-5 bg-white/10 border-white/20 text-[10px] text-white/80 font-normal uppercase px-2">
                      <Lock className="mr-1 h-3 w-3" /> somente leitura
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-white/60">
                  Modelo base de todas as tabelas <span className="text-white/30">·</span> {categorias.length} materiais <span className="text-white/30">·</span> {isAdmin ? "editável" : "somente leitura"}
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </CardContent>
          </Card>
        </button>

        <div className="mt-4">
          <h3 className="text-base font-bold text-foreground mb-4 px-1">Tabelas por fornecedor</h3>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b text-left text-muted-foreground/70 font-medium">
                <tr>
                  <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider w-16 text-center">Nº</th>
                  <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">Fornecedor (Razão Social)</th>
                  <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">CNPJ</th>
                  <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">Data de criação</th>
                  <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-right">Específicas</th>
                  <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fornecedores.filter(f => f.vinculado).map((f, idx) => {
                  const countOverrides = overrides.filter(o => o.fornecedor_id === f.id).length;
                  return (
                    <tr key={f.id} className="hover:bg-muted/50 cursor-pointer transition-colors group" onClick={() => setContexto(f.id)}>
                      <td className="px-6 py-5 text-center font-bold text-muted-foreground">{idx + 1}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <span className="font-bold text-foreground leading-tight">{f.razao_social}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-medium text-muted-foreground tabular-nums">
                        {f.cnpj ? formatarCNPJ(f.cnpj) : "-"}
                      </td>
                      <td className="px-6 py-5 font-medium text-muted-foreground">
                        {new Date(f.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {countOverrides > 0 ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 font-bold hover:bg-primary-soft h-7 px-3 rounded-full">
                            {countOverrides}
                          </Badge>
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">herda tudo</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setFornecedorEdit(f)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                              onClick={async () => {
                                if (confirm(`Deseja EXCLUIR permanentemente o fornecedor ${f.razao_social}? Esta ação é irreversível.`)) {
                                  try {
                                    await excluirFisicamente.mutateAsync(f.id);
                                    toast.success("Fornecedor excluído permanentemente.");
                                  } catch (err: any) {
                                    toast.error(err.message || "Erro ao excluir fornecedor.");
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {fornecedores.some(f => !f.vinculado && f.origem === 'manual') && (
          <div className="mt-8">
            <h3 className="text-base font-bold text-foreground mb-4 px-1">Cadastros guardados (desvinculados)</h3>
            <div className="rounded-xl border border-dashed bg-muted/50 overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {fornecedores.filter(f => !f.vinculado && f.origem === 'manual').map((f) => (
                    <tr key={f.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <Building2 className="h-4 w-4 text-muted-foreground" />
                           <span className="font-bold text-foreground">{f.razao_social}</span>
                           <Badge variant="outline" className="text-[9px] uppercase">Guardado</Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-medium">
                        {f.cnpj ? formatarCNPJ(f.cnpj) : "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setFornecedorEdit(f)}>
                             <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                           </Button>
                           <Button variant="outline" size="sm" className="h-8 text-primary border-primary/30" onClick={() => revincular.mutate(f.id)}>
                             <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revincular
                           </Button>
                           {isSuperAdmin && (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                               onClick={async () => {
                                 if (confirm(`Deseja EXCLUIR permanentemente o fornecedor desvinculado ${f.razao_social}?`)) {
                                   try {
                                     await excluirFisicamente.mutateAsync(f.id);
                                     toast.success("Fornecedor excluído.");
                                   } catch (err: any) {
                                     toast.error("Erro ao excluir fornecedor.");
                                   }
                                 }
                               }}
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogVincular
          aberto={vincularAberto}
          onOpenChange={setVincularAberto}
          vistos={emissoresVistos}
          onVincular={handleVincular}
          guardados={fornecedores.filter(f => !f.vinculado && f.origem === 'manual')}
          onRevincular={(id: string) => revincular.mutate(id)}
        />

        <DialogEditarFornecedor
          fornecedor={fornecedorEdit}
          onOpenChange={(open) => !open && setFornecedorEdit(null)}
          onSalvar={async (patch) => {
            if (fornecedorEdit) {
              await updateForn.mutateAsync({ id: fornecedorEdit.id, patch });
              toast.success("Fornecedor atualizado.");
              setFornecedorEdit(null);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => setContexto(null)} className="flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar às tabelas
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {fornecedorAtual ? <Building2 className="h-6 w-6 text-primary" /> : <Layers className="h-6 w-6 text-primary" />}
          <div>
            <h2 className="text-lg font-bold text-foreground">{fornecedorAtual ? fornecedorAtual.razao_social : "Tabela Padrão (Geral)"}</h2>
            {fornecedorAtual && (
              <p className="text-[10px] text-muted-foreground uppercase">
                CNPJ {fornecedorAtual.cnpj ? formatarCNPJ(fornecedorAtual.cnpj) : "---"} · 
                Criado por {fornecedorAtual.created_by_nome} em {new Date(fornecedorAtual.created_at).toLocaleDateString()}
              </p>
            )}
            {!fornecedorAtual && !isAdmin && (
              <div className="flex items-center gap-1.5 text-warning text-[11px] font-medium bg-warning-soft px-2 py-0.5 rounded-full w-fit mt-1">
                <Lock className="h-3 w-3" /> A tabela padrão é somente leitura para seu perfil
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2 text-xs" onClick={exportarContexto}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar para Excel
          </Button>
          <Popover open={trocarAberto} onOpenChange={setTrocarAberto}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 text-xs">Trocar <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Buscar contexto..." />
                <CommandList>
                  <CommandEmpty>Nada encontrado.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => { setContexto(PADRAO); setTrocarAberto(false); }}>
                      <Layers className="mr-2 h-3.5 w-3.5" /> Padrão (Geral)
                      {contexto === PADRAO && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                    </CommandItem>
                    {fornecedores.map(f => (
                      <CommandItem key={f.id} onSelect={() => { setContexto(f.id); setTrocarAberto(false); }}>
                        <Building2 className="mr-2 h-3.5 w-3.5" /> {f.razao_social}
                        {contexto === f.id && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {fornecedorAtual ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-2 text-foreground" onClick={() => setFornecedorEdit(fornecedorAtual)}>
                <Pencil className="h-3.5 w-3.5" /> Editar dados
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10" 
                onClick={async () => {
                  const msg = fornecedorAtual.origem === 'manual' 
                    ? "Como foi cadastrado manualmente, os dados ficam guardados e você pode revincular depois sem redigitar. Desvincular?"
                    : "Poderá ser readicionado pela lista de pesagens. Desvincular?";
                  if(confirm(msg)){
                    await desvincular.mutateAsync(fornecedorAtual as any);
                    setContexto(null);
                    toast.success("Desvinculado.");
                  }
                }}>
                <Unlink className="h-3.5 w-3.5" /> Desvincular
              </Button>
            </div>
          ) : (
            isAdmin && (
              <Button size="sm" className="h-9 bg-primary" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar Material
              </Button>
            )
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Condição</th>
              {!fornecedorAtual ? (
                <>
                  <th className="px-4 py-3 font-semibold">Palavras-chave</th>
                  <th className="px-4 py-3 font-semibold w-32">Tolerância ±%</th>
                  {(isAdmin || isSuperAdmin) && <th className="px-4 py-3 font-semibold w-20 text-center">Ações</th>}
                </>
              ) : (
                <>
                  <th className="px-4 py-3 font-semibold w-24">Padrão</th>
                  <th className="px-4 py-3 font-semibold w-40">Específica (±%)</th>
                  <th className="px-4 py-3 font-semibold w-24">Aplicada</th>
                  <th className="px-4 py-3 font-semibold w-32 text-center">Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {categorias.map(cat => {
              const isAdminOrSuper = isAdmin || isSuperAdmin;
              if (fornecedorAtual) {
                const ov = overrides.find(o => o.fornecedor_id === fornecedorAtual.id && o.tolerancia_padrao_id === cat.id);
                const aplicada = ov ? ov.tolerancia : cat.tolerancia;
                return (
                  <tr key={cat.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">{cat.categoria}</td>
                    <td className="px-4 py-2.5">{cat.condicao}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground opacity-60">±{cat.tolerancia}%</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Input type="number" step="0.1" placeholder="herda" 
                          defaultValue={ov?.tolerancia ?? ""}
                          onBlur={(e) => handleSalvarOverride(cat.id, e.target.value)}
                          className="h-8 w-24 text-center font-bold"
                        />
                        {ov && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleSalvarOverride(cat.id, "")}><X className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-primary">±{aplicada}%</td>
                    <td className="px-4 py-2.5 text-center">
                      {ov ? <Badge className="bg-primary">Sobrescrito</Badge> : <Badge variant="secondary">Herda</Badge>}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={cat.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Input defaultValue={cat.categoria} readOnly={!isAdmin} className="h-8 border-none bg-transparent shadow-none" 
                      onBlur={(e) => isAdmin && updatePadrao.mutate({ id: cat.id, patch: { categoria: e.target.value } })} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Select defaultValue={cat.condicao} disabled={!isAdmin} onValueChange={(v) => updatePadrao.mutate({ id: cat.id, patch: { condicao: v as Condicao } })}>
                      <SelectTrigger className="h-8 border-none bg-transparent shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Seco">Seco</SelectItem><SelectItem value="Úmido">Úmido</SelectItem></SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <Input defaultValue={cat.palavras_chave} readOnly={!isAdmin} placeholder="keywords..." className="h-8 border-none bg-transparent shadow-none"
                      onBlur={(e) => isAdmin && updatePadrao.mutate({ id: cat.id, patch: { palavras_chave: e.target.value } })} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input type="number" defaultValue={cat.tolerancia} readOnly={!isAdmin} className="h-8 border-none bg-transparent shadow-none font-bold"
                      onBlur={(e) => isAdmin && updatePadrao.mutate({ id: cat.id, patch: { tolerancia: Number(e.target.value) } })} />
                  </td>
                  {isAdminOrSuper && (
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isAdminOrSuper && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive" 
                            onClick={() => confirm(`Excluir material "${cat.categoria}" permanentemente?`) && removePadrao.mutate(cat.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Categoria Padrão</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Nome da Categoria</Label><Input value={newCat.categoria} onChange={e => setNewCat({ ...newCat, categoria: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label>Condição</Label><Select value={newCat.condicao} onValueChange={v => setNewCat({ ...newCat, condicao: v as Condicao })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Seco">Seco</SelectItem><SelectItem value="Úmido">Úmido</SelectItem></SelectContent></Select></div>
              <div className="grid gap-2"><Label>Tolerância ±%</Label><Input type="number" value={newCat.tolerancia} onChange={e => setNewCat({ ...newCat, tolerancia: Number(e.target.value) })} /></div>
            </div>
            <div className="grid gap-2"><Label>Palavras-chave</Label><Input placeholder="Separadas por vírgula" value={newCat.palavras_chave} onChange={e => setNewCat({ ...newCat, palavras_chave: e.target.value })} /></div>
          </div>
          <DialogFooter><Button className="bg-primary" onClick={() => addPadrao.mutateAsync(newCat).then(() => setIsDialogOpen(false))}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DialogVincular({ aberto, onOpenChange, vistos, onVincular, guardados, onRevincular }: any) {
  const [aba, setAba] = useState("lista");
  const [selecionado, setSelecionado] = useState<any>(null);
  const [novo, setNovo] = useState({ razao: "", cnpj: "" });

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>Vincular fornecedor às tolerâncias</DialogTitle><DialogDescription>Crie uma tabela de exceção para um fornecedor específico.</DialogDescription></DialogHeader>
        
        {guardados && guardados.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 p-3 bg-primary/10/50 rounded-lg border border-primary/20">
             <p className="text-[10px] font-bold text-primary uppercase w-full mb-1">Revincular cadastro guardado:</p>
             {guardados.map((g: any) => (
               <Badge key={g.id} className="bg-card text-primary border-primary/30 hover:bg-wine-50 cursor-pointer h-7 px-3" onClick={() => { onRevincular(g.id); onOpenChange(false); }}>
                 <RotateCcw className="h-3 w-3 mr-1" /> {g.razao_social}
               </Badge>
             ))}
          </div>
        )}

        <Tabs value={aba} onValueChange={setAba} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lista">Lista de pesagens</TabsTrigger>
            <TabsTrigger value="novo">Cadastrar novo</TabsTrigger>
          </TabsList>
          <TabsContent value="lista" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione um emissor já registrado</Label>
              <Select onValueChange={(v) => setSelecionado(vistos.find((x: any) => x.nome === v))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {vistos.map((v: any) => <SelectItem key={v.nome} value={v.nome}>{v.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {selecionado?.cnpj && <p className="text-[10px] text-primary font-medium uppercase mt-1">CNPJ identificado na nota: {formatarCNPJ(selecionado.cnpj)}</p>}
            </div>
            <Button disabled={!selecionado} className="w-full bg-primary" onClick={() => onVincular({ razao_social: selecionado.nome, cnpj: selecionado.cnpj, origem: 'lista' })}>Vincular</Button>
          </TabsContent>
          <TabsContent value="novo" className="space-y-4 py-4">
            <div className="space-y-2"><Label>Razão Social</Label><Input value={novo.razao} onChange={e => setNovo({ ...novo, razao: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={formatarCNPJ(novo.cnpj)} onChange={e => setNovo({ ...novo, cnpj: e.target.value.replace(/\D/g, "") })} />
              {novo.cnpj.length === 14 && (
                validarCNPJ(novo.cnpj) ? <p className="text-[10px] text-primary font-bold flex items-center gap-1"><Check className="h-3 w-3" /> CNPJ VÁLIDO</p> : <p className="text-[10px] text-destructive font-bold flex items-center gap-1"><X className="h-3 w-3" /> CNPJ INVÁLIDO</p>
              )}
            </div>
            <Button disabled={!novo.razao || (novo.cnpj.length > 0 && !validarCNPJ(novo.cnpj))} className="w-full bg-primary" onClick={() => onVincular({ razao_social: novo.razao, cnpj: novo.cnpj || null, origem: 'manual' })}>Cadastrar e vincular</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DialogEditarFornecedor({ fornecedor, onOpenChange, onSalvar }: { fornecedor: FornecedorMaterial | null, onOpenChange: (open: boolean) => void, onSalvar: (patch: any) => Promise<void> }) {
  const [dados, setDados] = useState({ razao: "", cnpj: "" });

  useMemo(() => {
    if (fornecedor) {
      setDados({ razao: fornecedor.razao_social, cnpj: fornecedor.cnpj || "" });
    }
  }, [fornecedor]);

  const canSave = dados.razao.trim().length > 0 && (dados.cnpj.length === 0 || validarCNPJ(dados.cnpj));

  return (
    <Dialog open={!!fornecedor} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader><DialogTitle>Editar Fornecedor</DialogTitle><DialogDescription>Atualize a razão social ou CNPJ do fornecedor.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2"><Label>Razão Social</Label><Input value={dados.razao} onChange={e => setDados({ ...dados, razao: e.target.value })} /></div>
          <div className="grid gap-2">
            <Label>CNPJ</Label>
            <Input value={formatarCNPJ(dados.cnpj)} onChange={e => setDados({ ...dados, cnpj: e.target.value.replace(/\D/g, "") })} />
            {dados.cnpj.length > 0 && (
              validarCNPJ(dados.cnpj) ? <p className="text-[10px] text-primary font-bold flex items-center gap-1"><Check className="h-3 w-3" /> CNPJ VÁLIDO</p> : <p className="text-[10px] text-destructive font-bold flex items-center gap-1"><X className="h-3 w-3" /> CNPJ INVÁLIDO</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-primary" disabled={!canSave} onClick={() => onSalvar({ razao_social: dados.razao, cnpj: dados.cnpj || null })}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
