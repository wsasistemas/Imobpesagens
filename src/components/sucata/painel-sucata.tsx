import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Recycle, Truck, Scale as ScaleIcon, Check, ChevronsUpDown, Camera, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useCelmiScale } from "@/hooks/useCelmiScale";
import { obrasQueryOptions } from "@/lib/pesagem-queries";
import {
  abrirProcessoSucata, atualizarDadosVeiculo, buscarDonoDaPlaca, buscarProcessoPendentePorPlaca,
  fecharProcessoSucata, salvarVeiculo, sucateirosAtivosQueryOptions, tiposSucataQueryOptions,
  veiculosAtivosQueryOptions,
} from "@/lib/sucata/sucata-queries";
import { calcularValorEPedirNota } from "@/lib/sucata/coleta.functions";
import { CLASSE_NUM, type ProcessoRow, type SucateiroRow, type VeiculoRow } from "@/lib/sucata/tipos";
import { formatarCnpjSucata, formatarCpf, formatarKg, normalizarPlaca } from "@/lib/sucata/validadores";
import { ListaProcessos } from "@/components/sucata/lista-processos";
import { MiniaturaFoto } from "@/components/sucata/miniatura-foto";
import { capturarEvidencia, evidenciasQueryOptions, posicoesVigentes } from "@/lib/sucata/evidencias-queries";
import {
  POSICAO_CACAMBA_CHEIA, POSICAO_CAMINHAO_VAZIO, POSICAO_FRENTE_PLACA, codigoDe, primeiraFaltanteBlocoA,
  rotuloDe,
} from "@/lib/sucata/posicoes-evidencia";
import { lerPlacaDaFoto } from "@/lib/sucata/ler-placa.functions";
import { comprimirImagem } from "@/lib/sucata/evidencias-queries";
import { registrarEvento } from "@/lib/sucata/sucata-queries";
import { Link } from "@tanstack/react-router";

function nomeSucateiro(s: SucateiroRow) {
  return s.razao_social ?? s.nome_fantasia ?? s.nome_completo ?? "(sem nome)";
}
function docSucateiro(s: SucateiroRow) {
  return s.tipo_pessoa === "PJ" ? formatarCnpjSucata(s.cnpj ?? "") : formatarCpf(s.cpf ?? "");
}

