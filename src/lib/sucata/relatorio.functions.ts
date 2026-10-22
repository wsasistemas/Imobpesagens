import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { marcarFases } from "@/lib/sucata/registro-fases";
import {
  posicoesObrigatorias,
} from "@/lib/sucata/posicoes-evidencia";
import { BUCKETS } from "@/integrations/db-schema";

export type EnvioRelatorio = {
  ok: boolean;
  versao: number;
  enviados: string[];
  falhas: string[];
  concluido: boolean;
  erro?: string;
};

type Destinatario = { nome: string; email: string };

const destinatarioSchema = z.object({ nome: z.string().min(1).max(120), email: z.string().email() });

const entrada = z.object({
  processoId: z.string().uuid(),
  pdfBase64: z.string().min(100),
  destinatarios: z.array(destinatarioSchema).min(1).max(20),
});

const correcaoEntrada = z.object({
  processoId: z.string().uuid(),
  pdfBase64: z.string().min(100),
});

type Admin = import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;

type ProcRelatorio = {
  id: string;
  numero: string;
  coligada_origem: string;
  relatorio_versao: number | null;
  peso_aferido_kg: number | null;
  valor_total: number | null;
  saida_em: string | null;
  entrada_em: string;
  situacao: string;
  nfa_numero: string | null;
  nfa_enviada_em: string | null;
  nfa_exportada_em: string | null;
  fases_registro: unknown;
  obra: { nome: string } | null;
  tipo: { nome: string } | null;
};

const PROC_SELECT =
  "id, numero, coligada_origem, relatorio_versao, peso_aferido_kg, valor_total, saida_em, entrada_em, situacao, nfa_numero, nfa_enviada_em, nfa_exportada_em, fases_registro, obra:obras(nome), tipo:sucata_tipos(nome)";

async function carregarProcesso(admin: Admin, processoId: string): Promise<ProcRelatorio> {
  const { data, error } = await admin.from("sucata_processos").select(PROC_SELECT).eq("id", processoId).single();
  if (error || !data) throw new Error("Processo não encontrado.");
  return data as never as ProcRelatorio;
}

/**
 * Fotos obrigatórias do processo. A foto 002 (frente com a placa) vale para
 * processos abertos a partir da vigência da regra.
 */
async function exigirFotosObrigatorias(
  admin: Admin,
  processoId: string,
  criadoEm?: string | null,
): Promise<void> {
  const obrigatorias = posicoesObrigatorias(criadoEm);
  const { data } = await admin
    .from("sucata_evidencias")
    .select("posicao")
    .eq("processo_id", processoId)
    .is("substituida_por", null);
  const feitas = new Set((data ?? []).map((e) => e.posicao));
  const faltam = obrigatorias.filter((p) => !feitas.has(p));
  if (faltam.length > 0) {
    throw new Error(
      `Sequência fotográfica incompleta: faltam ${faltam.length} de ${obrigatorias.length} fotos (${faltam
        .map((p) => String(p).padStart(3, "0"))
        .join(", ")}).`,
    );
  }
}

