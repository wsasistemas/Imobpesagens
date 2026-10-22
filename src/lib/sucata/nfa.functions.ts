import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { marcarFases } from "@/lib/sucata/registro-fases";
import { BUCKETS } from "@/integrations/db-schema";

const idProcesso = z.object({ processoId: z.string().uuid() });

export type ComprovanteLido = {
  ok: boolean;
  motivo?: string;
  hash: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  chave_pix: string | null;
  favorecido: string | null;
  valor: number | null;
  data: string | null;
  identificador: string | null;
  duplicado: { numero: string; id: string } | null;
};

export type CfopOpcao = { codigo: string; descricao: string; escopo: string };

export type FormularioNfa = Record<string, string>;

export type DadosNfa = {
  campos: { rotulo: string; valor: string }[];
  numero: string;
  aprovadoEm: string | null;
  nfaNumero: string | null;
  nfaEmissao: string | null;
  nfaEnviadaEm: string | null;
  nfaAnexada: boolean;
  /** Valor ajustado depois da emissão: a nota anterior deve ser cancelada e substituída. */
  substituicaoPendente: boolean;
  impedimento: string | null;
  pessoaFisica: boolean;
  avisoPf: string | null;
  emailSucateiro: string | null;
  valorTotal: number | null;
  pesoAferidoKg: number | null;
  /** Bloco do emitente (obra da construtora) no formulário da nota. */
  emitente: { nome: string; cnpj: string; endereco: string; uf: string };
  /** Bloco do destinatário (sucateiro do cadastro). */
  destinatario: {
    nome: string;
    documento: string;
    logradouro: string;
    bairro: string;
    cep: string;
    municipio: string;
    uf: string;
    telefone: string;
    inscricaoEstadual: string;
  };
  produto: { descricao: string; quantidadeKg: number | null; valorUnitario: number | null; valorTotal: number | null };
  transporte: { placa: string; pesoBrutoKg: number | null; pesoLiquidoKg: number | null };
  dataColeta: string | null;
  cfops: CfopOpcao[];
  cfopSugerido: string | null;
  /** "INTERNO" quando a UF do sucateiro é a mesma da obra; senão "INTERESTADUAL". */
  escopoSugerido: "INTERNO" | "INTERESTADUAL";
  naturezaSugerida: string;

  formulario: FormularioNfa;
};

/** Retorna o PDF definitivo já guardado, sem recriar a nota no navegador. */
export const urlNfaEmitida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idProcesso.parse(i))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select("nfa_storage_path")
      .eq("id", data.processoId)
      .single();
    if (error || !proc?.nfa_storage_path) throw new Error("A nota emitida não foi encontrada.");
    const { data: assinada, error: erroUrl } = await supabaseAdmin.storage
      .from(BUCKETS.sucataEvidencias)
      .createSignedUrl(proc.nfa_storage_path, 60 * 60);
    if (erroUrl || !assinada?.signedUrl) throw new Error("Não foi possível abrir o PDF definitivo.");
    return { url: assinada.signedUrl };
  });

type Papel = "admin" | "superadmin" | "coordenador" | "operador" | "contador" | "administrativo_obra";

type ClienteUsuario = {
  rpc: (fn: "has_role", args: { _user_id: string; _role: Papel }) => PromiseLike<{ data: boolean | null }>;
  from: (tabela: "sucata_processos") => {
    select: (cols: string) => {
      eq: (col: string, valor: string) => { single: () => PromiseLike<{ error: unknown }> };
    };
  };
};

/** Papéis: conferência = coordenador ou admin; NFA = admin ou superadmin. */
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

/** Confere se o usuário enxerga o processo (RLS decide). */
async function exigirAcesso(supabase: ClienteUsuario, processoId: string): Promise<void> {
  const { error } = await supabase.from("sucata_processos").select("id").eq("id", processoId).single();
  if (error) throw new Error("Processo não encontrado ou sem acesso.");

}

