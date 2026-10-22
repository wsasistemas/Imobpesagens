// Cliente da WhatsApp Business Platform (Graph API oficial da Meta).
// Uso exclusivo no servidor: o token nunca chega ao navegador.

const GRAPH = "https://graph.facebook.com/v21.0";

export type EnvioTemplate = {
  phoneNumberId: string;
  para: string; // E.164 sem símbolos, ex.: 5511999999999
  template: string;
  idioma: string;
  parametros: string[];
  /** ID do template na Meta (opcional). Quando informado, o nome/idioma reais são lidos da Meta. */
  templateId?: string | null;
};

export type ResultadoEnvio = {
  ok: boolean;
  messageId?: string;
  erro?: string;
};

/** Normaliza para E.164 sem símbolos (Brasil por padrão). Retorna null quando inválido. */
export function normalizarE164(bruto?: string | null): string | null {
  const so = (bruto ?? "").replace(/\D/g, "");
  if (!so) return null;
  let n = so;
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  if (n.startsWith("0")) n = n.replace(/^0+/, "");
  if (n.length < 12 || n.length > 15) return null;
  return n;
}

function token(): string {
  return (process.env["META_WHATSAPP_TOKEN"] ?? "").trim();
}

/** Resolve nome, idioma, status e variáveis ({{1}}, {{2}}…) de um template pelo ID na Meta. */
export async function resolverTemplatePorId(
  templateId: string,
): Promise<{
  nome?: string;
  idioma?: string;
  status?: string;
  variaveis?: string[];
  corpo?: string;
  erro?: string;
}> {
  const tk = token();
  if (!tk) return { erro: "Token da Meta não configurado no servidor." };
  try {
    const res = await fetch(`${GRAPH}/${templateId}?fields=name,language,status,components`, {
      headers: { Authorization: `Bearer ${tk}` },
    });
    const corpo = (await res.json().catch(() => null)) as {
      name?: string;
      language?: string;
      status?: string;
      components?: { type?: string; text?: string }[];
      error?: { message?: string };
    } | null;
    if (!res.ok) return { erro: corpo?.error?.message ?? `Falha HTTP ${res.status} ao ler o template.` };
    const corpoTxt = corpo?.components?.find((c) => c.type === "BODY")?.text ?? "";
    const nums = Array.from(corpoTxt.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1]));
    const total = nums.length > 0 ? Math.max(...nums) : 0;
    const variaveis = Array.from({ length: total }, (_, i) => String(i + 1));
    return {
      nome: corpo?.name,
      idioma: corpo?.language,
      status: corpo?.status,
      variaveis,
      corpo: corpoTxt || undefined,
    };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro de rede ao consultar o template." };
  }
}

/** Envia um template aprovado pela Meta. Nunca envia texto livre. */
export async function enviarTemplate(e: EnvioTemplate): Promise<ResultadoEnvio> {
  const tk = token();
  if (!tk) return { ok: false, erro: "Token da Meta não configurado no servidor." };
  if (!e.phoneNumberId) return { ok: false, erro: "Número remetente (Phone Number ID) não configurado." };

  let nome = e.template;
  let idioma = e.idioma;
  const id = (e.templateId ?? "").trim();
  if (id) {
    const r = await resolverTemplatePorId(id);
    if (r.erro && !nome) return { ok: false, erro: r.erro };
    if (r.nome) nome = r.nome;
    if (r.idioma) idioma = r.idioma;
  }
  if (!nome) return { ok: false, erro: "Informe o ID ou o nome do template aprovado." };

  try {
    const res = await fetch(`${GRAPH}/${e.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: e.para,
        type: "template",
        template: {
          name: nome,
          language: { code: idioma },
          components: [
            {
              type: "body",
              parameters: e.parametros.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    const corpo = (await res.json().catch(() => null)) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number };
    } | null;

    if (!res.ok) {
      return { ok: false, erro: corpo?.error?.message ?? `Falha HTTP ${res.status} no envio.` };
    }
    return { ok: true, messageId: corpo?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro de rede ao chamar a Meta." };
  }
}

export type StatusConexao = {
  ok: boolean;
  numero?: string | null;
  nomeExibicao?: string | null;
  qualidade?: string | null;
  erro?: string;
};

/** Consulta o número remetente para exibir o status da conexão. */
export async function statusConexaoMeta(phoneNumberId: string): Promise<StatusConexao> {
  const tk = token();
  if (!tk) return { ok: false, erro: "Token da Meta não configurado no servidor." };
  if (!phoneNumberId) return { ok: false, erro: "Informe o Phone Number ID." };
  try {
    const res = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${tk}` } },
    );
    const corpo = (await res.json().catch(() => null)) as {
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      error?: { message?: string };
    } | null;
    if (!res.ok) return { ok: false, erro: corpo?.error?.message ?? `Falha HTTP ${res.status}.` };
    return {
      ok: true,
      numero: corpo?.display_phone_number ?? null,
      nomeExibicao: corpo?.verified_name ?? null,
      qualidade: corpo?.quality_rating ?? null,
    };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro de rede ao chamar a Meta." };
  }
}
