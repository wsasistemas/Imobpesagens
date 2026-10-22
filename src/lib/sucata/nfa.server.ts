// Servidor: dados da Nota Fiscal Avulsa, e-mails da Contabilidade e do sucateiro.
// Nunca importado por componentes — só por *.functions.ts.
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatarKg } from "./validadores";
import { BUCKETS } from "@/integrations/db-schema";

type Admin = SupabaseClient<Database>;

export type ProcessoNfa = {
  id: string;
  numero: string;
  placa: string;
  tara_kg: number;
  bruto_kg: number | null;
  peso_aferido_kg: number | null;
  valor_total: number | null;
  valor_por_tonelada: number | null;
  entrada_em: string;
  saida_em: string | null;
  coligada_origem: string;
  obra_id: string;
  aceite_em: string | null;
  aprovado_em: string | null;
  aprovacao_observacao: string | null;
  pagamento_valor: number | null;
  pagamento_data: string | null;
  pagamento_conta_divergente: boolean | null;
  pagamento_justificativa: string | null;
  nfa_numero: string | null;
  nfa_emissao: string | null;
  nfa_storage_path: string | null;
  nfa_enviada_em: string | null;
  nfa_exportada_em: string | null;
  valor_ajustado_em: string | null;
  nfa_impedimento_motivo: string | null;
  nfa_solicitada_em: string | null;
  nfa_natureza_operacao: string | null;
  nfa_cfop: string | null;
  nfa_formulario: Record<string, unknown> | null;
  valor_unitario_kg: number | null;
  obra: {
    nome: string;
    engenheiro_email: string | null;
    coligada: string;
    cnpj: string | null;
    endereco: string | null;
  } | null;
  tipo: { nome: string } | null;
  sucateiro: {
    id: string;
    tipo_pessoa: string;
    razao_social: string | null;
    nome_completo: string | null;
    cnpj: string | null;
    cpf: string | null;
    email_coleta: string;
    email_financeiro: string | null;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    municipio: string;
    uf: string;
    telefone: string | null;
    inscricao_estadual: string | null;
  } | null;
};

export const PROCESSO_NFA_SELECT = `
  id, numero, placa, tara_kg, bruto_kg, peso_aferido_kg, valor_total, valor_por_tonelada,
  entrada_em, saida_em, coligada_origem, obra_id, aceite_em,
  aprovado_em, aprovacao_observacao, pagamento_valor, pagamento_data,
  pagamento_conta_divergente, pagamento_justificativa,
  nfa_numero, nfa_emissao, nfa_storage_path, nfa_enviada_em, nfa_exportada_em, nfa_impedimento_motivo,
  nfa_solicitada_em, valor_ajustado_em,
  nfa_natureza_operacao, nfa_cfop, nfa_formulario, valor_unitario_kg,
  obra:obras(nome, engenheiro_email, coligada, cnpj, endereco),
  tipo:sucata_tipos(nome),
  sucateiro:sucata_sucateiros(
    id, tipo_pessoa, razao_social, nome_completo, cnpj, cpf, email_coleta, email_financeiro,
    cep, logradouro, numero, complemento, bairro, municipio, uf, telefone, inscricao_estadual
  )
`;

export function hashArquivo(base64OuDataUrl: string): string {
  const puro = base64OuDataUrl.includes(",")
    ? base64OuDataUrl.slice(base64OuDataUrl.indexOf(",") + 1)
    : base64OuDataUrl;
  return createHash("sha256").update(puro).digest("hex");
}

export function nomeDestinatario(s: ProcessoNfa["sucateiro"]): string {
  if (!s) return "—";
  return (s.tipo_pessoa === "PJ" ? s.razao_social : s.nome_completo) ?? "—";
}

export function documentoDestinatario(s: ProcessoNfa["sucateiro"]): string {
  if (!s) return "—";
  const d = (s.tipo_pessoa === "PJ" ? s.cnpj : s.cpf) ?? "";
  const n = d.replace(/\D/g, "");
  if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d || "—";
}

export function enderecoDestinatario(s: ProcessoNfa["sucateiro"]): string {
  if (!s) return "—";
  const compl = s.complemento?.trim() ? `, ${s.complemento.trim()}` : "";
  return `${s.logradouro}, ${s.numero}${compl} — ${s.bairro} — ${s.municipio}/${s.uf} — CEP ${s.cep}`;
}

export function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI",
  "PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;