/** Guarda o PDF versionado, envia aos destinatários e registra em sucata_relatorios. */
async function gerarEEnviarRelatorio(
  admin: Admin,
  proc: ProcRelatorio,
  pdfBase64: string,
  destinatarios: Destinatario[],
  userId: string,
): Promise<{ versao: number; path: string; enviados: string[]; falhas: string[] }> {
  const { htmlRelatorio, enviarEmailComAnexo } = await import("@/lib/sucata/relatorio.server");
  const { formatarKg } = await import("@/lib/sucata/validadores");

  const base64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1]! : pdfBase64;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 15_000_000) throw new Error("Relatório acima do tamanho permitido (15 MB).");

  const versao = (proc.relatorio_versao ?? 0) + 1;
  const arquivo = `relatorio-${proc.numero.replace(/\W+/g, "-")}-v${versao}.pdf`;
  const path = `${proc.id}/v${versao}.pdf`;

  const up = await admin.storage
    .from(BUCKETS.sucataRelatorios)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(`Falha ao guardar o relatório: ${up.error.message}`);

  const dataColeta = proc.saida_em ?? proc.entrada_em;
  const conteudo = htmlRelatorio({
    numero: proc.numero,
    obra: proc.obra?.nome ?? "—",
    tipo: proc.tipo?.nome ?? "—",
    pesoKg: `${formatarKg(proc.peso_aferido_kg)} kg`,
    valor:
      proc.valor_total !== null
        ? proc.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "—",
    data: dataColeta ? new Date(dataColeta).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—",
    versao,
  });

  const enviados: string[] = [];
  const falhas: string[] = [];
  for (const dest of destinatarios) {
    // A lista de tipos de notificação ainda não inclui o relatório: quando recusado,
    // o envio segue e fica registrado em sucata_relatorios e sucata_eventos.
    const { data: nota } = await admin
      .from("sucata_notificacoes")
      .insert({
        processo_id: proc.id,
        tipo: "RELATORIO_FOTOGRAFICO",
        destinatario: dest.email,
        assunto: conteudo.assunto,
        status: "ENFILEIRADA",
      })
      .select("id")
      .maybeSingle();
    try {
      const { id } = await enviarEmailComAnexo({
        para: [dest.email],
        assunto: conteudo.assunto,
        html: conteudo.html,
        texto: conteudo.texto,
        anexo: { filename: arquivo, contentBase64: base64 },
      });
      if (nota) {
        await admin
          .from("sucata_notificacoes")
          .update({ status: "ENVIADA", provider_message_id: id, enviada_em: new Date().toISOString() })
          .eq("id", nota.id);
      }
      enviados.push(dest.email);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      if (nota) await admin.from("sucata_notificacoes").update({ status: "FALHA", erro: msg }).eq("id", nota.id);
      falhas.push(dest.email);
    }
  }

  const { error: erroRel } = await admin.from("sucata_relatorios").insert({
    processo_id: proc.id,
    versao,
    storage_path: path,
    gerado_por: userId,
    enviado_para: destinatarios as never,
    enviado_em: enviados.length > 0 ? new Date().toISOString() : null,
  });
  if (erroRel) throw new Error(`Falha ao registrar o relatório: ${erroRel.message}`);

  return { versao, path, enviados, falhas };
}

/** Marca o processo como concluído. O gatilho do banco recusa se faltar alguma das 5 fotos. */
async function concluirProcesso(
  admin: Admin,
  proc: ProcRelatorio,
  versao: number,
  userId: string,
  usuarioEmail: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await admin
    .from("sucata_processos")
    .update({
      fase: "F15",
      situacao: "CONCLUIDO",
      concluido_em: agora,
      concluido_por: userId,
      relatorio_versao: versao,
      fases_registro: marcarFases(proc.fases_registro, [
        { numero: 4, marca: { fechada_em: agora, fechada_nome: usuarioEmail } },
      ]) as never,
    })
    .eq("id", proc.id);
  if (error) throw new Error(error.message);

  await admin.from("sucata_eventos").insert({
    entidade: "processo",
    entidade_id: proc.id,
    processo_id: proc.id,
    fase: "F15",
    acao: "processo_encerrado",
    coligada_origem: proc.coligada_origem,
    payload: { versao, ...payload } as never,
    usuario_id: userId,
    usuario_email: usuarioEmail,
  });
}

/**
 * Tela de relatório: guarda o PDF versionado e envia aos destinatários escolhidos.
 * Processo aberto: encerra quando ao menos um e-mail sai. Processo concluído: só gera nova versão.
 */
