import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, naoAutenticado, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_pesagens",
  title: "Listar pesagens",
  description:
    "Lista registros de pesagem (entrada/saída) com filtros opcionais por obra, placa, nota fiscal, contratante, status e período.",
  inputSchema: {
    obra_id: z.string().uuid().optional().describe("ID da obra."),
    placa: z.string().optional().describe("Placa do caminhão (busca parcial)."),
    numero_nota: z.string().optional().describe("Número da nota fiscal (busca parcial)."),
    contratante: z.string().optional().describe("Nome do contratante (busca parcial)."),
    status: z
      .enum(["aguardando_saida", "aguardando_saida_ocorrencia", "concluida", "recusada"])
      .optional()
      .describe("Status do registro."),
    desde: z.string().optional().describe("Data inicial ISO (created_at >=)."),
    ate: z.string().optional().describe("Data final ISO (created_at <=)."),
    limite: z.number().int().optional().describe("Máximo de registros (padrão 50, teto 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const limite = Math.min(Math.max(input.limite ?? 50, 1), 200);

    let q = supabaseForUser(ctx)
      .from("pesagens")
      .select(
        "id, obra_id, status, numero_nota, emissor, contratante, placa, transportadora, motorista, descricao, qtd_total, valor_total_nf, peso_entrada, peso_saida, peso_liquido, peso_nf, entrou_em, saiu_em, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limite);

    if (input.obra_id) q = q.eq("obra_id", input.obra_id);
    if (input.status) q = q.eq("status", input.status);
    if (input.placa) q = q.ilike("placa", `%${input.placa}%`);
    if (input.numero_nota) q = q.ilike("numero_nota", `%${input.numero_nota}%`);
    if (input.contratante) q = q.ilike("contratante", `%${input.contratante}%`);
    if (input.desde) q = q.gte("created_at", input.desde);
    if (input.ate) q = q.lte("created_at", input.ate);

    const { data, error } = await q;
    if (error) return erro(error.message);
    return json({ total: data?.length ?? 0, pesagens: data ?? [] });
  },
});
