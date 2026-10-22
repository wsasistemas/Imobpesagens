import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { relatoToleranciaAcima } from "@/lib/ocorrencia";

export const TIPO_ALERTA_TOLERANCIA = "alerta_tolerancia_acima";
export const TEMPLATE_PADRAO = "alerta_pesagem_acima_tolerancia";
export const IDIOMA_PADRAO = "pt_BR";

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

export type ResultadoAlerta = {
  resultado: "enviado" | "sem_destinatario" | "falha" | "ignorado";
  motivo?: string;
  telefone?: string | null;
  destinatario?: string | null;
  enviados?: number;
  semTelefone?: number;
  falhas?: number;
};

function dataBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Fluxo completo do alerta de divergência acima da tolerância:
 * revalida a pesagem fechada, garante a ocorrência automática, resolve o
 * engenheiro responsável da coligada e envia o template oficial da Meta.
 * Antiduplicidade garantida pela restrição única (pesagem_id, tipo_alerta).
 */
export const enviarAlertaToleranciaAcima = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        pesagemId: z.string().uuid(),
        sinal: sinalSchema,
        forcarReenvio: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<ResultadoAlerta> => {
    if (data.sinal.chave !== "acima") return { resultado: "ignorado", motivo: "sinal_nao_acima" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizarE164 } = await import("@/lib/whatsapp/meta.server");
    const { enviarAlertaTemplateAuto } = await import("@/lib/whatsapp/alerta-envio.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const forcar = data.forcarReenvio === true;
    if (forcar) await assertAdmin(context);

    try {
    const { data: pesagem, error: errP } = await db
      .from("pesagens")
      .select(
        "id, obra_id, placa, emissor, contratante, transportadora, saiu_em, created_at, status, ocorrencia_tipo, ocorrencia_tipo_outro, ocorrencia_relato",
      )
      .eq("id", data.pesagemId)
      .maybeSingle();
    if (errP) throw new Error(errP.message);
    if (!pesagem) throw new Error("Pesagem não encontrada.");

    const fechada = pesagem.status === "concluida" || pesagem.status === "fechada_com_ocorrencia";
    if (!fechada) return { resultado: "ignorado", motivo: "pesagem_nao_fechada" };

    const dataOcorr: string = pesagem.saiu_em ?? pesagem.created_at ?? new Date().toISOString();
    const relato = relatoToleranciaAcima(pesagem.placa, dataOcorr);


    // Ocorrência automática: cria só quando não há ocorrência manual gravada.
    if (!pesagem.ocorrencia_tipo && !pesagem.ocorrencia_relato) {
      await db
        .from("pesagens")
        .update({
          ocorrencia_tipo: "Outro",
          ocorrencia_tipo_outro: "TOLERANCIA ACIMA DO PERMITIDO",
          ocorrencia_relato: relato,
          ocorrencia_em: dataOcorr,
          ocorrencia_por: context.userId,
        })
        .eq("id", pesagem.id);
    }

    const { data: obra } = await db
      .from("obras")
      .select("id, nome, coligada")
      .eq("id", pesagem.obra_id)
      .maybeSingle();

    const { data: cfg } = await db
      .from("whatsapp_config")
      .select(
        "provedor, api_token, sender_id, meta_phone_number_id, alertas_tolerancia_ativo, alerta_template_nome, alerta_template_id, alerta_template_idioma, is_active",
      )
      .limit(1)
      .maybeSingle();

    const template: string = cfg?.alerta_template_nome || TEMPLATE_PADRAO;
    const idioma: string = cfg?.alerta_template_idioma || IDIOMA_PADRAO;
    // Regra vigente: empreendimento = coluna "contratante" da pesagem (reserva: nome da obra);
    // fornecedor = coluna "transportadora" da pesagem (reserva: emissor da nota).
    const empreendimento =
      String(pesagem.contratante ?? "").trim() || String(obra?.nome ?? "").trim();
    const fornecedor =
      String(pesagem.transportadora ?? "").trim() || String(pesagem.emissor ?? "").trim();
    const variaveis = [
      String(pesagem.placa ?? "—").trim(),
      dataBR(dataOcorr),
      empreendimento,
      fornecedor,
    ];
    const valores = {
      placa: variaveis[0],
      data: variaveis[1],
      empreendimento,
      fornecedor,
    };

    const baseLog = {
      pesagem_id: pesagem.id,
      tipo_alerta: TIPO_ALERTA_TOLERANCIA,
      obra_id: pesagem.obra_id,
      coligada: obra?.coligada ?? null,
      placa: pesagem.placa ?? null,
      ocorrencia_ref: forcar ? "REENVIO MANUAL" : "TOLERANCIA ACIMA DO PERMITIDO",
      template,
      template_idioma: idioma,
      variaveis,
      reenvio_manual: forcar,
      template_id: cfg?.alerta_template_id ?? null,
      created_by: context.userId,
    };

    const registrar = async (
      extra: Record<string, unknown>,
    ): Promise<string | null> => {
      const { data: log, error } = await db
        .from("whatsapp_alertas")
        .insert({ ...baseLog, status: "pendente", ...extra })
        .select("id")
        .maybeSingle();
      if (error) {
        // 23505 = violação da restrição única → já disparado para este destinatário.
        if (String(error.code) === "23505") {
          if (!forcar) return null;
          // Reenvio manual: reutiliza o log existente.
          let q = db
            .from("whatsapp_alertas")
            .select("id")
            .eq("pesagem_id", pesagem.id)
            .eq("tipo_alerta", TIPO_ALERTA_TOLERANCIA);
          const destino = extra["destinatario_user_id"];
          q = destino ? q.eq("destinatario_user_id", destino) : q.is("destinatario_user_id", null);
          const { data: existente } = await q.limit(1).maybeSingle();
          if (!existente?.id) return null;
          await db
            .from("whatsapp_alertas")
            .update({ ...baseLog, status: "pendente", erro_detalhe: null, ...extra })
            .eq("id", existente.id);
          return existente.id as string;
        }
        throw new Error(error.message);
      }
      return log?.id ?? null;
    };


    const finalizar = async (
      logId: string,
      status: string,
      extra: Record<string, unknown>,
    ): Promise<void> => {
      await db.from("whatsapp_alertas").update({ status, ...extra }).eq("id", logId);
    };

    if (cfg?.alertas_tolerancia_ativo !== true) {
      const logId = await registrar({});
      if (logId) {
        await finalizar(logId, "falhou", {
          erro_detalhe: "Alertas de tolerância desativados nas configurações.",
        });
      }
      return { resultado: "falha", motivo: "alertas_desativados" };
    }

    // Etapa 6 do fluxo: engenheiro responsável da coligada +
    // Admin/SuperAdmin marcados como responsáveis por todas as coligadas.
    const idsDestinatarios: string[] = [];
    if (obra?.coligada) {
      const { data: vinculos } = await db
        .from("usuario_coligadas")
        .select("user_id")
        .eq("codcoligada", obra.coligada)
        .eq("engenheiro_responsavel", true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const v of (vinculos ?? []) as any[]) {
        if (v.user_id) idsDestinatarios.push(v.user_id);
      }
    }
    {
      const { data: globais } = await db
        .from("profiles")
        .select("id")
        .eq("engenheiro_todas_coligadas", true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (globais ?? []) as any[]) {
        if (p.id) idsDestinatarios.push(p.id);
      }
    }
    const ids = [...new Set(idsDestinatarios)];

    if (!ids.length) {
      const logId = await registrar({});
      if (logId) {
        await finalizar(logId, "pendente", {
          erro_detalhe: "Nenhum engenheiro responsável marcado para a coligada.",
        });
      }
      return { resultado: "sem_destinatario" };
    }

    const { data: perfis } = await db
      .from("profiles")
      .select("id, nome, email, telefone, whatsapp_e164")
      .in("id", ids);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perfilPorId = new Map<string, any>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((perfis ?? []) as any[]).map((p) => [p.id, p]),
    );

    const telefonesUsados = new Set<string>();
    let enviados = 0;
    let falhas = 0;
    let semTelefone = 0;
    let ultimoTelefone: string | null = null;
    let ultimoNome: string | null = null;
    let ultimoErro: string | undefined;

    for (const id of ids) {
      const perfil = perfilPorId.get(id);
      const email: string | null = perfil?.email ?? (await emailUsuario(db, id));
      const nome: string | null = perfil?.nome ?? email ?? null;
      const tel = normalizarE164(perfil?.whatsapp_e164 ?? perfil?.telefone ?? null);

      const logId = await registrar({
        destinatario_user_id: id,
        destinatario_nome: nome,
        destinatario_email: email,
        telefone: tel,
      });
      if (!logId) continue; // já disparado antes para este destinatário

      if (!tel) {
        semTelefone += 1;
        await finalizar(logId, "pendente", {
          erro_detalhe: "Engenheiro responsável sem telefone WhatsApp válido.",
        });
        continue;
      }
      if (telefonesUsados.has(tel)) {
        await finalizar(logId, "ignorado", {
          erro_detalhe: "Telefone duplicado neste alerta — envio único.",
        });
        continue;
      }
      telefonesUsados.add(tel);

      const envio = await enviarAlertaTemplateAuto({
        cfg,
        para: tel,
        template,
        idioma,
        valores,
      });

      if (!envio.ok) {
        falhas += 1;
        ultimoErro = envio.erro ?? "Falha desconhecida no envio.";
        await finalizar(logId, "falhou", {
          erro_detalhe: ultimoErro,
          campos_enviados: envio.campos ?? null,
          mensagem_texto: envio.texto ?? null,
          template_id: envio.templateId ?? cfg?.alerta_template_id ?? null,
          template_nome_real: envio.templateNome ?? null,
        });
        continue;
      }

      enviados += 1;
      ultimoTelefone = tel;
      ultimoNome = nome;
      const semValor = Object.entries(envio.campos ?? {})
        .filter(([, v]) => String(v ?? "").trim() === "")
        .map(([k]) => k);
      await finalizar(logId, "enviado", {
        meta_message_id: envio.messageId ?? null,
        erro_detalhe:
          semValor.length > 0
            ? `Variáveis do template sem valor: ${semValor.join(", ")}.`
            : null,
        variaveis: Object.values(envio.campos ?? {}).length > 0
          ? Object.values(envio.campos ?? {})
          : variaveis,
        campos_enviados: envio.campos ?? null,
        mensagem_texto: envio.texto ?? null,
        template_id: envio.templateId ?? cfg?.alerta_template_id ?? null,
        template_nome_real: envio.templateNome ?? null,
      });
    }

    const contadores = { enviados, semTelefone, falhas };
    if (enviados > 0) {
      return {
        resultado: "enviado",
        telefone: ultimoTelefone,
        destinatario: ultimoNome,
        motivo: ultimoErro,
        ...contadores,
      };
    }
    if (falhas > 0) return { resultado: "falha", motivo: ultimoErro, ...contadores };
    if (semTelefone > 0) return { resultado: "sem_destinatario", ...contadores };
    return { resultado: "ignorado", motivo: "ja_disparado", ...contadores };
    } catch (e) {
      // Nunca falhar em silêncio: registra o motivo no log de alertas.
      const motivo = e instanceof Error ? e.message : "Falha inesperada no alerta de tolerância.";
      try {
        await db.from("whatsapp_alertas").insert({
          pesagem_id: data.pesagemId,
          tipo_alerta: TIPO_ALERTA_TOLERANCIA,
          template: TEMPLATE_PADRAO,
          template_idioma: IDIOMA_PADRAO,
          variaveis: [],
          status: "falhou",
          reenvio_manual: data.forcarReenvio === true,
          erro_detalhe: motivo,
          created_by: context.userId,
        });
      } catch {
        // ignora conflito de unicidade no log de erro
      }
      return { resultado: "falha", motivo };
    }
  });


