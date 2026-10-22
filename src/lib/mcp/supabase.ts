import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { DB_SCHEMA } from "@/integrations/db-schema";

/**
 * Cliente Supabase que age COMO o usuário autenticado via OAuth (RLS aplicada).
 * Nunca usar service role aqui.
 */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    db: { schema: DB_SCHEMA },
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function naoAutenticado() {
  return {
    content: [{ type: "text" as const, text: "Não autenticado. Conecte-se com sua conta do Portal de Pesagem." }],
    isError: true,
  };
}

export function erro(mensagem: string) {
  return { content: [{ type: "text" as const, text: mensagem }], isError: true };
}

export function json(valor: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(valor, null, 2) }],
    structuredContent: valor as Record<string, unknown>,
  };
}
