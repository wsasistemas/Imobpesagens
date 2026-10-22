// Cliente do portal externo do sucateiro. Fala apenas com /api/public/coleta.
export type ModoPortal = "ACEITE" | "VALOR" | "LEITURA";

export type ProcessoPortal = {
  numero: string;
  obra: string | null;
  placa: string;
  tipo: string | null;
  tara_kg: number;
  bruto_kg: number | null;
  peso_aferido_kg: number | null;
  data_coleta: string | null;
  comprador: string;
  documento: string;
  municipio_uf: string | null;
  valor_total: number | null;
  valor_por_tonelada: number | null;
  recibo_modo: string | null;
  aceite_em: string | null;
  contestacao_em: string | null;
  contestacao_motivo: string | null;
  faixa_min: number | null;
  faixa_max: number | null;
  expirado: boolean;
};

export type RespostaPortal = {
  ok: boolean;
  modo?: ModoPortal;
  processo?: ProcessoPortal;
  motivo?: string;
  fora_da_faixa?: boolean;
};

export async function chamarPortal(payload: {
  token: string;
  acao: "consultar" | "aceitar" | "contestar" | "informar_valor";
  motivo?: string;
  valor_total?: number;
  recibo_modo?: "SISTEMA" | "PROPRIO";
}): Promise<RespostaPortal> {
  const resp = await fetch("/api/public/coleta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await resp.json().catch(() => ({}))) as RespostaPortal;
  if (!resp.ok && !json.processo && !json.motivo) {
    return { ok: false, motivo: "Não foi possível carregar esta coleta." };
  }
  return json;
}

export function formatarBRL(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Máscara de digitação em reais: aceita só dígitos e trata os 2 últimos como centavos. */
export function mascaraBRL(texto: string): { mascarado: string; numero: number | null } {
  const digitos = texto.replace(/\D/g, "").slice(0, 11);
  if (!digitos) return { mascarado: "", numero: null };
  const numero = Number(digitos) / 100;
  return { mascarado: formatarBRL(numero), numero };
}
