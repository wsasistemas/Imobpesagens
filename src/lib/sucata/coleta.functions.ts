// Fase 2 do processo de sucata: cálculo e revisão antes da solicitação manual
// da Nota Fiscal Avulsa à Contabilidade.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { marcarFases } from "@/lib/sucata/registro-fases";

const PORTAL_URL = "https://imobpesagens.vercel.app";

type Papel = "admin" | "superadmin" | "coordenador" | "operador" | "contador" | "administrativo_obra";

type ClienteUsuario = {
  rpc: (fn: "has_role", args: { _user_id: string; _role: Papel }) => PromiseLike<{ data: boolean | null }>;
  from: (tabela: "sucata_processos") => {
    select: (cols: string) => {
      eq: (col: string, valor: string) => { single: () => PromiseLike<{ error: unknown }> };
    };
  };
};

async function exigirPapel(
  supabase: ClienteUsuario,
  userId: string,
  papeis: Papel[],
  mensagem: string,
): Promise<void> {
  for (const papel of papeis) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: papel });
    if (data) return;
  }
  throw new Error(mensagem);
}

async function exigirAcesso(supabase: ClienteUsuario, processoId: string): Promise<void> {
  const { error } = await supabase.from("sucata_processos").select("id").eq("id", processoId).single();
  if (error) throw new Error("Processo não encontrado ou sem acesso.");
}

type Admin = import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;

export type PedidoNfa = { emailOk: boolean; destinatarios: string[]; erro?: string };

export type RevisaoFase2 = {
  sucateiro: string;
  banco: string;
  contaMascarada: string;
};

/** Dados mínimos da revisão. A conta completa nunca é enviada ao navegador. */
export const dadosRevisaoFase2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ processoId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<RevisaoFase2> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: proc, error: procErro } = await supabaseAdmin
      .from("sucata_processos")
      .select("sucateiro_id")
      .eq("id", data.processoId)
      .single();
    if (procErro || !proc) throw new Error("Processo não encontrado.");
    const { data: suc, error: sucErro } = await supabaseAdmin
      .from("sucata_sucateiros")
      .select("razao_social, nome_completo, banco, conta")
      .eq("id", proc.sucateiro_id)
      .single();
    if (sucErro || !suc) throw new Error("Sucateiro não encontrado.");
    const conta = suc.conta?.trim() ?? "";
    return {
      sucateiro: suc.razao_social ?? suc.nome_completo ?? "—",
      banco: suc.banco?.trim() || "—",
      contaMascarada: conta.length <= 4 ? conta || "—" : `${"•".repeat(Math.min(6, conta.length - 4))}${conta.slice(-4)}`,
    };
  });

