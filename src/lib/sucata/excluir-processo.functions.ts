import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const exclusaoSchema = z.object({
  processoId: z.string().uuid(),
  motivo: z.string().trim().min(5, "Informe um motivo com pelo menos 5 caracteres.").max(500),
});

export const excluirProcessoSucata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => exclusaoSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (roleError || !isSuperAdmin) {
      throw new Error("Somente o SuperAdmin pode excluir processos de sucata.");
    }

    const { data: processo, error: acessoError } = await context.supabase
      .from("sucata_processos")
      .select("id, numero, fase, coligada_origem, excluido_em")
      .eq("id", data.processoId)
      .single();
    if (acessoError || !processo) throw new Error("Processo não encontrado ou sem acesso.");
    if (processo.excluido_em) throw new Error("Este processo já foi excluído.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const agora = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        excluido_em: agora,
        excluido_por: context.userId,
        exclusao_motivo: data.motivo,
      })
      .eq("id", processo.id)
      .is("excluido_em", null);
    if (updateError) throw new Error(updateError.message);

    const { error: eventoError } = await supabaseAdmin.from("sucata_eventos").insert({
      processo_id: processo.id,
      entidade: "processo",
      entidade_id: processo.id,
      fase: processo.fase,
      acao: "processo_excluido",
      payload: { numero: processo.numero, motivo: data.motivo },
      coligada_origem: processo.coligada_origem,
      usuario_id: context.userId,
      usuario_nome: null,
      usuario_email: context.claims?.email ?? null,
    });
    if (eventoError) throw new Error("Processo excluído, mas não foi possível registrar a auditoria.");

    return { ok: true };
  });