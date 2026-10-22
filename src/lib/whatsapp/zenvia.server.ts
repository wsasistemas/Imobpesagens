// Cliente Zenvia (server-only). Nunca importar em código de navegador.

const BASE = "https://api.zenvia.com/v2";

export type ZenviaTemplate = {
  id: string;
  name: string | null;
  senderId: string | null;
  status: string | null;
  text: string | null;
  fields: string[];
};

export type ZenviaSender = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
};

function normalizarTelefone(raw: string): string {
  const d = String(raw).replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

async function zenviaGet(path: string, token: string) {
  const resp = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { "X-API-Token": token, "Content-Type": "application/json" },
  });
  const texto = await resp.text();
  let json: unknown = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* resposta não-JSON */
  }
  return { ok: resp.ok, status: resp.status, json, texto };
}

/** A Zenvia não expõe /senders: os remetentes são derivados dos templates. */
export async function listarTemplates(token: string): Promise<{
  ok: boolean;
  status: number;
  templates: ZenviaTemplate[];
  erro?: string;
}> {
  const r = await zenviaGet("/templates", token);
  if (!r.ok) {
    return { ok: false, status: r.status, templates: [], erro: `HTTP ${r.status}: ${r.texto.slice(0, 300)}` };
  }
  const bruto = r.json as { data?: unknown[] } | unknown[] | null;
  const lista: Record<string, unknown>[] = Array.isArray(bruto)
    ? (bruto as Record<string, unknown>[])
    : Array.isArray((bruto as { data?: unknown[] })?.data)
      ? ((bruto as { data: unknown[] }).data as Record<string, unknown>[])
      : [];

  const templates: ZenviaTemplate[] = lista.map((t) => {
    const componentes = t["components"] as { body?: { text?: string } } | undefined;
    const fields = Array.isArray(t["fields"])
      ? (t["fields"] as { name?: string }[]).map((f) => String(f?.name ?? "")).filter(Boolean)
      : [];
    return {
      id: String(t["id"] ?? ""),
      name: (t["name"] as string | undefined) ?? null,
      senderId: (t["senderId"] as string | undefined) ?? null,
      status: (t["status"] as string | undefined) ?? null,
      text: componentes?.body?.text ?? null,
      fields,
    };
  });
  return { ok: true, status: 200, templates };
}

export async function listarSenders(token: string): Promise<{
  ok: boolean;
  senders: ZenviaSender[];
  erro?: string;
}> {
  const r = await listarTemplates(token);
  if (!r.ok) return { ok: false, senders: [], erro: r.erro };
  const mapa = new Map<string, ZenviaSender>();
  for (const t of r.templates) {
    if (!t.senderId) continue;
    if (mapa.has(t.senderId)) continue;
    mapa.set(t.senderId, {
      id: t.senderId,
      name: null,
      phone: /^\d{10,15}$/.test(t.senderId) ? t.senderId : null,
      status: t.status,
    });
  }
  return { ok: true, senders: Array.from(mapa.values()) };
}

export async function enviarMensagem(args: {
  token: string;
  from: string;
  para: string;
  texto?: string;
  templateId?: string;
  variaveis?: Record<string, string>;
}): Promise<{
  ok: boolean;
  status: number;
  messageId?: string;
  providerStatus?: string;
  erro?: string;
}> {
  const to = normalizarTelefone(args.para);
  const contents = args.templateId
    ? [{ type: "template", templateId: args.templateId, fields: args.variaveis ?? {} }]
    : [{ type: "text", text: args.texto ?? "" }];

  const resp = await fetch(`${BASE}/channels/whatsapp/messages`, {
    method: "POST",
    headers: { "X-API-Token": args.token, "Content-Type": "application/json" },
    body: JSON.stringify({ from: args.from, to, contents }),
  });
  const texto = await resp.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  const erroApi = json?.["error"] as { description?: string } | undefined;
  return {
    ok: resp.ok && !erroApi,
    status: resp.status,
    messageId: (json?.["id"] as string | undefined) ?? undefined,
    providerStatus: (json?.["status"] as string | undefined) ?? undefined,
    erro: !resp.ok || erroApi ? (erroApi?.description ?? `HTTP ${resp.status}: ${texto.slice(0, 300)}`) : undefined,
  };
}

export async function statusMensagem(token: string, messageId: string) {
  const r = await zenviaGet(`/channels/whatsapp/messages/${messageId}`, token);
  return { ok: r.ok, status: r.status, dados: r.json };
}
