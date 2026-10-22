// Webhook oficial da Meta (WhatsApp Business Platform).
// Canal unidirecional: valida a origem e atualiza apenas o status de entrega/falha.
// Mensagens recebidas são ignoradas por decisão de produto.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function statusMeta(bruto?: string | null): string | null {
  switch (bruto) {
    case "sent":
      return "enviado";
    case "delivered":
      return "entregue";
    case "read":
      return "lido";
    case "failed":
    case "warning":
      return "falhou";
    default:
      return null;
  }
}

export const Route = createFileRoute("/api/public/whatsapp/meta-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const verify = (process.env["META_WEBHOOK_VERIFY_TOKEN"] ?? "").trim();
        if (!verify) return new Response("Not configured", { status: 500 });
        const url = new URL(request.url);
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === verify
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const appSecret = (process.env["META_APP_SECRET"] ?? "").trim();
        if (!appSecret) return new Response("Not configured", { status: 500 });

        const bruto = await request.text();
        const assinatura = (request.headers.get("x-hub-signature-256") ?? "").replace("sha256=", "");
        const esperado = createHmac("sha256", appSecret).update(bruto).digest("hex");
        const a = Buffer.from(assinatura);
        const b = Buffer.from(esperado);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let corpo: unknown = null;
        try {
          corpo = JSON.parse(bruto);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const entradas =
          (corpo as { entry?: { changes?: { value?: { statuses?: unknown[] } }[] }[] })?.entry ?? [];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;

        let atualizados = 0;
        for (const e of entradas) {
          for (const c of e.changes ?? []) {
            const statuses = (c.value?.statuses ?? []) as {
              id?: string;
              status?: string;
              errors?: { title?: string; message?: string }[];
            }[];
            for (const s of statuses) {
              const novo = statusMeta(s.status);
              if (!s.id || !novo) continue;
              const erro = s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null;
              const { error } = await db
                .from("whatsapp_alertas")
                .update({ status: novo, ...(erro ? { erro_detalhe: erro } : {}) })
                .eq("meta_message_id", s.id);
              if (!error) atualizados++;
            }
          }
        }

        return Response.json({ ok: true, atualizados });
      },
    },
  },
});
