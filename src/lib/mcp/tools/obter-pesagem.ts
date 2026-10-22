import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, naoAutenticado, supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_pesagem",
  title: "Detalhar pesagem",
  description:
    "Retorna todos os dados de um registro de pesagem, incluindo itens da nota fiscal, ocorrências de entrada/saída e evidências anexadas.",
  inputSchema: { id: z.string().uuid().describe("ID do registro de pesagem.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const { data, error } = await supabaseForUser(ctx)
      .from("pesagens")
      .select(
        "*, evidencias(id, tipo, nome, storage_path, created_at)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return erro(error.message);
    if (!data) return erro("Registro de pesagem não encontrado ou sem permissão de acesso.");
    return json({ pesagem: data });
  },
});
