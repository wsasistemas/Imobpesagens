import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PerfilUsuario = {
  id: string;
  nome: string | null;
  cargo: string | null;
  setor: string | null;
  telefone: string | null;
  email: string | null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerfilUsuario> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, cargo, setor, telefone, email")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { id: context.userId, nome: null, cargo: null, setor: null, telefone: null, email: null };
    }
    return data as PerfilUsuario;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        nome: z.string().max(120).nullable().optional(),
        cargo: z.string().max(120).nullable().optional(),
        setor: z.string().max(120).nullable().optional(),
        telefone: z.string().max(40).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      id: context.userId,
      nome: data.nome ?? null,
      cargo: data.cargo ?? null,
      setor: data.setor ?? null,
      telefone: data.telefone ?? null,
    };
    const { error } = await context.supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Melhora o relato usando Anthropic Claude Haiku. Fallback: retorna o texto original.
export const melhorarTextoOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        texto: z.string().min(1).max(4000),
        tipo: z.string().max(120).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<{ texto: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada.");

    const system = `Você é um assistente de redação de relatórios de recebimento em obra de construção civil.
Reescreva o texto do usuário em português-BR, tom formal, objetivo e cordial, corrigindo ortografia e gramática.
Mantenha TODOS os fatos e detalhes; NÃO invente informações. Preserve números, placas, nomes e horários.
Retorne apenas o texto reescrito, sem título, sem aspas e sem comentários.`;

    const userMsg = `${data.tipo ? `Tipo da ocorrência: ${data.tipo}\n\n` : ""}Texto original:\n"""\n${data.texto}\n"""`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      if (resp.status === 401 || resp.status === 403) throw new Error("IA indisponível: chave inválida.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      if (resp.status === 429) throw new Error("Muitas requisições. Tente novamente em instantes.");
      throw new Error(`IA ${resp.status}: ${body.slice(0, 300)}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const texto = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!texto) throw new Error("Resposta vazia do modelo.");
    return { texto };
  });
