import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ContaObraInsert,
  ContaObraRow,
  DocumentoRow,
  ProcessoRow,
  SucateiroInsert,
  SucateiroRow,
  TipoSucataRow,
  VeiculoInsert,
  VeiculoRow,
} from "./tipos";
import { marcarFases } from "./registro-fases";
import { normalizarPlaca } from "./validadores";

const SUCATEIRO_COLS =
  "id, tipo_pessoa, razao_social, nome_fantasia, nome_completo, cnpj, cpf, rg, orgao_emissor, data_nascimento, inscricao_estadual, inscricao_municipal, cnae, cep, logradouro, numero, complemento, bairro, municipio, uf, email_coleta, email_financeiro, telefone, contato_responsavel, banco, agencia, conta, tipo_conta, titularidade, chave_pix, situacao, observacoes, coligada_origem, valor_por_kg, created_at, updated_at";

const VEICULO_COLS =
  "id, sucateiro_id, placa, tipo_veiculo, capacidade_kg, motorista_habitual, situacao, created_at";

const PROCESSO_COLS =
  "id, numero, ano, obra_id, coligada_origem, sucateiro_id, veiculo_id, placa, motorista, documento_motorista, tara_kg, bruto_kg, peso_aferido_kg, tipo_sucata_id, fase, situacao, entrada_em, saida_em, created_at, peso_deposito_kg, notificado_em, aceite_em, aceite_token_expira_em, contestacao_em, contestacao_motivo, valor_total, valor_por_tonelada, valor_unitario_kg, valor_ajustado_em, valor_ajuste_justificativa, recibo_modo, aprovado_em, aprovacao_observacao, devolvido_em, devolucao_motivo, devolucao_fase_origem, conta_obra_id, pagamento_valor, pagamento_data, pagamento_conta_divergente, pagamento_justificativa, pagamento_conta_lida, recibo_valor_lido, nfa_numero, nfa_emissao, nfa_storage_path, nfa_enviada_em, nfa_exportada_em, nfa_impedimento_motivo, nfa_solicitada_em, descricao_carga, concluido_em, fases_registro, teste_manual, excluido_em, excluido_por, exclusao_motivo";

export const CONTA_OBRA_COLS =
  "id, obra_id, coligada_origem, banco, agencia, conta, tipo_conta, titular, titular_documento, chave_pix, situacao, observacoes, created_at, updated_at";


export const sucateirosQueryOptions = () =>
  queryOptions({
    queryKey: ["sucata", "sucateiros"],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<SucateiroRow[]> => {
      const { data, error } = await supabase
        .from("sucata_sucateiros")
        .select(SUCATEIRO_COLS)
        .order("created_at", { ascending: false })
        .range(0, 499);
      if (error) throw error;
      return (data ?? []) as SucateiroRow[];
    },
  });

export const veiculosQueryOptions = (sucateiroId?: string | null) =>
  queryOptions({
    queryKey: ["sucata", "veiculos", sucateiroId ?? "todos"],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<VeiculoRow[]> => {
      let q = supabase.from("sucata_veiculos").select(VEICULO_COLS).order("placa");
      if (sucateiroId) q = q.eq("sucateiro_id", sucateiroId);
      const { data, error } = await q.range(0, 499);
      if (error) throw error;
      return (data ?? []) as VeiculoRow[];
    },
  });

export const tiposSucataQueryOptions = () =>
  queryOptions({
    queryKey: ["sucata", "tipos"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<TipoSucataRow[]> => {
      const { data, error } = await supabase
        .from("sucata_tipos")
        .select("id, codigo, nome, ordem, ativo, valor_ton_min, valor_ton_max, created_at, updated_at")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as TipoSucataRow[];
    },
  });

export const processosQueryOptions = (obraId: string | null, pagina = 0, porPagina = 25) =>
  queryOptions({
    queryKey: ["sucata", "processos", obraId ?? "todas", pagina, porPagina],
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<{ linhas: ProcessoRow[]; total: number }> => {
      let q = supabase
        .from("sucata_processos")
        .select(PROCESSO_COLS, { count: "exact" })
        .is("excluido_em", null)
        .order("created_at", { ascending: false });
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error, count } = await q.range(pagina * porPagina, pagina * porPagina + porPagina - 1);
      if (error) throw error;
      return { linhas: (data ?? []) as ProcessoRow[], total: count ?? 0 };
    },
  });

