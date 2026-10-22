import { defineTool } from "@lovable.dev/mcp-js";
import { erro, json, naoAutenticado, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_obras",
  title: "Listar obras",
  description: "Lista as obras ativas às quais o usuário conectado tem acesso no Portal de Pesagem.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const { data, error } = await supabaseForUser(ctx)
      .from("obras")
      .select("id, nome, cnpj, coligada, ativo")
      .eq("ativo", true)
      .order("nome");
    if (error) return erro(error.message);
    return json({ obras: data ?? [] });
  },
});
