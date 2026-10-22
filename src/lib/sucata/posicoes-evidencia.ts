/**
 * Catálogo único das fotos do processo de sucata (5 posições).
 * Fonte de verdade para captura, grade de evidências, relatório e travas.
 *
 * Os números das posições são os mesmos usados desde o início do módulo,
 * para que processos antigos continuem válidos.
 */

export type BlocoEvidencia = "A" | "B" | "C";

export type PosicaoEvidencia = {
  posicao: number;
  codigo: string;
  rotulo: string;
  bloco: BlocoEvidencia;
  responsavel: string;
  /** Fase do processo remodelado (1 a 4). */
  fase: 1 | 2 | 3 | 4;
};

export const ROTULO_BLOCO: Record<BlocoEvidencia, string> = {
  A: "Entrada e saída do caminhão",
  B: "Complementares (não obrigatórias)",
  C: "Documentos do fechamento",
};

export const POSICOES_EVIDENCIA: readonly PosicaoEvidencia[] = [
  { posicao: 1, codigo: "001", rotulo: "Caminhão vazio com a placa", bloco: "A", responsavel: "Operador de balança", fase: 1 },
  { posicao: 2, codigo: "002", rotulo: "Frente do caminhão com a placa", bloco: "A", responsavel: "Operador de balança", fase: 1 },
  { posicao: 4, codigo: "004", rotulo: "Caçamba cheia com a sucata", bloco: "A", responsavel: "Operador de balança", fase: 2 },
  { posicao: 10, codigo: "010", rotulo: "Recibo do sucateiro", bloco: "C", responsavel: "Administrativo da obra", fase: 4 },
  { posicao: 11, codigo: "011", rotulo: "Comprovante de transação bancária", bloco: "C", responsavel: "Administrativo da obra", fase: 4 },
  { posicao: 12, codigo: "012", rotulo: "Nota Fiscal Avulsa", bloco: "C", responsavel: "Contabilidade", fase: 3 },
] as const;

export const TOTAL_POSICOES = POSICOES_EVIDENCIA.length;

/** Posições exigidas na entrada antes de liberar o peso bruto. */
export const POSICOES_BLOCO_A = [1, 2] as const;

/**
 * A foto da frente com a placa (002) passou a ser obrigatória nesta data.
 * Processos abertos antes seguem válidos com as fotos que têm.
 */
export const VIGENCIA_FRENTE_PLACA = Date.parse("2026-09-15T00:00:00Z");

export function exigeFrenteComPlaca(criadoEm?: string | null): boolean {
  if (!criadoEm) return true;
  const em = Date.parse(criadoEm);
  return Number.isNaN(em) ? true : em >= VIGENCIA_FRENTE_PLACA;
}

/** Posições obrigatórias do processo, conforme a data de abertura. */
export function posicoesObrigatorias(criadoEm?: string | null): number[] {
  const todas = POSICOES_EVIDENCIA.map((p) => p.posicao);
  return exigeFrenteComPlaca(criadoEm) ? todas : todas.filter((p) => p !== POSICAO_FRENTE_PLACA);
}

/** Posições da entrada exigidas antes do peso bruto, conforme a data de abertura. */
export function posicoesBlocoAObrigatorias(criadoEm?: string | null): number[] {
  return exigeFrenteComPlaca(criadoEm) ? [...POSICOES_BLOCO_A] : [POSICAO_CAMINHAO_VAZIO];
}

/** Posição da foto de cada etapa, por fase. */
export const POSICAO_CAMINHAO_VAZIO = 1;
export const POSICAO_FRENTE_PLACA = 2;
export const POSICAO_CACAMBA_CHEIA = 4;
export const POSICAO_RECIBO = 10;
export const POSICAO_COMPROVANTE = 11;
export const POSICAO_NFA = 12;

export function posicaoPor(posicao: number): PosicaoEvidencia | undefined {
  return POSICOES_EVIDENCIA.find((p) => p.posicao === posicao);
}

export function rotuloDe(posicao: number): string {
  return posicaoPor(posicao)?.rotulo ?? `Posição ${posicao}`;
}

export function codigoDe(posicao: number): string {
  return String(posicao).padStart(3, "0");
}

export function posicoesDoBloco(bloco: BlocoEvidencia): PosicaoEvidencia[] {
  return POSICOES_EVIDENCIA.filter((p) => p.bloco === bloco);
}

export function posicoesDaFase(fase: 1 | 2 | 3 | 4): PosicaoEvidencia[] {
  return POSICOES_EVIDENCIA.filter((p) => p.fase === fase);
}

/** Primeira posição obrigatória da entrada ainda não capturada, ou null quando completa. */
export function primeiraFaltanteBlocoA(
  posicoesVigentes: number[],
  criadoEm?: string | null,
): PosicaoEvidencia | null {
  for (const p of posicoesBlocoAObrigatorias(criadoEm)) {
    if (!posicoesVigentes.includes(p)) return posicaoPor(p) ?? null;
  }
  return null;
}
