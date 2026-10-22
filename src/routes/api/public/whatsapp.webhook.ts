// Webhook público de recebimento de mensagens da Zenvia.
// Autenticação: header `x-webhook-token` (ou ?token=) deve bater com WHATSAPP_WEBHOOK_SECRET.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const eventoSchema = z.object({
  type: z.string().optional(),
  id: z.string().optional(),
  message: z
    .object({
      id: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      direction: z.string().optional(),
      contents: z
        .array(
          z.object({
            type: z.string().optional(),
            text: z.string().optional(),
            fileUrl: z.string().optional(),
            fileName: z.string().optional(),
          }),
        )
        .optional(),
      visitor: z.object({ name: z.string().optional() }).optional(),
    })
    .optional(),
  messageId: z.string().optional(),
  messageStatus: z.object({ code: z.string().optional() }).optional(),
});

/** Traduz os códigos de status da Zenvia para os status dos logs de alerta. */
function statusAlerta(codigo?: string | null): string | null {
  const c = String(codigo ?? "").toUpperCase();
  if (c === "SENT" || c === "ACCEPTED") return "enviado";
  if (c === "DELIVERED") return "entregue";
  if (c === "READ") return "lido";
  if (c === "NOT_DELIVERED" || c === "REJECTED" || c === "FAILED") return "falhou";
  return null;
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperado = process.env["WHATSAPP_WEBHOOK_SECRET"];
        if (!esperado) {
          return Response.json({ ok: false, motivo: "WHATSAPP_WEBHOOK_SECRET não configurado." }, { status: 500 });
        }
        const url = new URL(request.url);
        const token = request.headers.get("x-webhook-token") ?? url.searchParams.get("token") ?? "";
        if (token !== esperado) return new Response("Unauthorized", { status: 401 });

        const corpo = await request.json().catch(() => null);
        const parsed = eventoSchema.safeParse(corpo);
        if (!parsed.success) return Response.json({ ok: false, motivo: "Payload inválido." }, { status: 400 });
        const evt = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Atualização de status de uma mensagem enviada
        if (evt.messageId && evt.messageStatus?.code) {
          await supabaseAdmin
            .from("whatsapp_mensagens")
            .update({ status: evt.messageStatus.code })
            .eq("provider_message_id", evt.messageId);

          // Espelha o status também nos logs de alertas de tolerância.
          const novo = statusAlerta(evt.messageStatus.code);
          if (novo) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
              .from("whatsapp_alertas")
              .update({ status: novo })
              .eq("meta_message_id", evt.messageId);
          }
          return Response.json({ ok: true, tipo: "status" });
        }

        // Mensagem recebida
        const msg = evt.message;
        if (msg?.from) {
          const { chaveContatoWhatsApp } = await import("@/lib/whatsapp/telefone");
          const conteudo = (msg.contents ?? []).find((c) => c.text) ?? msg.contents?.[0];
          const anexo = (msg.contents ?? []).find((c) => c.fileUrl);
          await supabaseAdmin.from("whatsapp_mensagens").insert({
            contato_whatsapp: chaveContatoWhatsApp(msg.from),
            contato_nome: msg.visitor?.name ?? null,
            mensagem: conteudo?.text ?? (anexo?.fileName ? `[anexo] ${anexo.fileName}` : "[mensagem sem texto]"),
            direcao: "recebida",
            tipo: anexo ? "arquivo" : "texto",
            status: "recebida",
            provider_message_id: msg.id ?? null,
            arquivo_url: anexo?.fileUrl ?? null,
            arquivo_nome: anexo?.fileName ?? null,
          });
          return Response.json({ ok: true, tipo: "mensagem" });
        }

        return Response.json({ ok: true, tipo: "ignorado" });
      },
    },
  },
});
