// Formulário da Nota Fiscal Avulsa (Fase 3 — Contabilidade), no desenho do
// modelo oficial. Todos os campos são editáveis; o que o sistema já sabe entra
// preenchido. O rascunho é salvo no processo.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Eye, FileSignature, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { salvarFormularioNfa, type DadosNfa } from "@/lib/sucata/nfa.functions";
import { CertificadoDigitalDialog } from "./certificado-digital-dialog";
import { CfopCombobox } from "./cfop-combobox";
import { NfaPreviewDialog } from "./nfa-preview-dialog";


type Props = {
  processoId: string;
  dados: DadosNfa;
  podeEditar: boolean;
  numero: string;
  onNumero: (v: string) => void;
  emissao: string;
  onEmissao: (v: string) => void;
  refNumero?: React.Ref<HTMLInputElement>;
  /** Chamado depois que a nota é confirmada e enviada à obra. */
  onConfirmado?: () => void;
};

const num = (v: number | null | undefined): string =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

// Valores monetários entram já mascarados: sempre 2 casas decimais (pt-BR).
const moedaNum = (v: number | null | undefined): string =>
  v === null || v === undefined
    ? ""
    : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Máscara de moeda digitada: vírgula = decimal, ponto = milhar.
const mascaraMoeda = (digitado: string): string => {
  const t = digitado.replace(/[^\d.,]/g, "");
  const idxVirg = t.lastIndexOf(",");
  if (idxVirg >= 0) {
    const inteira = t.slice(0, idxVirg).replace(/\D/g, "");
    const dec = t.slice(idxVirg + 1).replace(/\D/g, "").slice(0, 2);
    const inteiroFmt = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return dec ? `${inteiroFmt},${dec}` : `${inteiroFmt},`;
  }
  const soDigitos = t.replace(/\D/g, "");
  return soDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Ao sair do campo, completa as 2 casas decimais e remove zeros à esquerda.
const completarMoeda = (t: string): string => {
  if (!t.trim()) return "";
  const base = t.includes(",") ? t : `${t},`;
  const [i = "", d = ""] = base.split(",");
  const digitos = i.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const inteiroFmt = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".") || "0";
  const dec = (d + "00").slice(0, 2);
  return `${inteiroFmt},${dec}`;
};