export const enviarRelatorioConcluir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entrada.parse(i))
  .handler(async ({ data, context }): Promise<EnvioRelatorio> => {
    const { supabase, userId } = context;

    // Acesso ao processo é decidido pela RLS do usuário.
    const { data: permitido, error: erroAcesso } = await supabase
      .from("sucata_processos")
      .select("id, situacao")
      .eq("id", data.processoId)
      .single();
    if (erroAcesso || !permitido) throw new Error("Processo não encontrado ou sem acesso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const proc = await carregarProcesso(supabaseAdmin, data.processoId);
    await exigirFotosObrigatorias(supabaseAdmin, data.processoId, proc.entrada_em);

    const r = await gerarEEnviarRelatorio(supabaseAdmin, proc, data.pdfBase64, data.destinatarios, userId);
    const jaConcluido = proc.situacao === "CONCLUIDO";

    if (jaConcluido) {
      // Nova versão de um processo já encerrado: registra sem mexer no encerramento.
      await supabaseAdmin.from("sucata_eventos").insert({
        entidade: "processo",
        entidade_id: proc.id,
        processo_id: proc.id,
        fase: "F15",
        acao: "relatorio_reenviado",
        coligada_origem: proc.coligada_origem,
        payload: { versao: r.versao, storage_path: r.path, enviados: r.enviados, falhas: r.falhas } as never,
        usuario_id: userId,
        usuario_email: context.claims?.email ?? null,
      });
      return { ok: r.enviados.length > 0, ...r, concluido: true, erro: r.enviados.length === 0 ? "Nenhum e-mail saiu." : undefined };
    }

    if (r.enviados.length === 0) {
      return {
        ok: false,
        versao: r.versao,
        enviados: r.enviados,
        falhas: r.falhas,
        concluido: false,
        erro: "O relatório foi guardado, mas nenhum e-mail saiu. O processo continua aberto.",
      };
    }

    await concluirProcesso(supabaseAdmin, proc, r.versao, userId, context.claims?.email ?? null, {
      storage_path: r.path,
      enviados: r.enviados,
      falhas: r.falhas,
      origem: "tela_relatorio",
    });

    return { ok: true, versao: r.versao, enviados: r.enviados, falhas: r.falhas, concluido: true };
  });

/**
 * Reenvio do relatório já emitido: usa exatamente o PDF guardado da versão,
 * sem gerar documento novo. Registra o reenvio em sucata_eventos.
 */
export const reenviarRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        versao: z.number().int().positive().optional(),
        destinatarios: z.array(destinatarioSchema).min(1).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<EnvioRelatorio> => {
    const { supabase, userId } = context;

    const { data: permitido, error: erroAcesso } = await supabase
      .from("sucata_processos")
      .select("id")
      .eq("id", data.processoId)
      .single();
    if (erroAcesso || !permitido) throw new Error("Processo não encontrado ou sem acesso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const proc = await carregarProcesso(supabaseAdmin, data.processoId);

    let consulta = supabaseAdmin
      .from("sucata_relatorios")
      .select("id, versao, storage_path")
      .eq("processo_id", data.processoId);
    if (data.versao !== undefined) consulta = consulta.eq("versao", data.versao);
    const { data: versaoRel } = await consulta.order("versao", { ascending: false }).limit(1).maybeSingle();
    if (!versaoRel) throw new Error("Nenhuma versão do relatório foi emitida para este processo.");

    const baixado = await supabaseAdmin.storage.from(BUCKETS.sucataRelatorios).download(versaoRel.storage_path);
    if (baixado.error || !baixado.data) throw new Error("Não foi possível ler o relatório emitido.");
    const bytes = new Uint8Array(await baixado.data.arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const base64 = btoa(bin);

    const { htmlRelatorio, enviarEmailComAnexo } = await import("@/lib/sucata/relatorio.server");
    const { formatarKg } = await import("@/lib/sucata/validadores");
    const dataColeta = proc.saida_em ?? proc.entrada_em;
    const conteudo = htmlRelatorio({
      numero: proc.numero,
      obra: proc.obra?.nome ?? "—",
      tipo: proc.tipo?.nome ?? "—",
      pesoKg: `${formatarKg(proc.peso_aferido_kg)} kg`,
      valor:
        proc.valor_total !== null
          ? proc.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
      data: dataColeta ? new Date(dataColeta).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—",
      versao: versaoRel.versao,
    });
    const arquivo = `relatorio-${proc.numero.replace(/\W+/g, "-")}-v${versaoRel.versao}.pdf`;

    const enviados: string[] = [];
    const falhas: string[] = [];
    for (const dest of data.destinatarios) {
      const { data: nota } = await supabaseAdmin
        .from("sucata_notificacoes")
        .insert({
          processo_id: proc.id,
          tipo: "RELATORIO_FOTOGRAFICO",
          destinatario: dest.email,
          assunto: conteudo.assunto,
          status: "ENFILEIRADA",
        })
        .select("id")
        .maybeSingle();
      try {
        const { id } = await enviarEmailComAnexo({
          para: [dest.email],
          assunto: conteudo.assunto,
          html: conteudo.html,
          texto: conteudo.texto,
          anexo: { filename: arquivo, contentBase64: base64 },
        });
        if (nota) {
          await supabaseAdmin
            .from("sucata_notificacoes")
            .update({ status: "ENVIADA", provider_message_id: id, enviada_em: new Date().toISOString() })
            .eq("id", nota.id);
        }
        enviados.push(dest.email);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "erro desconhecido";
        if (nota) await supabaseAdmin.from("sucata_notificacoes").update({ status: "FALHA", erro: msg }).eq("id", nota.id);
        falhas.push(dest.email);
      }
    }

    await supabaseAdmin.from("sucata_eventos").insert({
      entidade: "relatorio",
      entidade_id: versaoRel.id,
      processo_id: proc.id,
      fase: "F15",
      acao: "relatorio_reenviado",
      coligada_origem: proc.coligada_origem,
      payload: {
        versao: versaoRel.versao,
        storage_path: versaoRel.storage_path,
        enviados,
        falhas,
        arquivo_original: true,
      } as never,
      usuario_id: userId,
      usuario_email: context.claims?.email ?? null,
    });

    return {
      ok: enviados.length > 0,
      versao: versaoRel.versao,
      enviados,
      falhas,
      concluido: true,
      erro: enviados.length === 0 ? "Nenhum e-mail saiu." : undefined,
    };
  });

/**
 * Substituição técnica única de um PDF emitido com falha de diagramação.
 * Preserva a versão anterior e não envia e-mail; reimpressões e reenvios passam
 * a usar a nova versão, que é a mais recente do processo.
 */
export const corrigirRelatorioEmitido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => correcaoEntrada.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let autorizado = false;
    for (const papel of ["admin", "superadmin"] as const) {
      const { data: tem } = await supabase.rpc("has_role", { _user_id: userId, _role: papel });
      if (tem) {
        autorizado = true;
        break;
      }
    }
    if (!autorizado) throw new Error("Somente Administrador ou SuperAdmin pode aplicar a correção técnica.");

    const { data: permitido, error: erroAcesso } = await supabase
      .from("sucata_processos")
      .select("id")
      .eq("id", data.processoId)
      .single();
    if (erroAcesso || !permitido) throw new Error("Processo não encontrado ou sem acesso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const proc = await carregarProcesso(supabaseAdmin, data.processoId);
    if (proc.situacao !== "CONCLUIDO") throw new Error("A correção técnica só se aplica a relatório já emitido.");

    const { data: correcaoAnterior } = await supabaseAdmin
      .from("sucata_eventos")
      .select("id")
      .eq("processo_id", proc.id)
      .eq("acao", "relatorio_correcao_tecnica")
      .limit(1)
      .maybeSingle();
    if (correcaoAnterior) throw new Error("A correção técnica deste relatório já foi aplicada.");

    const { data: anterior } = await supabaseAdmin
      .from("sucata_relatorios")
      .select("id, versao, storage_path")
      .eq("processo_id", proc.id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!anterior) throw new Error("Nenhum relatório emitido foi encontrado.");

    const base64 = data.pdfBase64.includes(",") ? data.pdfBase64.split(",")[1] : data.pdfBase64;
    if (!base64) throw new Error("Arquivo de correção inválido.");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 15_000_000) throw new Error("Relatório acima do tamanho permitido (15 MB).");

    const versao = anterior.versao + 1;
    const path = `${proc.id}/v${versao}.pdf`;
    const upload = await supabaseAdmin.storage
      .from(BUCKETS.sucataRelatorios)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upload.error) throw new Error(`Falha ao guardar a correção: ${upload.error.message}`);

    const agora = new Date().toISOString();
    const { data: novo, error: erroRegistro } = await supabaseAdmin
      .from("sucata_relatorios")
      .insert({
        processo_id: proc.id,
        versao,
        storage_path: path,
        gerado_por: userId,
        enviado_para: [],
        enviado_em: null,
      })
      .select("id")
      .single();
    if (erroRegistro || !novo) {
      await supabaseAdmin.storage.from(BUCKETS.sucataRelatorios).remove([path]);
      throw new Error(`Falha ao registrar a correção: ${erroRegistro?.message ?? "registro indisponível"}`);
    }

    const { error: erroEvento } = await supabaseAdmin.from("sucata_eventos").insert({
      entidade: "relatorio",
      entidade_id: novo.id,
      processo_id: proc.id,
      fase: "F15",
      acao: "relatorio_correcao_tecnica",
      coligada_origem: proc.coligada_origem,
      payload: {
        versao_anterior: anterior.versao,
        storage_path_anterior: anterior.storage_path,
        versao_corrigida: versao,
        storage_path_corrigido: path,
        motivo: "Correção definitiva da diagramação A4 do relatório fotográfico",
        corrigido_em: agora,
      } as never,
      usuario_id: userId,
      usuario_email: context.claims?.email ?? null,
    });
    if (erroEvento) throw new Error(`Arquivo corrigido, mas a auditoria falhou: ${erroEvento.message}`);

    return { ok: true, versao, storagePath: path };
  });