/** T8: leitura do comprovante de pagamento por IA, com checagem de duplicidade. */
export const lerComprovantePagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        arquivo: z.string().min(20),
        mimeType: z.string().optional(),
        filename: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<ComprovanteLido> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    const { hashArquivo } = await import("@/lib/sucata/nfa.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = hashArquivo(data.arquivo);

    const { data: outro } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, numero")
      .eq("pagamento_comprovante_hash", hash)
      .neq("id", data.processoId)
      .limit(1)
      .maybeSingle();
    const duplicado = outro ? { id: outro.id, numero: outro.numero } : null;

    const vazio: ComprovanteLido = {
      ok: false,
      hash,
      banco: null,
      agencia: null,
      conta: null,
      chave_pix: null,
      favorecido: null,
      valor: null,
      data: null,
      identificador: null,
      duplicado,
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ...vazio, motivo: "Leitura automática indisponível. Informe os dados manualmente." };

    const isPdf = (data.mimeType ?? "").includes("pdf") || data.arquivo.startsWith("data:application/pdf");
    const anexo = isPdf
      ? {
          type: "file" as const,
          file: {
            filename: data.filename?.trim() || "comprovante.pdf",
            file_data: data.arquivo.startsWith("data:") ? data.arquivo : `data:application/pdf;base64,${data.arquivo}`,
          },
        }
      : { type: "image_url" as const, image_url: { url: data.arquivo } };

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
                "Você extrai dados de comprovantes bancários brasileiros (TED, DOC, PIX, transferência interna). Formato numérico brasileiro: vírgula é decimal e ponto é milhar (ex.: '1.234,56' = 1234.56). Devolva a conta CREDITADA (favorecido/destino), nunca a conta pagadora. Datas em YYYY-MM-DD. Não invente dados: deixe vazio o que não estiver legível.",
            },
            {
              role: "user",
              content: [{ type: "text", text: "Extraia os dados deste comprovante de pagamento." }, anexo],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extrair_comprovante",
                description: "Dados do comprovante bancário",
                parameters: {
                  type: "object",
                  properties: {
                    banco: { type: "string", description: "Banco creditado (destino)" },
                    agencia: { type: "string", description: "Agência creditada, apenas números" },
                    conta: { type: "string", description: "Conta creditada, apenas números e dígito" },
                    chave_pix: { type: "string", description: "Chave PIX do favorecido, quando for PIX" },
                    favorecido: { type: "string", description: "Nome/razão social do favorecido" },
                    valor: { type: "number", description: "Valor pago em reais" },
                    data: { type: "string", description: "Data do pagamento em YYYY-MM-DD" },
                    identificador: { type: "string", description: "Identificador/autenticação da transação" },
                  },
                  required: [],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extrair_comprovante" } },
        }),
      });

      if (!resp.ok) {
        const motivo =
          resp.status === 429
            ? "Limite de leituras atingido. Tente novamente em alguns segundos."
            : resp.status === 402
              ? "Créditos de IA esgotados. Informe os dados manualmente."
              : `Não foi possível ler o comprovante (${resp.status}).`;
        return { ...vazio, motivo };
      }
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
      };
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { ...vazio, motivo: "A leitura não retornou dados." };
      const c = JSON.parse(args) as Partial<ComprovanteLido>;
      return {
        ok: true,
        hash,
        banco: c.banco?.toString().trim() || null,
        agencia: c.agencia?.toString().trim() || null,
        conta: c.conta?.toString().trim() || null,
        chave_pix: c.chave_pix?.toString().trim() || null,
        favorecido: c.favorecido?.toString().trim() || null,
        valor: typeof c.valor === "number" && Number.isFinite(c.valor) ? c.valor : null,
        data: c.data?.toString().slice(0, 10) || null,
        identificador: c.identificador?.toString().trim() || null,
        duplicado,
      };
    } catch {
      return { ...vazio, motivo: "Falha na leitura automática. Informe os dados manualmente." };
    }
  });

