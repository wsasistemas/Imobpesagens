// Normalização de unidades comerciais da NF e cálculo do peso estimado (kg).
// Fase 1: conversão direta (KG/TON) + densidades padrão para materiais comuns.

export type ItemNfBruto = {
  descricao?: string | null;
  quantidade?: number | string | null;
  unidade?: string | null;
  unidade_normalizada?: string | null;
  valor_unitario?: number | string | null;
  ncm?: string | null;
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Converte variações de unidade em código canônico (KG, TON, M3, SC, UN...). */
export function normalizarUnidade(raw?: string | null): string {
  if (!raw) return "";
  const u = semAcento(String(raw)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (["KG", "KGS", "QUILO", "QUILOS", "QUILOGRAMA"].includes(u)) return "KG";
  if (["TON", "T", "TN", "TL", "TONELADA", "TONELADAS"].includes(u)) return "TON";
  if (["M3", "MC", "MT3", "METROCUBICO"].includes(u)) return "M3";
  if (["L", "LT", "LTS", "LITRO", "LITROS"].includes(u)) return "L";
  if (["SC", "SACO", "SACA", "SACOS"].includes(u)) return "SC";
  if (["UN", "UND", "UNID", "UNIDADE", "PC", "PCS", "PEC", "PECA"].includes(u)) return "UN";
  return u;
}

/** Aceita "1.234,56", "1234.56", número ou vazio. Devolve null quando inválido. */
export function paraNumero(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = v.trim();
  const normalizado =
    s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\s/g, "");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Densidades padrão (kg/m³) para materiais comuns — substituídas pelo cadastro na Fase 2. */
const DENSIDADES: Array<{ palavras: string[]; kgM3: number }> = [
  { palavras: ["CONCRETO", "MAGRO"], kgM3: 2300 },
  { palavras: ["CONCRETO", "LASTRO"], kgM3: 2300 },
  { palavras: ["CONCRETO", "LEVE"], kgM3: 1800 },
  { palavras: ["CONCRETO"], kgM3: 2400 },
  { palavras: ["ARGAMASSA"], kgM3: 2100 },
  { palavras: ["AREIA"], kgM3: 1500 },
  { palavras: ["BRITA"], kgM3: 1450 },
  { palavras: ["PEDRA"], kgM3: 1450 },
  { palavras: ["SEIXO"], kgM3: 1500 },
  { palavras: ["RACHAO"], kgM3: 1500 },
  { palavras: ["CIMENTO"], kgM3: 1400 },
];

/** Densidades de líquidos (kg/L). */
const DENSIDADES_L: Array<{ palavras: string[]; kgL: number }> = [
  { palavras: ["AGUA"], kgL: 1 },
  { palavras: ["ADITIVO"], kgL: 1.15 },
];

/** Peso padrão do saco (kg) por material. */
const PESO_SACO: Array<{ palavras: string[]; kg: number }> = [
  { palavras: ["CIMENTO"], kg: 50 },
  { palavras: ["ARGAMASSA"], kg: 20 },
  { palavras: ["CAL"], kg: 20 },
];

function casar<T extends { palavras: string[] }>(lista: T[], descricao?: string | null): T | null {
  const d = semAcento(String(descricao ?? "")).toUpperCase();
  if (!d) return null;
  for (const regra of lista) {
    if (regra.palavras.every((p) => d.includes(p))) return regra;
  }
  return null;
}

function densidadePorDescricao(descricao?: string | null): number | null {
  return casar(DENSIDADES, descricao)?.kgM3 ?? null;
}


/** Resolvedor injetado pelo cadastro de Densidades (Configurações › Densidades). */
export type ResolvedorDensidade = (
  descricao: string | null | undefined,
  unidade: string,
) => { valor: number; origem: string; material?: string; fornecedor?: string } | null;

export type ItemCalculado = {
  descricao: string;
  quantidade: number | null;
  unidade: string;
  pesoKg: number | null;
  /** true quando a unidade não veio da NF e foi deduzida pela descrição. */
  estimado?: boolean;
  motivo?: string;
  /** de onde saiu a densidade/peso aplicado: carta_traco | fornecedor | cadastro | interna */
  origemDensidade?: string;
  /** fornecedor da exceção de densidade, quando houver. */
  fornecedorDensidade?: string;
};


export type PesoCalculado = {
  /** Soma dos itens conversíveis (kg). Null quando nenhum item converteu. */
  totalKg: number | null;
  itens: ItemCalculado[];
  convertidos: number;
  total: number;
  /** true quando ao menos um item não pôde ser convertido. */
  parcial: boolean;
  /** true quando ao menos um item usou unidade estimada. */
  estimado: boolean;
};

type PesagemItensRef = {
  qtd_total?: number | string | null;
  itens_nf?: unknown;
};

/**
 * Prepara itens para cálculo usando a regra de domínio da tela de edição:
 * quando a NF tem um único item, a "Qtd total" é a quantidade declarada final.
 * Isso evita que um item antigo (ex.: 1,26 TL) continue derrubando o cálculo
 * depois que o registro foi corrigido para 18,26 TON/TL.
 */
export function prepararItensNfParaCalculo(
  itens: ItemNfBruto[] | null | undefined,
  qtdTotal?: number | string | null,
): ItemNfBruto[] {
  const lista = Array.isArray(itens) ? itens : [];
  const qtdTotalNum = paraNumero(qtdTotal ?? null);

  return lista.map((item, idx) => {
    const unidadeCanonica = normalizarUnidade(item.unidade_normalizada ?? item.unidade);
    let quantidade = item.quantidade;

    // Formato B: Se houver CIMENTO na NF, tentamos derivar o volume a partir do consumo do traço
    // No entanto, isso requer o traço identificado, que acontece em nível superior (admin.functions / pesagem-store).
    // Aqui garantimos que a unidade normalizada prevaleça.
    
    return {
      ...item,
      unidade: unidadeCanonica || item.unidade || null,
      quantidade:
        lista.length === 1 && idx === 0 && qtdTotalNum != null && qtdTotalNum > 0
          ? qtdTotalNum
          : quantidade,
    };
  });
}

/** Deduz a unidade pela descrição quando a NF não trouxe a unidade. */
export function inferirUnidade(descricao?: string | null, quantidade?: number | null): string {
  const d = semAcento(String(descricao ?? "")).toUpperCase();
  if (!d) return "";
  const q = quantidade ?? null;

  // Concreto usinado (traço FCK / TC) → metros cúbicos
  if (/\bFCK\b/.test(d) || d.includes("CONCRETO USINADO") || /^TC[\s.]/.test(d)) return "M3";

  // Aço / vergalhão → toneladas
  if (/\bVERG|CA\s?50|CA\s?60|\bACO\b|VERGALHAO|\bTELA\b|\bBARRA\b/.test(d)) return "TON";

  // Água / aditivo líquido → litros quando volume alto, senão kg
  if (/\bAGUA\b|ADITIVO/.test(d)) return q != null && q > 100 ? "L" : "KG";

  // Cimento a granel/ensacado → quase sempre kg na NF
  if (/CIMENTO/.test(d)) return q != null && q > 500 ? "KG" : "TON";

  // Agregados: quantidade pequena costuma ser m³; grande, kg
  if (/PEDRA|BRITA|AREIA|SEIXO|PO DE PEDRA|RACHAO|BICA/.test(d)) {
    if (q == null) return "";
    if (q > 500) return "KG";
    return q <= 60 ? "TON" : "M3";
  }
  if (/CAL\b|ARGAMASSA/.test(d)) {
    return q != null && q > 500 ? "KG" : "TON";
  }
  return "";
}

export function calcularPesoItem(
  item: ItemNfBruto,
  densidadeForcada?: number | null,
  resolver?: ResolvedorDensidade,
): ItemCalculado {
  const quantidade = paraNumero(item.quantidade ?? null);
  const unidadeNf = normalizarUnidade(item.unidade_normalizada ?? item.unidade);
  const estimado = !unidadeNf;
  const unidade = unidadeNf || inferirUnidade(item.descricao, quantidade);
  const base: ItemCalculado = {
    descricao: (item.descricao ?? "").trim(),
    quantidade,
    unidade,
    pesoKg: null,
    estimado: estimado && !!unidade,
  };
  if (quantidade == null) return { ...base, motivo: "quantidade ausente" };
  if (!unidade) return { ...base, motivo: "unidade não informada" };
  if (unidade === "KG") return { ...base, pesoKg: quantidade };
  if (unidade === "TON") return { ...base, pesoKg: quantidade * 1000 };

  const doCadastro = resolver?.(item.descricao, unidade) ?? null;

  if (unidade === "L") {
    if (doCadastro) {
      return {
        ...base,
        pesoKg: quantidade * doCadastro.valor,
        origemDensidade: doCadastro.origem,
        fornecedorDensidade: doCadastro.fornecedor,
      };
    }
    const kgL = casar(DENSIDADES_L, item.descricao)?.kgL ?? 1;
    return { ...base, pesoKg: quantidade * kgL, origemDensidade: "interna" };
  }
  if (unidade === "SC") {
    if (doCadastro) {
      return {
        ...base,
        pesoKg: quantidade * doCadastro.valor,
        origemDensidade: doCadastro.origem,
        fornecedorDensidade: doCadastro.fornecedor,
      };
    }
    const kg = casar(PESO_SACO, item.descricao)?.kg;
    if (kg) return { ...base, pesoKg: quantidade * kg, origemDensidade: "interna" };
    return { ...base, motivo: "sem peso padrão do saco" };
  }
  if (unidade === "M3") {
    if (densidadeForcada) {
      return { ...base, pesoKg: quantidade * densidadeForcada, origemDensidade: "carta_traco" };
    }
    if (doCadastro) {
      return {
        ...base,
        pesoKg: quantidade * doCadastro.valor,
        origemDensidade: doCadastro.origem,
        fornecedorDensidade: doCadastro.fornecedor,
      };
    }
    const dens =
      densidadePorDescricao(item.descricao) ??
      (/\bFCK\b|^TC[\s.]/.test(semAcento(String(item.descricao ?? "")).toUpperCase()) ? 2390 : null);
    if (dens) return { ...base, pesoKg: quantidade * dens, origemDensidade: "interna" };
    return { ...base, motivo: "sem regra de conversão (m³)" };
  }
  return { ...base, motivo: `sem regra de conversão (${unidade})` };
}


export function calcularPesoNf(
  itens: ItemNfBruto[] | null | undefined,
  densidadeForcada?: number | null,
  resolver?: ResolvedorDensidade,
): PesoCalculado {
  const lista = Array.isArray(itens) ? itens : [];
  const calculados = lista.map((i) => calcularPesoItem(i, densidadeForcada, resolver));
  const convertidos = calculados.filter((i) => i.pesoKg != null);
  const totalKg = convertidos.length
    ? convertidos.reduce((acc, i) => acc + (i.pesoKg ?? 0), 0)
    : null;
  return {
    totalKg,
    itens: calculados,
    convertidos: convertidos.length,
    total: calculados.length,
    parcial: calculados.length > 0 && convertidos.length < calculados.length,
    estimado: calculados.some((i) => i.estimado && i.pesoKg != null),
  };
}

export function calcularPesoNfDaPesagem(
  p: PesagemItensRef,
  resolver?: ResolvedorDensidade,
  densidadeCarta?: number | null,
): PesoCalculado {
  const itens = Array.isArray(p?.itens_nf) ? (p.itens_nf as ItemNfBruto[]) : [];
  // Recupera densidade técnica se for concreto identificado
  const densidadeForcada = densidadeCarta ?? (p as any)?.resultado_afericao?.rho;
  return calcularPesoNf(
    prepararItensNfParaCalculo(itens, p?.qtd_total ?? null),
    densidadeForcada,
    resolver,
  );
}


const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

/** Formata quantidade conforme a unidade (3 casas para volume, 2 para peso). */
export function fmtQuantidade(q: number, unidade: string): string {
  if (unidade === "M3") return nf(0, 3).format(q);
  if (unidade === "KG" || unidade === "TON") return nf(0, 3).format(q);
  return nf(0, 3).format(q);
}

export function fmtQtdUnidade(q: number | null, unidade: string): string {
  if (q == null) return "—";
  return unidade ? `${fmtQuantidade(q, unidade)} ${unidade}` : fmtQuantidade(q, "");
}

export function fmtKgPt(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return `${nf(0, 2).format(kg)} kg`;
}

/** Formata em toneladas a partir de um valor em kg (ex.: "37,971 t"). */
export function fmtToneladas(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return `${nf(0, 3).format(kg / 1000)} t`;
}

export type PesoNfReferencia = {
  /** Peso de referência da NF em kg (null quando indisponível). */
  kg: number | null;
  /** "carta_traco" = peso oficial da carta; "calculado" = derivado dos itens da NF; "nf" = peso informado. */
  origem: "carta_traco" | "calculado" | "nf" | "nenhum";
  /** true quando nem todos os itens da NF puderam ser convertidos. */
  parcial: boolean;
  /** Tolerância (%) da carta de traço quando a referência vem dela. */
  tol?: number | null;
};

type PesagemRef = {
  peso_nf?: number | string | null;
  qtd_total?: number | string | null;
  itens_nf?: unknown;
  peso_esperado?: number | string | null;
  tolerancia_aplicada?: number | string | null;
  resultado_afericao?: unknown;
};

/** Peso esperado pela carta de traço gravado no registro (coluna ou apuração). */
export function pesoCartaTraco(p: PesagemRef): { kg: number | null; tol: number | null } {
  const af = (p?.resultado_afericao ?? null) as { esperado?: unknown; tol?: unknown } | null;
  const kg = paraNumero(p?.peso_esperado ?? null) ?? paraNumero((af?.esperado as any) ?? null);
  const tol = paraNumero(p?.tolerancia_aplicada ?? null) ?? paraNumero((af?.tol as any) ?? null);
  return { kg: kg != null && kg > 0 ? kg : null, tol: tol != null && tol > 0 ? tol : null };
}

/**
 * Peso usado como base de comparação contra o peso aferido (líquido).
 * Precedência: carta de traço > peso calculado pelos itens da NF > peso_nf gravado.
 */
export function pesoNfReferencia(
  p: PesagemRef,
  resolver?: ResolvedorDensidade,
  densidadeCarta?: number | null,
): PesoNfReferencia {
  const carta = pesoCartaTraco(p);
  if (carta.kg != null) {
    return { kg: carta.kg, origem: "carta_traco", parcial: false, tol: carta.tol };
  }
  if (Array.isArray(p?.itens_nf) && p.itens_nf.length > 0) {
    const calc = calcularPesoNfDaPesagem(p, resolver, densidadeCarta);
    if (calc.totalKg != null && calc.totalKg > 0) {
      return { kg: calc.totalKg, origem: "calculado", parcial: calc.parcial };
    }
  }
  const bruto = paraNumero(p?.peso_nf ?? null);
  if (bruto != null && bruto > 0) return { kg: bruto, origem: "nf", parcial: false };
  return { kg: null, origem: "nenhum", parcial: false };
}


/* ──────────────────────────────────────────────────────────────
 * Diagnóstico de unidade suspeita
 * Quando o peso declarado pelos itens estoura o peso aferido em várias vezes,
 * quase sempre a NF traz a quantidade em KG e o item foi gravado como M3/L/TON.
 * ────────────────────────────────────────────────────────────── */

export type DiagnosticoUnidades = {
  /** Índices (na lista de itens) cuja unidade parece incorreta. */
  indices: number[];
  /** Total atual em kg com as unidades gravadas. */
  totalAtualKg: number;
  /** Total em kg tratando os itens suspeitos como KG. */
  totalCorrigidoKg: number;
  /** Peso aferido usado como âncora. */
  aferidoKg: number;
};

const UNIDADES_VOLUMETRICAS = new Set(["M3", "L", "TON", "SC"]);

/**
 * Detecta itens com unidade provavelmente incorreta comparando o peso
 * declarado com o peso aferido na balança.
 */
export function detectarUnidadesSuspeitas(
  itens: ItemNfBruto[] | null | undefined,
  aferidoKg: number | null | undefined,
): DiagnosticoUnidades | null {
  const lista = Array.isArray(itens) ? itens : [];
  const aferido = paraNumero(aferidoKg ?? null);
  if (!lista.length || aferido == null || aferido <= 0) return null;

  const calc = calcularPesoNf(lista);
  const totalAtual = calc.totalKg ?? 0;
  // Só investiga quando o declarado estoura em pelo menos 3x o aferido.
  if (totalAtual < aferido * 3) return null;

  const candidatos = lista
    .map((item, idx) => ({ idx, item, peso: calc.itens[idx]?.pesoKg ?? 0 }))
    .filter(({ item, peso }) => {
      const un = normalizarUnidade(item.unidade_normalizada ?? item.unidade);
      return UNIDADES_VOLUMETRICAS.has(un) && peso > 0;
    })
    .sort((a, b) => b.peso - a.peso);

  const indices: number[] = [];
  let total = totalAtual;
  for (const c of candidatos) {
    if (total <= aferido * 1.2) break;
    const comoKg = paraNumero(c.item.quantidade ?? null) ?? 0;
    total = total - c.peso + comoKg;
    indices.push(c.idx);
  }

  if (!indices.length) return null;
  // A correção só é sugerida se aproximar o total do aferido de forma relevante.
  const erroAntes = Math.abs(totalAtual - aferido);
  const erroDepois = Math.abs(total - aferido);
  if (erroDepois >= erroAntes * 0.5) return null;

  return { indices, totalAtualKg: totalAtual, totalCorrigidoKg: total, aferidoKg: aferido };
}

/** Aplica a correção sugerida, gravando KG nos itens suspeitos. */
export function aplicarUnidadesCorrigidas(
  itens: ItemNfBruto[] | null | undefined,
  indices: number[],
): ItemNfBruto[] {
  const alvo = new Set(indices);
  return (Array.isArray(itens) ? itens : []).map((item, idx) =>
    alvo.has(idx) ? { ...item, unidade: "KG", unidade_normalizada: "KG" } : item,
  );
}
