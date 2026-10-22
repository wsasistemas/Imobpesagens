import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { identificarConcreto, validarCargaConcreto } from "@/lib/concreto";

export const reprocessarHistoricoConcreto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { identificarConcreto, validarCargaConcreto } = await import("@/lib/concreto");
    const { getFornecedoresConcreto } = await import("@/lib/concreto.functions");

    // 1. Obter fornecedores e traços
    const fornecedores = await getFornecedoresConcreto({ data: undefined });

    // 2. Buscar registros que podem ser de concreto
    const { data: pesagens, error } = await supabaseAdmin
      .from("pesagens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000); 

    if (error) throw new Error(error.message);

    let totalProcessados = 0;
    let totalStatusMudou = 0;
    let totalNaoIdentificado = 0;
    const stats = {
      reprovado_para_conforme: 0,
      conforme_para_reprovado: 0,
    };

    for (const p of (pesagens || [])) {
      const itensRaw = (p.itens_nf || []) as any[];
      const descItens = itensRaw.map(i => `${i.descricao || ""} ${i.unidade || ""}`).join(" | ");
      // Inclui numero_nota, emissor e DADOS ADICIONAIS na busca para ajudar se a descrição for muito genérica
      const descParaBusca = `${p.descricao || ""} ${descItens} ${p.numero_nota || ""} ${p.emissor || ""} ${p.dados_adicionais_nf || ""}`;

      const idRes = identificarConcreto(p.emissor || "", descParaBusca, fornecedores as any);
      
      // Se não identificou fornecedor nem traço, mas tem cimento, consideramos potencial concreto (stratified)
      const temCimento = itensRaw.some(i => (i.descricao || "").toUpperCase().includes("CIMENTO"));
      const isConcreto = idRes?.fornecedor || temCimento;

      if (!isConcreto) continue;

      if (!idRes?.traco) {
        if (idRes?.fornecedor) {
          totalNaoIdentificado++;
          if (p.status_afericao !== "traco_nao_identificado") {
             await supabaseAdmin
              .from("pesagens")
              .update({ status_afericao: "traco_nao_identificado" })
              .eq("id", p.id);
          }
        } else if (p.status_afericao === "traco_nao_identificado") {
          // Se não é mais identificado nem como fornecedor de concreto, limpa o status
          await supabaseAdmin
            .from("pesagens")
            .update({ status_afericao: "pendente" })
            .eq("id", p.id);
        }
        continue;
      }

      totalProcessados++;

      // Derivar volume
      let volume = Number(p.qtd_total || 0);
      
      const descCimento = "CIMENTO";
      const itemCimento = itensRaw.find(i => (i.descricao || "").toUpperCase().includes(descCimento));
      
      if (temCimento && itemCimento && idRes.traco) {
        const qtdCimento = Number(itemCimento.quantidade || 0);
        // Usando o novo campo consumo_cimento ou fallback
        const consumoTraco = Number((idRes.traco as any).consumo_cimento || 390);
        if (qtdCimento > 0) volume = qtdCimento / consumoTraco;
      }

      const res = validarCargaConcreto({
        fornecedor: idRes.fornecedor,
        traco: idRes.traco,
        volume: volume,
        modo: "dupla",
        pesoEntrada: Number(p.peso_entrada || 0),
        pesoSaida: Number(p.peso_saida || 0),
        pesoNF: Number(p.peso_nf || 0)
      });

      const auditData: any = {};
      if (p.aud_peso_esperado_anterior === null) {
        auditData.aud_peso_esperado_anterior = p.peso_nf || 0;
        auditData.aud_diferenca_kg_anterior = p.diferenca_kg || 0;
        auditData.aud_diferenca_pct_anterior = p.diferenca_pct || 0;
        auditData.aud_tolerancia_anterior = p.tolerancia_aplicada || 0;
        auditData.aud_status_anterior = p.status_afericao || "pendente";
        auditData.aud_base_calculo_anterior = "soma_itens_densidade_generica";
      }

      const statusAntigo = p.status_afericao;
      if (statusAntigo !== res.status) {
        totalStatusMudou++;
        if (statusAntigo !== "conforme" && res.status === "conforme") stats.reprovado_para_conforme++;
        if (statusAntigo === "conforme" && res.status !== "conforme") stats.conforme_para_reprovado++;
      }

      await supabaseAdmin
        .from("pesagens")
        .update({
          ...auditData,
          peso_esperado: res.esperado,
          diferenca_kg: res.aferido - res.esperado,
          diferenca_pct: res.desvioPct,
          tolerancia_aplicada: res.tol,
          status_afericao: res.status,
          base_calculo: "carta_traco",
          volume_m3: volume,
          traco_id: idRes.traco.id,
          recalculado_em: new Date().toISOString(),
          recalculo_versao: "carta_traco_v1"
        })
        .eq("id", p.id);
    }

    return {
      totalProcessados,
      totalStatusMudou,
      totalNaoIdentificado,
      stats,
      executadoEm: new Date().toISOString()
    };
  });

