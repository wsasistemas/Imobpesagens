// Servidor: envio de e-mail em HTML pelo Resend, registro de notificação e de evento.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

const FROM = "Portal de Pesagem <nao-responda@imobsystems.com.br>";

export async function enviarEmailHtml(params: {
  para: string[];
  assunto: string;
  html: string;
  texto: string;
}): Promise<{ id: string }> {
  // Resend direto (fora do Lovable não existe o gateway connector-gateway.lovable.dev).
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("RESEND_API_KEY não configurada.");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: params.para,
      subject: params.assunto,
      html: params.html,
      text: params.texto,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Falha no envio (${resp.status}): ${txt.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { id?: string };
  return { id: json.id ?? "" };
}

/** Enfileira, envia e fecha a notificação; nunca derruba o fluxo por falha de e-mail. */
export async function notificar(
  admin: Admin,
  input: {
    processoId: string;
    tipo:
      | "ACEITE_PESO"
      | "REENVIO_ACEITE"
      | "CONTESTACAO_ADMIN"
      | "ALERTA_SEM_RESPOSTA"
      | "SOLICITACAO_NFA"
      | "ENVIO_NFA"
      | "AJUSTE_VALOR_NFA";
    destinatario: string;
    assunto: string;
    html: string;
    texto: string;
  },
): Promise<{ ok: boolean; erro?: string }> {
  const { data: nota } = await admin
    .from("sucata_notificacoes")
    .insert({
      processo_id: input.processoId,
      tipo: input.tipo,
      destinatario: input.destinatario,
      assunto: input.assunto,
      status: "ENFILEIRADA",
    })
    .select("id")
    .single();

  try {
    const { id } = await enviarEmailHtml({
      para: [input.destinatario],
      assunto: input.assunto,
      html: input.html,
      texto: input.texto,
    });
    if (nota) {
      await admin
        .from("sucata_notificacoes")
        .update({ status: "ENVIADA", provider_message_id: id, enviada_em: new Date().toISOString() })
        .eq("id", nota.id);
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    if (nota) {
      await admin.from("sucata_notificacoes").update({ status: "FALHA", erro: msg }).eq("id", nota.id);
    }
    return { ok: false, erro: msg };
  }
}

/** Auditoria pelo servidor (portal externo e tarefas agendadas). */
export async function registrarEventoServidor(
  admin: Admin,
  input: {
    processoId: string;
    acao: string;
    fase?: string | null;
    coligada?: string | null;
    payload?: Record<string, unknown>;
    usuarioEmail?: string | null;
    usuarioNome?: string | null;
  },
) {
  await admin.from("sucata_eventos").insert({
    entidade: "processo",
    entidade_id: input.processoId,
    processo_id: input.processoId,
    fase: input.fase ?? null,
    acao: input.acao,
    coligada_origem: input.coligada ?? null,
    payload: (input.payload ?? {}) as never,
    usuario_id: null,
    usuario_nome: input.usuarioNome ?? null,
    usuario_email: input.usuarioEmail ?? null,
  });
}

export async function parametros(admin: Admin): Promise<Record<string, string>> {
  const { data } = await admin.from("sucata_parametros").select("chave, valor");
  const mapa: Record<string, string> = {};
  for (const p of data ?? []) mapa[p.chave] = p.valor;
  return mapa;
}

export function paramNumero(mapa: Record<string, string>, chave: string, padrao: number): number {
  const n = Number(mapa[chave]);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

/** Divide uma lista de e-mails escrita à mão em endereços normalizados. */
export function listaEmails(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/**
 * Destinatários da Contabilidade: exclusivamente os usuários com perfil
 * `contador`, usando o e-mail do cadastro do usuário. Nenhum endereço fixo.
 */
export async function emailsContabilidade(admin: Admin): Promise<string[]> {
  const lista: string[] = [];

  const { data: papeis } = await admin.from("user_roles").select("user_id").eq("role", "contador");
  const ids = (papeis ?? []).map((r) => r.user_id);

  if (ids.length > 0) {
    const { data: perfis } = await admin.from("profiles").select("id, email").in("id", ids);
    const porId = new Map((perfis ?? []).map((p) => [p.id, p.email]));
    for (const id of ids) {
      const email = porId.get(id);
      if (email && email.includes("@")) {
        lista.push(email.trim().toLowerCase());
        continue;
      }
      // Perfil sem e-mail: cai para o e-mail de autenticação.
      const { data: usuario } = await admin.auth.admin.getUserById(id);
      const alternativo = usuario?.user?.email;
      if (alternativo && alternativo.includes("@")) lista.push(alternativo.trim().toLowerCase());
    }
  }

  return [...new Set(lista)];
}
