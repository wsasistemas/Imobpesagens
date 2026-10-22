/** As 4 fases visíveis do processo de sucata remodelado. */

import {
  POSICAO_CACAMBA_CHEIA, POSICAO_CAMINHAO_VAZIO, POSICAO_COMPROVANTE, POSICAO_FRENTE_PLACA, POSICAO_NFA,
  POSICAO_RECIBO, exigeFrenteComPlaca,
} from "./posicoes-evidencia";

export type NumeroFase = 1 | 2 | 3 | 4;

export type FaseV2 = {
  numero: NumeroFase;
  nome: string;
  responsavel: string;
  resumo: string;
  posicoes: number[];
};

export const FASES_V2: readonly FaseV2[] = [
  {
    numero: 1,
    nome: "Entrada do caminhão",
    responsavel: "Operador de balança",
    resumo:
      "Sucateiro, placa, dados do caminhão, foto do caminhão vazio, foto da frente com a placa e peso da tara.",
    posicoes: [POSICAO_CAMINHAO_VAZIO, POSICAO_FRENTE_PLACA],
  },
  {
    numero: 2,
    nome: "Saída do caminhão",
    responsavel: "Operador de balança",
    resumo:
      "Peso bruto e foto da caçamba cheia. O sistema apura os valores; o Administrativo de Obra revisa e solicita a nota à Contabilidade.",
    posicoes: [POSICAO_CACAMBA_CHEIA],
  },
  {
    numero: 3,
    nome: "Nota Fiscal Avulsa",
    responsavel: "Contabilidade",
    resumo: "Emissão da nota com os dados do sucateiro, envio por e-mail ao sucateiro ou exportação em PDF.",
    posicoes: [POSICAO_NFA],
  },
  {
    numero: 4,
    nome: "Recibo do sucateiro",
    responsavel: "Administrativo da obra",
    resumo: "Recibo do sucateiro e comprovante de pagamento; encerramento com o relatório fotográfico.",
    posicoes: [POSICAO_RECIBO, POSICAO_COMPROVANTE],
  },
] as const;

export type EstadoFase = "concluida" | "atual" | "aguardando";

export type SituacaoProcessoFases = {
  taraOk: boolean;
  brutoOk: boolean;
  valorOk: boolean;
  reciboOk: boolean;
  comprovanteOk: boolean;
  notaOk: boolean;
  fotoEntradaOk: boolean;
  fotoFrenteOk: boolean;
  fotoSaidaOk: boolean;
};

/** Estado de cada fase a partir do que já foi preenchido no processo. */
export function estadoDasFases(s: SituacaoProcessoFases): Record<NumeroFase, EstadoFase> {
  const f1 = s.taraOk && s.fotoEntradaOk && s.fotoFrenteOk;
  const f2 = f1 && s.brutoOk && s.fotoSaidaOk && s.valorOk;
  const f3 = f2 && s.notaOk;
  const f4 = f3 && s.reciboOk && s.comprovanteOk;

  const estado = (concluida: boolean, liberada: boolean): EstadoFase =>
    concluida ? "concluida" : liberada ? "atual" : "aguardando";

  return {
    1: estado(f1, true),
    2: estado(f2, f1),
    3: estado(f3, f2),
    4: estado(f4, f3),
  };
}

/** Campos mínimos do processo para derivar o estado das 4 fases. */
export type ProcessoParaFases = {
  tara_kg: number;
  bruto_kg: number | null;
  valor_total: number | null;
  nfa_solicitada_em?: string | null;
  nfa_numero: string | null;
  created_at?: string | null;
};

/** Estado das fases a partir do processo e das posições de foto já registradas. */
export function estadosDoProcesso(p: ProcessoParaFases, feitas: Set<number>): Record<NumeroFase, EstadoFase> {
  return estadoDasFases({
    taraOk: Number(p.tara_kg) > 0,
    brutoOk: !!p.bruto_kg,
    valorOk: !!p.valor_total && !!p.nfa_solicitada_em,
    reciboOk: feitas.has(POSICAO_RECIBO),
    comprovanteOk: feitas.has(POSICAO_COMPROVANTE),
    notaOk: !!p.nfa_numero && feitas.has(POSICAO_NFA),
    fotoEntradaOk: feitas.has(POSICAO_CAMINHAO_VAZIO),
    fotoFrenteOk: !exigeFrenteComPlaca(p.created_at) || feitas.has(POSICAO_FRENTE_PLACA),
    fotoSaidaOk: feitas.has(POSICAO_CACAMBA_CHEIA),
  });
}



export function faseAtual(estados: Record<NumeroFase, EstadoFase>): NumeroFase {
  for (const n of [1, 2, 3, 4] as NumeroFase[]) if (estados[n] !== "concluida") return n;
  return 4;
}

/** Marco dentro de uma fase: cumprido por uma ação da auditoria ou por uma foto registrada. */
export type MarcoFase = {
  chave: string;
  nome: string;
  /** Ações em sucata_eventos que cumprem o marco. */
  acoes?: string[];
  /** Posição de foto que cumpre o marco. */
  posicao?: number;
};

export const MARCOS_FASE: Record<NumeroFase, MarcoFase[]> = {
  1: [
    { chave: "entrada", nome: "Entrada registrada (tara)", acoes: ["entrada_registrada"] },
    { chave: "foto_001", nome: "Foto 001 — caminhão vazio", posicao: POSICAO_CAMINHAO_VAZIO },
    { chave: "foto_002", nome: "Foto 002 — frente do caminhão com a placa", posicao: POSICAO_FRENTE_PLACA },
  ],
  2: [
    { chave: "saida", nome: "Saída registrada (peso bruto)", acoes: ["saida_registrada"] },
    { chave: "foto_004", nome: "Foto 004 — caçamba cheia", posicao: POSICAO_CACAMBA_CHEIA },
    {
      chave: "valor",
      nome: "Valor a pagar calculado pelo peso aferido",
      acoes: ["valor_calculado", "valor_informado", "valor_ajustado"],
    },
    { chave: "pedido", nome: "Pedido da nota enviado à Contabilidade", acoes: ["nfa_solicitada"] },
  ],
  3: [
    { chave: "nota", nome: "Nota Fiscal Avulsa anexada", acoes: ["nfa_anexada"], posicao: POSICAO_NFA },
    { chave: "envio", nome: "Nota enviada ao sucateiro ou exportada em PDF", acoes: ["nfa_enviada", "nfa_exportada"] },
  ],
  4: [
    { chave: "foto_010", nome: "Foto 010 — recibo do sucateiro", posicao: POSICAO_RECIBO },
    { chave: "foto_011", nome: "Foto 011 — comprovante de pagamento", posicao: POSICAO_COMPROVANTE },
    {
      chave: "encerramento",
      nome: "Relatório fotográfico gerado e processo encerrado",
      acoes: ["processo_encerrado", "processo_concluido"],
    },
  ],
};
