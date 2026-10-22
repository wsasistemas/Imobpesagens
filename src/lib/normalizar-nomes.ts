/** Normalização de nomes de pessoas jurídicas lidos por OCR (emissor, contratante, etc.). */

/** Remove ruído de OCR: espaços duplicados, pontuação solta nas bordas e caixa mista. */
export function normalizarNomeEmpresa(valor?: string | null): string {
  if (!valor) return "";
  return String(valor)
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:/\-–—|]+/, "")
    .replace(/[\s.,;:/\-–—|]+$/, "")
    .replace(/\s*([./])\s*/g, "$1") // "S / A" -> "S/A"
    .trim()
    .toUpperCase();
}

/** Aplica a normalização somente quando houver conteúdo, preservando undefined. */
export function normalizarNomeOpcional(valor?: string | null): string | undefined {
  const n = normalizarNomeEmpresa(valor);
  return n ? n : undefined;
}