/** T8 legado: registra a conferência sem enviar nova solicitação de NFA. */
export const aprovarConferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        contaObraId: z.string().uuid().nullable(),
        contaLida: z.string().max(200).nullable(),
        pagamentoValor: z.number().positive(),
        pagamentoData: z.string().min(10).max(10),
        comprovanteHash: z.string().max(200).nullable(),
        reciboValorLido: z.number().positive().nullable(),
        contaDivergente: z.boolean(),
        justificativa: z.string().max(1000).nullable(),
        observacao: z.string().max(1000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; emailOk: boolean; destinatarios: string[]; erro?: string }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["administrativo_obra", "admin", "superadmin"],
      "Só o Administrativo de Obra, Administrador ou TI pode aprovar a conferência.",
    );
    if (data.contaDivergente && !(data.justificativa ?? "").trim()) {
      throw new Error("Conta creditada fora do cadastro da obra exige justificativa.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");
    const { PROCESSO_NFA_SELECT } = await import("@/lib/sucata/nfa.server");
    type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

    if (data.comprovanteHash) {
      const { data: outro } = await supabaseAdmin
        .from("sucata_processos")
        .select("numero")
        .eq("pagamento_comprovante_hash", data.comprovanteHash)
        .neq("id", data.processoId)
        .limit(1)
        .maybeSingle();
      if (outro) throw new Error(`Este comprovante já foi usado no processo ${outro.numero}.`);
    }

    const agora = new Date().toISOString();
    const { data: atualizado, error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        conta_obra_id: data.contaObraId,
        pagamento_conta_lida: data.contaLida,
        pagamento_valor: data.pagamentoValor,
        pagamento_data: data.pagamentoData,
        pagamento_conta_divergente: data.contaDivergente,
        pagamento_justificativa: data.justificativa,
        pagamento_comprovante_hash: data.comprovanteHash,
        recibo_valor_lido: data.reciboValorLido,
        aprovado_em: agora,
        aprovado_por: context.userId,
        aprovacao_observacao: data.observacao,
        devolvido_em: null,
        devolucao_motivo: null,
        nfa_impedimento_motivo: null,
        fase: "F11",
      })
      .eq("id", data.processoId)
      .select(PROCESSO_NFA_SELECT)
      .single();
    if (upErro) throw new Error(upErro.message);
    const p = atualizado as never as P;

    await registrarEventoServidor(supabaseAdmin, {
      processoId: p.id,
      acao: "fechamento_aprovado",
      fase: "F11",
      coligada: p.coligada_origem,
      payload: {
        pagamento_valor: data.pagamentoValor,
        pagamento_data: data.pagamentoData,
        conta_divergente: data.contaDivergente,
        justificativa: data.justificativa,
        recibo_valor_lido: data.reciboValorLido,
        valor_total: p.valor_total,
      },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: true, emailOk: true, destinatarios: [] };
  });

/** T8: devolve o processo ao responsável da pendência, com motivo obrigatório. */
export const devolverProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        motivo: z.string().min(5).max(1000),
        faseOrigem: z.enum(["F06", "F07", "F08", "F09", "F10"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["coordenador", "admin", "superadmin"],
      "Só o administrativo da obra (coordenador ou administrador) pode devolver o processo.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        devolvido_em: new Date().toISOString(),
        devolvido_por: context.userId,
        devolucao_motivo: data.motivo,
        devolucao_fase_origem: data.faseOrigem,
        aprovado_em: null,
        aprovado_por: null,
        fase: data.faseOrigem,
      })
      .eq("id", data.processoId)
      .select("id, coligada_origem, numero")
      .single();
    if (error) throw new Error(error.message);

    await registrarEventoServidor(supabaseAdmin, {
      processoId: proc.id,
      acao: "processo_devolvido",
      fase: data.faseOrigem,
      coligada: proc.coligada_origem,
      payload: { motivo: data.motivo, fase_origem: data.faseOrigem },
      usuarioEmail: context.claims?.email ?? null,
    });
    return { ok: true };
  });