/** Monta e envia o pedido da nota à Contabilidade; registra evento e notificações. */
async function enviarPedidoNfa(
  admin: Admin,
  processoId: string,
  observacao: string | null,
  userId: string,
  usuarioEmail: string | null,
  usuarioNome: string | null,
): Promise<PedidoNfa> {
  const { notificar, emailsContabilidade, registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");
  const {
    PROCESSO_NFA_SELECT,
    anexosDoProcesso,
    assuntoSolicitacaoNfa,
    htmlSolicitacaoNfa,
    textoSolicitacaoNfa,
  } = await import("@/lib/sucata/nfa.server");
  type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

  const { data: atual, error: erroAtual } = await admin
    .from("sucata_processos")
    .select("id, numero, valor_total, bruto_kg, fases_registro")
    .eq("id", processoId)
    .single();
  if (erroAtual || !atual) throw new Error("Processo não encontrado.");
  if (!atual.bruto_kg) throw new Error("Registre a pesagem de saída antes de pedir a nota.");
  if (!atual.valor_total) throw new Error("O valor da coleta ainda não foi calculado.");

  const agora = new Date().toISOString();
  const { data: atualizado, error: upErro } = await admin
    .from("sucata_processos")
    .update({
      aprovado_em: agora,
      aprovado_por: userId,
      aprovacao_observacao: observacao,
      nfa_solicitada_em: agora,
      nfa_impedimento_motivo: null,
      devolvido_em: null,
      devolucao_motivo: null,
      fase: "F12",
      fases_registro: marcarFases(atual.fases_registro, [
        { numero: 2, marca: { fechada_em: agora, fechada_nome: usuarioNome ?? usuarioEmail } },
        { numero: 3, marca: { aberta_em: agora } },
      ]) as never,
    })
    .eq("id", processoId)
    .select(PROCESSO_NFA_SELECT)
    .single();
  if (upErro) throw new Error(upErro.message);
  const p = atualizado as never as P;

  const destinatarios = await emailsContabilidade(admin);

  let emailOk = destinatarios.length > 0;
  let erro: string | undefined;
  if (destinatarios.length === 0) {
    erro = "Pedido registrado, mas não há nenhum usuário com perfil Contabilidade nem e-mail configurado no módulo.";
  } else {
    const anexos = await anexosDoProcesso(admin, p.id);
    const assunto = assuntoSolicitacaoNfa(p);
    const html = `${htmlSolicitacaoNfa(p, anexos)}
    <div style="text-align:center;padding:18px 0">
      <a href="${PORTAL_URL}/sucata/${p.id}/nfa?foco=emissao"
         style="background:#B0202E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
        Emitir nota no sistema
      </a>
    </div>`;
    const texto = `${textoSolicitacaoNfa(p)}\n\nEmitir no sistema: ${PORTAL_URL}/sucata/${p.id}/nfa?foco=emissao`;
    for (const dest of destinatarios) {
      const r = await notificar(admin, {
        processoId: p.id,
        tipo: "SOLICITACAO_NFA",
        destinatario: dest,
        assunto,
        html,
        texto,
      });
      if (!r.ok) {
        emailOk = false;
        erro = r.erro;
      }
    }
  }

  await registrarEventoServidor(admin, {
    processoId: p.id,
    acao: "nfa_solicitada",
    fase: "F12",
    coligada: p.coligada_origem,
    payload: {
      destinatarios,
      valor_total: p.valor_total,
      observacao,
      envio: emailOk ? "ENVIADA" : "FALHA",
      erro: erro ?? null,
    },
    usuarioEmail,
  });

  return { emailOk, destinatarios, erro };
}

/**
 * Fase 2: logo após a pesagem de saída, calcula o valor a pagar pelo peso aferido.
 * A solicitação à Contabilidade permanece pendente até a revisão manual.
 */
export const calcularValorEPedirNota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ processoId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{
    ok: true;
    valorTotal: number;
    valorUnitario: number;
  }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, numero, coligada_origem, sucateiro_id, peso_aferido_kg, valor_total, valor_unitario_kg")
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    if (!proc.peso_aferido_kg || proc.peso_aferido_kg <= 0) {
      throw new Error("O peso aferido ainda não foi apurado. Registre a pesagem de saída.");
    }

    const { data: suc } = await supabaseAdmin
      .from("sucata_sucateiros")
      .select("id, valor_por_kg, razao_social, nome_completo")
      .eq("id", proc.sucateiro_id)
      .single();
    const unitario = Number(suc?.valor_por_kg ?? 0);
    if (!unitario || unitario <= 0) {
      throw new Error(
        "O sucateiro não tem valor por quilo cadastrado. Preencha o campo no cadastro do sucateiro para o sistema calcular o valor.",
      );
    }

    const total = Math.round(Number(proc.peso_aferido_kg) * unitario * 100) / 100;
    const { error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({ valor_unitario_kg: unitario, valor_total: total, recibo_modo: "SISTEMA" })
      .eq("id", data.processoId);
    if (upErro) throw new Error(upErro.message);

    await registrarEventoServidor(supabaseAdmin, {
      processoId: proc.id,
      acao: "valor_calculado",
      fase: "F04",
      coligada: proc.coligada_origem,
      payload: {
        peso_aferido_kg: proc.peso_aferido_kg,
        valor_unitario_kg: unitario,
        valor_total: total,
        origem: "calculo_automatico_saida",
      },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: true, valorTotal: total, valorUnitario: unitario };
  });

/** Solicitação ou reenvio manual do pedido da nota à Contabilidade. */
export const solicitarNfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        observacao: z.string().max(1000).nullable(),
      })
      .parse(i),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; emailOk: boolean; destinatarios: string[]; erro?: string }> => {
      await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
      await exigirPapel(
        context.supabase as unknown as ClienteUsuario,
        context.userId,
        ["administrativo_obra", "admin", "superadmin"],
        "Somente o Administrativo de Obra, Administrador ou TI pode solicitar a nota fiscal.",
      );

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const r = await enviarPedidoNfa(
        supabaseAdmin,
        data.processoId,
        data.observacao,
        context.userId,
        context.claims?.email ?? null,
        (context.claims as { name?: string } | undefined)?.name ?? null,
      );
      return { ok: true, ...r };
    },
  );

