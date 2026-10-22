// Envio do alerta de tolerância pelo provedor configurado (Zenvia ou Meta oficial).
// Server-only: nunca importar em código de navegador.

import { enviarMensagem, listarTemplates } from "@/lib/whatsapp/zenvia.server";
import { enviarTemplate, resolverTemplatePorId, statusConexaoMeta } from "@/lib/whatsapp/meta.server";

/** Variáveis esperadas do alerta de tolerância, na ordem posicional (Meta). */
export const VARIAVEIS_ALERTA = ["placa", "data", "empreendimento", "fornecedor"] as const;

export type ConfigAlerta = {
  provedor?: string | null;
  api_token?: string | null;
  sender_id?: string | null;
  meta_phone_number_id?: string | null;
  alerta_template_nome?: string | null;
  alerta_template_id?: string | null;
  alerta_template_idioma?: string | null;
};

export type ResultadoEnvio = {
  ok: boolean;
  erro?: string;
  messageId?: string;
  /** Campos exatos enviados ao provedor (nome da variável → valor). */
  campos?: Record<string, string>;
  /** ID do template usado no provedor. */
  templateId?: string | null;
  /** Nome real do template retornado pelo provedor. */
  templateNome?: string | null;
  /** Texto final da mensagem, com as variáveis já substituídas. */
  texto?: string | null;
};

/** Substitui {{nome}} / {{1}} no corpo do template pelos valores enviados. */
export function montarTextoMensagem(
  corpo: string | null | undefined,
  campos: Record<string, string>,
): string | null {
  if (!corpo) return null;
  return corpo.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (todo, chave: string) => {
    const v = campos[chave];
    return v == null || v === "" ? todo : v;
  });
}

export function provedorAlerta(cfg: ConfigAlerta | null | undefined): "zenvia" | "meta" {
  return (cfg?.provedor ?? "meta").toLowerCase() === "zenvia" ? "zenvia" : "meta";
}

function tokenZenvia(cfg: ConfigAlerta | null | undefined): string {
  return String(cfg?.api_token ?? process.env["ZENVIA_API_TOKEN"] ?? "").trim();
}

/** Monta os campos nomeados exigidos pelo template da Zenvia na ordem informada. */
async function camposZenvia(
  token: string,
  templateId: string,
  variaveis: string[],
): Promise<Record<string, string>> {
  const r = await listarTemplates(token);
  const nomes = r.ok ? (r.templates.find((t) => t.id === templateId)?.fields ?? []) : [];
  const chaves = nomes.length > 0 ? nomes : variaveis.map((_, i) => String(i + 1));
  const campos: Record<string, string> = {};
  chaves.forEach((k, i) => {
    campos[k] = variaveis[i] ?? "";
  });
  return campos;
}

export async function enviarAlertaTemplate(args: {
  cfg: ConfigAlerta | null | undefined;
  para: string;
  template: string;
  idioma: string;
  variaveis: string[];
}): Promise<ResultadoEnvio> {
  const { cfg, para, template, idioma, variaveis } = args;

  if (provedorAlerta(cfg) === "zenvia") {
    const token = tokenZenvia(cfg);
    const from = String(cfg?.sender_id ?? "").trim();
    const templateId = String(cfg?.alerta_template_id ?? "").trim();
    if (!token) return { ok: false, erro: "Token da API da Zenvia não configurado." };
    if (!from) return { ok: false, erro: "Remetente (sender) da Zenvia não configurado." };
    if (!templateId)
      return { ok: false, erro: "Informe o ID do template da Zenvia para o alerta de tolerância." };

    const r = await enviarMensagem({
      token,
      from,
      para,
      templateId,
      variaveis: await camposZenvia(token, templateId, variaveis),
    });
    return { ok: r.ok, erro: r.erro, messageId: r.messageId };
  }

  const r = await enviarTemplate({
    phoneNumberId: String(cfg?.meta_phone_number_id ?? ""),
    para,
    template,
    idioma,
    templateId: cfg?.alerta_template_id ?? null,
    parametros: variaveis,
  });
  return { ok: r.ok, erro: r.erro, messageId: r.messageId };
}

export type StatusAlerta = {
  ok: boolean;
  provedor: "zenvia" | "meta";
  numero?: string | null;
  nomeExibicao?: string | null;
  qualidade?: string | null;
  erro?: string;
};