export function PainelSucata({ obraId }: { obraId: string | null }) {
  const qc = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const { data: tipos = [] } = useQuery(tiposSucataQueryOptions());
  const scale = useCelmiScale();
  const obra = obras.find((o) => o.id === obraId);

  const [modo, setModo] = useState<"entrada" | "saida">("entrada");

  // Entrada: sucateiro primeiro, placa depois.
  const [sucateiroId, setSucateiroId] = useState("");
  const [abertoSucateiro, setAbertoSucateiro] = useState(false);
  const [placa, setPlaca] = useState("");
  const [veiculo, setVeiculo] = useState<VeiculoRow | null>(null);
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [motoristaHabitual, setMotoristaHabitual] = useState("");


  // Saída: reconhecimento pela placa (inalterado).
  const [placaSaida, setPlacaSaida] = useState("");
  const [processo, setProcesso] = useState<ProcessoRow | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [motorista, setMotorista] = useState("");
  const [documento, setDocumento] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [pesoManual, setPesoManual] = useState("");
  // Fase 1: fotos do caminhão vazio e da frente com a placa, guardadas até o processo ser criado.
  const [fotoEntrada, setFotoEntrada] = useState<File | null>(null);
  const [fotoFrente, setFotoFrente] = useState<File | null>(null);
  const [placaLida, setPlacaLida] = useState<string | null>(null);
  const [lendoPlaca, setLendoPlaca] = useState(false);
  const [avisoPlaca, setAvisoPlaca] = useState<string | null>(null);
  const [houveDivergencia, setHouveDivergencia] = useState(false);
  // Fase 2: foto da caçamba cheia e breve descrição da carga.
  const [fotoSaida, setFotoSaida] = useState<File | null>(null);
  const [descricaoCarga, setDescricaoCarga] = useState("");

  const { data: sucateiros = [] } = useQuery(sucateirosAtivosQueryOptions());
  const { data: veiculosAtivos = [] } = useQuery(veiculosAtivosQueryOptions(sucateiroId || null));
  const sucateiro = sucateiros.find((s) => s.id === sucateiroId) ?? null;

  const pesoBalanca = scale.leitura?.peso ?? null;
  const estavel = scale.leitura?.estavel ?? false;
  const podeManual = isAdmin || isSuperAdmin;
  const peso = pesoBalanca ?? (podeManual && pesoManual ? Number(pesoManual) : null);
  const tiposAtivos = useMemo(() => tipos.filter((t) => t.ativo), [tipos]);

  const { data: evidencias = [] } = useQuery(evidenciasQueryOptions(processo?.id ?? null));
  const faltanteBlocoA = useMemo(
    () => (processo ? primeiraFaltanteBlocoA(posicoesVigentes(evidencias), processo.entrada_em) : null),
    [processo, evidencias],
  );
  const travado = modo === "saida" && !!processo && !!faltanteBlocoA;

  const placaNorm = normalizarPlaca(placa);
  const placaCompleta = modo === "entrada" && placaNorm.length >= 7;
  const placaDivergente = !!placaLida && placaNorm.length >= 7 && placaLida !== placaNorm;

  // Lê a placa na foto da frente e preenche o campo; o operador sempre pode corrigir.
  async function receberFotoFrente(arquivo: File | null) {
    setFotoFrente(arquivo);
    setPlacaLida(null);
    setAvisoPlaca(null);
    if (!arquivo) return;
    setLendoPlaca(true);
    try {
      const comprimida = await comprimirImagem(arquivo);
      const imagem = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Não foi possível ler a foto."));
        fr.readAsDataURL(comprimida);
      });
      const r = await lerPlacaDaFoto({ data: { imagem } });
      if (r.ok && r.placa) {
        setPlacaLida(r.placa);
        setPlaca(r.placa);
        toast.success(`Placa lida na foto: ${r.placa}. Confira antes de salvar.`);
      } else {
        setAvisoPlaca(r.motivo ?? "Placa não identificada na foto. Digite a placa.");
        toast.warning(r.motivo ?? "Placa não identificada na foto. Digite a placa.");
      }
    } catch (e) {
      setAvisoPlaca(e instanceof Error ? e.message : "Falha na leitura da placa. Digite a placa.");
    } finally {
      setLendoPlaca(false);
    }
  }

  useEffect(() => {
    setVeiculo(null);
    setProcesso(null);
  }, [modo]);

  useEffect(() => {
    if (placaDivergente) setHouveDivergencia(true);
  }, [placaDivergente]);

  function limparVeiculo() {
    setVeiculo(null);
    setTipoVeiculo("");
    setCapacidade("");
    setMotoristaHabitual("");
  }

  function aplicarVeiculo(v: VeiculoRow) {
    setVeiculo(v);
    setPlaca(v.placa);
    setTipoVeiculo(v.tipo_veiculo ?? "");
    setCapacidade(v.capacidade_kg ? String(v.capacidade_kg) : "");
    setMotoristaHabitual(v.motorista_habitual ?? "");
    setMotorista(v.motorista_habitual ?? "");
  }

  // Placa digitada que coincide com um caminhão já cadastrado do sucateiro
  // apenas sugere os dados conhecidos — nunca bloqueia a entrada.
  useEffect(() => {
    if (modo !== "entrada" || !sucateiroId || placaNorm.length < 7) return;
    const conhecido = veiculosAtivos.find((v) => normalizarPlaca(v.placa) === placaNorm);
    if (conhecido) {
      if (veiculo?.id !== conhecido.id) aplicarVeiculo(conhecido);
    } else if (veiculo) {
      limparVeiculo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, sucateiroId, placaNorm, veiculosAtivos]);

  // Garante um veículo vinculado ao sucateiro escolhido para a placa informada.
  async function resolverVeiculoId(): Promise<string> {
    const conhecido = veiculosAtivos.find((v) => normalizarPlaca(v.placa) === placaNorm);
    if (conhecido) {
      if (tipoVeiculo.trim() || capacidade || motoristaHabitual.trim()) {
        await atualizarDadosVeiculo(conhecido.id, {
          tipo_veiculo: tipoVeiculo.trim() || null,
          capacidade_kg: capacidade ? Number(capacidade) : null,
          motorista_habitual: motoristaHabitual.trim() || null,
        });
      }
      return conhecido.id;
    }
    const existente = await buscarDonoDaPlaca(placaNorm);
    if (existente) return existente.id;
    const id = await salvarVeiculo({
      sucateiro_id: sucateiroId,
      placa: placaNorm,
      tipo_veiculo: tipoVeiculo.trim() || null,
      capacidade_kg: capacidade ? Number(capacidade) : null,
      motorista_habitual: motoristaHabitual.trim() || null,
      situacao: "ATIVO",
    });
    await qc.invalidateQueries({ queryKey: ["sucata", "veiculos"] });
    return id;
  }


  const complementarVeiculo = useMutation({
    mutationFn: async () => {
      if (!veiculo) throw new Error("Nenhum veículo selecionado.");
      await atualizarDadosVeiculo(veiculo.id, {
        tipo_veiculo: tipoVeiculo.trim() || null,
        capacidade_kg: capacidade ? Number(capacidade) : null,
        motorista_habitual: motoristaHabitual.trim() || null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sucata", "veiculos"] });
      setVeiculo((v) =>
        v
          ? {
              ...v,
              tipo_veiculo: tipoVeiculo.trim() || null,
              capacidade_kg: capacidade ? Number(capacidade) : null,
              motorista_habitual: motoristaHabitual.trim() || null,
            }
          : v,
      );
      toast.success("Dados do caminhão salvos no cadastro.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buscarSaida = async () => {
    const pl = normalizarPlaca(placaSaida);
    if (pl.length < 7) { toast.error("Informe a placa completa."); return; }
    setBuscando(true);
    try {
      const p = await buscarProcessoPendentePorPlaca(pl, obraId);
      if (!p) throw new Error("Nenhum processo de sucata aguardando saída para esta placa.");
      setProcesso(p);
      setTipoId(p.tipo_sucata_id ?? "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBuscando(false);
    }
  };

  const acimaDaCapacidade =
    modo === "entrada" && !!peso && !!veiculo?.capacidade_kg && peso > Number(veiculo.capacidade_kg);

  const salvarEntrada = useMutation({
    mutationFn: async () => {
      if (!obraId || !obra) throw new Error("Selecione uma obra específica para registrar a entrada.");
      if (!sucateiro) throw new Error("Escolha o sucateiro.");
      if (placaNorm.length < 7) throw new Error("Informe a placa do caminhão que está chegando.");
      if (!motorista.trim()) throw new Error("Informe o motorista que está conduzindo o caminhão.");
      if (!fotoEntrada) throw new Error("Tire a foto do caminhão vazio com a placa visível.");
      if (!fotoFrente) throw new Error("Tire a foto da frente do caminhão com a placa visível.");
      if (lendoPlaca) throw new Error("Aguarde a leitura da placa na foto da frente.");
      if (placaDivergente) {
        throw new Error(
          `A placa digitada (${placaNorm}) é diferente da placa lida na foto (${placaLida}). Corrija a placa ou tire a foto novamente.`,
        );
      }
      if (!peso || peso <= 0) throw new Error("Sem peso de tara válido.");
      if (pesoBalanca !== null && !estavel) throw new Error("Aguarde a balança estabilizar.");
      const pend = await buscarProcessoPendentePorPlaca(placaNorm, null);
      if (pend) throw new Error(`A placa ${placaNorm} já tem o processo ${pend.numero} aguardando saída.`);
      const veiculoId = await resolverVeiculoId();
      const criado = await abrirProcessoSucata({
        obraId,
        coligada: obra.coligada,
        sucateiroId: sucateiro.id,
        veiculoId,
        placa: placaNorm,
        motorista: motorista.trim(),
        documentoMotorista: documento.trim() || null,
        taraKg: peso,
        tipoSucataId: tipoId || null,
        snapshotFiscal: {
          tipo_pessoa: sucateiro.tipo_pessoa,
          razao_social: sucateiro.razao_social,
          nome_completo: sucateiro.nome_completo,
          cnpj: sucateiro.cnpj,
          cpf: sucateiro.cpf,
          inscricao_estadual: sucateiro.inscricao_estadual,
          municipio: sucateiro.municipio,
          uf: sucateiro.uf,
          email_coleta: sucateiro.email_coleta,
          telefone: sucateiro.telefone,
          veiculo_placa: placaNorm,
          veiculo_tipo: tipoVeiculo.trim() || (veiculo?.tipo_veiculo ?? null),
          veiculo_capacidade_kg: capacidade ? Number(capacidade) : (veiculo?.capacidade_kg ?? null),

          motorista: motorista.trim(),
          documento_motorista: documento.trim() || null,
        },
        userId: user?.id ?? null,
      });
      await capturarEvidencia({
        processoId: criado.id,
        posicao: POSICAO_CAMINHAO_VAZIO,
        arquivo: fotoEntrada,
      });
      await capturarEvidencia({
        processoId: criado.id,
        posicao: POSICAO_FRENTE_PLACA,
        arquivo: fotoFrente,
      });
      // Auditoria da leitura automática da placa.
      try {
        await registrarEvento({
          entidade: "processo",
          entidadeId: criado.id,
          processoId: criado.id,
          fase: "1",
          coligada: obra.coligada,
          acao: placaLida ? "placa_lida_ocr" : "placa_nao_lida",
          payload: { placa_lida: placaLida, placa_gravada: placaNorm, houve_divergencia: houveDivergencia },
        });
      } catch {
        // A auditoria não impede o registro da entrada.
      }
      return criado;
    },

    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      toast.success(`Processo ${p.numero} aberto. Tara de ${formatarKg(p.tara_kg)} kg registrada.`);
      setSucateiroId(""); setPlaca(""); limparVeiculo();
      setMotorista(""); setDocumento(""); setPesoManual(""); setTipoId("");
      setFotoEntrada(null); setFotoFrente(null); setPlacaLida(null); setAvisoPlaca(null);
      setHouveDivergencia(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarSaida = useMutation({
    mutationFn: async () => {
      if (!processo) throw new Error("Busque a placa antes de salvar.");
      if (!peso || peso <= 0) throw new Error("Sem peso bruto válido.");
      if (pesoBalanca !== null && !estavel) throw new Error("Aguarde a balança estabilizar.");
      if (peso <= Number(processo.tara_kg)) {
        throw new Error("O peso bruto na saída deve ser maior que a tara registrada na entrada.");
      }
      if (!fotoSaida) throw new Error("Tire a foto da caçamba cheia com a sucata.");
      if (!descricaoCarga.trim()) throw new Error("Escreva uma breve descrição da carga.");
      await capturarEvidencia({
        processoId: processo.id,
        posicao: POSICAO_CACAMBA_CHEIA,
        arquivo: fotoSaida,
      });
      const p = await fecharProcessoSucata({
        processoId: processo.id,
        brutoKg: peso,
        tipoSucataId: tipoId || null,
        descricaoCarga: descricaoCarga.trim(),
        userId: user?.id ?? null,
      });
      // Com o peso aferido apurado, o sistema calcula os valores. O pedido da
      // nota só será enviado após a revisão manual da Fase 2.
      try {
        const r = await calcularValorEPedirNota({ data: { processoId: p.id } });
        return { p, valor: r, erro: null as string | null };
      } catch (e) {
        return { p, valor: null, erro: e instanceof Error ? e.message : "Não foi possível calcular o valor." };
      }
    },
    onSuccess: ({ p, valor, erro }) => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      toast.success(`Saída registrada no processo ${p.numero}. Peso aferido: ${formatarKg(p.peso_aferido_kg)} kg.`);
      if (valor) {
        const total = valor.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        toast.success(`Valor a pagar: ${total}.`);
        toast.success("Valores calculados. Revise a Fase 2 antes de solicitar a nota fiscal.");
      }
      if (erro) toast.warning(erro);
      setPlacaSaida(""); setProcesso(null); setPesoManual(""); setTipoId("");
      setFotoSaida(null); setDescricaoCarga("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aferidoPrevisto =
    modo === "saida" && processo && peso ? peso - Number(processo.tara_kg) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Recycle className="h-5 w-5 text-primary" />
        <div className="mr-auto">
          <div className="font-heading text-sm font-semibold">Modo Sucata — pesagem inversa</div>
          <div className="text-xs text-muted-foreground">
            Entrada registra a tara do caminhão vazio. Saída registra o peso bruto carregado.
          </div>
        </div>
        <Tabs value={modo} onValueChange={(v) => setModo(v as "entrada" | "saida")}>
          <TabsList>
            <TabsTrigger value="entrada">Entrada (tara)</TabsTrigger>
            <TabsTrigger value="saida">Saída (bruto)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <Truck className="h-4 w-4" />
              {modo === "entrada" ? "Quem está coletando" : "Reconhecimento pela placa"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {modo === "entrada" ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="mb-1 block text-xs">Sucateiro (cadastro ativo)</Label>
                    <Popover open={abertoSucateiro} onOpenChange={setAbertoSucateiro}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span className="truncate">
                            {sucateiro ? nomeSucateiro(sucateiro) : "Procurar por nome, CNPJ ou CPF"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Nome, CNPJ ou CPF..." />
                          <CommandList>
                            <CommandEmpty>Nenhum sucateiro ativo encontrado.</CommandEmpty>
                            <CommandGroup>
                              {sucateiros.map((s) => (
                                <CommandItem
                                  key={s.id}
                                  value={`${nomeSucateiro(s)} ${s.cnpj ?? ""} ${s.cpf ?? ""}`}
                                  onSelect={() => {
                                    setSucateiroId(s.id);
                                    setAbertoSucateiro(false);
                                    setPlaca("");
                                    limparVeiculo();
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${s.id === sucateiroId ? "opacity-100" : "opacity-0"}`} />
                                  <span className="mr-2">{nomeSucateiro(s)}</span>
                                  <span className={`ml-auto text-xs text-muted-foreground ${CLASSE_NUM}`}>
                                    {docSucateiro(s)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="mb-1 block text-xs">Placa do caminhão que está chegando</Label>
                    <Input
                      value={placa}
                      disabled={!sucateiroId}
                      onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                      className={`text-lg font-semibold ${CLASSE_NUM}`}
                      placeholder="ABC1D23"
                    />

                    {!!sucateiroId && veiculosAtivos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {veiculosAtivos.map((v) => (
                          <Button
                            key={v.id}
                            type="button"
                            size="sm"
                            variant={veiculo?.id === v.id ? "default" : "outline"}
                            onClick={() => aplicarVeiculo(v)}
                          >
                            <span className={CLASSE_NUM}>{v.placa}</span>
                            {v.tipo_veiculo ? <span className="ml-2 text-xs opacity-80">{v.tipo_veiculo}</span> : null}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>




                {sucateiro && (
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-2">
                    <Info rotulo="Sucateiro" valor={nomeSucateiro(sucateiro)} />
                    <Info rotulo={sucateiro.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} valor={docSucateiro(sucateiro)} mono />
                    <Info rotulo="Município / UF" valor={`${sucateiro.municipio ?? "—"} / ${sucateiro.uf ?? "—"}`} />
                    <Info rotulo="Inscrição estadual" valor={sucateiro.inscricao_estadual ?? "—"} mono />
                  </div>
                )}

                {placaCompleta && (
                  <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="font-heading text-sm font-semibold">
                      {veiculo ? "Veículo (cadastro deste sucateiro)" : "Dados do caminhão (opcionais)"}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <Label className="mb-1 block text-xs">Placa</Label>
                        <Input value={normalizarPlaca(placa)} readOnly className={`${CLASSE_NUM} bg-background`} />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs">Tipo / modelo</Label>
                        <Input
                          value={tipoVeiculo}
                          onChange={(e) => setTipoVeiculo(e.target.value)}
                          placeholder="Ex.: Truck, Carreta, Volvo FH"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs">Capacidade (kg)</Label>
                        <Input
                          type="number"
                          value={capacidade}
                          onChange={(e) => setCapacidade(e.target.value)}
                          className={CLASSE_NUM}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="mb-1 block text-xs">Motorista habitual</Label>
                        <Input value={motoristaHabitual} onChange={(e) => setMotoristaHabitual(e.target.value)} />
                      </div>
                      {veiculo && (
                        <div className="flex items-end">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => complementarVeiculo.mutate()}
                            disabled={complementarVeiculo.isPending}
                          >
                            Salvar no cadastro
                          </Button>
                        </div>
                      )}
                    </div>
                    {!veiculo && (
                      <p className="text-xs text-muted-foreground">
                        A placa <span className={CLASSE_NUM}>{normalizarPlaca(placa)}</span> será gravada e vinculada
                        a este sucateiro ao salvar a entrada.
                      </p>
                    )}
                  </div>
                )}


                {placaCompleta && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-xs">Motorista (obrigatório)</Label>
                      <Input value={motorista} onChange={(e) => setMotorista(e.target.value)} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Documento do motorista</Label>
                      <Input value={documento} onChange={(e) => setDocumento(e.target.value)} className={CLASSE_NUM} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Tipo de sucata (previsto)</Label>
                      <Select value={tipoId} onValueChange={setTipoId}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          {tiposAtivos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <BlocoFoto
                  titulo={`Foto ${codigoDe(POSICAO_FRENTE_PLACA)} — ${rotuloDe(POSICAO_FRENTE_PLACA)}`}
                  ajuda="Obrigatória. Tire a foto da frente do caminhão na balança, com a placa legível. O sistema lê a placa e preenche o campo."
                  arquivo={fotoFrente}
                  onArquivo={(f) => void receberFotoFrente(f)}
                />

                {lendoPlaca && (
                  <p className="text-xs text-muted-foreground">Lendo a placa na foto...</p>
                )}

                {placaLida && !placaDivergente && (
                  <div className="rounded-md border border-success/30 bg-success-soft p-2 text-sm text-success">
                    Placa lida na foto: <span className={CLASSE_NUM}>{placaLida}</span> — confere com a placa
                    informada.
                  </div>
                )}

                {placaDivergente && (
                  <Alert className="border-primary/40 bg-primary/5">
                    <AlertDescription className="text-sm">
                      Placa divergente: a foto mostra{" "}
                      <strong className={CLASSE_NUM}>{placaLida}</strong> e o campo está com{" "}
                      <strong className={CLASSE_NUM}>{placaNorm}</strong>. Corrija a placa ou tire a foto da frente
                      novamente para liberar o registro da entrada.
                    </AlertDescription>
                  </Alert>
                )}

                {avisoPlaca && !placaLida && (
                  <Alert>
                    <AlertDescription className="text-sm">
                      {avisoPlaca} A foto da frente continua obrigatória.
                    </AlertDescription>
                  </Alert>
                )}

                {placaCompleta && (
                  <BlocoFoto
                    titulo={`Foto ${codigoDe(POSICAO_CAMINHAO_VAZIO)} — ${rotuloDe(POSICAO_CAMINHAO_VAZIO)}`}
                    ajuda="Tire a foto do caminhão vazio com a placa visível. Ela é enviada junto com a entrada."
                    arquivo={fotoEntrada}
                    onArquivo={setFotoEntrada}
                  />
                )}
              </>

            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-40">
                    <Label className="mb-1 block text-xs">Placa</Label>
                    <Input
                      value={placaSaida}
                      onChange={(e) => setPlacaSaida(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") void buscarSaida(); }}
                      className={`text-lg font-semibold ${CLASSE_NUM}`}
                      placeholder="ABC1D23"
                    />
                  </div>
                  <Button onClick={() => void buscarSaida()} disabled={buscando}>
                    {buscando ? "Buscando..." : "Buscar"}
                  </Button>
                </div>

                {processo && (
                  <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <Info rotulo="Processo" valor={processo.numero} mono />
                      <Info rotulo="Placa" valor={processo.placa} mono />
                      <Info rotulo="Tara registrada (kg)" valor={formatarKg(processo.tara_kg)} mono />
                      <Info rotulo="Motorista" valor={processo.motorista ?? "—"} />
                    </div>
                    <div className="md:w-1/2">
                      <Label className="mb-1 block text-xs">Tipo de sucata</Label>
                      <Select value={tipoId} onValueChange={setTipoId}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {tiposAtivos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {faltanteBlocoA ? (
                      <div className="rounded-md border border-primary-dark/30 bg-primary-dark/10 p-3 text-sm text-primary-dark">
                        <div className="flex items-center gap-2 font-semibold">
                          <Lock className="h-4 w-4" /> Fase 1 incompleta
                        </div>
                        <div className="mt-1">
                          Falta a foto <span className={CLASSE_NUM}>{codigoDe(faltanteBlocoA.posicao)}</span> —{" "}
                          {faltanteBlocoA.rotulo}. A saída não pode ser registrada sem ela.
                        </div>
                        <Button asChild size="sm" variant="outline" className="mt-2">
                          <Link to="/sucata/$id/evidencias" params={{ id: processo.id }}>
                            <Camera className="mr-2 h-4 w-4" /> Registrar a foto
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-md border border-success/30 bg-success-soft p-2 text-sm text-success">
                        Fase 1 concluída: fotos do caminhão vazio e da frente com a placa registradas.
                      </div>
                    )}

                    <BlocoFoto
                      titulo={`Foto ${codigoDe(POSICAO_CACAMBA_CHEIA)} — ${rotuloDe(POSICAO_CACAMBA_CHEIA)}`}
                      ajuda="Tire a foto da caçamba cheia antes de registrar a saída."
                      arquivo={fotoSaida}
                      onArquivo={setFotoSaida}
                    />

                    <div>
                      <Label className="mb-1 block text-xs">Breve descrição da carga</Label>
                      <Textarea
                        rows={2}
                        value={descricaoCarga}
                        onChange={(e) => setDescricaoCarga(e.target.value)}
                        placeholder="Ex.: vergalhão, perfis e chapas"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <ScaleIcon className="h-4 w-4" />
              {modo === "entrada" ? "Tara (caminhão vazio)" : "Bruto (caminhão carregado)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-background p-4 text-center">
              <div className={`text-3xl font-bold ${CLASSE_NUM}`}>
                {peso ? formatarKg(peso) : "—"} <span className="text-base font-normal">kg</span>
              </div>
              <div className="mt-1">
                {scale.status === "connected" ? (
                  <Badge variant="outline" className={estavel
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-warning/30 bg-warning-soft text-warning"}>
                    {estavel ? "Balança estável" : "Aguardando estabilizar"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                    Balança desconectada
                  </Badge>
                )}
              </div>
            </div>

            {scale.supported && scale.status !== "connected" && (
              <Button variant="secondary" className="w-full" onClick={scale.conectar}>Conectar balança</Button>
            )}

            {podeManual && (
              <div>
                <Label className="mb-1 block text-xs">Peso manual (kg) — apenas administrador</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="Ex.: 12500"
                  value={pesoManual}
                  onChange={(e) => setPesoManual(e.target.value)}
                  className={CLASSE_NUM}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Com a balança desconectada, o peso digitado aqui é usado para salvar a pesagem.
                </p>
              </div>
            )}


            {acimaDaCapacidade && (
              <Alert>
                <AlertDescription className="text-sm">
                  Atenção: a tara lida é maior que a capacidade cadastrada para este caminhão
                  (<span className={CLASSE_NUM}>{formatarKg(Number(veiculo?.capacidade_kg))}</span> kg). Confira
                  a placa e a balança.
                </AlertDescription>
              </Alert>
            )}

            {aferidoPrevisto !== null && (
              <Alert>
                <AlertDescription className="text-sm">
                  Peso aferido previsto:{" "}
                  <strong className={CLASSE_NUM}>{formatarKg(aferidoPrevisto)} kg</strong>. O valor
                  definitivo é calculado pelo banco de dados.
                </AlertDescription>
              </Alert>
            )}

            {modo === "entrada" ? (
              <>
                <Button
                  className="w-full"
                  onClick={() => salvarEntrada.mutate()}
                  disabled={salvarEntrada.isPending || lendoPlaca || placaDivergente}
                >
                  {salvarEntrada.isPending ? "Salvando..." : "Salvar entrada (tara)"}
                </Button>
                {placaDivergente && (
                  <p className="text-xs text-primary">
                    Bloqueado: a placa digitada não confere com a placa lida na foto da frente.
                  </p>
                )}
                {(!sucateiro || !placaCompleta || !motorista.trim() || !fotoEntrada || !fotoFrente || !peso) && (
                  <p className="text-xs text-muted-foreground">
                    Falta:{" "}
                    {[
                      !sucateiro ? "escolher o sucateiro" : null,
                      !placaCompleta ? "informar a placa do caminhão" : null,
                      !motorista.trim() ? "informar o motorista" : null,
                      !fotoFrente ? "tirar a foto da frente com a placa" : null,
                      !fotoEntrada ? "tirar a foto do caminhão vazio" : null,
                      !peso ? "peso da balança ou peso manual" : null,
                    ].filter(Boolean).join(" • ")}
                  </p>
                )}
              </>
            ) : (

              <>
                <Button
                  className="w-full"
                  onClick={() => salvarSaida.mutate()}
                  disabled={salvarSaida.isPending || !processo || travado}
                >
                  {salvarSaida.isPending ? "Salvando..." : "Registrar saída (bruto)"}
                </Button>
                {travado && faltanteBlocoA && (
                  <p className="text-xs text-primary-dark">
                    Bloqueado: falta a foto {codigoDe(faltanteBlocoA.posicao)} — {faltanteBlocoA.rotulo}.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ListaProcessos obraId={obraId} />
    </div>
  );
}

function Info({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className={mono ? `font-medium ${CLASSE_NUM}` : "font-medium"}>{valor}</div>
    </div>
  );
}

function BlocoFoto({
  titulo,
  ajuda,
  arquivo,
  onArquivo,
}: {
  titulo: string;
  ajuda: string;
  arquivo: File | null;
  onArquivo: (f: File | null) => void;
}) {
  const id = `foto-${titulo.replace(/\W+/g, "-").toLowerCase()}`;
  const abrirCamera = () => document.getElementById(id)?.click();
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-56 flex-1 space-y-2">
          <div className="font-heading text-sm font-semibold">{titulo}</div>
          <p className="text-xs text-muted-foreground">{ajuda}</p>
          <input
            id={id}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              onArquivo(f);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={arquivo ? "outline" : "secondary"} onClick={abrirCamera}>
              <Camera className="mr-2 h-4 w-4" /> {arquivo ? "Tirar outra foto" : "Tirar foto"}
            </Button>
            {arquivo ? (
              <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
                <Check className="mr-1 h-3 w-3" /> Foto registrada
              </Badge>
            ) : (
              <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                Pendente
              </Badge>
            )}
          </div>
        </div>
        <MiniaturaFoto arquivo={arquivo} rotulo={titulo} onTirarOutra={abrirCamera} />
      </div>
    </div>
  );
}