export function FormularioNfa({
  processoId,
  dados,
  podeEditar,
  numero,
  onNumero,
  emissao,
  onEmissao,
  refNumero,
  onConfirmado,
}: Props) {
  const salvar = useServerFn(salvarFormularioNfa);
  
  const [certAberto, setCertAberto] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);
  // Com substituição pendente a nota anterior foi cancelada: a emissão volta a ficar liberada.
  const emitida = dados.nfaAnexada && !dados.substituicaoPendente;

  const padroes = useMemo<Record<string, string>>(
    () => ({
      emitNome: dados.emitente.nome,
      emitCnpj: dados.emitente.cnpj,
      emitEndereco: dados.emitente.endereco,
      emitUf: dados.emitente.uf,
      destNome: dados.destinatario.nome,
      destDoc: dados.destinatario.documento,
      destEndereco: dados.destinatario.logradouro,
      destBairro: dados.destinatario.bairro,
      destCep: dados.destinatario.cep,
      destMunicipio: dados.destinatario.municipio,
      destUf: dados.destinatario.uf,
      destFone: dados.destinatario.telefone,
      destIe: dados.destinatario.inscricaoEstadual,
      prodDescricao: dados.produto.descricao,
      prodUnidade: "KG",
      prodQuantidade: num(dados.produto.quantidadeKg),
      prodValorUnitario: moedaNum(dados.produto.valorUnitario),
      prodValorTotal: moedaNum(dados.produto.valorTotal),
      valorProdutos: moedaNum(dados.produto.valorTotal),
      valorNota: moedaNum(dados.produto.valorTotal),
      transpPlaca: dados.transporte.placa,
      transpUf: dados.destinatario.uf,
      transpFretePorConta: "2",
      pesoBruto: num(dados.transporte.pesoBrutoKg),
      pesoLiquido: num(dados.transporte.pesoLiquidoKg),
      volQuantidade: "1",
      volEspecie: "GRANEL",
    }),
    [dados],
  );

  const [campos, setCampos] = useState<Record<string, string>>({ ...padroes, ...dados.formulario });
  const [cfop, setCfop] = useState(dados.cfopSugerido ?? "");
  const [natureza, setNatureza] = useState(dados.naturezaSugerida);

  useEffect(() => {
    setCampos({ ...padroes, ...dados.formulario });
    setCfop(dados.cfopSugerido ?? "");
    setNatureza(dados.naturezaSugerida);
  }, [padroes, dados.formulario, dados.cfopSugerido, dados.naturezaSugerida]);

  // O Nº de controle do formulário é sempre o número da nota — nunca texto livre.
  useEffect(() => {
    setCampos((a) => (a.numeroControle === numero ? a : { ...a, numeroControle: numero }));
  }, [numero]);

  const set = (k: string) => (e: { target: { value: string } }) =>
    setCampos((a) => ({ ...a, [k]: e.target.value }));

  const trocarCfop = (codigo: string) => {
    setCfop(codigo);
    const opcao = dados.cfops.find((c) => c.codigo === codigo);
    if (opcao) setNatureza(opcao.descricao);
  };

  const acaoSalvar = useMutation({
    mutationFn: async () =>
      salvar({
        data: {
          processoId,
          cfop: cfop || null,
          natureza: natureza || null,
          formulario: campos,
        },
      }),
    onSuccess: () => toast.success("Rascunho do formulário salvo no processo."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar o rascunho."),
  });

  // Antes de abrir a pré-visualização, guarda o rascunho para a folha refletir a tela.
  const abrirPreview = useMutation({
    mutationFn: async () => {
      if (!numero.trim()) throw new Error("Informe o número da nota.");
      if (!emissao) throw new Error("Informe a data de emissão.");
      if (podeEditar) {
        await salvar({ data: { processoId, cfop: cfop || null, natureza: natureza || null, formulario: campos } });
      }
    },
    onSuccess: () => setPreviewAberto(true),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível abrir a pré-visualização."),
  });




  const campo = (k: string, rotulo: string, opts?: { numerico?: boolean; moeda?: boolean; largura?: string }) => (
    <div className={`space-y-1 ${opts?.largura ?? ""}`}>
      <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</Label>
      <Input
        value={campos[k] ?? ""}
        onChange={(e) =>
          setCampos((a) => ({ ...a, [k]: opts?.moeda ? mascaraMoeda(e.target.value) : e.target.value }))
        }
        onBlur={opts?.moeda ? () => setCampos((a) => ({ ...a, [k]: completarMoeda(a[k] ?? "") })) : undefined}
        disabled={!podeEditar}
        className={`h-8 ${opts?.numerico || opts?.moeda ? CLASSE_NUM : ""}`}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="font-heading text-base">Formulário da Nota Fiscal Avulsa</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => acaoSalvar.mutate()} disabled={!podeEditar || acaoSalvar.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar rascunho
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => abrirPreview.mutate()}
            disabled={abrirPreview.isPending}
          >
            <Eye className="mr-2 h-4 w-4" /> {emitida ? "Ver a nota emitida" : "Pré-visualizar nota"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
            <div>
              <p className="font-heading text-base font-semibold">NOTA FISCAL AVULSA</p>
              <p className="text-xs text-muted-foreground">Saída — {dados.numero}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">Nº da nota</Label>
                <Input
                  ref={refNumero}
                  value={numero}
                  onChange={(e) => onNumero(e.target.value)}
                  disabled={!podeEditar}
                  className={`h-8 w-32 ${CLASSE_NUM}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">Data de emissão</Label>
                <Input
                  type="date"
                  value={emissao}
                  onChange={(e) => onEmissao(e.target.value)}
                  disabled={!podeEditar}
                  className={`h-8 ${CLASSE_NUM}`}
                />
              </div>
            </div>
          </div>

          <Secao titulo="Natureza da operação e CFOP">
            <div className="space-y-1 col-span-2 xl:col-span-3">
              <Label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                CFOP — busque pelo código ou pela descrição
              </Label>
              <CfopCombobox
                opcoes={dados.cfops}
                valor={cfop}
                escopoSugerido={dados.escopoSugerido}
                disabled={!podeEditar}
                onSelecionar={(opcao) => trocarCfop(opcao.codigo)}
              />
            </div>
            <div className="space-y-1 col-span-2 xl:col-span-3">
              <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">Natureza da operação</Label>
              <Input value={natureza} onChange={(e) => setNatureza(e.target.value)} disabled={!podeEditar} className="h-8" />
            </div>
          </Secao>


          <Secao titulo="Remetente / Emitente">
            {campo("emitNome", "Nome / Razão social", { largura: "col-span-2" })}
            {campo("emitCnpj", "CNPJ", { numerico: true })}
            {campo("emitIe", "Inscrição estadual", { numerico: true })}
            {campo("emitEndereco", "Endereço", { largura: "col-span-2" })}
            {campo("emitMunicipio", "Município")}
            {campo("emitUf", "UF")}
            {campo("emitBairro", "Bairro / Distrito")}
            {campo("emitCep", "CEP", { numerico: true })}
            {campo("emitFone", "Fone / Fax", { numerico: true })}
            {campo("emitHoraSaida", "Hora da saída", { numerico: true })}
          </Secao>

          <Secao titulo="Destinatário">
            {campo("destNome", "Nome / Razão social", { largura: "col-span-2" })}
            {campo("destDoc", "CNPJ / CPF", { numerico: true })}
            {campo("destIe", "Inscrição estadual", { numerico: true })}
            {campo("destEndereco", "Endereço", { largura: "col-span-2" })}
            {campo("destBairro", "Bairro / Distrito")}
            {campo("destCep", "CEP", { numerico: true })}
            {campo("destMunicipio", "Município")}
            {campo("destUf", "UF")}
            {campo("destFone", "Fone / Fax", { numerico: true })}
            {campo("destDataSaida", "Data da saída / entrada", { numerico: true })}
          </Secao>

          <Secao titulo="Dados do produto">
            {campo("prodCodigo", "Código")}
            {campo("prodDescricao", "Descrição dos produtos", { largura: "col-span-2" })}
            {campo("prodNcm", "Classificação fiscal (NCM)", { numerico: true })}
            {campo("prodCst", "Situação tributária (CST)", { numerico: true })}
            {campo("prodUnidade", "Unidade")}
            {campo("prodQuantidade", "Quantidade", { numerico: true })}
            {campo("prodValorUnitario", "Valor unitário", { moeda: true })}
            {campo("prodValorTotal", "Valor total", { moeda: true })}
            {campo("prodAliqIcms", "Alíquota ICMS", { numerico: true })}
            {campo("prodAliqIpi", "Alíquota IPI", { numerico: true })}
            {campo("prodValorIpi", "Valor do IPI", { moeda: true })}
          </Secao>

          <Secao titulo="Cálculo do imposto">
            {campo("baseIcms", "Base de cálculo do ICMS", { moeda: true })}
            {campo("valorIcms", "Valor do ICMS", { moeda: true })}
            {campo("baseIcmsSt", "Base ICMS substituição", { moeda: true })}
            {campo("valorIcmsSt", "Valor ICMS substituição", { moeda: true })}
            {campo("valorProdutos", "Valor total dos produtos", { moeda: true })}
            {campo("valorFrete", "Valor do frete", { moeda: true })}
            {campo("valorSeguro", "Valor do seguro", { moeda: true })}
            {campo("outrasDespesas", "Outras despesas", { moeda: true })}
            {campo("valorIpi", "Valor total do IPI", { moeda: true })}
            {campo("valorNota", "Valor total da nota", { moeda: true })}
          </Secao>

          <Secao titulo="Transportador / volumes transportados">
            {campo("transpNome", "Nome / Razão social", { largura: "col-span-2" })}
            {campo("transpFretePorConta", "Frete por conta (1 emitente / 2 destinatário)")}
            {campo("transpPlaca", "Placa do veículo")}
            {campo("transpUf", "UF")}
            {campo("transpCnpj", "CNPJ / CPF", { numerico: true })}
            {campo("transpEndereco", "Endereço", { largura: "col-span-2" })}
            {campo("transpMunicipio", "Município")}
            {campo("transpIe", "Inscrição estadual", { numerico: true })}
            {campo("volQuantidade", "Quantidade", { numerico: true })}
            {campo("volEspecie", "Espécie")}
            {campo("volMarca", "Marca")}
            {campo("volNumero", "Número", { numerico: true })}
            {campo("pesoBruto", "Peso bruto (kg)", { numerico: true })}
            {campo("pesoLiquido", "Peso líquido (kg)", { numerico: true })}
          </Secao>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-heading text-sm font-semibold">Informações complementares</p>
              <Button size="sm" variant="outline" onClick={() => setCertAberto(true)} disabled={!podeEditar}>
                <BadgeCheck className="mr-2 h-4 w-4" /> Certificado Digital
              </Button>
            </div>
            <Textarea
              value={campos["informacoesComplementares"] ?? ""}
              onChange={set("informacoesComplementares")}
              disabled={!podeEditar}
              rows={3}
            />
            {campos["certificado"] && (
              <pre className={`whitespace-pre-wrap rounded-md border border-success/30 bg-success-soft p-3 text-xs text-success ${CLASSE_NUM}`}>
                {campos["certificado"]}
              </pre>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {campo("reservadoFisco", "Reservado ao fisco")}
              <div className="space-y-1">
                <Label className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  Nº de controle do formulário
                </Label>
                <Input value={numero} disabled className={`h-8 ${CLASSE_NUM}`} />
                <p className="text-[10px] text-muted-foreground">Sempre igual ao número da nota.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ação única e definitiva da Contabilidade */}
        <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary-soft p-4">
          <p className="font-heading text-base font-semibold">Emissão da Nota Fiscal Avulsa</p>
          <p className={`mt-1 text-sm text-muted-foreground ${CLASSE_NUM}`}>
            Número {numero || "—"} · Emissão {emissao ? emissao.split("-").reverse().join("/") : "—"}
          </p>
          {emitida ? (
            <div className="mt-3 space-y-2">
              <p className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-1 text-sm font-medium text-success">
                <BadgeCheck className="h-4 w-4" /> Nota emitida
                {dados.nfaEmissao ? ` em ${dados.nfaEmissao.split("-").reverse().join("/")}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                A emissão é definitiva. Nova nota desta venda só após cancelamento e reabertura pelo TI.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Confira os dados e o certificado antes de emitir.</p>
              <Button
                size="lg"
                className="mt-3 h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
                onClick={() => abrirPreview.mutate()}
                disabled={!podeEditar || !dados.aprovadoEm || abrirPreview.isPending}
              >
                <FileSignature className="mr-2 h-5 w-5" /> EMITIR NOTA FISCAL AVULSA
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                A emissão é definitiva. Uma nova nota desta venda só será possível se esta emissão for cancelada e a
                emissão do mesmo processo for reaberta.
              </p>
            </>
          )}
        </div>
      </CardContent>

      <CertificadoDigitalDialog
        aberto={certAberto}
        onFechar={() => setCertAberto(false)}
        onEstampar={(texto) => {
          setCampos((a) => ({ ...a, certificado: texto }));
          setCertAberto(false);
          toast.success("Certificado estampado nas informações complementares.");
        }}
      />

      <NfaPreviewDialog
        aberto={previewAberto}
        onFechar={() => setPreviewAberto(false)}
        processoId={processoId}
        processo={dados.numero}
        campos={campos}
        cfop={cfop}
        natureza={natureza}
        numero={numero}
        emissao={emissao}
        podeConfirmar={podeEditar && !!dados.aprovadoEm && !emitida}
        somenteLeitura={emitida}
        onConfirmado={onConfirmado}
      />
    </Card>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <p className="font-heading text-sm font-semibold">{titulo}</p>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