/** UF do emitente (obra) lida do endereço cadastrado; sem endereço, assume RJ. */
export function ufDaObra(endereco: string | null | undefined): string {
  const texto = (endereco ?? "").toUpperCase();
  let achada: string | null = null;
  for (const uf of UFS) {
    const re = new RegExp(`(^|[^A-Z])${uf}([^A-Z]|$)`);
    const pos = texto.search(re);
    if (pos >= 0) achada = uf;
  }
  return achada ?? "RJ";
}

/** Dentro do estado usa a faixa 5.xxx; para outro estado, 6.xxx. */
export function escopoCfop(ufObra: string, ufDestino: string | null | undefined): "INTERNO" | "INTERESTADUAL" {
  return (ufDestino ?? "").toUpperCase() === ufObra.toUpperCase() ? "INTERNO" : "INTERESTADUAL";
}

/** Linhas de dados da NFA, na ordem em que a Contabilidade digita a nota. */
export function camposNfa(p: ProcessoNfa): { rotulo: string; valor: string }[] {
  return [
    { rotulo: "Obra", valor: p.obra?.nome ?? "—" },
    { rotulo: "Coligada", valor: p.coligada_origem },
    { rotulo: "Processo", valor: p.numero },
    { rotulo: "Destinatário", valor: nomeDestinatario(p.sucateiro) },
    { rotulo: "CNPJ / CPF", valor: documentoDestinatario(p.sucateiro) },
    { rotulo: "Endereço", valor: enderecoDestinatario(p.sucateiro) },
    { rotulo: "Natureza da operação", valor: "Venda de sucata" },
    { rotulo: "Produto", valor: p.tipo?.nome ?? "Sucata ferrosa" },
    { rotulo: "Quantidade (kg)", valor: formatarKg(p.peso_aferido_kg) },
    { rotulo: "Valor total", valor: moeda(p.valor_total) },
    { rotulo: "Data da coleta", valor: dataBr(p.saida_em ?? p.entrada_em) },
    { rotulo: "Placa", valor: p.placa },
  ];
}

