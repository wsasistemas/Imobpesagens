import type { PerfilUsuario } from "./ocorrencia.functions";

export const TIPOS_OCORRENCIA = [
  "Faltou volume / peso abaixo",
  "Peso acima do esperado",
  "Extraviou lona / cobertura",
  "Motorista inadequado (embriagado, agressivo, etc.)",
  "Documentação inconsistente",
  "Carga danificada / avariada",
  "Material fora de especificação",
  "Caminhão sem pesagem de saída",
  "Outro",
] as const;

export type TipoOcorrencia = (typeof TIPOS_OCORRENCIA)[number];

export const DESTINATARIOS_FIXOS = [
  "wsasistemas.ia@gmail.com",
] as const;

export const TEXTO_TOLERANCIA_ACIMA = `Prezado Engenheiro,

Foi constatada, durante o processo de pesagem, uma divergência acima da tolerância permitida referente ao veículo de placa XXXX no dia XX/XX/XXXX.

Solicitamos a gentileza de analisar o ocorrido e emitir seu parecer quanto às devidas providências que deveremos adotar em relação a essa discrepância.

Atenciosamente,

Sistema de Pesagem` as const;

/** Lista final de destinatários: fixos + engenheiro da obra (normalizado e sem duplicidade). */
export function destinatariosOcorrencia(engenheiroEmail?: string | null): string[] {
  const set = new Set<string>();
  for (const e of DESTINATARIOS_FIXOS) set.add(e.trim().toLowerCase());
  const eng = engenheiroEmail?.trim().toLowerCase();
  if (eng && /.+@.+\..+/.test(eng)) set.add(eng);
  return Array.from(set);
}

/** Destinatários para notificação automática de tolerância acima: fixos + engenheiro + coordenadores da coligada. */
export function destinatariosTolerancia(
  engenheiroEmail?: string | null,
  coordenadoresEmails?: string[],
): string[] {
  const set = new Set<string>();
  for (const e of DESTINATARIOS_FIXOS) set.add(e.trim().toLowerCase());
  const eng = engenheiroEmail?.trim().toLowerCase();
  if (eng && /.+@.+\..+/.test(eng)) set.add(eng);
  for (const e of coordenadoresEmails ?? []) {
    const t = e.trim().toLowerCase();
    if (t && /.+@.+\..+/.test(t)) set.add(t);
  }
  return Array.from(set);
}

/** Substitui os marcadores XXXX e XX/XX/XXXX do template padrão. */
export function relatoToleranciaAcima(placa?: string | null, data?: string | Date | null): string {
  const placaLimpa = (placa ?? "—").trim();
  let dataFmt = "—";
  if (data) {
    try {
      dataFmt = new Date(data).toLocaleDateString("pt-BR");
    } catch {
      dataFmt = String(data);
    }
  }
  return TEXTO_TOLERANCIA_ACIMA.replace(/XXXX/g, placaLimpa).replace(/XX\/XX\/XXXX/g, dataFmt);
}

export type OcorrenciaPayload = {
  para: string[];
  cc: string[];
  assunto: string;
  corpoTexto: string;
};

function nomeAPartirEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const prefixo = email.split("@")[0] || "";
  if (!prefixo) return null;
  return prefixo
    .split(/[._-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

export function assinaturaPerfil(p: PerfilUsuario | null | undefined): string {
  const nome = (p?.nome && p.nome.trim()) || nomeAPartirEmail(p?.email) || "Portaria";
  const linhas = [
    nome,
    [p?.cargo, p?.setor].filter(Boolean).join(" — "),
    p?.telefone ? `Tel.: ${p.telefone}` : "",
  ].filter((s) => s && s.trim().length > 0);
  return linhas.join("\n");
}

export function montarPayloadOcorrencia(args: {
  tipo: string;
  relato: string;
  ccExtra?: string[];
  numeroNota?: string | null;
  placa?: string | null;
  emissor?: string | null;
  contratante?: string | null;
  obraNome?: string | null;
  engenheiroEmail?: string | null;
  engenheiroNome?: string | null;
  pesoNfKg?: number | null;
  pesoLiquidoKg?: number | null;
  perfil: PerfilUsuario | null | undefined;
}): OcorrenciaPayload {
  const linhas = [
    `Prezados,`,
    ``,
    `Registro de ocorrência durante o recebimento na obra ${args.obraNome || "—"}.`,
    ...(args.engenheiroNome || args.engenheiroEmail
      ? [`Engenheiro responsável: ${args.engenheiroNome || "—"}${args.engenheiroEmail ? ` (${args.engenheiroEmail})` : ""}`]
      : []),
    ``,
    `• Tipo: ${args.tipo}`,
    `• Contratante: ${args.contratante || "—"}`,
    `• NF nº: ${args.numeroNota || "—"}`,
    `• Emissor: ${args.emissor || "—"}`,
    `• Placa: ${args.placa || "—"}`,
    `• Peso NF: ${args.pesoNfKg != null ? args.pesoNfKg.toLocaleString("pt-BR") + " kg" : "—"}`,
    `• Peso líquido apurado: ${args.pesoLiquidoKg != null ? args.pesoLiquidoKg.toLocaleString("pt-BR") + " kg" : "—"}`,
    ``,
    `Relato:`,
    args.relato.trim(),
    ``,
    `Fotos e evidências desta pesagem estão registradas no Portal.`,
    ``,
    `Atenciosamente,`,
    assinaturaPerfil(args.perfil),
  ].join("\n");

  const assunto = `OCORRÊNCIA no recebimento — ${args.tipo} — NF ${args.numeroNota || "?"} — ${args.emissor || ""}`.trim();

  const para = destinatariosOcorrencia(args.engenheiroEmail);

  const ccSet = new Set<string>();
  (args.ccExtra ?? []).forEach((e) => {
    const t = e.trim().toLowerCase();
    if (t && !para.includes(t)) ccSet.add(t);
  });

  return {
    para,
    cc: Array.from(ccSet),
    assunto,
    corpoTexto: linhas,
  };
}

export function mailtoUrlOcorrencia(p: OcorrenciaPayload): string {
  const params = new URLSearchParams();
  if (p.cc.length) params.set("cc", p.cc.join(","));
  params.set("subject", p.assunto);
  params.set("body", p.corpoTexto);
  return `mailto:${encodeURIComponent(p.para.join(","))}?${params.toString()}`;
}

