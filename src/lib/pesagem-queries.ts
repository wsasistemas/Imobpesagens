import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  EvidenciaRow,
  ObraRow,
  PesagemComEvidencias,
  TipoEvidencia,
} from "./pesagem-store";
import { BUCKETS } from "@/integrations/db-schema";

// Colunas efetivamente usadas na UI. Reduz payload vs. `select("*")`.
const PESAGEM_COLS =
  "id, obra_id, status, numero_nota, placa, transportadora, emissor, motorista, descricao, contratante, modelo, marca, carreta, qtd_total, valor_total_nf, itens_nf, entrou_em, saiu_em, peso_entrada, peso_saida, peso_liquido, peso_nf, fonte_peso_entrada, fonte_peso_saida, fonte_nota, justificativa, created_at, criado_por, saida_por, emissao, uf, chave_nfe, ocorrencia_tipo, ocorrencia_tipo_outro, ocorrencia_relato, ocorrencia_em, ocorrencia_por, ocorrencia_saida_tipo, ocorrencia_saida_tipo_outro, ocorrencia_saida_relato, ocorrencia_saida_em, ocorrencia_saida_por, traco_id, resultado_afericao, peso_esperado, diferenca_kg, diferenca_pct, tolerancia_aplicada, status_afericao, base_calculo, volume_m3, volume_derivado_detalhe, dados_adicionais_nf, aud_diferenca_pct_anterior, evidencias(id, pesagem_id, tipo, storage_path, nome, created_at)";


// Lote de leitura. A consulta percorre todos os lotes para não truncar históricos
// consolidados ou competências antigas quando a base ultrapassar 500 registros.
const PESAGENS_BATCH_SIZE = 500;

export const obrasQueryOptions = (userId?: string | null) =>
  queryOptions({
    queryKey: ["obras", userId ?? "sem-usuario"],
    enabled: !!userId,
    // Obras e permissões podem mudar durante implantação/administração; revalida ao montar.
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: "always",
    queryFn: async (): Promise<ObraRow[]> => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome, cnpj, coligada, ativo, endereco, engenheiro_nome, engenheiro_email, created_at, updated_at")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

/**
 * Obra com movimentação mais recente (última pesagem visível ao usuário).
 * Usada apenas como fallback de seleção inicial: evita abrir o sistema em uma
 * obra sem registros só porque ela é a primeira em ordem alfabética.
 */
export const obraComMovimentoQueryOptions = (userId?: string | null) =>
  queryOptions({
    queryKey: ["obra-com-movimento", userId ?? "sem-usuario"],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("pesagens")
        .select("obra_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.obra_id ?? null;
    },
  });



export const pesagensQueryOptions = (obraId: string | null) =>
  queryOptions({
    queryKey: ["pesagens", obraId],
    // Operação ao vivo: 30s de frescor evita hammer no PostgREST mas mantém UI reativa.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<PesagemComEvidencias[]> => {
      const todas: PesagemComEvidencias[] = [];
      let inicio = 0;

      while (true) {
        let query = supabase.from("pesagens").select(PESAGEM_COLS);
        if (obraId) query = query.eq("obra_id", obraId);

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .range(inicio, inicio + PESAGENS_BATCH_SIZE - 1);
        if (error) throw error;

        const lote = (data ?? []) as unknown as PesagemComEvidencias[];
        todas.push(...lote);
        if (lote.length < PESAGENS_BATCH_SIZE) break;
        inicio += PESAGENS_BATCH_SIZE;
      }

      return todas;
    },
  });

export const dashboardQueryOptions = (obraId: string | null, ini: string, fim: string) =>
  queryOptions({
    queryKey: ["dashboard", obraId, ini, fim],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_recebimento", {
        _obra_id: obraId!,
        _ini: ini,
        _fim: fim,
      });
      if (error) throw error;
      return data as any;
    },
  });

// URLs assinadas em lote para o grid (fotos). A key precisa ser estável — ordena antes.
export const signedUrlsQueryOptions = (paths: string[]) => {
  const stable = [...paths].sort();
  return queryOptions({
    queryKey: ["ev-urls", stable],
    enabled: stable.length > 0,
    // URLs valem 1h; reutilizamos por 30 min em cache.
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: () => signedUrls(stable),
  });
};

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage
    .from(BUCKETS.evidencias)
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  const out: Record<string, string> = {};
  data?.forEach((r) => {
    if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  });
  return out;
}

export async function uploadEvidencia(
  obraId: string,
  pesagemId: string,
  file: File,
  tipo: TipoEvidencia,
): Promise<EvidenciaRow> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${obraId}/${pesagemId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.evidencias)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("evidencias")
    .insert({ pesagem_id: pesagemId, tipo, storage_path: path, nome: file.name })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKETS.evidencias).remove([path]);
    throw error;
  }
  return data;
}

export async function removeEvidencia(ev: EvidenciaRow) {
  await supabase.storage.from(BUCKETS.evidencias).remove([ev.storage_path]);
  const { error } = await supabase.from("evidencias").delete().eq("id", ev.id);
  if (error) throw error;
}
