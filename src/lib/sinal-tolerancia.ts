import { categorizar } from "@/lib/tolerancias-material";
import {
  resolverToleranciaDaPesagem,
  type FornecedorMaterial,
  type OverrideTolerancia,
  type ToleranciaPadrao,
} from "@/lib/tolerancias-heranca";

export type SinalTolerancia = {
  /** "acima" = falta de peso além da tolerância; "ok" = dentro/sobra; null = sem base */
  chave: "acima" | "ok" | "aguardando" | "sem_base";
  rotulo: string;
  esperado: number | null;
  aferido: number | null;
  difKg: number | null;
  difPct: number | null;
  tolPct: number | null;
  origem: string | null;
};

const numOuNull = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(String(v).replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

export type CtxSinal = {
  categorias: ToleranciaPadrao[];
  fornecedores: FornecedorMaterial[];
  overrides: OverrideTolerancia[];
  /** traco_id → tolerância cadastrada na carta */
  tolPorTraco: Map<string, number>;
  fallbackPct?: number;
};

/**
 * Sinal de tolerância de um registro fechado (entrada + saída).
 * Base do esperado: carta de traço (peso_esperado) ou peso/qtd da NF.
 * Convenção do projeto: |dif%| > tolerância e dif negativa (falta) → ACIMA DA TOLERÂNCIA.
 * Sobra (dif positiva) é tratada como OK.
 */
export function sinalTolerancia(
  p: any,
  ctx: CtxSinal,
  pesoNfKg: number | null,
): SinalTolerancia {
  const vazio = (chave: SinalTolerancia["chave"], rotulo: string): SinalTolerancia => ({
    chave,
    rotulo,
    esperado: null,
    aferido: null,
    difKg: null,
    difPct: null,
    tolPct: null,
    origem: null,
  });

  const fechada = p?.status === "concluida" || p?.status === "fechada_com_ocorrencia";
  const entrada = numOuNull(p?.peso_entrada);
  const saida = numOuNull(p?.peso_saida);
  if (!fechada || entrada == null || saida == null) return vazio("aguardando", "Aguardando saída");

  const aferido = numOuNull(p?.peso_liquido) ?? Math.abs(entrada - saida);

  const ap = p?.resultado_afericao && typeof p.resultado_afericao === "object" ? p.resultado_afericao : null;
  const esperadoCarta = numOuNull(p?.peso_esperado) ?? numOuNull(ap?.esperado);
  const temCarta = !!p?.traco_id || p?.base_calculo === "carta_traco";
  const esperado = temCarta && esperadoCarta != null ? esperadoCarta : (pesoNfKg ?? esperadoCarta);

  if (esperado == null || esperado <= 0 || aferido == null) {
    return vazio("sem_base", "Sem base de comparação");
  }

  const carta = p?.traco_id ? (ctx.tolPorTraco.get(String(p.traco_id)) ?? null) : null;
  const tol = resolverToleranciaDaPesagem(p, {
    categorias: ctx.categorias,
    fornecedores: ctx.fornecedores,
    overrides: ctx.overrides,
    fornecedorNome: p?.emissor ?? null,
    fallbackPct: ctx.fallbackPct ?? 2,
    toleranciaCarta: carta,
    categorizar: categorizar as any,
  });

  const difKg = aferido - esperado;
  const difPct = (difKg / esperado) * 100;
  const acima = difPct < -Math.abs(tol.pct);

  return {
    chave: acima ? "acima" : "ok",
    rotulo: acima ? "Acima da Tolerância" : "Dentro da tolerância",
    esperado,
    aferido,
    difKg,
    difPct,
    tolPct: tol.pct,
    origem: tol.rotulo,
  };
}
