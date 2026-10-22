// Servidor: avisos de "Nota Fiscal Avulsa emitida" ao engenheiro responsável da obra
// e ao administrativo da obra, por e-mail e por WhatsApp.
// Server-only: nunca importar em código de navegador.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { enviarEmailHtml } from "@/lib/sucata/notificacoes.server";

type Admin = SupabaseClient<Database>;

export type AvisoNota = {
  emails: string[];
  whatsapp: string[];
  erros: string[];
};

type Destino = { nome: string; email: string };

// ===== MODO DE TESTE (fechamento da validação do módulo Sucata) =====
// Enquanto MODO_TESTE = true, o aviso da Nota Fiscal Avulsa vai SOMENTE para
// os endereços abaixo. Para voltar ao normal, basta trocar para false.
const MODO_TESTE = true;
const DESTINOS_TESTE: Destino[] = [
  { nome: "WSA Sistemas", email: "wsasistemas.ia@gmail.com" },
];
// ===================================================================

const moeda = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const kg = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")} kg`);

/** Coordenadores da obra: perfil Coordenador com acesso à obra do processo. */
async function coordenadoresDaObra(admin: Admin, obraId: string): Promise<Destino[]> {
  const { data: acessos } = await admin.from("obra_acessos").select("user_id").eq("obra_id", obraId);
  const ids = (acessos ?? []).map((a) => a.user_id);
  if (ids.length === 0) return [];

  const { data: papeis } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "coordenador")
    .in("user_id", ids);
  const coordIds = (papeis ?? []).map((p) => p.user_id);
  if (coordIds.length === 0) return [];

  const { data: perfis } = await admin.from("profiles").select("id, nome, email").in("id", coordIds);
  return (perfis ?? [])
    .filter((p): p is { id: string; nome: string | null; email: string } => !!p.email)
    .map((p) => ({ nome: p.nome ?? "Coordenador da obra", email: p.email }));
}

