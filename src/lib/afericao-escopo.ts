// Critério único de "registro contabilizável" nas análises (conferência,
// fechamento mensal e indicadores do dashboard).
//
// Regra: entram registros concluídos OU fechados com ocorrência, desde que
// tenham pesagem de entrada e saída (líquido apurável).
// Registros sem pesagem de saída ficam fora — o líquido seria nulo e a
// diferença apurada (~ -100%) contaminaria médias e Impacto R$.

type Escopo = {
  status?: string | null;
  peso_entrada?: number | string | null;
  peso_saida?: number | string | null;
  peso_liquido?: number | string | null;
  peso_nf?: number | string | null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Status que representam uma operação encerrada (com ou sem ocorrência). */
export function statusEncerrado(p: Escopo): boolean {
  return p.status === "concluida" || p.status === "fechada_com_ocorrencia";
}

/** Fechado com ocorrência (usado apenas para sinalização visual). */
export function fechadoComOcorrencia(p: Escopo): boolean {
  return p.status === "fechada_com_ocorrencia";
}

/** Sem pesagem de saída → líquido não apurável. */
export function semSaidaApurada(p: Escopo): boolean {
  const liquido = num(p.peso_liquido);
  if (liquido != null && liquido > 0) return false;
  return num(p.peso_entrada) == null || num(p.peso_saida) == null;
}

/** Predicado principal: o registro entra nas apurações? */
export function contabilizavelNaConferencia(p: Escopo): boolean {
  return statusEncerrado(p) && !semSaidaApurada(p);
}

/** Encerrados que ficaram fora por falta de pesagem de saída. */
export function excluidosSemSaida<T extends Escopo>(lista: T[]): T[] {
  return lista.filter((p) => statusEncerrado(p) && semSaidaApurada(p));
}