export async function statusProvedorAlerta(cfg: ConfigAlerta | null | undefined): Promise<StatusAlerta> {
  if (provedorAlerta(cfg) === "zenvia") {
    const token = tokenZenvia(cfg);
    if (!token) return { ok: false, provedor: "zenvia", erro: "Token da API da Zenvia não configurado." };
    const r = await listarTemplates(token);
    if (!r.ok) return { ok: false, provedor: "zenvia", erro: r.erro ?? "Falha ao validar o token da Zenvia." };
    const from = String(cfg?.sender_id ?? "").trim();
    const templateId = String(cfg?.alerta_template_id ?? "").trim();
    const tpl = r.templates.find((t) => t.id === templateId);
    return {
      ok: true,
      provedor: "zenvia",
      numero: from || null,
      nomeExibicao: tpl?.name ?? null,
      qualidade: tpl?.status ?? null,
    };
  }
  const m = await statusConexaoMeta(String(cfg?.meta_phone_number_id ?? ""));
  return { ...m, provedor: "meta" };
}

export type InspecaoTemplate = {
  ok: boolean;
  provedor: "zenvia" | "meta";
  nome?: string | null;
  idioma?: string | null;
  status?: string | null;
  sender?: string | null;
  /** Variáveis reais do template (nomes na Zenvia; "1", "2"… na Meta). */
  variaveis: string[];
  /** Variáveis esperadas (VARIAVEIS_ALERTA) ausentes no template aprovado. */
  faltantes: string[];
  /** Corpo do template aprovado, com os marcadores de variáveis. */
  corpo?: string | null;
  erro?: string;
};

/** Extrai os nomes de variáveis ({{nome}}) na ordem em que aparecem no corpo. */
export function variaveisDoCorpo(corpo: string | null | undefined): string[] {
  if (!corpo) return [];
  const achados: string[] = [];
  for (const m of corpo.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
    const nome = m[1];
    if (nome && !achados.includes(nome)) achados.push(nome);
  }
  return achados;
}

/** Une as variáveis declaradas pelo provedor com as exigidas pelo corpo do template. */
function unirVariaveis(declaradas: string[], corpo: string | null | undefined): string[] {
  const doCorpo = variaveisDoCorpo(corpo);
  const uniao = [...doCorpo];
  for (const d of declaradas) if (!uniao.includes(d)) uniao.push(d);
  return uniao.length > 0 ? uniao : declaradas;
}

/** Lê as variáveis reais do template configurado no provedor. */
export async function variaveisTemplateAlerta(
  cfg: ConfigAlerta | null | undefined,
): Promise<Omit<InspecaoTemplate, "ok" | "provedor" | "faltantes">> {
  if (provedorAlerta(cfg) === "zenvia") {
    const token = tokenZenvia(cfg);
    if (!token) return { variaveis: [], erro: "Token da API da Zenvia não configurado." };
    const templateId = String(cfg?.alerta_template_id ?? "").trim();
    if (!templateId) return { variaveis: [], erro: "Informe o ID do template da Zenvia." };
    const r = await listarTemplates(token);
    if (!r.ok) return { variaveis: [], erro: r.erro ?? "Falha ao listar templates da Zenvia." };
    const tpl = r.templates.find((t) => t.id === templateId);
    if (!tpl) return { variaveis: [], erro: "Template não encontrado na Zenvia para este ID." };
    return {
      variaveis: unirVariaveis(tpl.fields, tpl.text),
      nome: tpl.name,
      status: tpl.status,
      corpo: tpl.text ?? null,
      sender: tpl.senderId ?? (String(cfg?.sender_id ?? "").trim() || null),
    };
  }
  const templateId = String(cfg?.alerta_template_id ?? "").trim();
  if (!templateId) return { variaveis: [], erro: "Informe o ID do template da Meta." };
  const r = await resolverTemplatePorId(templateId);
  if (r.erro) return { variaveis: [], erro: r.erro };
  return {
    variaveis: r.variaveis ?? [],
    nome: r.nome ?? null,
    idioma: r.idioma ?? null,
    status: r.status ?? null,
    corpo: r.corpo ?? null,
    sender: String(cfg?.meta_phone_number_id ?? "").trim() || null,
  };
}

/** Inspeciona o template configurado e compara com as variáveis esperadas do alerta. */
export async function inspecionarTemplateAlerta(
  cfg: ConfigAlerta | null | undefined,
): Promise<InspecaoTemplate> {
  const provedor = provedorAlerta(cfg);
  const base = await variaveisTemplateAlerta(cfg);
  if (base.erro) return { ok: false, provedor, variaveis: [], faltantes: [], erro: base.erro };
  const faltantes =
    provedor === "zenvia"
      ? VARIAVEIS_ALERTA.filter((v) => !base.variaveis.includes(v))
      : [];
  return {
    ok: true,
    provedor,
    nome: base.nome ?? null,
    idioma: base.idioma ?? null,
    status: base.status ?? null,
    corpo: base.corpo ?? null,
    sender: base.sender ?? null,
    variaveis: base.variaveis,
    faltantes,
  };
}

