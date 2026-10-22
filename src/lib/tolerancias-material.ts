import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Condicao = "seco" | "umido" | "na";

export type Categoria = {
  id: string;
  nome: string;
  condicao: Condicao;
  tolerancia: number; // ± %
  keywords: string[];
};

export type FornecedorMaterial = {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
};

export type OverrideTolerancia = {
  id: string;
  fornecedor_id: string;
  tolerancia_material_id: string;
  tolerancia: number;
};

// Fallback usado apenas se a query ainda não terminou o primeiro fetch.
export const CATEGORIAS_FALLBACK: Categoria[] = [
  { id: "outros", nome: "Outros", condicao: "na", tolerancia: 3, keywords: [] },
];

const QUERY_KEY = ["tolerancias_material"] as const;
const QUERY_KEY_FORN = ["fornecedores_material"] as const;
const QUERY_KEY_OVER = ["tolerancias_fornecedor"] as const;
const LEGACY_STORAGE_KEY = "imobpesagens.tolerancias.v1";

type Row = {
  id: string;
  categoria: string;
  condicao: Condicao;
  palavras_chave: string;
  tolerancia_pct: number;
};

function rowToCategoria(r: Row): Categoria {
  return {
    id: r.id,
    nome: r.categoria || "Sem Categoria",
    condicao: r.condicao,
    tolerancia: Number(r.tolerancia_pct) || 0,
    keywords: (r.palavras_chave ?? "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
  };
}

function categoriaToRow(c: Partial<Categoria>): Partial<Row> {
  const row: Partial<Row> = {};
  if (c.nome !== undefined) row.categoria = c.nome;
  if (c.condicao !== undefined) row.condicao = c.condicao;
  if (c.tolerancia !== undefined) row.tolerancia_pct = c.tolerancia;
  if (c.keywords !== undefined) row.palavras_chave = c.keywords.join(", ");
  return row;
}

const stripAcentos = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Normaliza nome de fornecedor para comparação (sem acento, caixa alta, espaços colapsados). */
export function chaveNomeFornecedor(nome?: string | null): string {
  return stripAcentos((nome ?? "").toUpperCase())
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectarCondicao(descricao: string | null | undefined): Condicao | null {
  const d = stripAcentos((descricao ?? "").toLowerCase());
  if (/\b(umido|molhado|chuva)\b/.test(d)) return "umido";
  if (/\bseco\b/.test(d)) return "seco";
  return null;
}

/**
 * Classifica uma descrição em (categoria + condição).
 * - Detecta categoria pela primeira linha cujas keywords casem (case/acento insensível).
 * - Detecta condição por palavras na descrição.
 * - Se a categoria tem variação Seco/Úmido e a condição não foi detectada, usa Seco (mais conservadora).
 * - Sem match → "Outros".
 */
export function categorizar(descricao: string | null | undefined, cats: Categoria[]): Categoria {
  const safeCats = Array.isArray(cats) ? cats : [];
  const d = stripAcentos((descricao ?? "").toLowerCase());
  const condicao = detectarCondicao(descricao ?? "");

  // Agrupa por nome de categoria (independente de acento/case).
  const grupos = new Map<string, Categoria[]>();
  for (const c of safeCats) {
    const chave = stripAcentos((c.nome || "").toLowerCase());
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(c);
  }

  // Percorre categorias na ordem original tentando casar keywords.
  for (const c of safeCats) {
    const keywords = Array.isArray(c.keywords) ? c.keywords : [];
    const hit = keywords.some((k) => k && d.includes(stripAcentos(k.toLowerCase())));
    if (!hit) continue;
    const chave = stripAcentos((c.nome || "").toLowerCase());
    const linhas = grupos.get(chave) ?? [c];
    // Categoria sem umidade: retorna a linha 'na' se existir, senão a primeira.
    const na = linhas.find((l) => l.condicao === "na");
    if (na) return na;
    if (condicao === "umido") return linhas.find((l) => l.condicao === "umido") ?? linhas[0];
    // Seco por padrão quando a categoria tem variação.
    return linhas.find((l) => l.condicao === "seco") ?? linhas[0];
  }

  const outros =
    safeCats.find((c) => stripAcentos((c.nome || "").toLowerCase()) === "outros") ??
    safeCats[safeCats.length - 1];
  return outros ?? CATEGORIAS_FALLBACK[0];
}

/**
 * Regra de herança: tolerância aplicada = override(fornecedor, material) ?? padrão(material).
 */
export function resolverTolerancia(
  categoria: Categoria | null | undefined,
  fornecedorNome: string | null | undefined,
  fornecedores: FornecedorMaterial[],
  overrides: OverrideTolerancia[],
): number | null {
  if (!categoria) return null;
  const chave = chaveNomeFornecedor(fornecedorNome);
  if (chave) {
    const forn = fornecedores.find((f) => chaveNomeFornecedor(f.nome) === chave);
    if (forn) {
      const ov = overrides.find(
        (o) => o.fornecedor_id === forn.id && o.tolerancia_material_id === categoria.id,
      );
      if (ov) return Number(ov.tolerancia);
    }
  }
  return categoria.tolerancia;
}

async function fetchTolerancias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("tolerancias_material")
    .select("id, categoria, condicao, palavras_chave, tolerancia_pct")
    .order("categoria", { ascending: true })
    .order("condicao", { ascending: true });
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToCategoria);
}

