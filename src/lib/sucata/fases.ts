/** Mapa das fases do processo de sucata (F00 a F15) com o responsável de cada uma. */

export type FaseSucata = {
  codigo: string;
  nome: string;
  responsavel: string;
  /** Ações registradas em sucata_eventos que marcam a fase como cumprida. */
  acoes: string[];
};

export const FASES_SUCATA: readonly FaseSucata[] = [
  { codigo: "F00", nome: "Cadastro prévio", responsavel: "Administrativo da obra", acoes: ["criado"] },
  { codigo: "F01", nome: "Tara de entrada", responsavel: "Operador de balança", acoes: ["entrada_registrada"] },
  { codigo: "F02", nome: "Carregamento monitorado", responsavel: "Encarregado da obra", acoes: ["evidencia_bloco_a_completo"] },
  { codigo: "F03", nome: "Liberação para a balança", responsavel: "Sistema", acoes: ["liberado_para_balanca"] },
  { codigo: "F04", nome: "Pesagem de saída e tipo", responsavel: "Operador de balança", acoes: ["saida_registrada"] },
  { codigo: "F05", nome: "Cálculo e envio do aferido", responsavel: "Sistema", acoes: ["aferido_calculado", "reenvio_aceite"] },
  { codigo: "F06", nome: "Entrega no depósito e contraprova", responsavel: "Funcionário da obra", acoes: ["peso_deposito_registrado"] },
  { codigo: "F07", nome: "Aceite do peso", responsavel: "Sucateiro", acoes: ["peso_aceito", "peso_contestado", "reabertura_peso", "alerta_sem_resposta"] },
  { codigo: "F08", nome: "Valor informado e recibo", responsavel: "Sucateiro", acoes: ["valor_informado"] },
  { codigo: "F09", nome: "Foto do recibo anexada", responsavel: "Funcionário da obra", acoes: ["recibo_anexado"] },
  { codigo: "F10", nome: "Comprovante de pagamento", responsavel: "Administrativo da obra", acoes: ["comprovante_anexado"] },
  { codigo: "F11", nome: "Aprovação de recibo e comprovante", responsavel: "Administrativo da obra", acoes: ["fechamento_aprovado"] },
  { codigo: "F12", nome: "Solicitação de NFA", responsavel: "Sistema", acoes: ["nfa_solicitada"] },
  { codigo: "F13", nome: "Emissão e anexo da NFA", responsavel: "Contabilidade", acoes: ["nfa_anexada"] },
  { codigo: "F14", nome: "Envio da nota ao sucateiro", responsavel: "Contabilidade (opcional)", acoes: ["nfa_enviada"] },
  { codigo: "F15", nome: "Relatório fotográfico e encerramento", responsavel: "Sistema", acoes: ["processo_encerrado"] },
] as const;

/** Fases exibidas na timeline do processo (F01 a F15). */
export const FASES_TIMELINE = FASES_SUCATA.filter((f) => f.codigo !== "F00");

export function faseDaAcao(acao: string): FaseSucata | undefined {
  return FASES_SUCATA.find((f) => f.acoes.includes(acao));
}
