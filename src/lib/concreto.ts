import { paraNumero } from "./unidades";

/** Palavras que indicam matéria-prima (nunca são o volume de concreto da nota). */
const MATERIA_PRIMA = [
  "cimento", "areia", "brita", "pedra", "po de pedra", "agua", "aditivo",
  "fibra", "cal", "argila", "seixo", "pedrisco", "filler", "escoria",
];

export type OrigemVolume = "manual" | "dados_adicionais" | "item_nf" | "indefinido";

export type VolumeDerivado = {
  volume: number | null;
  origem: OrigemVolume;
  detalhe: string;
};

function semAcento(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Volume em m³ declarado no texto dos dados adicionais (ex.: "descarga de 10 m3 de FCK 35"). */
export function extrairVolumeDadosAdicionais(texto?: string | null): number | null {
  const t = semAcento(texto ?? "");
  if (!t) return null;
  const candidatos: number[] = [];
  const re = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:m3|m³|metros?\s*cubicos?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const v = Number(String(m[1]).replace(",", "."));
    if (Number.isFinite(v) && v > 0 && v <= 100) candidatos.push(v);
  }
  if (!candidatos.length) return null;
  // O primeiro volume citado é o da carga ("preparo e descarga de X m3 de ...").
  return candidatos[0];
}

/**
 * Volume da nota, em ordem de prioridade:
 * manual > dados adicionais > item de concreto em m³ (matérias-primas nunca somadas).
 */
export function derivarVolumeNota(input: {
  itens?: { descricao?: string | null; quantidade?: number | string | null; unidade?: string | null }[] | null;
  dadosAdicionais?: string | null;
  volumeManual?: number | string | null;
  /** Volume em m³ devolvido pela leitura da nota (OCR). */
  volumeOcr?: number | string | null;
}): VolumeDerivado {
  const manual = paraNumero(input.volumeManual ?? null);
  if (manual != null && manual > 0) {
    return { volume: manual, origem: "manual", detalhe: "Volume informado manualmente no registro" };
  }

  const doOcr = paraNumero(input.volumeOcr ?? null);
  if (doOcr != null && doOcr > 0) {
    return {
      volume: doOcr,
      origem: "dados_adicionais",
      detalhe: `Volume lido na nota pelo OCR (${doOcr} m³)`,
    };
  }

  const doTexto = extrairVolumeDadosAdicionais(input.dadosAdicionais);
  if (doTexto != null) {
    return {
      volume: doTexto,
      origem: "dados_adicionais",
      detalhe: `Volume lido nos dados adicionais da nota (${doTexto} m³)`,
    };
  }

  const emM3 = (input.itens ?? []).filter((it) => {
    const unit = semAcento(it?.unidade ?? "").replace(/[^a-z0-9²³]/g, "");
    return ["m3", "m³", "mc", "m2", "m²"].includes(unit);
  });
  const concreto = emM3.filter((it) => {
    const d = semAcento(it?.descricao ?? "");
    return !MATERIA_PRIMA.some((k) => d.includes(k));
  });

  if (concreto.length === 1) {
    const v = paraNumero(concreto[0].quantidade ?? null);
    if (v != null && v > 0) {
      return {
        volume: v,
        origem: "item_nf",
        detalhe: `Volume do item de concreto da nota (${v} m³)`,
      };
    }
  }

  return {
    volume: null,
    origem: "indefinido",
    detalhe: emM3.length
      ? "Itens em m³ são matérias-primas — volume da carga não identificado na nota"
      : "Nota sem volume em m³ identificado",
  };
}


export type FornecedorConcreto = {
  id: string;
  nome: string;
  tolerancia_padrao: number;
  emissor_keywords?: string[];
  teor_ar?: number | null;
};

export type TracoConcreto = {
  id: string;
  fornecedor_id: string;
  codigo?: string | null;
  fck?: number | null;
  aplicacao?: string | null;
  slump_nominal?: number | null;
  slump_unidade?: "cm" | "mm";
  densidade_teorica?: number | null;
  densidade_pratica?: number | null;
  tolerancia_peso?: number | null;
  match_keywords?: string[];
  consumo_cimento?: number | null;
  ativo?: boolean | null;
};


export type ValidarConcretoInput = {
  fornecedor: FornecedorConcreto;
  /** Pode vir ausente quando o traço não foi identificado na NF. */
  traco?: TracoConcreto | null;
  volume: number;
  modo: "dupla" | "unica_excecao";
  pesoEntrada: number;
  pesoSaida: number;
  taraInformada?: number | null;
  pesoNF?: number | null;
  /** Líquido já apurado (entrada − saída) do registro; tem prioridade sobre a leitura ao vivo. */
  aferidoDireto?: number | null;
};