/** T9: dados da NFA em somente leitura, com o aviso fiscal de pessoa física. */
export const dadosNfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idProcesso.parse(i))
  .handler(async ({ data, context }): Promise<DadosNfa> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parametros } = await import("@/lib/sucata/notificacoes.server");
    const {
      PROCESSO_NFA_SELECT,
      camposNfa,
      nomeDestinatario,
      documentoDestinatario,
      ufDaObra,
      escopoCfop,
    } = await import("@/lib/sucata/nfa.server");
    type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select(PROCESSO_NFA_SELECT)
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    const p = proc as never as P;
    const params = await parametros(supabaseAdmin);
    const pf = p.sucateiro?.tipo_pessoa === "PF";

    const { data: cfopRows } = await supabaseAdmin
      .from("sucata_cfop")
      .select("codigo, descricao, escopo")
      .eq("ativo", true)
      .order("ordem");
    const cfops: CfopOpcao[] = cfopRows ?? [];

    const ufObra = ufDaObra(p.obra?.endereco);
    const escopo = escopoCfop(ufObra, p.sucateiro?.uf);
    const preferido = escopo === "INTERNO" ? "5.102" : "6.102";
    const sugerido =
      cfops.find((c) => c.codigo === preferido) ?? cfops.find((c) => c.escopo === escopo) ?? null;

    const compl = p.sucateiro?.complemento?.trim() ? `, ${p.sucateiro.complemento.trim()}` : "";
    const liquido =
      p.peso_aferido_kg ?? (p.bruto_kg !== null ? Number(p.bruto_kg) - Number(p.tara_kg) : null);

    return {
      campos: camposNfa(p),
      numero: p.numero,
      aprovadoEm: p.aprovado_em,
      nfaNumero: p.nfa_numero,
      nfaEmissao: p.nfa_emissao,
      nfaEnviadaEm: p.nfa_enviada_em,
      nfaAnexada: !!p.nfa_storage_path,
      substituicaoPendente: (() => {
        const emitidaEm = p.nfa_exportada_em ?? p.nfa_enviada_em;
        return (
          !!p.valor_ajustado_em &&
          !!emitidaEm &&
          new Date(p.valor_ajustado_em).getTime() > new Date(emitidaEm).getTime()
        );
      })(),
      impedimento: p.nfa_impedimento_motivo,
      pessoaFisica: pf,
      avisoPf: pf ? (params["aviso_fiscal_pf"] ?? null) : null,
      emailSucateiro: p.sucateiro?.email_financeiro ?? p.sucateiro?.email_coleta ?? null,
      valorTotal: p.valor_total,
      pesoAferidoKg: p.peso_aferido_kg,
      emitente: {
        nome: p.obra?.nome ?? "—",
        cnpj: p.obra?.cnpj ?? "",
        endereco: p.obra?.endereco ?? "",
        uf: ufObra,
      },
      destinatario: {
        nome: nomeDestinatario(p.sucateiro),
        documento: documentoDestinatario(p.sucateiro),
        logradouro: p.sucateiro ? `${p.sucateiro.logradouro}, ${p.sucateiro.numero}${compl}` : "",
        bairro: p.sucateiro?.bairro ?? "",
        cep: p.sucateiro?.cep ?? "",
        municipio: p.sucateiro?.municipio ?? "",
        uf: p.sucateiro?.uf ?? "",
        telefone: p.sucateiro?.telefone ?? "",
        inscricaoEstadual: p.sucateiro?.inscricao_estadual ?? "",
      },
      produto: {
        descricao: p.tipo?.nome ?? "Sucata ferrosa",
        quantidadeKg: p.peso_aferido_kg,
        valorUnitario: p.valor_unitario_kg,
        valorTotal: p.valor_total,
      },
      transporte: { placa: p.placa, pesoBrutoKg: p.bruto_kg, pesoLiquidoKg: liquido },
      dataColeta: p.saida_em ?? p.entrada_em,
      cfops,
      cfopSugerido: p.nfa_cfop ?? sugerido?.codigo ?? null,
      escopoSugerido: escopo,

      naturezaSugerida: p.nfa_natureza_operacao ?? sugerido?.descricao ?? "Venda de sucata",
      formulario: normalizarFormulario(p.nfa_formulario),
    };
  });

function normalizarFormulario(bruto: unknown): FormularioNfa {
  if (!bruto || typeof bruto !== "object") return {};
  const saida: FormularioNfa = {};
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof v === "string") saida[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") saida[k] = String(v);
  }
  return saida;
}

/** Fase 3: salva o rascunho do formulário da NFA, o CFOP e a natureza da operação. */
export const salvarFormularioNfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        cfop: z.string().max(20).nullable().optional(),
        natureza: z.string().max(200).nullable().optional(),
        formulario: z.record(z.string(), z.string().max(2000)).default({}),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["contador", "admin", "superadmin"],
      "Só a Contabilidade pode preencher o formulário da Nota Fiscal Avulsa.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, coligada_origem")
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");

    const { error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        nfa_cfop: data.cfop ?? null,
        nfa_natureza_operacao: data.natureza ?? null,
        nfa_formulario: data.formulario as never,
      })
      .eq("id", data.processoId);
    if (upErro) throw new Error(upErro.message);

    await registrarEventoServidor(supabaseAdmin, {
      processoId: data.processoId,
      acao: "nfa_formulario_salvo",
      fase: "F13",
      coligada: proc.coligada_origem,
      payload: {
        cfop: data.cfop ?? null,
        natureza: data.natureza ?? null,
        certificado: data.formulario["certificado"] ?? null,
      },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: true };
  });