/** Status da conexão com a Meta (Admin/SuperAdmin). */
export const statusMetaWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const { data: cfg } = await db
      .from("whatsapp_config")
      .select("provedor, api_token, sender_id, meta_phone_number_id, alerta_template_id")
      .limit(1)
      .maybeSingle();
    const { statusProvedorAlerta } = await import("@/lib/whatsapp/alerta-envio.server");
    return statusProvedorAlerta(cfg);
  });

/** Template ID digitado na tela (ainda não salvo) prevalece sobre o gravado. */
const templateIdSchema = z.string().trim().max(120).optional();

/** Inspeciona o template configurado e devolve suas variáveis reais (Admin/SuperAdmin). */
export const inspecionarTemplateAlerta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ templateId: templateIdSchema }).optional().parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const { data: cfg } = await db
      .from("whatsapp_config")
      .select("provedor, api_token, sender_id, meta_phone_number_id, alerta_template_nome, alerta_template_id, alerta_template_idioma")
      .limit(1)
      .maybeSingle();
    const { inspecionarTemplateAlerta: inspecionar } = await import(
      "@/lib/whatsapp/alerta-envio.server"
    );
    const templateId = data?.templateId?.trim();
    return inspecionar(templateId ? { ...(cfg ?? {}), alerta_template_id: templateId } : cfg);
  });

