// Servidor: token de aceite, template do e-mail e gravações do portal externo.
// Nunca importado por componentes — só por *.functions.ts e rotas de servidor.
import { createHash, randomBytes } from "crypto";
import { formatarKg } from "./validadores";

export type ProcessoAceite = {
  id: string;
  numero: string;
  placa: string;
  tara_kg: number;
  bruto_kg: number | null;
  peso_aferido_kg: number | null;
  valor_total: number | null;
  valor_por_tonelada: number | null;
  recibo_modo: string | null;
  entrada_em: string;
  saida_em: string | null;
  coligada_origem: string;
  aceite_em: string | null;
  aceite_token_expira_em: string | null;
  contestacao_em: string | null;
  contestacao_motivo: string | null;
  obra: { nome: string; engenheiro_email: string | null } | null;
  tipo: { nome: string; valor_ton_min: number | null; valor_ton_max: number | null } | null;
  sucateiro: {
    id: string;
    tipo_pessoa: string;
    razao_social: string | null;
    nome_completo: string | null;
    cnpj: string | null;
    cpf: string | null;
    email_coleta: string;
    municipio: string;
    uf: string;
  } | null;
};

export const PROCESSO_ACEITE_SELECT = `
  id, numero, placa, tara_kg, bruto_kg, peso_aferido_kg, valor_total, valor_por_tonelada,
  recibo_modo, entrada_em, saida_em, coligada_origem, aceite_em, aceite_token_expira_em,
  contestacao_em, contestacao_motivo,
  obra:obras(nome, engenheiro_email),
  tipo:sucata_tipos(nome, valor_ton_min, valor_ton_max),
  sucateiro:sucata_sucateiros(id, tipo_pessoa, razao_social, nome_completo, cnpj, cpf, email_coleta, municipio, uf)
`;

export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function nomeSucateiro(s: ProcessoAceite["sucateiro"]): string {
  if (!s) return "—";
  return (s.tipo_pessoa === "PJ" ? s.razao_social : s.nome_completo) ?? "—";
}

export function documentoSucateiro(s: ProcessoAceite["sucateiro"]): string {
  if (!s) return "—";
  return (s.tipo_pessoa === "PJ" ? s.cnpj : s.cpf) ?? "—";
}

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function variaveisEmail(p: ProcessoAceite): { rotulo: string; valor: string }[] {
  return [
    { rotulo: "Obra", valor: p.obra?.nome ?? "—" },
    { rotulo: "Número do processo", valor: p.numero },
    { rotulo: "Data da coleta", valor: dataBR(p.saida_em ?? p.entrada_em) },
    { rotulo: "Placa", valor: p.placa },
    { rotulo: "Tipo de sucata", valor: p.tipo?.nome ?? "—" },
    { rotulo: "Tara de entrada", valor: `${formatarKg(p.tara_kg)} kg` },
    { rotulo: "Bruto de saída", valor: `${formatarKg(p.bruto_kg)} kg` },
    { rotulo: "Peso aferido", valor: `${formatarKg(p.peso_aferido_kg)} kg` },
    { rotulo: "Destinatário", valor: p.sucateiro?.email_coleta ?? "—" },
  ];
}

export function assuntoAceite(p: ProcessoAceite): string {
  return `Coleta de sucata — ${p.obra?.nome ?? "obra"} — placa ${p.placa} — aceite do peso aferido`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** E-mail HTML responsivo com identidade do Portal de Pesagem. Todas as variáveis vêm do processo. */
export function htmlAceite(p: ProcessoAceite, linkAceite: string, linkContestar: string): string {
  const linhas = [
    ["Obra", p.obra?.nome ?? "—"],
    ["Data da coleta", dataBR(p.saida_em ?? p.entrada_em)],
    ["Placa", p.placa],
    ["Tipo de sucata", p.tipo?.nome ?? "—"],
    ["Tara de entrada", `${formatarKg(p.tara_kg)} kg`],
    ["Bruto de saída", `${formatarKg(p.bruto_kg)} kg`],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${esc(k)}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:'Courier New',monospace;color:#0f172a">${esc(v)}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f6f8;padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="background:#B0202E;padding:18px 20px;color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:.5px">
    PORTAL DE PESAGEM
  </td></tr>
  <tr><td style="padding:20px">
    <p style="margin:0 0 12px;font-size:15px;color:#0f172a">Olá, ${esc(nomeSucateiro(p.sucateiro))}.</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">
      A coleta de sucata abaixo foi pesada na obra. Confira os dados e confirme o peso aferido para seguir com o valor da compra.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:8px">
      ${linhas}
    </table>
    <div style="margin:18px 0;padding:16px;border-radius:10px;background:#0f172a;text-align:center">
      <div style="font-size:12px;color:#94a3b8;letter-spacing:1px">PESO AFERIDO</div>
      <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:bold;color:#34d399">
        ${esc(formatarKg(p.peso_aferido_kg))} kg
      </div>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#334155">
      Precisamos da sua confirmação para continuar. Escolha uma das opções:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding-bottom:10px">
        <a href="${esc(linkAceite)}" style="display:block;text-align:center;background:#059669;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:8px;font-weight:bold;font-size:15px">
          ACEITAR O PESO E INFORMAR O VALOR
        </a>
      </td></tr>
      <tr><td>
        <a href="${esc(linkContestar)}" style="display:block;text-align:center;border:1px solid #B0202E;color:#B0202E;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:bold;font-size:15px">
          CONTESTAR O PESO AFERIDO
        </a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:14px 20px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
    Processo <span style="font-family:'Courier New',monospace">${esc(p.numero)}</span> ·
    ${esc(p.obra?.nome ?? "")} · Este link é pessoal e tem prazo de validade.
  </td></tr>
</table></body></html>`;
}

export function textoAceite(p: ProcessoAceite, linkAceite: string): string {
  return [
    `Coleta de sucata — processo ${p.numero}`,
    `Obra: ${p.obra?.nome ?? "—"}`,
    `Placa: ${p.placa}`,
    `Tipo: ${p.tipo?.nome ?? "—"}`,
    `Tara: ${formatarKg(p.tara_kg)} kg`,
    `Bruto: ${formatarKg(p.bruto_kg)} kg`,
    `Peso aferido: ${formatarKg(p.peso_aferido_kg)} kg`,
    "",
    `Para aceitar o peso e informar o valor, acesse: ${linkAceite}`,
  ].join("\n");
}