/** Ajuste do valor calculado — somente administrador ou TI, sempre com justificativa. */
export const ajustarValorColeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        valorTotal: z.number().positive().max(10_000_000).nullable(),
        valorUnitario: z.number().positive().max(1000).nullable(),
        justificativa: z.string().trim().min(5).max(1000),
      })
      .refine((v) => v.valorTotal !== null || v.valorUnitario !== null, {
        message: "Informe o valor total ou o valor por quilo.",
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{
    ok: true;
    valorTotal: number;
    valorUnitario: number | null;
    notaEmitida: boolean;
    emailOk: boolean;
    destinatarios: string[];
    erro?: string;
  }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["admin", "superadmin"],
      "Só o administrador ou a TI podem ajustar o valor da coleta.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor, notificar, emailsContabilidade } = await import(
      "@/lib/sucata/notificacoes.server"
    );
    const {
      PROCESSO_NFA_SELECT,
      assuntoAjusteValor,
      htmlAjusteValor,
      textoAjusteValor,
    } = await import("@/lib/sucata/nfa.server");
    type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, numero, coligada_origem, peso_aferido_kg, valor_total, valor_unitario_kg, nfa_numero, nfa_emissao")
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    const peso = Number(proc.peso_aferido_kg ?? 0);
    if (peso <= 0) throw new Error("O peso aferido ainda não foi apurado.");

    const arredonda = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;
    const total =
      data.valorTotal !== null ? arredonda(data.valorTotal, 2) : arredonda(peso * (data.valorUnitario ?? 0), 2);
    const unitario = data.valorUnitario !== null ? arredonda(data.valorUnitario, 4) : arredonda(total / peso, 4);
    const notaEmitida = !!proc.nfa_numero;

    const agora = new Date().toISOString();
    const autor = (context.claims as { name?: string } | undefined)?.name ?? context.claims?.email ?? null;
    const { data: atualizado, error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        valor_total: total,
        valor_unitario_kg: unitario,
        valor_ajustado_em: agora,
        valor_ajustado_por: context.userId,
        valor_ajuste_justificativa: data.justificativa,
      })
      .eq("id", data.processoId)
      .select(PROCESSO_NFA_SELECT)
      .single();
    if (upErro) throw new Error(upErro.message);
    const p = atualizado as never as P;

    await registrarEventoServidor(supabaseAdmin, {
      processoId: proc.id,
      acao: "valor_ajustado",
      fase: "F04",
      coligada: proc.coligada_origem,
      payload: {
        valor_total_anterior: proc.valor_total,
        valor_unitario_anterior: proc.valor_unitario_kg,
        valor_total: total,
        valor_unitario_kg: unitario,
        justificativa: data.justificativa,
      },
      usuarioEmail: context.claims?.email ?? null,
    });

    // Avisa a Contabilidade: emitir pelo novo valor ou cancelar a nota anterior.
    const destinatarios = await emailsContabilidade(supabaseAdmin);
    let emailOk = destinatarios.length > 0;
    let erro: string | undefined;
    if (destinatarios.length === 0) {
      erro = "Valor ajustado, mas não há nenhum usuário com perfil Contabilidade para avisar.";
    } else {
      const ajuste = {
        valorAnterior: proc.valor_total,
        valorNovo: total,
        unitarioNovo: unitario,
        justificativa: data.justificativa,
        autor,
        quando: agora,
      };
      const assunto = assuntoAjusteValor(p, notaEmitida);
      const html = `${htmlAjusteValor(p, ajuste, notaEmitida)}
      <div style="text-align:center;padding:18px 0">
        <a href="${PORTAL_URL}/sucata/${p.id}/nfa?foco=emissao"
           style="background:#B0202E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Emitir nota no sistema
        </a>
      </div>`;
      const texto = `${textoAjusteValor(p, ajuste, notaEmitida)}\n\nEmitir no sistema: ${PORTAL_URL}/sucata/${p.id}/nfa?foco=emissao`;
      for (const dest of destinatarios) {
        const r = await notificar(supabaseAdmin, {
          processoId: p.id,
          tipo: "AJUSTE_VALOR_NFA",
          destinatario: dest,
          assunto,
          html,
          texto,
        });
        if (!r.ok) {
          emailOk = false;
          erro = r.erro;
        }
      }
    }

    await registrarEventoServidor(supabaseAdmin, {
      processoId: proc.id,
      acao: notaEmitida ? "nfa_cancelamento_solicitado" : "nfa_valor_corrigido",
      fase: "F12",
      coligada: proc.coligada_origem,
      payload: {
        emails: destinatarios,
        valor_anterior: proc.valor_total,
        valor_novo: total,
        nfa_numero: proc.nfa_numero,
        justificativa: data.justificativa,
        envio: emailOk ? "ENVIADA" : "FALHA",
        erro: erro ?? null,
      },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: true, valorTotal: total, valorUnitario: unitario, notaEmitida, emailOk, destinatarios, erro };
  });

