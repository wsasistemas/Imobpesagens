// Preenchimento manual do processo de sucata para teste do fluxo ponta a ponta.
// Exclusivo de Admin/SuperAdmin: marca o processo como teste e audita cada gravação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const iso = z.string().datetime({ offset: true });

const entrada = z.object({
  processoId: z.string().uuid(),
  campos: z.object({
    tara_kg: z.number().positive().max(200_000).nullable().optional(),
    bruto_kg: z.number().positive().max(200_000).nullable().optional(),
    peso_deposito_kg: z.number().positive().max(200_000).nullable().optional(),
    tipo_sucata_id: z.string().uuid().nullable().optional(),
    saida_em: iso.nullable().optional(),
    aceite_em: iso.nullable().optional(),
    valor_total: z.number().positive().max(9_999_999).nullable().optional(),
    recibo_modo: z.enum(["SISTEMA", "PROPRIO"]).nullable().optional(),
    pagamento_valor: z.number().positive().max(9_999_999).nullable().optional(),
    pagamento_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    aprovado_em: iso.nullable().optional(),
    aprovacao_observacao: z.string().max(500).nullable().optional(),
    nfa_numero: z.string().max(60).nullable().optional(),
    nfa_emissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    concluido_em: iso.nullable().optional(),
    fase: z.string().regex(/^F\d{2}$/).optional(),
  }),
});

type Campos = z.infer<typeof entrada>["campos"];

/** Grava os campos informados na ordem que as travas do banco exigem. */
export const salvarProcessoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entrada.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; aplicados: string[] }> => {
    const [{ data: ehAdmin }, { data: ehTI }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" }),
    ]);
    if (!ehAdmin && !ehTI) throw new Error("Somente Administrador ou TI pode preencher o processo manualmente.");

    // RLS do usuário decide se ele pode ver o processo (coligada da obra).
    const { error: permErro } = await context.supabase
      .from("sucata_processos")
      .select("id")
      .eq("id", data.processoId)
      .single();
    if (permErro) throw new Error("Processo não encontrado ou sem acesso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, coligada_origem, fase")
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");

    const c: Campos = data.campos;
    const pick = (chaves: (keyof Campos)[]) => {
      const out: Record<string, unknown> = {};
      for (const k of chaves) if (c[k] !== undefined) out[k] = c[k];
      return out;
    };

    // Cada etapa é uma gravação separada porque as travas do banco validam
    // aprovação depois do valor e NFA depois da aprovação.
    const etapas: Record<string, unknown>[] = [
      { teste_manual: true, ...pick(["tara_kg", "bruto_kg", "peso_deposito_kg", "tipo_sucata_id", "saida_em"]) },
      pick(["aceite_em"]),
      pick(["valor_total", "recibo_modo"]),
      pick(["pagamento_valor", "pagamento_data"]),
      pick(["aprovado_em", "aprovacao_observacao"]),
      pick(["nfa_numero", "nfa_emissao"]),
      pick(["concluido_em"]),
      c.fase !== undefined ? { fase: c.fase } : {},
    ];

    const aplicados: string[] = [];
    for (const etapa of etapas) {
      const chaves = Object.keys(etapa).filter((k) => k !== "teste_manual");
      if (chaves.length === 0 && !("teste_manual" in etapa)) continue;
      const { error: upErro } = await supabaseAdmin
        .from("sucata_processos")
        .update(etapa as never)
        .eq("id", proc.id);
      if (upErro) throw new Error(upErro.message);
      aplicados.push(...chaves);
    }

    await registrarEventoServidor(supabaseAdmin, {
      processoId: proc.id,
      acao: "ajuste_manual_teste",
      fase: (c.fase ?? proc.fase) as string,
      coligada: proc.coligada_origem,
      payload: { origem: "teste_manual", campos: c, aplicados },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: true, aplicados };
  });