/** T9: anexa a nota como evidência 012 e avança para F13. */
export const anexarNfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        numero: z.string().min(1).max(60),
        emissao: z.string().min(10).max(10),
        storagePath: z.string().min(5).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{
    ok: true;
    envioOk: boolean;
    destinatario: string | null;
    pendencia?: string;
    avisos: string[];
  }> => {

    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["contador", "admin", "superadmin"],
      "Só a Contabilidade pode anexar a Nota Fiscal Avulsa.",
    );


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error: erroProc } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, numero, coligada_origem, nfa_solicitada_em, fases_registro")
      .eq("id", data.processoId)
      .single();
    if (erroProc || !proc) throw new Error("Processo não encontrado.");
    if (!proc.nfa_solicitada_em) {
      throw new Error("O pedido da nota ainda não foi enviado à Contabilidade.");
    }

    const { data: anterior } = await supabaseAdmin
      .from("sucata_evidencias")
      .select("id, versao")
      .eq("processo_id", data.processoId)
      .eq("posicao", 12)
      .is("substituida_por", null)
      .maybeSingle();

    const { data: nova, error: erroEv } = await supabaseAdmin
      .from("sucata_evidencias")
      .insert({
        processo_id: data.processoId,
        posicao: 12,
        rotulo: "Nota Fiscal Avulsa",
        storage_path: data.storagePath,
        capturado_em: new Date().toISOString(),
        capturado_por: context.userId,
        versao: (anterior?.versao ?? 0) + 1,
        motivo_substituicao: anterior ? "Nova via da Nota Fiscal Avulsa" : null,
      })
      .select("id")
      .single();
    if (erroEv) throw new Error(erroEv.message);
    if (anterior) {
      await supabaseAdmin
        .from("sucata_evidencias")
        .update({ substituida_por: nova.id })
        .eq("id", anterior.id);
    }

    const { error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        nfa_numero: data.numero,
        nfa_emissao: data.emissao,
        nfa_storage_path: data.storagePath,
        nfa_impedimento_motivo: null,
        fase: "F13",
      })
      .eq("id", data.processoId);
    if (upErro) throw new Error(upErro.message);

    await registrarEventoServidor(supabaseAdmin, {
      processoId: data.processoId,
      acao: "nfa_anexada",
      fase: "F13",
      coligada: proc.coligada_origem,
      payload: { nfa_numero: data.numero, nfa_emissao: data.emissao, storage_path: data.storagePath },
      usuarioEmail: context.claims?.email ?? null,
    });

    // Envia a nota ao sucateiro. Com o envio (ou a exportação em PDF), a fase 3
    // fecha e a fase 4 — recibo do sucateiro — é aberta para o administrativo.
    const { notificar } = await import("@/lib/sucata/notificacoes.server");
    const { PROCESSO_NFA_SELECT, assuntoEnvioNfa, htmlEnvioNfa } = await import("@/lib/sucata/nfa.server");
    type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

    const { data: completo } = await supabaseAdmin
      .from("sucata_processos")
      .select(PROCESSO_NFA_SELECT)
      .eq("id", data.processoId)
      .single();
    const p = completo as never as P | null;
    const destinatario = p?.sucateiro?.email_financeiro ?? p?.sucateiro?.email_coleta ?? null;

    let envioOk = false;
    let pendencia: string | undefined;
    if (p && destinatario) {
      const { data: assinada } = await supabaseAdmin.storage
        .from(BUCKETS.sucataEvidencias)
        .createSignedUrl(data.storagePath, 7 * 24 * 60 * 60);
      if (assinada?.signedUrl) {
        const r = await notificar(supabaseAdmin, {
          processoId: p.id,
          tipo: "ENVIO_NFA",
          destinatario,
          assunto: assuntoEnvioNfa(p),
          html: htmlEnvioNfa(p, assinada.signedUrl),
          texto: `Nota Fiscal Avulsa ${data.numero} da coleta ${p.numero}: ${assinada.signedUrl}`,
        });
        envioOk = r.ok;
        if (!r.ok) pendencia = r.erro;
      } else {
        pendencia = "Não foi possível gerar o link da nota para o e-mail.";
      }
    } else {
      pendencia = "O sucateiro não tem e-mail cadastrado; a nota ficou anexada no processo.";
    }

    const avisos: string[] = [];
    if (envioOk) {
      const agora = new Date().toISOString();
      await supabaseAdmin
        .from("sucata_processos")
        .update({
          nfa_enviada_em: agora,
          fase: "F14",
          fases_registro: marcarFases(proc.fases_registro, [
            { numero: 3, marca: { fechada_em: agora, fechada_nome: context.claims?.email ?? null } },
            { numero: 4, marca: { aberta_em: agora } },
          ]) as never,
        })
        .eq("id", data.processoId);
      await registrarEventoServidor(supabaseAdmin, {
        processoId: data.processoId,
        acao: "nfa_enviada",
        fase: "F14",
        coligada: proc.coligada_origem,
        payload: { destinatario, envio: "ENVIADA" },
        usuarioEmail: context.claims?.email ?? null,
      });
      avisos.push(
        ...(await avisarEmissao(supabaseAdmin, data.processoId, "email", context.claims?.email ?? null)).erros,
      );
    }

    return { ok: true, envioOk, destinatario, pendencia, avisos };
  });

