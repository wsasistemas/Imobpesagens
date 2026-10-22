import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { destinatariosTolerancia, relatoToleranciaAcima } from "@/lib/ocorrencia";
import type { SinalTolerancia } from "@/lib/sinal-tolerancia";

const sinalSchema = z.object({
  chave: z.enum(["acima", "ok", "aguardando", "sem_base"]),
  rotulo: z.string(),
  esperado: z.number().nullable(),
  aferido: z.number().nullable(),
  difKg: z.number().nullable(),
  difPct: z.number().nullable(),
  tolPct: z.number().nullable(),
  origem: z.string().nullable(),
});

export const notificarToleranciaAcima = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        pesagemId: z.string().uuid(),
        sinal: sinalSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ enviado: boolean; motivo?: string; emailId?: string }> => {
    const { enviarEmailViaGateway } = await import("@/lib/email/resend.server");
    const { sinal, pesagemId } = data;

    if (sinal.chave !== "acima") {
      return { enviado: false, motivo: "sinal_nao_acima" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pesagem, error: errPesagem } = await supabaseAdmin
      .from("pesagens")
      .select("id, obra_id, placa, saiu_em, created_at, status, ocorrencia_tipo, ocorrencia_tipo_outro, numero_nota, emissor, contratante, peso_nf, peso_liquido, peso_entrada, peso_saida")
      .eq("id", pesagemId)
      .maybeSingle();

    if (errPesagem) throw new Error(errPesagem.message);
    if (!pesagem) throw new Error("Pesagem não encontrada.");

    const fechada = pesagem.status === "concluida" || pesagem.status === "fechada_com_ocorrencia";
    if (!fechada) {
      return { enviado: false, motivo: "pesagem_nao_fechada" };
    }

    const jaNotificado =
      pesagem.ocorrencia_tipo_outro === "TOLERANCIA ACIMA DO PERMITIDO" ||
      (pesagem.ocorrencia_tipo && pesagem.ocorrencia_tipo_outro !== "TOLERANCIA ACIMA DO PERMITIDO");
    if (jaNotificado) {
      return { enviado: false, motivo: "ja_notificado" };
    }

    const { data: obra, error: errObra } = await supabaseAdmin
      .from("obras")
      .select("id, nome, coligada, engenheiro_email, engenheiro_nome")
      .eq("id", pesagem.obra_id)
      .maybeSingle();

    if (errObra) throw new Error(errObra.message);

    // Busca coordenadores vinculados à coligada da obra.
    const { data: coordenadores } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "coordenador");

    const coordIds = (coordenadores ?? [])
      .map((r) => r.user_id)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);

    const coordEmails: string[] = [];
    if (coordIds.length > 0 && obra?.coligada) {
      const { data: vinculos } = await supabaseAdmin
        .from("usuario_coligadas")
        .select("user_id")
        .in("user_id", coordIds)
        .eq("codcoligada", obra.coligada);

      const vinculadosIds = (vinculos ?? []).map((v) => v.user_id);
      if (vinculadosIds.length > 0) {
        const { data: perfis } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .in("id", vinculadosIds);
        for (const p of perfis ?? []) {
          if (p.email) coordEmails.push(p.email);
        }
      }
    }

    const destinatarios = destinatariosTolerancia(obra?.engenheiro_email ?? null, coordEmails);
    if (destinatarios.length === 0) {
      return { enviado: false, motivo: "sem_destinatarios" };
    }

    const dataOcorr = pesagem.saiu_em ?? pesagem.created_at ?? new Date().toISOString();
    const relato = relatoToleranciaAcima(pesagem.placa, dataOcorr);

    const { error: errUpdate } = await supabaseAdmin
      .from("pesagens")
      .update({
        ocorrencia_tipo: "Outro",
        ocorrencia_tipo_outro: "TOLERANCIA ACIMA DO PERMITIDO",
        ocorrencia_relato: relato,
        ocorrencia_em: dataOcorr,
        ocorrencia_por: context.userId,
      })
      .eq("id", pesagemId);

    if (errUpdate) throw new Error(errUpdate.message);

    const pesoLiquido =
      pesagem.peso_liquido != null
        ? Number(pesagem.peso_liquido)
        : pesagem.peso_entrada != null && pesagem.peso_saida != null
          ? Math.abs(Number(pesagem.peso_entrada) - Number(pesagem.peso_saida))
          : null;

    const assunto = `TOLERÂNCIA ACIMA DO PERMITIDO — Placa ${pesagem.placa || "?"} — ${obra?.nome || "—"}`.trim();

    const corpo = [
      `Prezado Engenheiro,`,
      ``,
      relato,
      ``,
      `Resumo técnico:`,
      `• Obra: ${obra?.nome || "—"}`,
      `• Contratante: ${pesagem.contratante || "—"}`,
      `• NF nº: ${pesagem.numero_nota || "—"}`,
      `• Emissor: ${pesagem.emissor || "—"}`,
      `• Placa: ${pesagem.placa || "—"}`,
      `• Peso NF: ${pesagem.peso_nf != null ? Number(pesagem.peso_nf).toLocaleString("pt-BR") + " kg" : "—"}`,
      `• Peso líquido: ${pesoLiquido != null ? pesoLiquido.toLocaleString("pt-BR") + " kg" : "—"}`,
      ...(sinal.esperado != null ? [`• Peso esperado: ${sinal.esperado.toLocaleString("pt-BR")} kg`] : []),
      ...(sinal.tolPct != null ? [`• Tolerância aplicada: ${sinal.tolPct.toFixed(2)}%`] : []),
      ...(sinal.difPct != null ? [`• Diferença: ${sinal.difPct.toFixed(2)}%`] : []),
      ``,
      `Favor analisar e emitir parecer no Portal de Pesagem.`,
    ].join("\n");

    const { id } = await enviarEmailViaGateway({
      para: destinatarios,
      assunto,
      corpoTexto: corpo,
    });

    return { enviado: true, emailId: id };
  });