/** Engenheiro + coordenadores da obra + destinatários administrativos ativos, sem repetição. */
async function destinos(admin: Admin, obraId: string, coligada: string): Promise<Destino[]> {
  const lista: Destino[] = [];
  lista.push(...(await coordenadoresDaObra(admin, obraId)));

  const { data: obra } = await admin
    .from("obras")
    .select("nome, engenheiro_nome, engenheiro_email")
    .eq("id", obraId)
    .maybeSingle();
  if (obra?.engenheiro_email) {
    lista.push({ nome: obra.engenheiro_nome ?? "Engenheiro responsável", email: obra.engenheiro_email });
  }

  const { data: admins } = await admin
    .from("sucata_destinatarios_relatorio")
    .select("nome, email")
    .eq("coligada", coligada)
    .eq("ativo", true)
    .order("nome");
  for (const d of admins ?? []) if (d.email) lista.push({ nome: d.nome, email: d.email });

  const vistos = new Set<string>();
  return lista.filter((d) => {
    const chave = d.email.trim().toLowerCase();
    if (!chave.includes("@") || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/** WhatsApp cadastrado no perfil de cada destinatário (quando houver). */
async function telefonesDos(admin: Admin, emails: string[]): Promise<{ email: string; telefone: string }[]> {
  if (emails.length === 0) return [];
  const { data } = await admin
    .from("profiles")
    .select("email, whatsapp_e164")
    .in("email", emails);
  return (data ?? [])
    .filter((p): p is { email: string; whatsapp_e164: string } => !!p.email && !!p.whatsapp_e164)
    .map((p) => ({ email: p.email, telefone: p.whatsapp_e164 }));
}

async function mandarWhatsApp(admin: Admin, telefone: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const { data: cfg } = await admin
    .from("whatsapp_config")
    .select("api_token, sender_id, is_active")
    .limit(1)
    .maybeSingle();
  const token = (cfg?.api_token ?? process.env["ZENVIA_API_TOKEN"] ?? "").trim();
  const from = (cfg?.sender_id ?? "").trim();
  if (!token || !from) return { ok: false, erro: "WhatsApp não configurado." };
  if (cfg && cfg.is_active === false) return { ok: false, erro: "Integração de WhatsApp desativada." };

  const { enviarMensagem } = await import("@/lib/whatsapp/zenvia.server");
  const { chaveContatoWhatsApp } = await import("@/lib/whatsapp/telefone");
  const r = await enviarMensagem({ token, from, para: telefone, texto });
  await admin.from("whatsapp_mensagens").insert({
    contato_whatsapp: chaveContatoWhatsApp(telefone),
    mensagem: texto,
    direcao: "enviada",
    tipo: "texto",
    status: r.ok ? (r.providerStatus ?? "enviada") : "falha",
    provider_message_id: r.messageId ?? null,
  });
  return { ok: r.ok, erro: r.erro };
}

export type ProcessoAviso = {
  id: string;
  numero: string;
  obra_id: string;
  coligada_origem: string;
  placa: string;
  peso_aferido_kg: number | null;
  valor_total: number | null;
  valor_unitario_kg: number | null;
  nfa_numero: string | null;
  nfa_emissao: string | null;
};

/**
 * Avisa engenheiro da obra e administrativo de que a nota fiscal avulsa foi emitida.
 * Nunca derruba o fluxo: falhas voltam na lista de erros.
 */
export async function avisarNotaEmitida(
  admin: Admin,
  p: ProcessoAviso,
  meio: "email" | "pdf" | "preview",
  anexo?: { filename: string; contentBase64: string },
): Promise<AvisoNota> {
  const saida: AvisoNota = { emails: [], whatsapp: [], erros: [] };
  const lista = MODO_TESTE ? DESTINOS_TESTE : await destinos(admin, p.obra_id, p.coligada_origem);
  if (lista.length === 0) {
    saida.erros.push("Nenhum engenheiro ou administrativo cadastrado para avisar.");
    return saida;
  }

  const { data: obra } = await admin.from("obras").select("nome").eq("id", p.obra_id).maybeSingle();
  const nomeObra = obra?.nome ?? "—";
  const emissao = p.nfa_emissao
    ? new Date(`${p.nfa_emissao}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";

  const assunto = `Nota Fiscal Avulsa emitida — coleta ${p.numero} — ${nomeObra}`;
  const linhas: [string, string][] = [
    ["Obra", nomeObra],
    ["Processo", p.numero],
    ["Placa", p.placa],
    ["Nota fiscal avulsa", p.nfa_numero ?? "—"],
    ["Emissão", emissao],
    ["Peso aferido", kg(p.peso_aferido_kg)],
    ["Valor por quilo", p.valor_unitario_kg === null ? "—" : moeda(p.valor_unitario_kg)],
    ["Valor total", moeda(p.valor_total)],
  ];
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111">
    <h2 style="font-size:18px;margin:0 0 12px">Nota Fiscal Avulsa emitida</h2>
    <p style="margin:0 0 12px">A Contabilidade ${
      meio === "email"
        ? "enviou a nota ao sucateiro por e-mail"
        : meio === "pdf"
          ? "exportou a nota em PDF"
          : "emitiu a nota; o PDF no modelo oficial segue em anexo"
    }. A fase do recibo do sucateiro já está aberta no portal.</p>
    <table style="border-collapse:collapse;font-size:14px">
      ${linhas
        .map(
          ([r, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#555">${r}</td><td style="padding:4px 0;font-weight:600">${v}</td></tr>`,
        )
        .join("")}
    </table>
  </div>`;
  const texto = `Nota Fiscal Avulsa emitida.\n${linhas.map(([r, v]) => `${r}: ${v}`).join("\n")}`;

  try {
    if (anexo) {
      const { enviarEmailComAnexo } = await import("@/lib/sucata/relatorio.server");
      await enviarEmailComAnexo({ para: lista.map((d) => d.email), assunto, html, texto, anexo });
    } else {
      await enviarEmailHtml({ para: lista.map((d) => d.email), assunto, html, texto });
    }
    saida.emails = lista.map((d) => d.email);
  } catch (e) {
    saida.erros.push(`E-mail do aviso não saiu: ${e instanceof Error ? e.message : "erro desconhecido"}`);
  }

  const fones = await telefonesDos(admin, lista.map((d) => d.email));
  for (const f of fones) {
    const r = await mandarWhatsApp(
      admin,
      f.telefone,
      `Portal de Pesagem\nNota Fiscal Avulsa ${p.nfa_numero ?? ""} emitida.\nObra: ${nomeObra}\nProcesso: ${p.numero} · Placa ${p.placa}\nValor total: ${moeda(p.valor_total)}\nA fase do recibo do sucateiro já está aberta.`,
    );
    if (r.ok) saida.whatsapp.push(f.telefone);
    else saida.erros.push(`WhatsApp para ${f.email} não saiu: ${r.erro ?? "falha no envio"}`);
  }

  return saida;
}