/** Avisa engenheiro e administrativo da obra que a nota foi emitida; nunca derruba o fluxo. */
async function avisarEmissao(
  admin: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
  processoId: string,
  meio: "email" | "pdf" | "preview",
  usuarioEmail: string | null,
  anexo?: { filename: string; contentBase64: string },
): Promise<{ erros: string[]; emails: string[] }> {
  const { avisarNotaEmitida } = await import("@/lib/sucata/avisos.server");
  const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");
  const { data: p } = await admin
    .from("sucata_processos")
    .select(
      "id, numero, obra_id, coligada_origem, placa, peso_aferido_kg, valor_total, valor_unitario_kg, nfa_numero, nfa_emissao",
    )
    .eq("id", processoId)
    .single();
  if (!p) return { erros: ["Não foi possível avisar a obra: processo não encontrado."], emails: [] };
  try {
    const r = await avisarNotaEmitida(admin, p, meio, anexo);
    await registrarEventoServidor(admin, {
      processoId,
      acao: "nota_emitida_avisada",
      fase: "F14",
      coligada: p.coligada_origem,
      payload: { meio, emails: r.emails, whatsapp: r.whatsapp, erros: r.erros },
      usuarioEmail,
    });
    return { erros: r.erros, emails: r.emails };
  } catch (e) {
    return {
      erros: [`Aviso da emissão não saiu: ${e instanceof Error ? e.message : "erro desconhecido"}`],
      emails: [],
    };
  }
}

/** Fase 3, saída alternativa: a Contabilidade exporta a nota em PDF em vez de enviar por e-mail. */
export const exportarNfaPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idProcesso.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; url: string | null; avisos: string[] }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["contador", "admin", "superadmin"],
      "Só a Contabilidade pode exportar a nota fiscal avulsa.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select("id, coligada_origem, nfa_numero, nfa_storage_path, nfa_exportada_em, fases_registro")
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    if (!proc.nfa_numero || !proc.nfa_storage_path) {
      throw new Error("Anexe a nota fiscal avulsa antes de exportar.");
    }

    const { data: assinada } = await supabaseAdmin.storage
      .from(BUCKETS.sucataEvidencias)
      .createSignedUrl(proc.nfa_storage_path, 60 * 60);

    const agora = new Date().toISOString();
    await supabaseAdmin
      .from("sucata_processos")
      .update({
        nfa_exportada_em: agora,
        fases_registro: marcarFases(proc.fases_registro, [
          { numero: 3, marca: { fechada_em: agora, fechada_nome: context.claims?.email ?? null } },
          { numero: 4, marca: { aberta_em: agora } },
        ]) as never,
      })
      .eq("id", data.processoId);

    await registrarEventoServidor(supabaseAdmin, {
      processoId: data.processoId,
      acao: "nfa_exportada",
      fase: "F14",
      coligada: proc.coligada_origem,
      payload: { nfa_numero: proc.nfa_numero, reexportacao: !!proc.nfa_exportada_em },
      usuarioEmail: context.claims?.email ?? null,
    });

    const avisos = (await avisarEmissao(supabaseAdmin, data.processoId, "pdf", context.claims?.email ?? null)).erros;
    return { ok: true, url: assinada?.signedUrl ?? null, avisos };
  });

/**
 * Fase 3: a Contabilidade confirma a pré-visualização da nota no modelo oficial.
 * Guarda o PDF como documento 012 (nova versão quando já houver), grava número e
 * data da nota, envia o PDF por e-mail ao administrativo e ao engenheiro da obra,
 * fecha a fase 3 e abre a fase 4.
 */
