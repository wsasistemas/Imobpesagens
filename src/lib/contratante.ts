/** Normalização de contratantes para unificar grafias semelhantes lidas por OCR. */

const SUFIXOS_CONTRATANTE = new Set([
  "LTDA", "ME", "EPP", "EIRELI", "SA", "S A", "CIA", "COMPANHIA",
  "MEI", "SS", "MICROEMPRESA", "MATRIZ", "FILIAL", "S/A",
  "RESIDENCIAL", "CONDOMINIO", "CONDOMINIOS"
]);

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
 * Chave canônica do contratante.
 */
export function chaveContratante(nome?: string | null): string {
  const base = normalizar(nome ?? "");
  if (!base) return "Sem contratante";

  // Remove sufixos societários e termos genéricos (como CONDOMINIO) 
  // do início e do fim para focar no nome principal.
  let partes = base.split(" ");
  
  // Limpeza de prefixos e sufixos repetidamente
  let mudou = true;
  while (mudou && partes.length > 1) {
    mudou = false;
    const prim = partes[0];
    const ult = partes[partes.length - 1];
    
    if (SUFIXOS_CONTRATANTE.has(prim)) {
      partes.shift();
      mudou = true;
    } else if (SUFIXOS_CONTRATANTE.has(ult)) {
      partes.pop();
      mudou = true;
    }
  }
  
  return partes.join(" ") || base;
}

export type ContratanteGrupo = {
  chave: string;
  rotulo: string;
  variantes: string[];
};

/**
 * Constrói o mapa chave → { rótulo de exibição, grafias originais }.
 */
export function construirMapaContratantes(
  registros: Array<{ contratante?: string | null }>,
): Map<string, ContratanteGrupo> {
  const contagem = new Map<string, Map<string, number>>();

  for (const r of registros) {
    const nome = (r.contratante ?? "").trim() || "Sem contratante";
    const chave = chaveContratante(nome);
    if (!contagem.has(chave)) contagem.set(chave, new Map());
    const m = contagem.get(chave)!;
    m.set(nome, (m.get(nome) ?? 0) + 1);
  }

  const out = new Map<string, ContratanteGrupo>();
  for (const [chave, m] of contagem) {
    const variantes = Array.from(m.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    // O rótulo é a grafia mais frequente; empate pela mais completa.
    const rotulo = Array.from(m.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const acA = (a[0].match(/[À-ÿ]/g) ?? []).length;
      const acB = (b[0].match(/[À-ÿ]/g) ?? []).length;
      if (acB !== acA) return acB - acA;
      if (b[0].length !== a[0].length) return b[0].length - a[0].length;
      return a[0].localeCompare(b[0]);
    })[0][0];

    out.set(chave, { chave, rotulo, variantes });
  }
  return out;
}

/** Rótulo unificado para um contratante. */
export function rotuloContratante(
  contratante: string | null | undefined,
  mapa?: Map<string, ContratanteGrupo>,
): string {
  const nome = (contratante ?? "").trim() || "Sem contratante";
  const chave = chaveContratante(nome);
  const g = mapa?.get(chave);
  return g?.rotulo ?? nome;
}

/** Somente dígitos de um CNPJ/CPF. */
function digitos(v?: string | null): string {
  return (v ?? "").replace(/\D+/g, "");
}

export type ObraContratante = { id: string; nome: string; cnpj?: string | null };

export type IdentificacaoObra = {
  obra: ObraContratante | null;
  origem: "cnpj" | "nome" | null;
};

/**
 * Identifica a obra contratante a partir dos campos lidos da nota.
 * Ordem: CNPJ (destinatário/tomador) → razão social normalizada.
 */
export function identificarObraContratante(
  campos: {
    contratante?: string | null;
    destinatario?: string | null;
    tomador?: string | null;
    destinatario_cnpj?: string | null;
    tomador_cnpj?: string | null;
  },
  obras: ObraContratante[],
): IdentificacaoObra {
  const cnpjs = [campos.destinatario_cnpj, campos.tomador_cnpj].map(digitos).filter((d) => d.length >= 11);
  for (const c of cnpjs) {
    const achou = obras.find((o) => digitos(o.cnpj) === c);
    if (achou) return { obra: achou, origem: "cnpj" };
  }

  const nomes = [campos.contratante, campos.destinatario, campos.tomador]
    .map((n) => (n ?? "").trim())
    .filter((n) => n.length > 2);

  for (const nome of nomes) {
    const chave = chaveContratante(nome);
    if (!chave || chave === "Sem contratante") continue;
    const exato = obras.find((o) => chaveContratante(o.nome) === chave);
    if (exato) return { obra: exato, origem: "nome" };
    const parcial = obras.find((o) => {
      const k = chaveContratante(o.nome);
      return k.length >= 4 && (k.includes(chave) || chave.includes(k));
    });
    if (parcial) return { obra: parcial, origem: "nome" };
  }

  return { obra: null, origem: null };
}