export function validarCargaConcreto(input: ValidarConcretoInput) {
  const { fornecedor, traco, volume, modo, pesoEntrada, pesoSaida, taraInformada, pesoNF, aferidoDireto } = input;

  const rho = paraNumero(traco?.densidade_teorica ?? traco?.densidade_pratica ?? null) ?? 0;
  const tol = paraNumero(traco?.tolerancia_peso ?? fornecedor?.tolerancia_padrao ?? null) ?? 4;

  // dupla pesagem (padrão) x pesagem única (exceção)
  const aferidoCalculado = modo === "unica_excecao"
    ? (pesoEntrada - (paraNumero(taraInformada ?? null) ?? 0))
    : (pesoEntrada - pesoSaida);
  const direto = paraNumero(aferidoDireto ?? null);
  const aferido = direto != null && direto > 0 ? direto : aferidoCalculado;

  const esperado = volume * rho;
  const desvioPct = esperado ? ((aferido - esperado) / esperado) * 100 : 0;


  const min = esperado * (1 - tol / 100);
  const max = esperado * (1 + tol / 100);

  const status = aferido < min ? "abaixo" : aferido > max ? "acima" : "conforme";
  const volumeEquiv = rho ? aferido / rho : 0;

  // checagem secundária: peso da NF vs esperado (na pesagem única vira referência de confronto)
  const pesoNFNum = paraNumero(pesoNF ?? null);
  const nfDesvio = (pesoNFNum != null && esperado > 0) ? ((pesoNFNum - esperado) / esperado) * 100 : null;
  const nfFlag = nfDesvio != null && Math.abs(nfDesvio) > tol;

  // pesagem única sempre exige conferência da engenharia se houver divergência
  const requerEngenharia = (modo === "unica_excecao") && (status !== "conforme" || nfFlag);

  return {
    rho,
    tol,
    aferido,
    esperado,
    desvioPct,
    min,
    max,
    status: status as "conforme" | "abaixo" | "acima",
    volumeEquiv,
    difVolume: volumeEquiv - volume,
    nfDesvio,
    nfFlag,
    requerEngenharia,
    volume // Incluído para facilitar uso no frontend
  };
}

const SUFIXOS_SOCIETARIOS = new Set([
  "LTDA", "SA", "S", "A", "ME", "EPP", "EIRELI", "MEI", "CIA", "COMPANHIA",
  "MATRIZ", "FILIAL", "SS", "DO", "DA", "DE", "DOS", "DAS", "E",
]);

/** Normalização agressiva: sem acento, só letras/números, minúsculas. */
function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/** Primeiro nome significativo (ignora sufixos societários e palavras curtas). */
export function primeiroNomeSignificativo(nome: string): string {
  const partes = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1 && !SUFIXOS_SOCIETARIOS.has(p));
  return partes.length ? partes[0].toLowerCase() : "";
}

/**
 * Vincula o emissor da NF a um fornecedor de concreto cadastrado.
 * Prioridade: 1) primeiro nome igual  2) nome contido  3) palavras-chave.
 */
export function casarFornecedorPorEmissor<T extends FornecedorConcreto>(
  emissor: string,
  fornecedores: T[],
): T | undefined {
  const emissorNorm = normalizarTexto(emissor ?? "");
  if (!emissorNorm) return undefined;
  const primEmissor = primeiroNomeSignificativo(emissor);

  // 1) primeiro nome do emissor == primeiro nome do fornecedor
  if (primEmissor.length > 2) {
    const porPrimeiroNome = fornecedores.find(
      (f) => primeiroNomeSignificativo(f.nome) === primEmissor,
    );
    if (porPrimeiroNome) return porPrimeiroNome;

    // 1b) primeiro nome do fornecedor aparece no início do emissor
    const porPrefixo = fornecedores.find((f) => {
      const p = primeiroNomeSignificativo(f.nome);
      return p.length > 3 && (primEmissor.startsWith(p) || p.startsWith(primEmissor));
    });
    if (porPrefixo) return porPrefixo;
  }

  // 2) nome completo contido (em qualquer direção)
  const porNome = fornecedores.find((f) => {
    const nomeNorm = normalizarTexto(f.nome);
    return nomeNorm.length > 3 && (emissorNorm.includes(nomeNorm) || nomeNorm.includes(emissorNorm));
  });
  if (porNome) return porNome;

  // 3) palavras-chave cadastradas (aceita entradas com múltiplas palavras)
  return fornecedores.find((f) =>
    (f.emissor_keywords ?? []).some((k) => {
      const kNorm = normalizarTexto(k);
      if (kNorm.length > 3 && emissorNorm.includes(kNorm)) return true;
      // entrada gravada como "SUPERMIX SUPERMIX CONCRETO" -> testa cada palavra
      return String(k)
        .split(/\s+/)
        .map(normalizarTexto)
        .some((t) => t.length > 3 && emissorNorm.includes(t));
    }),
  );
}

