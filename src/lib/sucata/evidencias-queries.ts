import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { registrarEvento } from "./sucata-queries";
import { codigoDe, rotuloDe } from "./posicoes-evidencia";
import { enfileirar, listarFila, removerDaFila, type ItemFila } from "./fila-offline";
import { BUCKETS } from "@/integrations/db-schema";

export type EvidenciaRow = Database["public"]["Tables"]["sucata_evidencias"]["Row"];
export type EventoRow = Database["public"]["Tables"]["sucata_eventos"]["Row"];

export const BUCKET_EVIDENCIAS = BUCKETS.sucataEvidencias;

const EVIDENCIA_COLS =
  "id, processo_id, posicao, rotulo, storage_path, capturado_em, capturado_por, lat, lng, versao, substituida_por, motivo_substituicao";

const EVENTO_COLS =
  "id, processo_id, entidade, entidade_id, fase, acao, payload, usuario_id, usuario_nome, usuario_email, created_at";

export const evidenciasQueryOptions = (processoId: string | null) =>
  queryOptions({
    queryKey: ["sucata", "evidencias", processoId],
    enabled: !!processoId,
    staleTime: 15_000,
    queryFn: async (): Promise<EvidenciaRow[]> => {
      const { data, error } = await supabase
        .from("sucata_evidencias")
        .select(EVIDENCIA_COLS)
        .eq("processo_id", processoId!)
        .order("posicao")
        .order("versao");
      if (error) throw error;
      return (data ?? []) as EvidenciaRow[];
    },
  });

export const eventosProcessoQueryOptions = (processoId: string | null) =>
  queryOptions({
    queryKey: ["sucata", "eventos", processoId],
    enabled: !!processoId,
    staleTime: 15_000,
    queryFn: async (): Promise<EventoRow[]> => {
      const { data, error } = await supabase
        .from("sucata_eventos")
        .select(EVENTO_COLS)
        .eq("processo_id", processoId!)
        .order("created_at")
        .range(0, 299);
      if (error) throw error;
      return (data ?? []) as EventoRow[];
    },
  });

