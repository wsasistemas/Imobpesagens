/**
 * Registro de abertura e conclusão de cada fase do processo de sucata.
 * Guardado em sucata_processos.fases_registro (jsonb), com usuário, data e hora.
 */

export type MarcaFase = {
  aberta_em?: string | null;
  aberta_nome?: string | null;
  fechada_em?: string | null;
  fechada_nome?: string | null;
};

export type ChaveFase = "1" | "2" | "3" | "4";

export type RegistroFases = Partial<Record<ChaveFase, MarcaFase>>;

const CHAVES: ChaveFase[] = ["1", "2", "3", "4"];

function marcaValida(v: unknown): MarcaFase {
  const o = (v ?? {}) as Record<string, unknown>;
  const txt = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null);
  return {
    aberta_em: txt("aberta_em"),
    aberta_nome: txt("aberta_nome"),
    fechada_em: txt("fechada_em"),
    fechada_nome: txt("fechada_nome"),
  };
}

/** Lê o jsonb do banco com segurança. */
export function lerRegistroFases(bruto: unknown): RegistroFases {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const fonte = bruto as Record<string, unknown>;
  const saida: RegistroFases = {};
  for (const k of CHAVES) if (fonte[k]) saida[k] = marcaValida(fonte[k]);
  return saida;
}

/** Une uma nova marca ao registro existente, sem apagar o que já estava lá. */
export function marcarFase(
  bruto: unknown,
  numero: 1 | 2 | 3 | 4,
  marca: MarcaFase,
): RegistroFases {
  const atual = lerRegistroFases(bruto);
  const chave = String(numero) as ChaveFase;
  const anterior = atual[chave] ?? {};
  const nova: MarcaFase = { ...anterior };
  for (const [k, v] of Object.entries(marca)) {
    if (v !== undefined && v !== null && v !== "") (nova as Record<string, unknown>)[k] = v;
  }
  return { ...atual, [chave]: nova };
}

/** Une várias marcas de uma vez (ex.: fecha a fase 2 e abre a 3). */
export function marcarFases(
  bruto: unknown,
  marcas: { numero: 1 | 2 | 3 | 4; marca: MarcaFase }[],
): RegistroFases {
  let atual = lerRegistroFases(bruto);
  for (const m of marcas) atual = marcarFase(atual, m.numero, m.marca);
  return atual;
}
