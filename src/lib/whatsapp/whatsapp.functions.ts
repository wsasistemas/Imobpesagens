import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ZenviaSenderDTO = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
};

export type ZenviaTemplateDTO = {
  id: string;
  name: string | null;
  senderId: string | null;
  status: string | null;
  text: string | null;
  fields: string[];
};

export type InfoZenvia = {
  configurado: boolean;
  senderConfigurado: string | null;
  senderEncontrado: boolean;
  senders: ZenviaSenderDTO[];
  templates: ZenviaTemplateDTO[];
  erro?: string;
};

/** Situação da conexão Zenvia: remetentes e templates aprovados. */
export const infoZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InfoZenvia> => {
    const { data: cfg } = await context.supabase
      .from("whatsapp_config")
      .select("api_token, sender_id, is_active")
      .limit(1)
      .maybeSingle();

    const token = (cfg?.api_token ?? process.env["ZENVIA_API_TOKEN"] ?? "").trim();
    const sender = (cfg?.sender_id ?? "").trim();
    if (!token) {
      return {
        configurado: false,
        senderConfigurado: sender || null,
        senderEncontrado: false,
        senders: [],
        templates: [],
        erro: "Token da Zenvia não configurado.",
      };
    }

    const { listarTemplates, listarSenders } = await import("@/lib/whatsapp/zenvia.server");
    const [t, s] = await Promise.all([listarTemplates(token), listarSenders(token)]);
    if (!t.ok) {
      return {
        configurado: true,
        senderConfigurado: sender || null,
        senderEncontrado: false,
        senders: [],
        templates: [],
        erro: t.erro,
      };
    }
    return {
      configurado: true,
      senderConfigurado: sender || null,
      senderEncontrado: !!sender && s.senders.some((x) => x.id.toLowerCase() === sender.toLowerCase()),
      senders: s.senders,
      templates: t.templates,
    };
  });

/** Envia uma mensagem de WhatsApp e grava no histórico. */
export const enviarWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        telefone: z.string().trim().min(10).max(20),
        mensagem: z.string().trim().max(4000).optional(),
        templateId: z.string().trim().max(120).optional(),
        variaveis: z.record(z.string(), z.string().max(500)).optional(),
        contatoNome: z.string().trim().max(200).optional(),
        contatoEmail: z.string().trim().email().max(255).optional(),
        obraId: z.string().uuid().optional(),
        registrar: z.boolean().optional(),
      })
      .refine((v) => !!v.mensagem || !!v.templateId, {
        message: "Informe a mensagem ou o template.",
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; messageId?: string; erro?: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (!isAdmin && !isSuper) throw new Error("Apenas administradores podem enviar mensagens.");

    const { data: cfg } = await context.supabase
      .from("whatsapp_config")
      .select("api_token, sender_id, is_active")
      .limit(1)
      .maybeSingle();

    const token = (cfg?.api_token ?? process.env["ZENVIA_API_TOKEN"] ?? "").trim();
    const from = (cfg?.sender_id ?? "").trim();
    if (!token || !from) return { ok: false, erro: "Configure o token e o remetente da Zenvia." };
    if (cfg && cfg.is_active === false) return { ok: false, erro: "Integração WhatsApp está desativada." };

    const { enviarMensagem } = await import("@/lib/whatsapp/zenvia.server");
    const r = await enviarMensagem({
      token,
      from,
      para: data.telefone,
      texto: data.mensagem,
      templateId: data.templateId,
      variaveis: data.variaveis,
    });

    if (data.registrar !== false) {
      const { chaveContatoWhatsApp } = await import("@/lib/whatsapp/telefone");
      await context.supabase.from("whatsapp_mensagens").insert({
        // Mesma chave (com DDI 55) usada nas respostas recebidas pelo webhook.
        contato_whatsapp: chaveContatoWhatsApp(data.telefone),
        contato_nome: data.contatoNome ?? null,
        contato_email: data.contatoEmail ?? null,
        obra_id: data.obraId ?? null,
        mensagem: data.mensagem ?? `[template ${data.templateId}]`,
        direcao: "enviada",
        tipo: data.templateId ? "template" : "texto",
        status: r.ok ? (r.providerStatus ?? "enviada") : "falha",
        provider_message_id: r.messageId ?? null,
        created_by: context.userId,
      });
    }

    return { ok: r.ok, messageId: r.messageId, erro: r.erro };
  });

/** Importa os templates aprovados na Zenvia para o cadastro local. */
export const sincronizarTemplatesZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ importados: number; erro?: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (!isAdmin && !isSuper) throw new Error("Apenas administradores podem sincronizar templates.");

    const { data: cfg } = await context.supabase
      .from("whatsapp_config")
      .select("api_token")
      .limit(1)
      .maybeSingle();
    const token = (cfg?.api_token ?? process.env["ZENVIA_API_TOKEN"] ?? "").trim();
    if (!token) return { importados: 0, erro: "Token da Zenvia não configurado." };

    const { listarTemplates } = await import("@/lib/whatsapp/zenvia.server");
    const r = await listarTemplates(token);
    if (!r.ok) return { importados: 0, erro: r.erro };

    let importados = 0;
    for (const t of r.templates) {
      if (!t.id) continue;
      const key = (t.name ?? t.id).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60);
      const { error } = await context.supabase.from("whatsapp_templates").upsert(
        {
          funcao_key: key,
          funcao_label: t.name ?? t.id,
          descricao: t.text,
          template_id: t.id,
          sender_id: t.senderId,
          sender_status: t.status,
          variaveis: t.fields,
        },
        { onConflict: "funcao_key" },
      );
      if (!error) importados++;
    }
    return { importados };
  });