export const processoQueryOptions = (processoId: string | null) =>
  queryOptions({
    queryKey: ["sucata", "processo", processoId],
    enabled: !!processoId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sucata_processos")
        .select(
          "id, numero, ano, obra_id, coligada_origem, sucateiro_id, veiculo_id, placa, motorista, documento_motorista, tara_kg, bruto_kg, peso_aferido_kg, peso_deposito_kg, tipo_sucata_id, fase, situacao, entrada_em, saida_em, created_at, notificado_em, aceite_em, aceite_token_expira_em, contestacao_em, contestacao_motivo, valor_total, valor_por_tonelada, valor_unitario_kg, valor_ajustado_em, valor_ajuste_justificativa, recibo_modo, aprovado_em, aprovacao_observacao, devolvido_em, devolucao_motivo, devolucao_fase_origem, conta_obra_id, pagamento_valor, pagamento_data, pagamento_conta_divergente, pagamento_justificativa, pagamento_conta_lida, recibo_valor_lido, nfa_numero, nfa_emissao, nfa_storage_path, nfa_enviada_em, nfa_exportada_em, fases_registro, nfa_impedimento_motivo, nfa_solicitada_em, teste_manual, concluido_em, descricao_carga, concluido_por, excluido_em, excluido_por, exclusao_motivo",
        )
        .eq("id", processoId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

/** Somente as evidências vigentes (não substituídas). */
export function vigentes(lista: EvidenciaRow[]): EvidenciaRow[] {
  return lista.filter((e) => e.substituida_por === null);
}

export function posicoesVigentes(lista: EvidenciaRow[]): number[] {
  return vigentes(lista).map((e) => e.posicao);
}

/** Posições 001 a 004 completas? Trava do fechamento da pesagem de saída. */
export async function faltantePosicaoBlocoA(processoId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("sucata_evidencias")
    .select("posicao")
    .eq("processo_id", processoId)
    .is("substituida_por", null)
    .lte("posicao", 4);
  if (error) throw error;
  const tem = new Set((data ?? []).map((d) => d.posicao));
  for (const p of [1, 2, 3, 4]) if (!tem.has(p)) return p;
  return null;
}

/** Comprime a imagem no client: lado maior 1600px, JPEG qualidade 0,8. */
export async function comprimirImagem(arquivo: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const maior = Math.max(bitmap.width, bitmap.height);
  const escala = maior > 1600 ? 1600 / maior : 1;
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return arquivo;
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
  );
  return blob ?? arquivo;
}

/** Coordenadas da captura; permissão negada devolve null e não impede a foto. */
export function obterCoordenadas(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export async function urlAssinada(path: string, segundos = 300): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_EVIDENCIAS).createSignedUrl(path, segundos);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Envia um item da fila para o Storage e grava a evidência. */
export async function enviarItem(item: ItemFila): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sessão expirada. Entre novamente para enviar as fotos.");

  const path = `${item.processoId}/${codigoDe(item.posicao)}-v${item.versao}.jpg`;
  const up = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .upload(path, item.arquivo, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw up.error;

  // Substituição: libera a posição vigente antes de inserir a nova versão.
  if (item.substituiId) {
    const { error } = await supabase
      .from("sucata_evidencias")
      .update({ substituida_por: item.substituiId, motivo_substituicao: item.motivo })
      .eq("id", item.substituiId);
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from("sucata_evidencias")
    .insert({
      processo_id: item.processoId,
      posicao: item.posicao,
      rotulo: item.rotulo,
      storage_path: path,
      capturado_em: item.capturadoEm,
      capturado_por: userId,
      lat: item.lat,
      lng: item.lng,
      versao: item.versao,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (item.substituiId) {
    const { error: e2 } = await supabase
      .from("sucata_evidencias")
      .update({ substituida_por: data.id, motivo_substituicao: item.motivo })
      .eq("id", item.substituiId);
    if (e2) throw e2;
  }

  await registrarEvento({
    entidade: "evidencia",
    entidadeId: data.id,
    processoId: item.processoId,
    fase: item.posicao <= 4 ? "F02" : item.posicao <= 8 ? "F06" : "F09",
    acao: item.substituiId ? "evidencia_substituida" : "evidencia_capturada",
    payload: {
      posicao: codigoDe(item.posicao),
      rotulo: item.rotulo,
      versao: item.versao,
      geolocalizacao: item.lat !== null && item.lng !== null ? "capturada" : "nao_autorizada",
      motivo_substituicao: item.motivo,
    },
  });

  const faltante = await faltantePosicaoBlocoA(item.processoId);
  if (item.posicao <= 4 && faltante === null) {
    await registrarEvento({
      entidade: "processo",
      entidadeId: item.processoId,
      processoId: item.processoId,
      fase: "F02",
      acao: "evidencia_bloco_a_completo",
      payload: { posicoes: ["001", "002", "003", "004"] },
    });
  }
}

/** Captura: enfileira localmente e tenta enviar na hora. */
export async function capturarEvidencia(input: {
  processoId: string;
  posicao: number;
  arquivo: File | Blob;
  substituiId?: string | null;
  motivo?: string | null;
  versao?: number;
}): Promise<{ enviado: boolean }> {
  const comprimido = await comprimirImagem(input.arquivo);
  const coords = await obterCoordenadas();
  const item: ItemFila = {
    id: crypto.randomUUID(),
    processoId: input.processoId,
    posicao: input.posicao,
    rotulo: rotuloDe(input.posicao),
    versao: input.versao ?? 1,
    substituiId: input.substituiId ?? null,
    motivo: input.motivo ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    capturadoEm: new Date().toISOString(),
    arquivo: comprimido,
  };
  if (filaAtiva()) await enfileirar(item);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { enviado: false };
  try {
    await enviarItem(item);
    if (filaAtiva()) await removerDaFila(item.id);
    return { enviado: true };
  } catch (e) {
    if (!filaAtiva()) throw e;
    return { enviado: false };
  }
}

function filaAtiva() {
  return typeof indexedDB !== "undefined";
}

/** Reenvia tudo o que ficou na fila local. Devolve quantos foram enviados. */
export async function esvaziarFila(processoId?: string): Promise<number> {
  const itens = await listarFila(processoId);
  let enviados = 0;
  for (const item of itens) {
    try {
      await enviarItem(item);
      await removerDaFila(item.id);
      enviados += 1;
    } catch {
      break;
    }
  }
  return enviados;
}

export { listarFila };

/** Grava o peso lido na balança do depósito do sucateiro. */
export async function salvarPesoDeposito(processoId: string, pesoKg: number): Promise<void> {
  const { data, error } = await supabase
    .from("sucata_processos")
    .update({ peso_deposito_kg: pesoKg })
    .eq("id", processoId)
    .select("id, numero, peso_aferido_kg, peso_deposito_kg, coligada_origem")
    .single();
  if (error) throw error;
  await registrarEvento({
    entidade: "processo",
    entidadeId: processoId,
    processoId,
    fase: "F06",
    acao: "peso_deposito_registrado",
    coligada: data.coligada_origem,
    payload: {
      numero: data.numero,
      peso_deposito_kg: data.peso_deposito_kg,
      peso_aferido_kg: data.peso_aferido_kg,
    },
  });
}