export function useTolerancias() {
  const qc = useQueryClient();

  // Limpeza silenciosa da chave antiga do localStorage.
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(LEGACY_STORAGE_KEY)) {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTolerancias,
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const atualizarMut = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Categoria> }) => {
      const { error } = await supabase
        .from("tolerancias_material")
        .update(categoriaToRow(args.patch))
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removerMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tolerancias_material").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const adicionarMut = useMutation({
    mutationFn: async (dados: Partial<Categoria>) => {
      const { error } = await supabase.from("tolerancias_material").insert({
        categoria: dados.nome || "Nova categoria",
        condicao: dados.condicao || "seco",
        palavras_chave: dados.keywords?.join(", ") || "",
        tolerancia_pct: dados.tolerancia ?? 3,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    categorias: data ?? CATEGORIAS_FALLBACK,
    atualizar: (id: string, patch: Partial<Categoria>) => atualizarMut.mutate({ id, patch }),
    remover: (id: string) => removerMut.mutate(id),
    adicionar: (dados: Partial<Categoria> = {}) => adicionarMut.mutate(dados),
  };
}

async function fetchFornecedoresMaterial(): Promise<FornecedorMaterial[]> {
  const { data, error } = await supabase
    .from("fornecedores_material")
    .select("id, nome, cnpj, ativo")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FornecedorMaterial[];
}

async function fetchOverrides(): Promise<OverrideTolerancia[]> {
  const { data, error } = await supabase
    .from("tolerancias_fornecedor")
    .select("id, fornecedor_id, tolerancia_material_id, tolerancia");
  if (error) throw error;
  return (data ?? []).map((o) => ({ ...o, tolerancia: Number(o.tolerancia) })) as OverrideTolerancia[];
}

/** Fornecedores de material vinculados + seus overrides de tolerância. */
export function useToleranciasFornecedor() {
  const qc = useQueryClient();

  const fornecedoresQ = useQuery({
    queryKey: QUERY_KEY_FORN,
    queryFn: fetchFornecedoresMaterial,
    staleTime: 60_000,
  });

  const overridesQ = useQuery({
    queryKey: QUERY_KEY_OVER,
    queryFn: fetchOverrides,
    staleTime: 60_000,
  });

  const invalidateForn = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEY_FORN });
    qc.invalidateQueries({ queryKey: QUERY_KEY_OVER });
  };
  const invalidateOver = () => qc.invalidateQueries({ queryKey: QUERY_KEY_OVER });

  const vincularMut = useMutation({
    mutationFn: async (dados: { nome: string; cnpj?: string | null }) => {
      const { data, error } = await supabase
        .from("fornecedores_material")
        .insert({ nome: dados.nome.trim(), cnpj: dados.cnpj?.trim() || null })
        .select("id, nome, cnpj, ativo")
        .single();
      if (error) throw error;
      return data as FornecedorMaterial;
    },
    onSuccess: invalidateForn,
  });

  const desvincularMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores_material").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateForn,
  });

  const definirOverrideMut = useMutation({
    mutationFn: async (args: { fornecedorId: string; materialId: string; tolerancia: number }) => {
      const { error } = await supabase
        .from("tolerancias_fornecedor")
        .upsert(
          {
            fornecedor_id: args.fornecedorId,
            tolerancia_material_id: args.materialId,
            tolerancia: args.tolerancia,
          },
          { onConflict: "fornecedor_id,tolerancia_material_id" },
        );
      if (error) throw error;
    },
    onSuccess: invalidateOver,
  });

  const removerOverrideMut = useMutation({
    mutationFn: async (args: { fornecedorId: string; materialId: string }) => {
      const { error } = await supabase
        .from("tolerancias_fornecedor")
        .delete()
        .eq("fornecedor_id", args.fornecedorId)
        .eq("tolerancia_material_id", args.materialId);
      if (error) throw error;
    },
    onSuccess: invalidateOver,
  });

  return {
    fornecedores: fornecedoresQ.data ?? [],
    overrides: overridesQ.data ?? [],
    carregando: fornecedoresQ.isLoading || overridesQ.isLoading,
    vincular: (dados: { nome: string; cnpj?: string | null }) => vincularMut.mutateAsync(dados),
    desvincular: (id: string) => desvincularMut.mutateAsync(id),
    definirOverride: (fornecedorId: string, materialId: string, tolerancia: number) =>
      definirOverrideMut.mutateAsync({ fornecedorId, materialId, tolerancia }),
    removerOverride: (fornecedorId: string, materialId: string) =>
      removerOverrideMut.mutateAsync({ fornecedorId, materialId }),
  };
}