/** Envio de teste do template para um número informado pelo Admin/SuperAdmin. */
export const testarAlertaTolerancia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        telefone: z.string().trim().min(10).max(20),
        variaveis: z.record(z.string(), z.string().max(500)).optional(),
        templateId: templateIdSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; erro?: string; messageId?: string }> => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const { data: cfgSalva } = await db
      .from("whatsapp_config")
      .select("provedor, api_token, sender_id, meta_phone_number_id, alerta_template_nome, alerta_template_id, alerta_template_idioma")
      .limit(1)
      .maybeSingle();
    const templateIdTela = data.templateId?.trim();
    const cfg = templateIdTela ? { ...(cfgSalva ?? {}), alerta_template_id: templateIdTela } : cfgSalva;

    const { normalizarE164 } = await import("@/lib/whatsapp/meta.server");
    const { enviarAlertaTemplate, enviarAlertaTemplateCampos } = await import(
      "@/lib/whatsapp/alerta-envio.server"
    );
    const para = normalizarE164(data.telefone);
    if (!para) return { ok: false, erro: "Telefone inválido para o formato internacional." };

    const template = cfg?.alerta_template_nome || TEMPLATE_PADRAO;
    const idioma = cfg?.alerta_template_idioma || IDIOMA_PADRAO;

    if (data.variaveis && Object.keys(data.variaveis).length > 0) {
      const r = await enviarAlertaTemplateCampos({
        cfg,
        para,
        template,
        idioma,
        campos: data.variaveis,
      });
      return { ok: r.ok, erro: r.erro, messageId: r.messageId };
    }

    const r = await enviarAlertaTemplate({
      cfg,
      para,
      template,
      idioma,
      variaveis: ["TESTE0000", new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })],
    });
    return { ok: r.ok, erro: r.erro, messageId: r.messageId };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: any) {
  const [a, s] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" }),
  ]);
  if (!a.data && !s.data) throw new Error("Apenas administradores podem executar esta ação.");
}


/** E-mail do usuário no cadastro de autenticação (fallback quando o perfil não tem nome). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function emailUsuario(db: any, userId: string): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}
