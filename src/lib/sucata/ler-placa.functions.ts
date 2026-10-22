import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlacaLida = {
  ok: boolean;
  placa: string | null;
  confianca: number | null;
  motivo?: string;
};

const entrada = z.object({
  /** Imagem da frente do caminhão em data URL (data:image/jpeg;base64,...). */
  imagem: z.string().min(64, "Imagem inválida."),
});

/** Placas brasileiras: antigo AAA0000 e Mercosul AAA0A00. */
export function normalizarPlacaLida(bruto: string): string | null {
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{3}\d{4}$/.test(limpo)) return limpo;
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(limpo)) return limpo;
  return null;
}

/**
 * Lê a placa na foto da frente do caminhão. O navegador nunca fala com o
 * serviço de leitura: a imagem vai pelo servidor e nada é armazenado aqui.
 */
export const lerPlacaDaFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entrada.parse(i))
  .handler(async ({ data }): Promise<PlacaLida> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false, placa: null, confianca: null, motivo: "Leitura automática indisponível. Digite a placa." };
    }

    const url = data.imagem.startsWith("data:") ? data.imagem : `data:image/jpeg;base64,${data.imagem}`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "system",
              content:
                "Você lê placas de veículos brasileiros em fotos. Placa antiga: 3 letras e 4 números (AAA0000). Placa Mercosul: 3 letras, 1 número, 1 letra, 2 números (AAA0A00). Devolva só a placa do caminhão principal da foto, sem espaços nem hífen. Não invente: se não estiver legível, deixe vazio e confianca 0.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Qual é a placa do caminhão nesta foto?" },
                { type: "image_url", image_url: { url } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extrair_placa",
                description: "Placa lida na foto",
                parameters: {
                  type: "object",
                  properties: {
                    placa: { type: "string", description: "Placa sem espaços nem hífen, ou vazio" },
                    confianca: { type: "number", description: "Confiança de 0 a 1" },
                  },
                  required: [],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extrair_placa" } },
        }),
      });

      if (!resp.ok) {
        const motivo =
          resp.status === 429
            ? "Muitas leituras em sequência. Aguarde alguns segundos ou digite a placa."
            : resp.status === 402
              ? "Créditos de leitura automática esgotados. Digite a placa."
              : `Não foi possível ler a placa (${resp.status}). Digite a placa.`;
        return { ok: false, placa: null, confianca: null, motivo };
      }

      const json = (await resp.json()) as {
        choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
      };
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { ok: false, placa: null, confianca: null, motivo: "Placa não identificada na foto." };

      const lido = JSON.parse(args) as { placa?: string; confianca?: number };
      const placa = normalizarPlacaLida(String(lido.placa ?? ""));
      const confianca = typeof lido.confianca === "number" ? Math.max(0, Math.min(1, lido.confianca)) : null;
      if (!placa) {
        return { ok: false, placa: null, confianca, motivo: "Placa não identificada na foto. Digite a placa." };
      }
      return { ok: true, placa, confianca };
    } catch {
      return { ok: false, placa: null, confianca: null, motivo: "Falha na leitura automática. Digite a placa." };
    }
  });