export const documentosQueryOptions = (sucateiroId: string | null) =>
  queryOptions({
    queryKey: ["sucata", "documentos", sucateiroId],
    enabled: !!sucateiroId,
    staleTime: 60_000,
    queryFn: async (): Promise<DocumentoRow[]> => {
      const { data, error } = await supabase
        .from("sucata_sucateiro_documentos")
        .select("id, sucateiro_id, tipo, storage_path, nome_arquivo, validade, versao, motivo_substituicao, vigente, created_at")
        .eq("sucateiro_id", sucateiroId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentoRow[];
    },
  });

/**
 * Processo de sucata aguardando SAÍDA para uma placa (reconhecimento da saída e
 * trava de entrada duplicada). Após a pesagem de saída o processo continua
 * PENDENTE nas fases administrativas, mas a placa já pode iniciar nova coleta.
 */
export async function buscarProcessoPendentePorPlaca(placa: string, obraId: string | null) {
  const alvo = normalizarPlaca(placa);
  if (alvo.length < 3) return null;
  let q = supabase
    .from("sucata_processos")
    .select(PROCESSO_COLS)
    .eq("situacao", "PENDENTE")
    .is("saida_em", null)
    .is("bruto_kg", null)
    .is("excluido_em", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (obraId) q = q.eq("obra_id", obraId);
  const { data, error } = await q;
  if (error) throw error;
  const achou = (data ?? []).find((p) => normalizarPlaca(p.placa) === alvo);
  return (achou ?? null) as ProcessoRow | null;
}

/** Sucateiros ATIVOS, para o campo de busca da entrada. */
export const sucateirosAtivosQueryOptions = () =>
  queryOptions({
    queryKey: ["sucata", "sucateiros", "ativos"],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<SucateiroRow[]> => {
      const { data, error } = await supabase
        .from("sucata_sucateiros")
        .select(SUCATEIRO_COLS)
        .eq("situacao", "ATIVO")
        .order("razao_social")
        .range(0, 499);
      if (error) throw error;
      return (data ?? []) as SucateiroRow[];
    },
  });

/** Veículos ATIVOS de um sucateiro. */
export const veiculosAtivosQueryOptions = (sucateiroId: string | null) =>
  queryOptions({
    queryKey: ["sucata", "veiculos", "ativos", sucateiroId ?? "nenhum"],
    enabled: !!sucateiroId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<VeiculoRow[]> => {
      const { data, error } = await supabase
        .from("sucata_veiculos")
        .select(VEICULO_COLS)
        .eq("sucateiro_id", sucateiroId!)
        .eq("situacao", "ATIVO")
        .order("placa")
        .range(0, 199);
      if (error) throw error;
      return (data ?? []) as VeiculoRow[];
    },
  });

/** Dono atual de uma placa ativa (para recusar placa de outro sucateiro). */
export async function buscarDonoDaPlaca(placa: string) {
  const alvo = normalizarPlaca(placa);
  if (alvo.length < 7) return null;
  const { data, error } = await supabase
    .from("sucata_veiculos")
    .select(`${VEICULO_COLS}, sucateiro:sucata_sucateiros(id, tipo_pessoa, razao_social, nome_completo, situacao)`)
    .eq("situacao", "ATIVO")
    .limit(500);
  if (error) throw error;
  return (data ?? []).find((v) => normalizarPlaca(v.placa) === alvo) ?? null;
}

/** Completa tipo/modelo, capacidade e motorista habitual no cadastro do veículo. */
export async function atualizarDadosVeiculo(
  id: string,
  dados: { tipo_veiculo?: string | null; capacidade_kg?: number | null; motorista_habitual?: string | null },
) {
  const { error } = await supabase.from("sucata_veiculos").update(dados).eq("id", id);
  if (error) throw error;
  await registrarEvento({
    entidade: "veiculo",
    entidadeId: id,
    acao: "dados_complementados",
    payload: dados as Record<string, unknown>,
  });
}

/** Veículo ativo pela placa, com o sucateiro correspondente. */
export async function buscarVeiculoAtivoPorPlaca(placa: string) {
  const alvo = normalizarPlaca(placa);
  if (alvo.length < 3) return null;
  const { data, error } = await supabase
    .from("sucata_veiculos")
    .select(`${VEICULO_COLS}, sucateiro:sucata_sucateiros(id, tipo_pessoa, razao_social, nome_completo, cnpj, cpf, inscricao_estadual, situacao, coligada_origem, email_coleta, telefone, municipio, uf)`)
    .eq("situacao", "ATIVO")
    .limit(500);
  if (error) throw error;
  const achou = (data ?? []).find((v) => normalizarPlaca(v.placa) === alvo);
  return achou ?? null;
}

/** Auditoria: toda ação do módulo grava um evento. */
export async function registrarEvento(input: {
  entidade: string;
  acao: string;
  entidadeId?: string | null;
  processoId?: string | null;
  fase?: string | null;
  coligada?: string | null;
  payload?: Record<string, unknown>;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const u = auth.user;
  const { error } = await supabase.from("sucata_eventos").insert({
    entidade: input.entidade,
    entidade_id: input.entidadeId ?? null,
    processo_id: input.processoId ?? null,
    fase: input.fase ?? null,
    acao: input.acao,
    coligada_origem: input.coligada ?? null,
    payload: (input.payload ?? {}) as never,
    usuario_id: u?.id ?? null,
    usuario_nome:
      (u?.user_metadata as { display_name?: string; full_name?: string } | undefined)?.display_name ??
      (u?.user_metadata as { full_name?: string } | undefined)?.full_name ??
      null,
    usuario_email: u?.email ?? null,
  });
  if (error) throw error;
}

export async function salvarSucateiro(dados: SucateiroInsert, id?: string | null) {
  if (id) {
    const { data, error } = await supabase
      .from("sucata_sucateiros")
      .update(dados)
      .eq("id", id)
      .select("id, coligada_origem")
      .single();
    if (error) throw error;
    await registrarEvento({
      entidade: "sucateiro",
      entidadeId: data.id,
      acao: "atualizado",
      coligada: data.coligada_origem,
      payload: { campos: Object.keys(dados) },
    });
    return data.id;
  }
  const { data, error } = await supabase
    .from("sucata_sucateiros")
    .insert(dados)
    .select("id, coligada_origem")
    .single();
  if (error) throw error;
  await registrarEvento({
    entidade: "sucateiro",
    entidadeId: data.id,
    acao: "criado",
    coligada: data.coligada_origem,
    payload: { tipo_pessoa: dados.tipo_pessoa },
  });
  return data.id;
}

export async function salvarVeiculo(dados: VeiculoInsert, id?: string | null) {
  const payload = { ...dados, placa: normalizarPlaca(String(dados.placa ?? "")) };
  if (id) {
    const { error } = await supabase.from("sucata_veiculos").update(payload).eq("id", id);
    if (error) throw error;
    await registrarEvento({ entidade: "veiculo", entidadeId: id, acao: "atualizado", payload: { placa: payload.placa } });
    return id;
  }
  const { data, error } = await supabase.from("sucata_veiculos").insert(payload).select("id").single();
  if (error) throw error;
  await registrarEvento({ entidade: "veiculo", entidadeId: data.id, acao: "criado", payload: { placa: payload.placa } });
  return data.id;
}

export async function salvarTipoSucata(
  dados: { codigo: string; nome: string; ordem: number; ativo: boolean; valor_ton_min: number | null; valor_ton_max: number | null },
  id?: string | null,
) {
  if (id) {
    const { error } = await supabase.from("sucata_tipos").update(dados).eq("id", id);
    if (error) throw error;
    await registrarEvento({ entidade: "tipo_sucata", entidadeId: id, acao: "atualizado", payload: dados });
    return id;
  }
  const { data, error } = await supabase.from("sucata_tipos").insert(dados).select("id").single();
  if (error) throw error;
  await registrarEvento({ entidade: "tipo_sucata", entidadeId: data.id, acao: "criado", payload: dados });
  return data.id;
}

/** Nome de quem está operando, para o registro de cada fase. */
async function nomeUsuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  const meta = (u?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  return meta.display_name ?? meta.full_name ?? u?.email ?? null;
}

/** Entrada do modo sucata: registra a TARA do caminhão vazio e abre o processo. */
export async function abrirProcessoSucata(input: {
  obraId: string;
  coligada: string;
  sucateiroId: string;
  veiculoId: string | null;
  placa: string;
  motorista: string | null;
  documentoMotorista: string | null;
  taraKg: number;
  tipoSucataId: string | null;
  snapshotFiscal: Record<string, unknown>;
  userId: string | null;
}) {
  const placa = normalizarPlaca(input.placa);
  const pendente = await buscarProcessoPendentePorPlaca(placa, null);
  if (pendente) throw new Error(`A placa ${placa} já tem o processo ${pendente.numero} aguardando saída.`);
  const ano = new Date().getFullYear();
  const agora = new Date().toISOString();
  const nome = await nomeUsuarioAtual();
  const { data, error } = await supabase
    .from("sucata_processos")
    .insert({
      numero: "",
      ano,
      obra_id: input.obraId,
      coligada_origem: input.coligada,
      sucateiro_id: input.sucateiroId,
      veiculo_id: input.veiculoId,
      placa,
      motorista: input.motorista,
      documento_motorista: input.documentoMotorista,
      tara_kg: input.taraKg,
      tipo_sucata_id: input.tipoSucataId,
      fase: "F01",
      situacao: "PENDENTE",
      snapshot_fiscal: input.snapshotFiscal as never,
      created_by: input.userId,
      fases_registro: marcarFases({}, [
        { numero: 1, marca: { aberta_em: agora, aberta_nome: nome, fechada_em: agora, fechada_nome: nome } },
        { numero: 2, marca: { aberta_em: agora, aberta_nome: nome } },
      ]) as never,
    })
    .select(PROCESSO_COLS)
    .single();
  if (error) throw error;
  const processo = data as ProcessoRow;
  await registrarEvento({
    entidade: "processo",
    entidadeId: processo.id,
    processoId: processo.id,
    fase: "F01",
    acao: "entrada_registrada",
    coligada: input.coligada,
    payload: { numero: processo.numero, placa, tara_kg: input.taraKg },
  });
  return processo;
}

/** Saída do modo sucata: registra o peso BRUTO; o peso aferido é calculado pelo banco. */
export async function fecharProcessoSucata(input: {
  processoId: string;
  brutoKg: number;
  tipoSucataId: string | null;
  descricaoCarga: string | null;
  userId: string | null;
}) {
  // Pesagem concluída é somente leitura: não se registra saída duas vezes.
  const { data: atual, error: erroAtual } = await supabase
    .from("sucata_processos")
    .select("id, numero, bruto_kg, saida_em")
    .eq("id", input.processoId)
    .single();
  if (erroAtual || !atual) throw new Error("Processo não encontrado ou sem acesso.");
  if (atual.bruto_kg != null || atual.saida_em) {
    throw new Error(`A pesagem do processo ${atual.numero} já foi concluída e não pode ser alterada.`);
  }

  const { data, error } = await supabase
    .from("sucata_processos")
    .update({
      bruto_kg: input.brutoKg,
      tipo_sucata_id: input.tipoSucataId,
      descricao_carga: input.descricaoCarga,
      // O processo só é concluído no encerramento (Fase 4), nunca na saída do caminhão.
      fase: "F04",
      saida_em: new Date().toISOString(),
      saida_por: input.userId,
    })
    .eq("id", input.processoId)
    .select(PROCESSO_COLS)
    .single();
  if (error) throw error;
  const processo = data as ProcessoRow;
  await registrarEvento({
    entidade: "processo",
    entidadeId: processo.id,
    processoId: processo.id,
    fase: "F04",
    acao: "saida_registrada",
    coligada: processo.coligada_origem,
    payload: {
      numero: processo.numero,
      bruto_kg: processo.bruto_kg,
      tara_kg: processo.tara_kg,
      peso_aferido_kg: processo.peso_aferido_kg,
      descricao_carga: input.descricaoCarga,
    },
  });
  return processo;
}

// ===================== Fase 4: contas bancárias da obra =====================

export const contasObraQueryOptions = (obraId: string | null) =>
  queryOptions({
    queryKey: ["sucata", "contas-obra", obraId ?? "todas"],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<ContaObraRow[]> => {
      let q = supabase.from("sucata_contas_obra").select(CONTA_OBRA_COLS).order("banco");
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q.range(0, 299);
      if (error) throw error;
      return (data ?? []) as ContaObraRow[];
    },
  });

/** Cadastro de conta da obra. Nunca apaga: contas saem de uso pela situação INATIVA. */
export async function salvarContaObra(dados: ContaObraInsert, id?: string | null) {
  if (id) {
    const { error } = await supabase.from("sucata_contas_obra").update(dados).eq("id", id);
    if (error) throw error;
    await registrarEvento({
      entidade: "conta_obra",
      entidadeId: id,
      acao: "atualizado",
      coligada: dados.coligada_origem,
      payload: { banco: dados.banco, conta: dados.conta, situacao: dados.situacao },
    });
    return id;
  }
  const { data, error } = await supabase.from("sucata_contas_obra").insert(dados).select("id").single();
  if (error) throw error;
  await registrarEvento({
    entidade: "conta_obra",
    entidadeId: data.id,
    acao: "criado",
    coligada: dados.coligada_origem,
    payload: { banco: dados.banco, conta: dados.conta },
  });
  return data.id;
}

/**
 * Resumo de sucata agregado por obra (acompanhamento do Coordenador).
 * Lê apenas as colunas necessárias e percorre a base em lotes, respeitando o
 * RLS de coligada/obra já aplicado em `sucata_processos`.
 */
export type ResumoSucataLinha = {
  obra_id: string;
  fase: string;
  situacao: string;
  entrada_em: string;
  peso_aferido_kg: number | null;
  valor_total: number | null;
  concluido_em: string | null;
};

const RESUMO_BATCH = 500;

export const resumoPorObraQueryOptions = (
  obraId: string | null,
  inicio: string | null,
  fim: string | null,
) =>
  queryOptions({
    queryKey: ["sucata", "resumo-obra", obraId ?? "todas", inicio ?? "tudo", fim ?? "tudo"],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<ResumoSucataLinha[]> => {
      const todas: ResumoSucataLinha[] = [];
      let offset = 0;
      while (true) {
        let q = supabase
          .from("sucata_processos")
          .select("obra_id, fase, situacao, entrada_em, peso_aferido_kg, valor_total, concluido_em")
          .is("excluido_em", null)
          .order("entrada_em", { ascending: false });
        if (obraId) q = q.eq("obra_id", obraId);
        if (inicio) q = q.gte("entrada_em", inicio);
        if (fim) q = q.lte("entrada_em", fim);
        const { data, error } = await q.range(offset, offset + RESUMO_BATCH - 1);
        if (error) throw error;
        const lote = (data ?? []) as ResumoSucataLinha[];
        todas.push(...lote);
        if (lote.length < RESUMO_BATCH) break;
        offset += RESUMO_BATCH;
      }
      return todas;
    },
  });
