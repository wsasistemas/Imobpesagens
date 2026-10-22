// Unificação de fornecedores: o mesmo emissor pode vir grafado de formas
// diferentes nas notas (acentos, traços, sufixos societários). Aqui geramos uma
// chave canônica usada apenas para agrupar — o dado gravado na nota não muda.

const SUFIXOS = new Set([
  "LTDA", "ME", "EPP", "EIRELI", "SA", "S A", "CIA", "COMPANHIA",
  "MEI", "SS", "MICROEMPRESA", "MATRIZ", "FILIAL",
]);

export const SEM_FORNECEDOR = "Sem emissor";

/** Normaliza texto: maiúsculas, sem acento, pontuação vira espaço. */
function normalizar(txt: string): string {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Chave canônica do fornecedor. Se houver CNPJ, a raiz (8 dígitos) tem
 * prioridade sobre o nome.
 */
export function chaveFornecedor(emissor?: string | null, cnpj?: string | null): string {
  const digitos = (cnpj ?? "").replace(/\D/g, "");
  if (digitos.length >= 8) return `CNPJ:${digitos.slice(0, 8)}`;

  const base = normalizar(emissor ?? "");
  if (!base) return SEM_FORNECEDOR;

  // Remove sufixos societários repetidos no fim ("... S A LTDA").
  let partes = base.split(" ");
  while (partes.length > 1) {
    const ult = partes[partes.length - 1];
    const penUlt = partes.length > 1 ? `${partes[partes.length - 2]} ${ult}` : "";
    if (SUFIXOS.has(penUlt)) { partes = partes.slice(0, -2); continue; }
    if (SUFIXOS.has(ult)) { partes = partes.slice(0, -1); continue; }
    break;
  }
  const semSufixo = partes.join(" ");
  return semSufixo || base;
}

export type FornecedorGrupo = {
  chave: string;
  rotulo: string;
  variantes: string[];
  cnpj: string | null;
};

/**
 * Constrói o mapa chave → { rótulo de exibição, grafias originais }.
 * O rótulo é a grafia mais frequente; empate resolve pela mais completa
 * (mais longa / com acentos).
 */
export function construirMapaFornecedores(
  registros: Array<{ emissor?: string | null; emissor_cnpj?: string | null }>,
): Map<string, FornecedorGrupo> {
  const contagem = new Map<string, Map<string, number>>();
  const cnpjs = new Map<string, Set<string>>();

  for (const r of registros) {
    const nome = (r.emissor ?? "").trim() || SEM_FORNECEDOR;
    const chave = chaveFornecedor(nome, r.emissor_cnpj);
    if (!contagem.has(chave)) contagem.set(chave, new Map());
    const m = contagem.get(chave)!;
    m.set(nome, (m.get(nome) ?? 0) + 1);

    if (r.emissor_cnpj) {
      if (!cnpjs.has(chave)) cnpjs.set(chave, new Set());
      cnpjs.get(chave)!.add(r.emissor_cnpj.replace(/\D/g, ""));
    }
  }

  const out = new Map<string, FornecedorGrupo>();
  for (const [chave, m] of contagem) {
    const variantes = Array.from(m.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const rotulo = Array.from(m.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const acA = (a[0].match(/[À-ÿ]/g) ?? []).length;
      const acB = (b[0].match(/[À-ÿ]/g) ?? []).length;
      if (acB !== acA) return acB - acA;
      if (b[0].length !== a[0].length) return b[0].length - a[0].length;
      return a[0].localeCompare(b[0]);
    })[0][0];

    const cnpjSet = cnpjs.get(chave);
    const cnpj = cnpjSet && cnpjSet.size > 0 ? Array.from(cnpjSet)[0] : null;

    out.set(chave, { chave, rotulo, variantes, cnpj });
  }
  return out;
}

/** Rótulo unificado para um emissor, usando o mapa quando disponível. */
export function rotuloFornecedor(
  emissor: string | null | undefined,
  mapa?: Map<string, FornecedorGrupo>,
): string {
  const nome = (emissor ?? "").trim() || SEM_FORNECEDOR;
  const g = mapa?.get(chaveFornecedor(nome));
  return g?.rotulo ?? nome;
}
