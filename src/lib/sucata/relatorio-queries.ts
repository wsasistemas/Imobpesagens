import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { registrarEvento } from "./sucata-queries";
import { BUCKETS } from "@/integrations/db-schema";

export type RelatorioRow = Database["public"]["Tables"]["sucata_relatorios"]["Row"];
export type DestinatarioRow = Database["public"]["Tables"]["sucata_destinatarios_relatorio"]["Row"];
export type DestinatarioInsert = Database["public"]["Tables"]["sucata_destinatarios_relatorio"]["Insert"];

export const BUCKET_RELATORIOS = BUCKETS.sucataRelatorios;

const RELATORIO_COLS =
  "id, processo_id, versao, storage_path, gerado_em, gerado_por, enviado_para, enviado_em, created_at";

const DESTINATARIO_COLS = "id, coligada, nome, email, papel, ativo, created_at, updated_at";

export const relatoriosQueryOptions = (processoId: string | null) =>
  queryOptions({
    queryKey: ["sucata", "relatorios", processoId],
    enabled: !!processoId,
    staleTime: 15_000,
    queryFn: async (): Promise<RelatorioRow[]> => {
      const { data, error } = await supabase
        .from("sucata_relatorios")
        .select(RELATORIO_COLS)
        .eq("processo_id", processoId!)
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RelatorioRow[];
    },
  });

export const destinatariosRelatorioQueryOptions = (coligada: string | null) =>
  queryOptions({
    queryKey: ["sucata", "destinatarios-relatorio", coligada],
    enabled: !!coligada,
    staleTime: 60_000,
    queryFn: async (): Promise<DestinatarioRow[]> => {
      const { data, error } = await supabase
        .from("sucata_destinatarios_relatorio")
        .select(DESTINATARIO_COLS)
        .eq("coligada", coligada!)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as DestinatarioRow[];
    },
  });

export async function salvarDestinatarioRelatorio(dados: DestinatarioInsert, id?: string | null) {
  if (id) {
    const { data, error } = await supabase
      .from("sucata_destinatarios_relatorio")
      .update(dados)
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    await registrarEvento({
      entidade: "destinatario_relatorio",
      entidadeId: id,
      acao: "atualizado",
      coligada: dados.coligada ?? null,
      payload: { email: dados.email, ativo: dados.ativo },
    });
    return data.id;
  }
  const { data, error } = await supabase
    .from("sucata_destinatarios_relatorio")
    .insert(dados)
    .select("id")
    .single();
  if (error) throw error;
  await registrarEvento({
    entidade: "destinatario_relatorio",
    entidadeId: data.id,
    acao: "criado",
    coligada: dados.coligada ?? null,
    payload: { email: dados.email },
  });
  return data.id;
}

/** URL assinada do PDF guardado. */
export async function urlRelatorio(path: string, segundos = 300): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_RELATORIOS).createSignedUrl(path, segundos);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Baixa o PDF guardado e devolve uma URL local (blob:) para pré-visualização
 * dentro do sistema. Não navega para endereço externo, que bloqueadores barram.
 */
export async function blobRelatorio(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_RELATORIOS).download(path);
  if (error || !data) throw new Error("Não foi possível carregar o relatório emitido.");
  return URL.createObjectURL(new Blob([await data.arrayBuffer()], { type: "application/pdf" }));
}

/** Reabertura de processo concluído: somente TI (superadmin). O banco também barra. */
export async function reabrirProcesso(processoId: string, motivo: string): Promise<void> {
  const texto = motivo.trim();
  if (texto.length < 5) throw new Error("Descreva o motivo da reabertura.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("sucata_processos")
    .update({
      situacao: "PENDENTE",
      reaberto_em: new Date().toISOString(),
      reaberto_por: auth.user?.id ?? null,
      reabertura_motivo: texto,
      concluido_em: null,
      concluido_por: null,
    })
    .eq("id", processoId);
  if (error) throw error;
  await registrarEvento({
    entidade: "processo",
    entidadeId: processoId,
    processoId,
    fase: "F15",
    acao: "processo_reaberto",
    payload: { motivo: texto },
  });
}