/** Slump declarado na descrição da NF: "D.12+-2", "SL.10", "SLUMP 14". */
export function extrairSlumpDescricao(descricao: string): number | null {
  const t = (descricao ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const m =
    t.match(/D\.?\s?(\d{1,3})\s?(?:\+-|±|\+\/-)/) ??
    t.match(/\bSL\.?\s?(\d{1,3})\b/) ??
    t.match(/\bSLUMP\s?\.?\s?(\d{1,3})\b/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Normaliza slump para cm (cartas gravam 10/12/14 cm ou 100/120/140 mm). */
function slumpEmCm(valor?: number | null, unidade?: string | null): number | null {
  const v = valor == null ? null : Number(valor);
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  if ((unidade ?? "").toLowerCase() === "mm" || v >= 60) return v / 10;
  return v;
}

export function identificarConcreto(
  emissor: string,
  descricaoItem: string,
  fornecedores: (FornecedorConcreto & { tracos: TracoConcreto[] })[],
  dadosConcretoOcr?: { fck?: number; slump_nominal?: number; slump_unidade?: string }
) {
  const descNormal = (descricaoItem ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Tenta achar fornecedor pelo emissor
  const fornecedor = casarFornecedorPorEmissor(emissor, fornecedores);
  
  // Se não achar o fornecedor, tentaremos o fallback PADRÃO depois se tivermos dados técnicos
  const fornecedorPadrao = fornecedores.find(f => f.nome.toUpperCase() === "PADRÃO");

  const fckMatch = descNormal.match(/tc\.?\s?(\d{2})|(?:^|[^a-z])c(\d{2})\b|fck\s?\.?\s?(\d{2})|fck(\d{2})/i);
  const fckVal = fckMatch ? (fckMatch[1] || fckMatch[2] || fckMatch[3] || fckMatch[4]) : null;
  const fckAlvo = dadosConcretoOcr?.fck != null ? Number(dadosConcretoOcr.fck) : (fckVal ? Number(fckVal) : null);

  const slumpOcr = slumpEmCm(dadosConcretoOcr?.slump_nominal ?? null, dadosConcretoOcr?.slump_unidade ?? null);
  const slumpAlvo = slumpOcr ?? slumpEmCm(extrairSlumpDescricao(descricaoItem), null);

  const buscarTracoEmLista = (listaTracos: TracoConcreto[]) => {
    const tracosAtivos = listaTracos.filter((t) => t.ativo !== false);
    
    const casaKeyword = (t: TracoConcreto) =>
      (t.match_keywords ?? []).some((k) => {
        const kNormal = String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
        return kNormal.length > 1 && descNormal.includes(kNormal);
      });

    const mesmoFck = (t: TracoConcreto) =>
      fckAlvo == null || (t.fck != null && Number(t.fck) === fckAlvo);

    const mesmoSlump = (t: TracoConcreto) => {
      if (slumpAlvo == null) return false;
      const s = slumpEmCm(t.slump_nominal ?? null, t.slump_unidade ?? null);
      return s != null && Math.abs(s - slumpAlvo) <= 1;
    };

    let traco: TracoConcreto | undefined;

    if (slumpAlvo != null) {
      const candidatos = tracosAtivos.filter((t) => mesmoFck(t) && mesmoSlump(t));
      traco = candidatos.find(casaKeyword) ?? candidatos[0];

      if (!traco) {
        const porFck = tracosAtivos
          .filter((t) => mesmoFck(t) && slumpEmCm(t.slump_nominal ?? null, t.slump_unidade ?? null) != null)
          .sort((a, b) =>
            Math.abs((slumpEmCm(a.slump_nominal, a.slump_unidade) ?? 0) - slumpAlvo) -
            Math.abs((slumpEmCm(b.slump_nominal, b.slump_unidade) ?? 0) - slumpAlvo),
          );
        traco = porFck[0];
      }
    }

    if (!traco) traco = tracosAtivos.filter(mesmoFck).find(casaKeyword);
    if (!traco) traco = tracosAtivos.find(casaKeyword);
    if (!traco && fckAlvo != null) traco = tracosAtivos.find(mesmoFck);

    return traco;
  };

  // Prioridade 1: Traço do fornecedor identificado
  let tracoFinal: TracoConcreto | undefined;
  let fornecedorFinal = fornecedor;
  let isPadraoFallback = false;

  if (fornecedor) {
    tracoFinal = buscarTracoEmLista(fornecedor.tracos || []);
  }

  // Prioridade 2: Fallback para o fornecedor PADRÃO se o traço não foi achado no fornecedor ou se o fornecedor nem foi achado
  if (!tracoFinal && fornecedorPadrao && (fckAlvo != null || slumpAlvo != null)) {
    tracoFinal = buscarTracoEmLista(fornecedorPadrao.tracos || []);
    if (tracoFinal) {
      isPadraoFallback = true;
      // Se não achamos fornecedor nenhum, usamos o PADRÃO como base de cálculo
      if (!fornecedorFinal) fornecedorFinal = fornecedorPadrao;
    }
  }

  if (!fornecedorFinal) return null;

  return { 
    fornecedor: fornecedorFinal, 
    traco: tracoFinal,
    isPadraoFallback
  };
}
