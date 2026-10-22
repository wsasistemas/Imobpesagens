import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entrada = z.object({ processoId: z.string().uuid() });

export type PreviaEmailAceite = {
  destinatario: string | null;
  assunto: string;
  html: string;
  variaveis: { rotulo: string; valor: string }[];
  jaNotificado: boolean;
  expiraEm: string | null;
  aceiteEm: string | null;
  validadeDias: number;
  reenvioHoras: number;
  alertaDias: number;
};

function origem(): string {
  try {
    const url = new URL(getRequest().url);
    return url.origin;
  } catch {
    return "https://imobpesagens.vercel.app";
  }
}

/** T5: prévia do e-mail exatamente como o sucateiro recebe. Corpo não editável. */
export const previaEmailAceite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entrada.parse(i))
  .handler(async ({ data, context }): Promise<PreviaEmailAceite> => {
    const { PROCESSO_ACEITE_SELECT, assuntoAceite, htmlAceite, variaveisEmail } = await import(
      "@/lib/sucata/aceite.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parametros, paramNumero } = await import("@/lib/sucata/notificacoes.server");

    // RLS do usuário decide se ele pode ver o processo.
    const { error: permErro } = await context.supabase
      .from("sucata_processos")
      .select("id")
      .eq("id", data.processoId)
      .single();
    if (permErro) throw new Error("Processo não encontrado ou sem acesso.");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select(PROCESSO_ACEITE_SELECT)
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");

    const p = proc as never as import("@/lib/sucata/aceite.server").ProcessoAceite;
    const params = await parametros(supabaseAdmin);
    const base = origem();
    return {
      destinatario: p.sucateiro?.email_coleta ?? null,
      assunto: assuntoAceite(p),
      html: htmlAceite(p, `${base}/coleta/aceite/EXEMPLO-DO-LINK`, `${base}/coleta/aceite/EXEMPLO-DO-LINK?contestar=1`),
      variaveis: variaveisEmail(p),
      jaNotificado: !!p.aceite_token_expira_em,
      expiraEm: p.aceite_token_expira_em,
      aceiteEm: p.aceite_em,
      validadeDias: paramNumero(params, "token_validade_dias", 7),
      reenvioHoras: paramNumero(params, "reenvio_horas", 48),
      alertaDias: paramNumero(params, "alerta_admin_dias", 5),
    };
  });

/** Gera o token (só o hash vai ao banco), envia o e-mail e avança para F05. */
export const enviarAceiteSucateiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entrada.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: boolean; destinatario: string; erro?: string }> => {
    const { PROCESSO_ACEITE_SELECT, assuntoAceite, gerarToken, htmlAceite, textoAceite } = await import(
      "@/lib/sucata/aceite.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notificar, parametros, paramNumero, registrarEventoServidor } = await import(
      "@/lib/sucata/notificacoes.server"
    );

    const { error: permErro } = await context.supabase
      .from("sucata_processos")
      .select("id")
      .eq("id", data.processoId)
      .single();
    if (permErro) throw new Error("Processo não encontrado ou sem acesso.");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select(PROCESSO_ACEITE_SELECT)
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    const p = proc as never as import("@/lib/sucata/aceite.server").ProcessoAceite;

    if (!p.peso_aferido_kg) throw new Error("O processo ainda não tem peso aferido.");
    if (p.aceite_em) throw new Error("Este processo já foi aceito pelo sucateiro.");
    const destinatario = p.sucateiro?.email_coleta;
    if (!destinatario) throw new Error("O sucateiro não tem e-mail de coleta cadastrado.");

    const params = await parametros(supabaseAdmin);
    const dias = paramNumero(params, "token_validade_dias", 7);
    const { token, hash } = gerarToken();
    const expira = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

    const { error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        aceite_token_hash: hash,
        aceite_token_expira_em: expira,
        notificado_em: new Date().toISOString(),
        fase: "F05",
      })
      .eq("id", p.id);
    if (upErro) throw new Error(upErro.message);

    const base = origem();
    const link = `${base}/coleta/aceite/${token}`;
    const assunto = assuntoAceite(p);
    const resultado = await notificar(supabaseAdmin, {
      processoId: p.id,
      tipo: "ACEITE_PESO",
      destinatario,
      assunto,
      html: htmlAceite(p, link, `${link}?contestar=1`),
      texto: textoAceite(p, link),
    });

    await registrarEventoServidor(supabaseAdmin, {
      processoId: p.id,
      acao: "aferido_calculado",
      fase: "F05",
      coligada: p.coligada_origem,
      payload: {
        peso_aferido_kg: p.peso_aferido_kg,
        destinatario,
        expira_em: expira,
        envio: resultado.ok ? "ENVIADA" : "FALHA",
        erro: resultado.erro ?? null,
      },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: resultado.ok, destinatario, erro: resultado.erro };
  });

/** Reabertura do peso após o aceite — exclusiva do TI (superadmin), sempre auditada. */
export const reabrirPeso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ processoId: z.string().uuid(), motivo: z.string().min(5).max(500) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: ehTI } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (!ehTI) throw new Error("Só o perfil de TI pode reabrir o peso de um processo aceito.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, coligada_origem, aceite_em, peso_aferido_kg")
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    if (!proc.aceite_em) throw new Error("Este processo não está com o peso aceito.");

    const { error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        aceite_em: null,
        aceite_ip: null,
        aceite_email: null,
        aceite_token_hash: null,
        aceite_token_expira_em: null,
        fase: "F05",
      })
      .eq("id", proc.id);
    if (upErro) throw new Error(upErro.message);

    await registrarEventoServidor(supabaseAdmin, {
      processoId: proc.id,
      acao: "reabertura_peso",
      fase: "F07",
      coligada: proc.coligada_origem,
      payload: {
        motivo: data.motivo,
        aceite_anterior_em: proc.aceite_em,
        peso_aferido_kg: proc.peso_aferido_kg,
      },
      usuarioEmail: context.claims?.email ?? null,
    });
    return { ok: true };
  });