function tabela(linhas: { rotulo: string; valor: string }[]): string {
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${linhas
    .map(
      (l) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#555">${l.rotulo}</td><td style="padding:6px 0;font-weight:600">${l.valor}</td></tr>`,
    )
    .join("")}</table>`;
}

function moldura(titulo: string, corpo: string): string {
  return `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px">
    <div style="background:#B0202E;color:#fff;padding:14px 18px;font-size:16px;font-weight:700">${titulo}</div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:18px">${corpo}</div>
    <div style="color:#6b7280;font-size:12px;padding:10px 2px">Portal de Pesagem — mensagem automática.</div>
  </div>`;
}

export function assuntoSolicitacaoNfa(p: ProcessoNfa): string {
  return `Solicitação de Nota Fiscal Avulsa — ${p.numero} — ${p.obra?.nome ?? p.coligada_origem}`;
}

export function htmlSolicitacaoNfa(
  p: ProcessoNfa,
  anexos: { rotulo: string; url: string }[],
): string {
  const links = anexos.length
    ? `<p style="font-size:14px">Documentos (links válidos por tempo limitado):</p><ul style="font-size:14px">${anexos
        .map((a) => `<li><a href="${a.url}">${a.rotulo}</a></li>`)
        .join("")}</ul>`
    : "";
  return moldura(
    "Emissão de Nota Fiscal Avulsa — Venda de sucata",
    `<p style="font-size:14px">O administrativo da obra aprovou o recibo e o comprovante de pagamento. Segue a solicitação de emissão da Nota Fiscal Avulsa.</p>
     ${tabela(camposNfa(p))}
     ${links}`,
  );
}

export function textoSolicitacaoNfa(p: ProcessoNfa): string {
  return camposNfa(p)
    .map((l) => `${l.rotulo}: ${l.valor}`)
    .join("\n");
}

export function assuntoEnvioNfa(p: ProcessoNfa): string {
  return `Nota Fiscal Avulsa ${p.nfa_numero ?? ""} — coleta de sucata ${p.numero}`.trim();
}

export function htmlEnvioNfa(p: ProcessoNfa, url: string): string {
  return moldura(
    "Nota Fiscal Avulsa da coleta de sucata",
    `<p style="font-size:14px">Segue a Nota Fiscal Avulsa referente à coleta ${p.numero}.</p>
     ${tabela([
       { rotulo: "Nota Fiscal Avulsa", valor: p.nfa_numero ?? "—" },
       { rotulo: "Emissão", valor: dataBr(p.nfa_emissao) },
       { rotulo: "Quantidade (kg)", valor: formatarKg(p.peso_aferido_kg) },
       { rotulo: "Valor total", valor: moeda(p.valor_total) },
     ])}
     <p style="font-size:14px"><a href="${url}">Baixar a nota fiscal</a> (link válido por tempo limitado).</p>`,
  );
}

export function assuntoImpedimento(p: ProcessoNfa): string {
  return `Impedimento na emissão da NFA — ${p.numero}`;
}

export function htmlImpedimento(p: ProcessoNfa, motivo: string): string {
  return moldura(
    "Impedimento na emissão da Nota Fiscal Avulsa",
    `<p style="font-size:14px">A Contabilidade registrou um impedimento no processo ${p.numero} (${p.obra?.nome ?? p.coligada_origem}).</p>
     <p style="font-size:14px"><strong>Motivo:</strong> ${motivo}</p>
     <p style="font-size:14px">O processo voltou para a aprovação do administrativo da obra.</p>`,
  );
}

export type AjusteValor = {
  valorAnterior: number | null;
  valorNovo: number;
  unitarioNovo: number | null;
  justificativa: string;
  autor: string | null;
  quando: string;
};

export function assuntoAjusteValor(p: ProcessoNfa, notaEmitida: boolean): string {
  return notaEmitida
    ? `Cancelar nota nº ${p.nfa_numero ?? "—"} e emitir nova — processo ${p.numero}`
    : `Valor corrigido antes da emissão — processo ${p.numero}`;
}

function linhasAjuste(p: ProcessoNfa, a: AjusteValor): { rotulo: string; valor: string }[] {
  return [
    ...camposNfa(p).filter((l) => l.rotulo !== "Valor total"),
    { rotulo: "Valor total anterior", valor: moeda(a.valorAnterior) },
    { rotulo: "Novo valor total", valor: moeda(a.valorNovo) },
    { rotulo: "Valor por quilo", valor: a.unitarioNovo === null ? "—" : `${moeda(a.unitarioNovo)}/kg` },
    { rotulo: "Nota anterior", valor: p.nfa_numero ? `${p.nfa_numero} — ${dataBr(p.nfa_emissao)}` : "não emitida" },
    { rotulo: "Ajustado por", valor: a.autor ?? "—" },
    { rotulo: "Ajustado em", valor: dataBr(a.quando) },
    { rotulo: "Justificativa", valor: a.justificativa },
  ];
}

export function htmlAjusteValor(p: ProcessoNfa, a: AjusteValor, notaEmitida: boolean): string {
  const chamada = notaEmitida
    ? `<p style="font-size:14px">O administrativo ajustou o valor desta venda de sucata <strong>depois</strong> da emissão da nota.
        Favor <strong>cancelar a nota nº ${p.nfa_numero ?? "—"}</strong>, emitida em ${dataBr(p.nfa_emissao)}, e
        <strong>emitir nova nota pelo novo valor</strong> indicado abaixo.</p>`
    : `<p style="font-size:14px">O administrativo corrigiu o valor desta venda de sucata <strong>antes</strong> da emissão.
        A Nota Fiscal Avulsa deve ser emitida pelo novo valor indicado abaixo.</p>`;
  return moldura(
    notaEmitida ? "Cancelamento e nova Nota Fiscal Avulsa" : "Valor corrigido — Nota Fiscal Avulsa",
    `${chamada}${tabela(linhasAjuste(p, a))}`,
  );
}

export function textoAjusteValor(p: ProcessoNfa, a: AjusteValor, notaEmitida: boolean): string {
  const chamada = notaEmitida
    ? `Cancelar a nota nº ${p.nfa_numero ?? "—"} e emitir nova nota pelo novo valor.`
    : "Emitir a Nota Fiscal Avulsa pelo novo valor.";
  return `${chamada}\n\n${linhasAjuste(p, a)
    .map((l) => `${l.rotulo}: ${l.valor}`)
    .join("\n")}`;
}

/** URLs assinadas das evidências usadas na NFA (comprovante de pesagem, recibo e pagamento). */
export async function anexosDoProcesso(
  admin: Admin,
  processoId: string,
): Promise<{ rotulo: string; url: string }[]> {
  const { data } = await admin
    .from("sucata_evidencias")
    .select("posicao, rotulo, storage_path")
    .eq("processo_id", processoId)
    .is("substituida_por", null)
    .in("posicao", [1, 4, 10, 11])
    .order("posicao");
  const saida: { rotulo: string; url: string }[] = [];


  for (const ev of data ?? []) {
    const { data: assinada } = await admin.storage
      .from(BUCKETS.sucataEvidencias)
      .createSignedUrl(ev.storage_path, 7 * 24 * 60 * 60);
    if (assinada?.signedUrl) saida.push({ rotulo: ev.rotulo, url: assinada.signedUrl });
  }
  return saida;
}