export const confirmarPreviewNfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        processoId: z.string().uuid(),
        numero: z.string().min(1).max(30),
        emissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de emissão inválida."),
        pdfBase64: z.string().min(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; emails: string[]; avisos: string[]; storagePath: string }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["contador", "admin", "superadmin"],
      "Só a Contabilidade pode emitir a Nota Fiscal Avulsa.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");

    const { data: proc, error: erroProc } = await supabaseAdmin
      .from("sucata_processos")
      .select(
        "id, numero, coligada_origem, aprovado_em, nfa_solicitada_em, nfa_numero, nfa_storage_path, fases_registro, nfa_enviada_em, nfa_exportada_em, valor_ajustado_em",
      )
      .eq("id", data.processoId)
      .single();
    if (erroProc || !proc) throw new Error("Processo não encontrado.");
    if (!proc.aprovado_em) throw new Error("O processo ainda não foi aprovado pelo administrativo da obra.");
    // Emissão irreversível, exceto quando o administrador ajustou o valor depois da emissão:
    // nesse caso a nota anterior é cancelada e uma nova nota substitui a primeira.
    const emitidaEm = proc.nfa_exportada_em ?? proc.nfa_enviada_em;
    const substituicaoPendente =
      !!proc.valor_ajustado_em &&
      !!emitidaEm &&
      new Date(proc.valor_ajustado_em).getTime() > new Date(emitidaEm).getTime();
    if ((proc.nfa_storage_path || proc.nfa_numero) && !substituicaoPendente) {
      throw new Error(
        "Nota já emitida para esta venda. Uma nova nota só é possível após o cancelamento e a reabertura da emissão pelo TI.",
      );
    }

    const base64 = data.pdfBase64.includes(",") ? data.pdfBase64.split(",")[1]! : data.pdfBase64;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 15_000_000) throw new Error("PDF acima do tamanho permitido (15 MB).");

    const storagePath = `${data.processoId}/012-nfa-preview-${Date.now()}.pdf`;
    const up = await supabaseAdmin.storage
      .from(BUCKETS.sucataEvidencias)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(`Falha ao guardar a nota: ${up.error.message}`);

    const { data: anterior } = await supabaseAdmin
      .from("sucata_evidencias")
      .select("id, versao")
      .eq("processo_id", data.processoId)
      .eq("posicao", 12)
      .is("substituida_por", null)
      .maybeSingle();

    const { data: nova, error: erroEv } = await supabaseAdmin
      .from("sucata_evidencias")
      .insert({
        processo_id: data.processoId,
        posicao: 12,
        rotulo: "Nota Fiscal Avulsa",
        storage_path: storagePath,
        capturado_em: new Date().toISOString(),
        capturado_por: context.userId,
        versao: (anterior?.versao ?? 0) + 1,
        motivo_substituicao: anterior ? "Nova via da Nota Fiscal Avulsa emitida no sistema" : null,
      })
      .select("id")
      .single();
    if (erroEv) throw new Error(erroEv.message);
    if (anterior) {
      await supabaseAdmin.from("sucata_evidencias").update({ substituida_por: nova.id }).eq("id", anterior.id);
    }

    const agora = new Date().toISOString();
    const { error: upErro } = await supabaseAdmin
      .from("sucata_processos")
      .update({
        nfa_numero: data.numero,
        nfa_emissao: data.emissao,
        nfa_storage_path: storagePath,
        nfa_impedimento_motivo: null,
        nfa_exportada_em: agora,
        fase: "F14",
        fases_registro: marcarFases(proc.fases_registro, [
          { numero: 3, marca: { fechada_em: agora, fechada_nome: context.claims?.email ?? null } },
          { numero: 4, marca: { aberta_em: agora } },
        ]) as never,
      })
      .eq("id", data.processoId);
    if (upErro) throw new Error(upErro.message);

    const aviso = await avisarEmissao(supabaseAdmin, data.processoId, "preview", context.claims?.email ?? null, {
      filename: `NFA-${data.numero.replace(/\W+/g, "-")}-${proc.numero.replace(/\W+/g, "-")}.pdf`,
      contentBase64: base64,
    });

    // O evento é gravado depois do aviso para guardar a lista de destinatários no log da emissão.
    await registrarEventoServidor(supabaseAdmin, {
      processoId: data.processoId,
      acao: "nfa_preview_confirmada",
      fase: "F14",
      coligada: proc.coligada_origem,
      payload: {
        nfa_numero: data.numero,
        nfa_emissao: data.emissao,
        storage_path: storagePath,
        emails: aviso.emails,
        avisos: aviso.erros,
      },
      usuarioEmail: context.claims?.email ?? null,
    });

    return { ok: true, emails: aviso.emails, avisos: aviso.erros, storagePath };
  });



