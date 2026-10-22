import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, naoAutenticado, supabaseForUser } from "../supabase";

type Linha = {
  contratante: string | null;
  peso_liquido: number | null;
  peso_nf: number | null;
  status: string | null;
};

export default defineTool({
  name: "resumo_conferencia",
  title: "Resumo de conferência (NF × aferido)",
  description:
    "Agrega, por contratante/fornecedor, o peso aferido na balança contra o peso declarado na nota fiscal em um período, retornando diferenças em kg e %.",
  inputSchema: {
    obra_id: z.string().uuid().optional().describe("ID da obra."),
    desde: z.string().optional().describe("Data inicial ISO."),
    ate: z.string().optional().describe("Data final ISO."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    let q = supabaseForUser(ctx)
      .from("pesagens")
      .select("contratante, peso_liquido, peso_nf, status")
      .limit(2000);
    if (input.obra_id) q = q.eq("obra_id", input.obra_id);
    if (input.desde) q = q.gte("created_at", input.desde);
    if (input.ate) q = q.lte("created_at", input.ate);

    const { data, error } = await q;
    if (error) return erro(error.message);

    const mapa = new Map<string, { recebimentos: number; aferido_kg: number; nf_kg: number }>();
    for (const l of (data ?? []) as Linha[]) {
      const chave = (l.contratante ?? "SEM CONTRATANTE").trim().toUpperCase();
      const atual = mapa.get(chave) ?? { recebimentos: 0, aferido_kg: 0, nf_kg: 0 };
      atual.recebimentos += 1;
      atual.aferido_kg += Number(l.peso_liquido ?? 0);
      atual.nf_kg += Number(l.peso_nf ?? 0);
      mapa.set(chave, atual);
    }

    const linhas = [...mapa.entries()]
      .map(([contratante, v]) => {
        const diferenca_kg = v.aferido_kg - v.nf_kg;
        return {
          contratante,
          ...v,
          diferenca_kg,
          diferenca_pct: v.nf_kg > 0 ? (diferenca_kg / v.nf_kg) * 100 : null,
        };
      })
      .sort((a, b) => Math.abs(b.diferenca_kg) - Math.abs(a.diferenca_kg));

    return json({ periodo: { desde: input.desde ?? null, ate: input.ate ?? null }, resumo: linhas });
  },
});