/**
 * Envio de teste com campos explícitos (nome → valor).
 * Zenvia: usa os nomes reais do template; Meta: chaves "1".."n" viram parâmetros posicionais.
 */
export async function enviarAlertaTemplateCampos(args: {
  cfg: ConfigAlerta | null | undefined;
  para: string;
  template: string;
  idioma: string;
  campos: Record<string, string>;
}): Promise<ResultadoEnvio> {
  const { cfg, para, template, idioma, campos } = args;

  if (provedorAlerta(cfg) === "zenvia") {
    const token = tokenZenvia(cfg);
    const from = String(cfg?.sender_id ?? "").trim();
    const templateId = String(cfg?.alerta_template_id ?? "").trim();
    if (!token) return { ok: false, erro: "Token da API da Zenvia não configurado." };
    if (!from) return { ok: false, erro: "Remetente (sender) da Zenvia não configurado." };
    if (!templateId)
      return { ok: false, erro: "Informe o ID do template da Zenvia para o alerta de tolerância." };

    const info = await variaveisTemplateAlerta(cfg);
    const chaves = info.variaveis.length > 0 ? info.variaveis : Object.keys(campos);
    const fields: Record<string, string> = {};
    for (const k of chaves) fields[k] = campos[k] ?? "";

    const r = await enviarMensagem({ token, from, para, templateId, variaveis: fields });
    return { ok: r.ok, erro: r.erro, messageId: r.messageId };
  }

  const parametros = Object.keys(campos)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => campos[k] ?? "");
  const r = await enviarTemplate({
    phoneNumberId: String(cfg?.meta_phone_number_id ?? ""),
    para,
    template,
    idioma,
    templateId: cfg?.alerta_template_id ?? null,
    parametros,
  });
  return { ok: r.ok, erro: r.erro, messageId: r.messageId };
}

/**
 * Fluxo automático do alerta: monta os campos conforme as variáveis reais do template.
 * Envia empreendimento/fornecedor somente quando o template os possui.
 */
export async function enviarAlertaTemplateAuto(args: {
  cfg: ConfigAlerta | null | undefined;
  para: string;
  template: string;
  idioma: string;
  valores: Record<string, string>;
}): Promise<ResultadoEnvio> {
  const { cfg, para, template, idioma, valores } = args;

  if (provedorAlerta(cfg) === "zenvia") {
    const token = tokenZenvia(cfg);
    const from = String(cfg?.sender_id ?? "").trim();
    const templateId = String(cfg?.alerta_template_id ?? "").trim();
    if (!token) return { ok: false, erro: "Token da API da Zenvia não configurado." };
    if (!from) return { ok: false, erro: "Remetente (sender) da Zenvia não configurado." };
    if (!templateId)
      return { ok: false, erro: "Informe o ID do template da Zenvia para o alerta de tolerância." };

    const info = await variaveisTemplateAlerta(cfg);
    const chaves = info.variaveis.length > 0 ? info.variaveis : [...VARIAVEIS_ALERTA.slice(0, 2)];
    const fields: Record<string, string> = {};
    chaves.forEach((k, i) => {
      fields[k] = valores[k] ?? valores[VARIAVEIS_ALERTA[i] ?? ""] ?? "";
    });

    const r = await enviarMensagem({ token, from, para, templateId, variaveis: fields });
    return {
      ok: r.ok,
      erro: r.erro,
      messageId: r.messageId,
      campos: fields,
      templateId,
      templateNome: info.nome ?? null,
      texto: montarTextoMensagem(info.corpo, fields),
    };
  }

  const info = await variaveisTemplateAlerta(cfg);
  const total = info.variaveis.length > 0 ? info.variaveis.length : 2;
  const parametros = VARIAVEIS_ALERTA.map((v) => valores[v] ?? "").slice(0, total);
  const campos: Record<string, string> = {};
  parametros.forEach((v, i) => {
    campos[String(i + 1)] = v;
    const nome = VARIAVEIS_ALERTA[i];
    if (nome) campos[nome] = v;
  });
  const r = await enviarTemplate({
    phoneNumberId: String(cfg?.meta_phone_number_id ?? ""),
    para,
    template,
    idioma,
    templateId: cfg?.alerta_template_id ?? null,
    parametros,
  });
  return {
    ok: r.ok,
    erro: r.erro,
    messageId: r.messageId,
    campos,
    templateId: String(cfg?.alerta_template_id ?? "").trim() || null,
    templateNome: info.nome ?? null,
    texto: montarTextoMensagem(info.corpo, campos),
  };
}