/** Teste de envio (somente superadmin): manda o mesmo e-mail da NFA para um endereço avulso. */
export const enviarNfaTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        email: z.string().email().max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; erro?: string }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["superadmin"],
      "Somente a TI (superadmin) pode disparar o e-mail de teste da nota fiscal avulsa.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notificar, registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");
    const {
      PROCESSO_NFA_SELECT,
      anexosDoProcesso,
      assuntoSolicitacaoNfa,
      htmlSolicitacaoNfa,
      textoSolicitacaoNfa,
    } = await import("@/lib/sucata/nfa.server");
    type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select(PROCESSO_NFA_SELECT)
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    const p = proc as never as P;
    if (!p.bruto_kg) throw new Error("Registre a pesagem de saída antes de testar o envio.");
    if (!p.valor_total) throw new Error("O valor da coleta ainda não foi calculado.");

    const anexos = await anexosDoProcesso(supabaseAdmin, p.id);
    const assunto = `[TESTE] ${assuntoSolicitacaoNfa(p)}`;
    const html = `<div style="background:#fef3c7;color:#78350f;padding:10px 14px;border-radius:8px;font-weight:600">
      Envio de teste — este e-mail não representa um pedido real de nota fiscal avulsa.
    </div>
    ${htmlSolicitacaoNfa(p, anexos)}
    <div style="text-align:center;padding:18px 0">
      <a href="${PORTAL_URL}/sucata/${p.id}/nfa?foco=emissao"
         style="background:#B0202E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
        Abrir o processo no sistema
      </a>
    </div>`;
    const texto = `[TESTE] Este e-mail não representa um pedido real de nota fiscal avulsa.\n\n${textoSolicitacaoNfa(p)}\n\nAbrir no sistema: ${PORTAL_URL}/sucata/${p.id}/nfa?foco=emissao`;

    const r = await notificar(supabaseAdmin, {
      processoId: p.id,
      tipo: "SOLICITACAO_NFA",
      destinatario: data.email,
      assunto,
      html,
      texto,
    });

    await registrarEventoServidor(supabaseAdmin, {
      processoId: p.id,
      acao: "nfa_teste_enviado",
      fase: "F12",
      coligada: p.coligada_origem,
      payload: { destinatario: data.email, envio: r.ok ? "ENVIADA" : "FALHA", erro: r.ok ? null : (r.erro ?? null) },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: r.ok, erro: r.ok ? undefined : r.erro };
  });