export const simularAmostraConcreto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limite: z.number().default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getFornecedoresConcreto } = await import("@/lib/concreto.functions");

    const fornecedores = await getFornecedoresConcreto({ data: undefined });

    const { data: pesagens, error } = await supabaseAdmin
      .from("pesagens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limite);

    if (error) throw new Error(error.message);

    const comparativo = [];

    for (const p of (pesagens || [])) {
      const itensRaw = (p.itens_nf || []) as any[];
      const descItens = itensRaw.map(i => `${i.descricao || ""} ${i.unidade || ""}`).join(" | ");
      const descParaBusca = `${p.descricao || ""} ${descItens} ${p.numero_nota || ""} ${p.emissor || ""} ${p.dados_adicionais_nf || ""}`;

      const idRes = identificarConcreto(p.emissor || "", descParaBusca, fornecedores as any);
      
      // Sem traço identificado não há densidade oficial para simular.
      if (!idRes?.fornecedor || !idRes.traco) continue;

      let volume = Number(p.qtd_total || 0);
      const itemCimento = itensRaw.find(i => (i.descricao || "").toUpperCase().includes("CIMENTO"));
      if (itemCimento && idRes.traco) {
        const qtdCimento = Number(itemCimento.quantidade || 0);
        const consumoTraco = Number((idRes.traco as any).consumo_cimento || 390);
        if (qtdCimento > 0) volume = qtdCimento / consumoTraco;
      }

      const resNovo = validarCargaConcreto({
        fornecedor: idRes.fornecedor,
        traco: idRes.traco as any,
        volume: volume,
        modo: "dupla",
        pesoEntrada: Number(p.peso_entrada || 0),
        pesoSaida: Number(p.peso_saida || 0),
        pesoNF: Number(p.peso_nf || 0)
      });

      comparativo.push({
        id: p.id,
        numero_nota: p.numero_nota,
        emissor: p.emissor,
        anterior: {
          peso_esperado: p.peso_esperado || p.peso_nf,
          status: p.status_afericao,
          traco_id: p.traco_id
        },
        novo: {
          peso_esperado: resNovo.esperado,
          status: resNovo.status,
          traco_id: idRes.traco?.id,
          traco_nome: idRes.traco ? `FCK ${idRes.traco.fck} Slump ${idRes.traco.slump_nominal}` : "Não identificado",
          densidade: resNovo.rho
        },
        mudou: p.status_afericao !== resNovo.status || (p.peso_esperado && Math.abs(p.peso_esperado - resNovo.esperado) > 1)
      });
    }

    return comparativo;
  });

export const reverterRecalculoConcreto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: pesagens, error } = await supabaseAdmin
      .from("pesagens")
      .select("id, aud_peso_esperado_anterior, aud_diferenca_kg_anterior, aud_diferenca_pct_anterior, aud_tolerancia_anterior, aud_status_anterior")
      .not("aud_peso_esperado_anterior", "is", null);

    if (error) throw new Error(error.message);

    for (const p of (pesagens || [])) {
      await supabaseAdmin
        .from("pesagens")
        .update({
          peso_nf: p.aud_peso_esperado_anterior,
          diferenca_kg: p.aud_diferenca_kg_anterior,
          diferenca_pct: p.aud_diferenca_pct_anterior,
          tolerancia_aplicada: p.aud_tolerancia_anterior,
          status_afericao: p.aud_status_anterior,
          recalculado_em: null,
          recalculo_versao: null,
          base_calculo: null,
          volume_m3: null,
          traco_id: null
        })
        .eq("id", p.id);
    }

    return { ok: true, revertidos: pesagens?.length || 0 };
  });