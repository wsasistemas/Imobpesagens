import type { Database } from "@/integrations/supabase/types";

export type SucateiroRow = Database["public"]["Tables"]["sucata_sucateiros"]["Row"];
export type SucateiroInsert = Database["public"]["Tables"]["sucata_sucateiros"]["Insert"];
export type VeiculoRow = Database["public"]["Tables"]["sucata_veiculos"]["Row"];
export type VeiculoInsert = Database["public"]["Tables"]["sucata_veiculos"]["Insert"];
export type TipoSucataRow = Database["public"]["Tables"]["sucata_tipos"]["Row"];
export type ProcessoRow = Database["public"]["Tables"]["sucata_processos"]["Row"];
export type DocumentoRow = Database["public"]["Tables"]["sucata_sucateiro_documentos"]["Row"];

export type SituacaoSucateiro = "EM_HOMOLOGACAO" | "ATIVO" | "BLOQUEADO";
export type SituacaoProcesso = "PENDENTE" | "CONCLUIDO" | "BLOQUEADO";

/** Tríade de status do Design System: âmbar pendente, verde concluído, vinho bloqueado. */
export const CORES_STATUS = {
  pendente: "bg-amber-100 text-amber-900 border-amber-300",
  concluido: "bg-emerald-100 text-emerald-900 border-emerald-300",
  bloqueado: "bg-[#4A1119]/10 text-[#4A1119] border-[#4A1119]/30",
} as const;

export const ROTULO_SITUACAO_SUCATEIRO: Record<SituacaoSucateiro, string> = {
  EM_HOMOLOGACAO: "Em homologação",
  ATIVO: "Ativo",
  BLOQUEADO: "Bloqueado",
};

export const ROTULO_SITUACAO_PROCESSO: Record<SituacaoProcesso, string> = {
  PENDENTE: "Pendente",
  CONCLUIDO: "Concluído",
  BLOQUEADO: "Bloqueado",
};

export const TIPOS_DOCUMENTO: { value: string; label: string }[] = [
  { value: "CARTAO_CNPJ", label: "Cartão CNPJ" },
  { value: "CONTRATO_SOCIAL", label: "Contrato social" },
  { value: "CPF", label: "CPF" },
  { value: "RG", label: "RG" },
  { value: "COMPROV_RESIDENCIA", label: "Comprovante de residência" },
  { value: "LICENCA_AMBIENTAL", label: "Licença ambiental" },
  { value: "OUTRO", label: "Outro" },
];

export const TIPOS_CONTA = ["Corrente", "Poupança", "Pagamento"];
export const TITULARIDADES = ["Própria", "Terceiro"];

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

/** Fonte monoespaçada tabular para pesos, placas, valores e número de processo. */
export const CLASSE_NUM = "font-mono [font-variant-numeric:tabular-nums]";

export type ContaObraRow = Database["public"]["Tables"]["sucata_contas_obra"]["Row"];
export type ContaObraInsert = Database["public"]["Tables"]["sucata_contas_obra"]["Insert"];