/**
 * Fase 4: depois da nota enviada ao sucateiro, guarda o relatório com o preview da nota,
 * envia aos destinatários ativos da coligada e encerra o processo — mesmo sem e-mail enviado.
 * Perfis: contador, admin e superadmin.
 */
export const encerrarComRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ processoId: z.string().uuid(), pdfBase64: z.string().min(100) }).parse(i))
  .handler(async ({ data, context }): Promise<EnvioRelatorio> => {
    const { supabase, userId } = context;

    const { data: permitido, error: erroAcesso } = await supabase
      .from("sucata_processos")
      .select("id")
      .eq("id", data.processoId)
      .single();
    if (erroAcesso || !permitido) throw new Error("Processo não encontrado ou sem acesso.");

    let autorizado = false;
    for (const papel of ["coordenador", "contador", "admin", "superadmin"] as const) {
      const { data: tem } = await supabase.rpc("has_role", { _user_id: userId, _role: papel });
      if (tem) {
        autorizado = true;
        break;
      }
    }
    if (!autorizado) throw new Error("Você não tem permissão para encerrar o processo.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const proc = await carregarProcesso(supabaseAdmin, data.processoId);
    if (proc.situacao === "CONCLUIDO") throw new Error("Processo já está concluído.");
    if (!proc.nfa_numero) throw new Error("Anexe a Nota Fiscal Avulsa antes de encerrar.");
    if (!proc.nfa_enviada_em && !proc.nfa_exportada_em) {
      throw new Error("A nota ainda não foi enviada ao sucateiro nem exportada pela Contabilidade.");
    }
    await exigirFotosObrigatorias(supabaseAdmin, data.processoId, proc.entrada_em);

    const { data: lista } = await supabaseAdmin
      .from("sucata_destinatarios_relatorio")
      .select("nome, email")
      .eq("coligada", proc.coligada_origem)
      .eq("ativo", true)
      .order("nome");
    const destinatarios: Destinatario[] = (lista ?? []).filter((d) => destinatarioSchema.safeParse(d).success);

    const r = await gerarEEnviarRelatorio(supabaseAdmin, proc, data.pdfBase64, destinatarios, userId);

    await concluirProcesso(supabaseAdmin, proc, r.versao, userId, context.claims?.email ?? null, {
      storage_path: r.path,
      enviados: r.enviados,
      falhas: r.falhas,
      sem_destinatarios: destinatarios.length === 0,
      origem: "nota_fiscal_avulsa",
    });

    return {
      ok: true,
      versao: r.versao,
      enviados: r.enviados,
      falhas: r.falhas,
      concluido: true,
      erro:
        destinatarios.length === 0
          ? "Nenhum destinatário do relatório cadastrado para a coligada; o PDF ficou guardado no processo."
          : r.enviados.length === 0
            ? "O PDF ficou guardado, mas nenhum e-mail do relatório saiu."
            : undefined,
    };
  });
