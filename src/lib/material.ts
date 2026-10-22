// Unificação de materiais: a mesma descrição chega grafada de formas diferentes
// nas notas (OCR trocando O/0 e I/1, numerais romanos, texto fiscal colado no
// fim da descrição). Aqui geramos uma chave canônica usada apenas para agrupar —
// o texto gravado na nota não muda.

const RUIDO_FISCAL = [
  "VALOR DISPENSADO",
  "MOTIVO DA DESONER",
  "MOTIVO DESONER",
  "DESONERACAO DO ICMS",
  "AJUSTE SINIEF",
  "EFEITOS A PARTIR",
  "BASE DE CALCULO",
  "ICMS DESONERADO",
];

const ROMANOS: Record<string, string> = {
  I: "1", II: "2", III: "3", IV: "4", V: "5",
  VI: "6", VII: "7", VIII: "8", IX: "9", X: "10",
};

export const SEM_MATERIAL = "SEM DESCRIÇÃO";

function semAcento(txt: string): string {
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Maiúsculas, sem acento, pontuação vira espaço. */
function normalizar(txt: string): string {
  return semAcento(txt)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Corta o texto fiscal que às vezes vem concatenado à descrição do item. */
function cortarRuidoFiscal(txt: string): string {
  let out = txt;
  for (const marca of RUIDO_FISCAL) {
    const i = out.indexOf(marca);
    if (i > 0) out = out.slice(0, i);
  }
  return out.trim().replace(/\s+/g, " ");
}

/** Descrições "código" (misturam letras e dígitos no mesmo token). */
function pareceCodigo(txt: string): boolean {
  return txt.split(" ").some((t) => /[A-Z]/.test(t) && /[0-9]/.test(t));
}

/** Confusões típicas de OCR em códigos alfanuméricos. */
function achatarOcr(txt: string): string {
  return txt.replace(/[OILT]/g, (c) => (c === "O" ? "0" : "1"));
}

/**
 * Chave canônica do material. Materiais com a mesma chave são o mesmo item,
 * mesmo escritos de formas diferentes.
 */
export function chaveMaterial(descricao?: string | null): string {
  const base = cortarRuidoFiscal(normalizar(descricao ?? ""));
  if (!base) return normalizar(SEM_MATERIAL);

  const tokens = base.split(" ").map((t) => ROMANOS[t] ?? t);
  const semRomanos = tokens.join(" ");
  return pareceCodigo(semRomanos) ? achatarOcr(semRomanos) : semRomanos;
}

// ---------------------------------------------------------------------------
// Aglutinação por similaridade: mesma sacola de palavras (ordem irrelevante),
// ignorando unidades/qualificadores que não mudam o material e tratando
// plural/singular como iguais. Tokens que DIFERENCIAM (números, granulometria,
// tipo de cimento) são sempre preservados.
// ---------------------------------------------------------------------------

const TOKENS_IRRELEVANTES = new Set([
  "TON", "TONELADA", "TONELADAS", "T", "KG", "KGS", "QUILO", "QUILOS",
  "M3", "MC", "METRO", "METROS", "CUBICO", "CUBICOS",
  "UN", "UND", "UNID", "UNIDADE", "PC", "PCT", "SC", "SACO", "SACOS",
  "LAVADA", "LAVADO", "LAVADAS", "LAVADOS",
  "DE", "DA", "DO", "DAS", "DOS", "E", "COM", "PARA", "EM", "A", "O",
]);

/** MATERIAIS → MATERIAL, PEDRAS → PEDRA (sem mexer em tokens curtos). */
function singularizar(token: string): string {
  if (/^[0-9]+$/.test(token)) return token;
  if (token.endsWith("AIS") && token.length > 4) return `${token.slice(0, -3)}AL`;
  if (token.endsWith("OES") && token.length > 4) return `${token.slice(0, -3)}AO`;
  if (token.endsWith("S") && token.length > 4) return token.slice(0, -1);
  return token;
}

/** Chave por conjunto de palavras (não aplicada a descrições que são código). */
function chavePorConjunto(base: string): string {
  const tokens = base
    .split(" ")
    .map((t) => ROMANOS[t] ?? t)
    .map(singularizar)
    .filter((t) => t && !TOKENS_IRRELEVANTES.has(t));
  if (tokens.length === 0) return base;
  return Array.from(new Set(tokens)).sort().join(" ");
}

export type MaterialEntrada =
  | string
  | { descricao?: string | null; tracoId?: string | null; tracoRotulo?: string | null };

/**
 * Chave final de agrupamento. Carta de traço tem precedência: descrições
 * diferentes ligadas ao mesmo traço formam um único material.
 */
export function chaveAglutinacao(entrada: MaterialEntrada): string {
  if (typeof entrada !== "string" && entrada?.tracoId) return `traco:${entrada.tracoId}`;
  const descricao = typeof entrada === "string" ? entrada : entrada?.descricao;
  const canonica = chaveMaterial(descricao);
  return pareceCodigo(canonica) ? canonica : chavePorConjunto(canonica);
}

export type MaterialGrupo = {
  chave: string;
  rotulo: string;
  variantes: string[];
  porTraco: boolean;
};

/**
 * Mapa chave → { rótulo de exibição, grafias originais }.
 * Em grupos de carta de traço o rótulo é o da carta; nos demais é a grafia mais
 * frequente, com empate resolvido pela mais curta (sem texto fiscal).
 */
export function construirMapaMateriais(entradas: Iterable<MaterialEntrada>): Map<string, MaterialGrupo> {
  const contagem = new Map<string, Map<string, number>>();
  const rotulosTraco = new Map<string, string>();
  for (const e of entradas) {
    const descricao = typeof e === "string" ? e : e?.descricao;
    const nome = (descricao ?? "").trim() || SEM_MATERIAL;
    const chave = chaveAglutinacao(e);
    if (typeof e !== "string" && e?.tracoId && e.tracoRotulo && !rotulosTraco.has(chave)) {
      rotulosTraco.set(chave, e.tracoRotulo);
    }
    if (!contagem.has(chave)) contagem.set(chave, new Map());
    const m = contagem.get(chave)!;
    m.set(nome, (m.get(nome) ?? 0) + 1);
  }

  const out = new Map<string, MaterialGrupo>();
  for (const [chave, m] of contagem) {
    const variantes = Array.from(m.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const maisFrequente = Array.from(m.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      if (a[0].length !== b[0].length) return a[0].length - b[0].length;
      return a[0].localeCompare(b[0], "pt-BR");
    })[0][0];
    const porTraco = chave.startsWith("traco:");
    out.set(chave, {
      chave,
      rotulo: (porTraco ? rotulosTraco.get(chave) : undefined) ?? maisFrequente,
      variantes,
      porTraco,
    });
  }
  return out;
}

/** Rótulo unificado para uma descrição, usando o mapa quando disponível. */
export function rotuloMaterial(
  entrada: MaterialEntrada,
  mapa?: Map<string, MaterialGrupo>,
): string {
  const descricao = typeof entrada === "string" ? entrada : entrada?.descricao;
  const nome = (descricao ?? "").trim() || SEM_MATERIAL;
  return mapa?.get(chaveAglutinacao(entrada))?.rotulo ?? nome;
}

