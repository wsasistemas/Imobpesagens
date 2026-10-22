import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, 
  Plus, 
  Trash2, 
  FileText, 
  Lock, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Scale,
  FlaskConical,
  HelpCircle,
  FileCheck,
  Loader2,
  ShieldAlert,
  Pencil,
  X,
  FileSpreadsheet
} from "lucide-react";


import { toast } from "sonner";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  getFornecedoresConcreto, 
  upsertFornecedorConcreto, 
  deleteFornecedorConcreto,
  upsertTracoConcreto,
  deleteTracoConcreto
} from "@/lib/concreto.functions";
import { useServerFn } from "@tanstack/react-start";
import { paraNumero } from "@/lib/unidades";
import { validarCargaConcreto } from "@/lib/concreto";
import { AjudaConferenciaConcreto } from "./ajuda-conferencia-concreto";
import { useAuth } from "@/hooks/useAuth";
import { baixarCsv } from "@/lib/exportar-csv";

export function DashboardConcreto() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const getFn = useServerFn(getFornecedoresConcreto);
  const upsertFornFn = useServerFn(upsertFornecedorConcreto);
  const deleteFornFn = useServerFn(deleteFornecedorConcreto);
  const upsertTracoFn = useServerFn(upsertTracoConcreto);
  const deleteTracoFn = useServerFn(deleteTracoConcreto);

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores_concreto"],
    queryFn: () => getFn(),
  });

  const [toleranciaPadraoGlobal, setToleranciaPadraoGlobal] = useState(4);

  const mutForn = useMutation({
    mutationFn: (data: any) => upsertFornFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores_concreto"] });
      toast.success("Fornecedor atualizado.");
    },
    onError: (e: any) => {
      console.error("Erro ao salvar fornecedor:", e);
      toast.error(e?.message || "Falha ao salvar fornecedor.");
    }
  });

  const mutDelForn = useMutation({
    mutationFn: (id: string) => deleteFornFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores_concreto"] });
      toast.success("Fornecedor removido.");
    },
    onError: () => toast.error("Falha ao remover fornecedor.")
  });

  const mutTraco = useMutation({
    mutationFn: (data: any) => upsertTracoFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores_concreto"] });
      toast.success("Traço atualizado.");
    },
    onError: () => toast.error("Falha ao salvar traço.")
  });

  const mutDelTraco = useMutation({
    mutationFn: (id: string) => deleteTracoFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores_concreto"] });
      toast.success("Traço removido.");
    },
    onError: () => toast.error("Falha ao remover traço.")
  });

  const [tracoEditando, setTracoEditando] = useState<any>(null);
  const [fornIdEditando, setFornIdEditando] = useState<string | null>(null);

  const exportarCartaTraco = () => {
    const linhas: (string | number | null)[][] = [];
    linhas.push(["CARTAS DE TRAÇO"]);
    linhas.push(["Usina/Fornecedor", "Código", "FCK (MPa)", "Aplicação", "Slump", "ρ Teórica (kg/m³)", "Consumo cimento", "ρ Prática (kg/m³)", "Tolerância (%)", "Keywords (Item NF)"]);
    for (const f of fornecedores as any[]) {
      for (const t of (f.tracos ?? [])) {
        linhas.push([
          f.nome,
          t.codigo ?? "",
          t.fck ?? "",
          t.aplicacao ?? "",
          `${t.slump_nominal ?? ""} ${t.slump_unidade ?? "cm"}`.trim(),
          t.densidade_teorica ?? "",
          t.consumo_cimento ?? "",
          t.densidade_pratica ?? "",
          t.tolerancia_peso ?? f.tolerancia_padrao ?? "",
          t.match_keywords?.join(", ") ?? "",
        ]);
      }
    }
    linhas.push([]);
    linhas.push(["USINAS CADASTRADAS"]);
    linhas.push(["Nome", "Tolerância padrão (%)", "Emissor (keywords NF)", "Ativo", "Traços", "Observações"]);
    for (const f of fornecedores as any[]) {
      linhas.push([
        f.nome,
        f.tolerancia_padrao ?? "",
        f.emissor_keywords?.join(", ") ?? "",
        f.ativo ? "Sim" : "Não",
        f.tracos?.length ?? 0,
        f.observacoes ?? "",
      ]);
    }
    baixarCsv("carta-traco", linhas);
    toast.success("Exportação gerada.");
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando configurações de concreto...</div>;



  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border bg-muted">
        <CardContent className="flex flex-wrap items-center gap-6 py-4 text-sm text-foreground">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4 text-primary" />
            <span>Método de tara: <strong>Dupla pesagem</strong></span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4 text-primary" />
            <span>Densidade de referência: <strong>Teórica</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="tol-global" className="font-medium text-foreground">Tolerância padrão:</Label>
            <div className="flex items-center gap-1">
              <Input 
                id="tol-global"
                type="number" 
                className="h-8 w-16 bg-card text-center font-bold focus-visible:ring-primary"
                value={toleranciaPadraoGlobal}
                onChange={(e) => setToleranciaPadraoGlobal(Number(e.target.value))}
              />
              <span className="font-bold">%</span>
            </div>
            <AjudaConferenciaConcreto />
          </div>
        </CardContent>
      </Card>

      {/* Seção Fornecedor Padrão - Fixo no Topo */}
      {(() => {
        const fornPadrao = fornecedores.find((f: any) => f.nome.toUpperCase() === "PADRÃO");
        if (!fornPadrao) return null;
        
        return (
          <Card className="border-border bg-card shadow-xl shadow-foreground/5 overflow-hidden transition-all duration-300">
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between bg-gradient-to-r from-muted to-transparent">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary border border-border shadow-sm">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    Referência Técnica Padrão
                    <Badge variant="outline" className="text-[10px] bg-muted border-border text-primary font-semibold uppercase tracking-wider py-0.5 px-2 rounded-full">
                      <Lock className="mr-1 h-3 w-3" /> Restrito: Engenharia
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-primary/60 font-medium">Traços de segurança padrão para ausência de carta específica.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 px-6 pb-6 bg-wine-50/10">
              <div className="rounded-xl border border-wine-100 bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-wine-50/50">
                    <TableRow className="border-wine-100 hover:bg-transparent">
                      <TableHead className="w-[100px] text-[10px] uppercase tracking-widest h-10 text-primary/40 font-bold">FCK (MPa)</TableHead>
                      <TableHead className="w-[120px] text-[10px] uppercase tracking-widest h-10 text-primary/40 font-bold">Slump (cm)</TableHead>
                      <TableHead className="w-[140px] text-[10px] uppercase tracking-widest h-10 text-primary/40 font-bold">ρ Teórica</TableHead>
                      <TableHead className="w-[100px] text-[10px] uppercase tracking-widest h-10 text-primary/40 font-bold">Tol.%</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest h-10 text-primary/40 font-bold">Keywords</TableHead>
                      <TableHead className="w-[100px] text-[10px] uppercase tracking-widest h-10 text-center text-primary/40 font-bold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fornPadrao.tracos?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-primary/20 italic text-sm">
                          Nenhum traço padrão cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {fornPadrao.tracos?.map((t: any) => (
                      <TableRow key={t.id} className="border-wine-50 hover:bg-wine-50/50 transition-colors group">
                        <TableCell className="py-3 px-4">
                          <span className="text-sm font-bold text-primary bg-wine-50 px-2 py-0.5 rounded border border-wine-100">{t.fck}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-xs font-medium text-primary/60">{t.slump_nominal} {t.slump_unidade}</TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-primary">{t.densidade_teorica}</span>
                            <span className="text-[10px] text-primary/40 font-bold uppercase tracking-tighter">kg/m³</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-xs font-bold text-primary/50">{t.tolerancia_peso || fornPadrao.tolerancia_padrao}%</TableCell>
                        <TableCell className="py-3 px-4 text-primary/30 text-[10px] font-medium italic">{t.match_keywords?.join(", ")}</TableCell>
                        <TableCell className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={!isAdmin}
                              className="h-8 w-8 text-primary/40 hover:text-primary hover:bg-wine-50 rounded-lg"
                              onClick={() => {
                                setTracoEditando(t);
                                setFornIdEditando(fornPadrao.id);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={!isAdmin}
                              className="h-8 w-8 text-primary/40 hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => {
                                if(confirm("Deseja realmente excluir este traço padrão?")) {
                                  mutDelTraco.mutate(t.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {isAdmin && (
                  <div className="bg-wine-50/30 p-3 flex justify-end border-t border-wine-100">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[11px] text-primary hover:text-primary-hover hover:bg-wine-50 font-bold tracking-wide transition-all group/btn"
                      onClick={() => setTracoEditando({ 
                        codigo: `PADRAO-${fornPadrao.tracos?.length + 1}`,
                        fck: 20,
                        densidade_teorica: 2350,
                        slump_nominal: 10,
                        slump_unidade: 'cm',
                        match_keywords: []
                      })}
                    >
                      <Plus className="mr-2 h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" /> 
                      Adicionar Referência Padrão
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex items-center justify-between mt-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Usinas de Concreto</h2>
          <p className="text-sm text-muted-foreground">Configure as usinas e seus respectivos traços para conferência volumétrica.</p>
        </div>
        <div className="flex items-center gap-2">
        <Button variant="outline" onClick={exportarCartaTraco}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar para Excel
        </Button>
        <Button 
          className="bg-primary hover:bg-primary-hover text-white"
          disabled={mutForn.isPending || !isAdmin}
          onClick={() => mutForn.mutate({ nome: "Nova Usina", tolerancia_padrao: toleranciaPadraoGlobal })}
        >
          {mutForn.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Adicionar usina
        </Button>
        </div>
      </div>


      <Accordion type="multiple" className="w-full space-y-3">
        {fornecedores.filter((f: any) => f.nome.toUpperCase() !== "PADRÃO").map((f: any) => (

          <AccordionItem key={f.id} value={f.id} className="rounded-lg border border-wine-100 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 hover:bg-wine-50/50">
              <AccordionTrigger className="flex-1 hover:no-underline py-2">
                <div className="flex items-center gap-3 text-left">
                  <div className={`h-2.5 w-2.5 rounded-full ${f.ativo ? 'bg-primary' : 'bg-border'}`} />
                  <span className="font-bold text-primary">{f.nome}</span>
                  <Badge variant="outline" className="text-[10px] py-0 border-wine-100 text-primary">
                    Emissor: {f.emissor_keywords?.join(", ") || "Nenhum"}
                  </Badge>
                </div>
              </AccordionTrigger>
              <div className="flex items-center gap-4 px-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Tolerância:</Label>
                  <div className="flex items-center gap-1">
                    <Input 
                      className="h-8 w-14 text-center text-xs font-bold"
                      defaultValue={f.tolerancia_padrao}
                      disabled={!isAdmin}
                      onBlur={(e) => mutForn.mutate({ id: f.id, tolerancia_padrao: Number(e.target.value) })}

                    />
                    <span className="text-xs font-bold">%</span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-wine-50 text-primary">
                  {f.tracos?.length || 0} traços
                </Badge>
                <Button 
                  variant="ghost" 
                  size="icon" 
                   className="h-8 w-8 text-destructive hover:bg-destructive/10"
                   disabled={!isAdmin}
                   onClick={(e) => {

                    e.stopPropagation();
                    if(confirm("Remover este fornecedor e todos os seus traços?")) mutDelForn.mutate(f.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <AccordionContent className="px-4 pb-4 pt-2 border-t border-wine-50">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Palavras-chave do Emissor (NF)</Label>
                    <Input 
                      placeholder="Ex: SUPERMIX, SUPERMIX CONCRETO"
                      defaultValue={f.emissor_keywords?.join(", ")}
                      disabled={!isAdmin}
                      onBlur={(e) => mutForn.mutate({ id: f.id, emissor_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}

                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Observações</Label>
                    <Input 
                      placeholder="Notas internas..."
                      defaultValue={f.observacoes}
                      disabled={!isAdmin}
                      onBlur={(e) => mutForn.mutate({ id: f.id, observacoes: e.target.value })}

                    />
                  </div>
                </div>

                <div className="rounded-md border border-wine-50 bg-wine-50/10 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-wine-50/50">
                      <TableRow className="border-wine-50">
                        <TableHead className="w-[80px] text-xs h-9">Código</TableHead>
                        <TableHead className="w-[70px] text-xs h-9">FCK</TableHead>
                        <TableHead className="text-xs h-9">Aplicação</TableHead>
                        <TableHead className="w-[100px] text-xs h-9">Slump</TableHead>
                        <TableHead className="w-[100px] text-xs h-9">ρ Teórica</TableHead>
                        <TableHead className="w-[85px] text-xs h-9">Consumo</TableHead>
                        <TableHead className="w-[100px] text-xs h-9 text-muted-foreground">ρ Prática</TableHead>
                        <TableHead className="w-[70px] text-xs h-9">Tol.%</TableHead>
                        <TableHead className="text-xs h-9">Keywords (Item NF)</TableHead>
                        <TableHead className="w-[70px] text-xs h-9 text-center">Ações</TableHead>

                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.tracos?.map((t: any) => (
                        <TableRow key={t.id} className="hover:bg-wine-50/20 group/row">
                          <TableCell className="p-2">
                            <Input 
                              className="h-7 text-[11px] px-1.5" 
                              defaultValue={t.codigo}
                              disabled={!isAdmin}
                              onBlur={(e) => mutTraco.mutate({ id: t.id, codigo: e.target.value, fornecedor_id: f.id })}

                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              type="number"
                              className="h-7 text-[11px] px-1.5" 
                              defaultValue={t.fck}
                              disabled={!isAdmin}
                              onBlur={(e) => mutTraco.mutate({ id: t.id, fck: Number(e.target.value), fornecedor_id: f.id })}

                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              className="h-7 text-[11px] px-1.5" 
                              defaultValue={t.aplicacao}
                              disabled={!isAdmin}
                              onBlur={(e) => mutTraco.mutate({ id: t.id, aplicacao: e.target.value, fornecedor_id: f.id })}

                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center gap-1">
                              <Input 
                                type="number"
                                className="h-7 w-12 text-[11px] px-1.5" 
                                defaultValue={t.slump_nominal}
                                disabled={!isAdmin}
                                onBlur={(e) => mutTraco.mutate({ id: t.id, slump_nominal: Number(e.target.value), fornecedor_id: f.id })}

                              />
                              <Select 
                                defaultValue={t.slump_unidade || 'cm'}
                                  onValueChange={(v) => mutTraco.mutate({ id: t.id, slump_unidade: v, fornecedor_id: f.id })}
                                  disabled={!isAdmin}
                                >

                                <SelectTrigger className="h-7 w-[45px] text-[10px] px-1 bg-card">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cm">cm</SelectItem>
                                  <SelectItem value="mm">mm</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              type="number"
                              className="h-7 text-[11px] px-1.5 font-bold text-primary" 
                              defaultValue={t.densidade_teorica}
                              disabled={!isAdmin}
                              onBlur={(e) => mutTraco.mutate({ id: t.id, densidade_teorica: Number(e.target.value), fornecedor_id: f.id })}

                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center gap-1">
                              <Input 
                                type="number"
                                placeholder="300"
                                className="h-7 text-[11px] px-1.5" 
                                defaultValue={t.consumo_cimento}
                                disabled={!isAdmin}
                                onBlur={(e) => mutTraco.mutate({ id: t.id, consumo_cimento: e.target.value ? Number(e.target.value) : null, fornecedor_id: f.id })}

                              />
                              <span className="text-[9px] text-muted-foreground">kg</span>
                            </div>
                          </TableCell>
                          <TableCell className="p-2">

                            <Input 
                              type="number"
                              className="h-7 text-[11px] px-1.5 text-muted-foreground" 
                              defaultValue={t.densidade_pratica}
                              disabled={!isAdmin}
                              onBlur={(e) => mutTraco.mutate({ id: t.id, densidade_pratica: e.target.value ? Number(e.target.value) : null, fornecedor_id: f.id })}

                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              type="number"
                              placeholder={f.tolerancia_padrao}
                              className="h-7 text-[11px] px-1.5" 
                                defaultValue={t.tolerancia_peso}
                                disabled={!isAdmin}
                                onBlur={(e) => mutTraco.mutate({ id: t.id, tolerancia_peso: e.target.value ? Number(e.target.value) : null, fornecedor_id: f.id })}

                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              placeholder="Palavras no item da NF"
                              className="h-7 text-[11px] px-1.5" 
                              defaultValue={t.match_keywords?.join(", ")}
                              disabled={!isAdmin}
                              onBlur={(e) => mutTraco.mutate({ 

                                id: t.id, 
                                match_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                                fornecedor_id: f.id 
                              })}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary">
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                                  onClick={() => {
                                    if(confirm("Deseja realmente excluir este registro de carta traço? Esta ação é irreversível.")) {
                                      mutDelTraco.mutate(t.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="bg-wine-50/30 p-2 flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[11px] border-wine-100 text-primary hover:bg-wine-50"
                      onClick={() => mutTraco.mutate({ 
                        fornecedor_id: f.id, 
                        codigo: "NOVO", 
                        densidade_teorica: 2350 
                      })}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Adicionar traço
                    </Button>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="flex justify-end pt-4">
        <TestarAfericaoDialog fornecedores={fornecedores} />
      </div>

      {/* Modal de Edição de Traço Padrão */}
      <Dialog open={!!tracoEditando} onOpenChange={(open) => !open && setTracoEditando(null)}>
        <DialogContent className="sm:max-w-[425px] bg-foreground text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {tracoEditando?.id ? "Editar Traço Padrão" : "Novo Traço Padrão"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Insira os dados técnicos para a referência padrão.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-white/70">Código</Label>
                <Input 
                  value={tracoEditando?.codigo || ""} 
                  onChange={e => setTracoEditando({ ...tracoEditando, codigo: e.target.value })}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">FCK (MPa)</Label>
                <Input 
                  type="number"
                  value={tracoEditando?.fck || ""} 
                  onChange={e => setTracoEditando({ ...tracoEditando, fck: Number(e.target.value) })}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-white/70">ρ Teórica (kg/m³)</Label>
                <Input 
                  type="number"
                  value={tracoEditando?.densidade_teorica || ""} 
                  onChange={e => setTracoEditando({ ...tracoEditando, densidade_teorica: Number(e.target.value) })}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Tolerância (%)</Label>
                <Input 
                  type="number"
                  value={tracoEditando?.tolerancia_peso || ""} 
                  placeholder="4"
                  onChange={e => setTracoEditando({ ...tracoEditando, tolerancia_peso: e.target.value ? Number(e.target.value) : null })}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-white/70">Slump Nominal</Label>
                <Input 
                  type="number"
                  value={tracoEditando?.slump_nominal || ""} 
                  onChange={e => setTracoEditando({ ...tracoEditando, slump_nominal: Number(e.target.value) })}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Unidade Slump</Label>
                <Select 
                  value={tracoEditando?.slump_unidade || "cm"}
                  onValueChange={val => setTracoEditando({ ...tracoEditando, slump_unidade: val })}
                >
                  <SelectTrigger className="bg-black/20 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-foreground text-white border-white/10">
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="mm">mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTracoEditando(null)} className="text-white/60 hover:text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button 
              className="bg-primary hover:bg-primary-hover text-white"
              onClick={() => {
                const fornPadrao = fornecedores.find((f: any) => f.nome.toUpperCase() === "PADRÃO");
                if (!fornPadrao) {
                  toast.error("Referência PADRÃO não encontrada no banco.");
                  return;
                }
                mutTraco.mutate({ 
                  ...tracoEditando,
                  fornecedor_id: fornPadrao.id
                }, {
                  onSuccess: () => setTracoEditando(null)
                });
              }}

            >
              Salvar Traço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function TestarAfericaoDialog({ fornecedores }: { fornecedores: any[] }) {
  const [fornId, setFornId] = useState("");
  const [tracoId, setTracoId] = useState("");
  const [volume, setVolume] = useState("10");
  const [pesoEntrada, setPesoEntrada] = useState("34500");
  const [pesoSaida, setPesoSaida] = useState("11200");
  
  const selectedForn = fornecedores.find(f => f.id === fornId);
  const selectedTraco = selectedForn?.tracos?.find((t: any) => t.id === tracoId);

  const resultado = (selectedForn && selectedTraco) ? validarCargaConcreto({
    fornecedor: selectedForn,
    traco: selectedTraco,
    volume: Number(volume),
    modo: "dupla",
    pesoEntrada: Number(pesoEntrada),
    pesoSaida: Number(pesoSaida)
  }) : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-wine-100 text-primary hover:bg-wine-50">
          <FlaskConical className="mr-2 h-4 w-4" /> Testar aferição
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Simulador de Aferição</DialogTitle>
          <DialogDescription>
            Valide o cálculo de conferência de carga usando os parâmetros cadastrados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Select onValueChange={setFornId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Traço</Label>
              <Select onValueChange={setTracoId} disabled={!fornId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {selectedForn?.tracos?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.codigo} - {t.aplicacao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Volume (m³)</Label>
              <Input type="number" value={volume} onChange={e => setVolume(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Peso Entrada (kg)</Label>
              <Input type="number" value={pesoEntrada} onChange={e => setPesoEntrada(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Peso Saída (kg)</Label>
              <Input type="number" value={pesoSaida} onChange={e => setPesoSaida(e.target.value)} />
            </div>
          </div>

          {resultado && (
            <div className="rounded-lg border border-wine-100 bg-wine-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary">Resultado da Aferição</span>
                <Badge className={
                  resultado.status === 'conforme' ? 'bg-success' : 
                  resultado.status === 'abaixo' ? 'bg-destructive' : 'bg-warning'
                }>
                  {resultado.status.toUpperCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-muted-foreground">Peso Aferido:</div>
                <div className="font-bold text-right">{resultado.aferido.toLocaleString('pt-BR')} kg</div>
                <div className="text-muted-foreground">Peso Esperado:</div>
                <div className="font-bold text-right">{resultado.esperado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</div>
                <div className="text-muted-foreground">Desvio:</div>
                <div className={`font-bold text-right ${Math.abs(resultado.desvioPct) > resultado.tol ? 'text-destructive' : 'text-success'}`}>
                  {resultado.desvioPct.toFixed(2)}%
                </div>
                <div className="text-muted-foreground">Volume Equivalente:</div>
                <div className="font-bold text-right">{resultado.volumeEquiv.toFixed(2)} m³</div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