/** T9: impedimento de emissão — devolve para F11 e avisa a obra. */
export const registrarImpedimentoNfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ processoId: z.string().uuid(), motivo: z.string().min(5).max(1000) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; emailOk: boolean; destinatario: string | null }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["contador", "admin", "superadmin"],
      "Só a Contabilidade pode registrar impedimento.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notificar, registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");
    const { PROCESSO_NFA_SELECT, assuntoImpedimento, htmlImpedimento } = await import("@/lib/sucata/nfa.server");
    type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .update({ nfa_impedimento_motivo: data.motivo, fase: "F11" })
      .eq("id", data.processoId)
      .select(PROCESSO_NFA_SELECT)
      .single();
    if (error || !proc) throw new Error(error?.message ?? "Processo não encontrado.");
    const p = proc as never as P;

    const destinatario = p.obra?.engenheiro_email ?? null;
    let emailOk = false;
    if (destinatario) {
      const r = await notificar(supabaseAdmin, {
        processoId: p.id,
        tipo: "CONTESTACAO_ADMIN",
        destinatario,
        assunto: assuntoImpedimento(p),
        html: htmlImpedimento(p, data.motivo),
        texto: `Impedimento na NFA do processo ${p.numero}. Motivo: ${data.motivo}`,
      });
      emailOk = r.ok;
    }

    await registrarEventoServidor(supabaseAdmin, {
      processoId: p.id,
      acao: "nfa_impedimento",
      fase: "F11",
      coligada: p.coligada_origem,
      payload: { motivo: data.motivo, destinatario, envio: emailOk ? "ENVIADA" : "FALHA" },
      usuarioEmail: context.claims?.email ?? null,
    });
    return { ok: true, emailOk, destinatario };
  });

/** T9 (opcional): envia a nota ao sucateiro. Não bloqueia o processo. */
export const enviarNfaSucateiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idProcesso.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: boolean; destinatario: string | null; erro?: string }> => {
    await exigirAcesso(context.supabase as unknown as ClienteUsuario, data.processoId);
    await exigirPapel(
      context.supabase as unknown as ClienteUsuario,
      context.userId,
      ["contador", "admin", "superadmin"],
      "Só a Contabilidade pode enviar a nota ao sucateiro.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notificar, registrarEventoServidor } = await import("@/lib/sucata/notificacoes.server");
    const { PROCESSO_NFA_SELECT, assuntoEnvioNfa, htmlEnvioNfa } = await import("@/lib/sucata/nfa.server");
    type P = import("@/lib/sucata/nfa.server").ProcessoNfa;

    const { data: proc, error } = await supabaseAdmin
      .from("sucata_processos")
      .select(PROCESSO_NFA_SELECT)
      .eq("id", data.processoId)
      .single();
    if (error || !proc) throw new Error("Processo não encontrado.");
    const p = proc as never as P;
    if (!p.nfa_storage_path) throw new Error("Anexe a Nota Fiscal Avulsa antes de enviá-la.");
    const destinatario = p.sucateiro?.email_financeiro ?? p.sucateiro?.email_coleta ?? null;
    if (!destinatario) throw new Error("O sucateiro não tem e-mail cadastrado.");

    const { data: assinada } = await supabaseAdmin.storage
      .from(BUCKETS.sucataEvidencias)
      .createSignedUrl(p.nfa_storage_path, 7 * 24 * 60 * 60);
    if (!assinada?.signedUrl) throw new Error("Não foi possível gerar o link da nota.");

    const r = await notificar(supabaseAdmin, {
      processoId: p.id,
      tipo: "ENVIO_NFA",
      destinatario,
      assunto: assuntoEnvioNfa(p),
      html: htmlEnvioNfa(p, assinada.signedUrl),
      texto: `Nota Fiscal Avulsa ${p.nfa_numero ?? ""} da coleta ${p.numero}: ${assinada.signedUrl}`,
    });

    if (r.ok) {
      await supabaseAdmin
        .from("sucata_processos")
        .update({ nfa_enviada_em: new Date().toISOString(), fase: "F14" })
        .eq("id", p.id);
    }

    await registrarEventoServidor(supabaseAdmin, {
      processoId: p.id,
      acao: "nfa_enviada",
      fase: "F14",
      coligada: p.coligada_origem,
      payload: { destinatario, envio: r.ok ? "ENVIADA" : "FALHA", erro: r.erro ?? null },
      usuarioEmail: context.claims?.email ?? null,
    });
    return { ok: r.ok, destinatario, erro: r.erro };
  });
