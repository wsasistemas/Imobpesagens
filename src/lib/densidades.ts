import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UnidadeBase = "M3" | "L" | "SC";

export type DensidadeMaterial = {
  id: string;
  material: string;
  palavras_chave: string[];
  unidade_base: UnidadeBase;
  densidade: number;
  ordem: number;
  ativo: boolean;
};

export type DensidadeFornecedor = {
  id: string;
  densidade_material_id: string;
  fornecedor_nome: string;
  densidade: number;
};

export type OrigemDensidade = "fornecedor" | "cadastro" | "interna";

export type DensidadeResolvida = {
  valor: number;
  origem: OrigemDensidade;
  material?: string;
  fornecedor?: string;
};

function semAcento(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function normNome(s: string): string {
  return semAcento(s).replace(/[^A-Z0-9]/g, "");
}

/** Regra do cadastro que casa com a descrição (todas as palavras-chave contidas). */
function casarRegra(
  regras: DensidadeMaterial[],
  descricao: string | null | undefined,
  unidade: UnidadeBase,
): DensidadeMaterial | null {
  const d = semAcento(String(descricao ?? ""));
  if (!d) return null;
  const candidatas = regras
    .filter((r) => r.ativo && r.unidade_base === unidade)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  for (const r of candidatas) {
    const palavras = (r.palavras_chave ?? []).map(semAcento).filter(Boolean);
    if (!palavras.length) continue;
    if (palavras.every((p) => d.includes(p))) return r;
  }
  return null;
}

/**
 * Precedência: exceção do fornecedor > densidade padrão do material (cadastro).
 * A densidade da carta de traço é aplicada antes (fora daqui) e a tabela interna
 * de `unidades.ts` continua como último recurso.
 */
export function resolverDensidade(
  catalogo: {
    regras: DensidadeMaterial[];
    excecoes?: DensidadeFornecedor[];
    fornecedorNome?: string | null;
  },
  descricao: string | null | undefined,
  unidade: UnidadeBase,
): DensidadeResolvida | null {
  const regra = casarRegra(catalogo.regras ?? [], descricao, unidade);
  if (!regra) return null;

  const forn = normNome(catalogo.fornecedorNome ?? "");
  if (forn) {
    const exc = (catalogo.excecoes ?? []).find(
      (e) =>
        e.densidade_material_id === regra.id &&
        (() => {
          const n = normNome(e.fornecedor_nome);
          return n.length > 2 && (forn.includes(n) || n.includes(forn));
        })(),
    );
    if (exc && Number(exc.densidade) > 0) {
      return {
        valor: Number(exc.densidade),
        origem: "fornecedor",
        material: regra.material,
        fornecedor: exc.fornecedor_nome,
      };
    }
  }

  if (Number(regra.densidade) > 0) {
    return { valor: Number(regra.densidade), origem: "cadastro", material: regra.material };
  }
  return null;
}

/** Cria o resolvedor injetado em `calcularPesoItem` / `calcularPesoNf`. */
export function criarResolvedorDensidade(
  regras: DensidadeMaterial[] | undefined,
  excecoes: DensidadeFornecedor[] | undefined,
  fornecedorNome?: string | null,
) {
  if (!regras?.length) return undefined;
  return (descricao: string | null | undefined, unidade: string) => {
    if (unidade !== "M3" && unidade !== "L" && unidade !== "SC") return null;
    return resolverDensidade({ regras, excecoes, fornecedorNome }, descricao, unidade);
  };
}

/* ----------------------------- dados (hooks) ----------------------------- */

/** Nomes de fornecedores cadastrados, para sugestão no vínculo de densidade. */
export function useFornecedoresSugestoes() {
  return useQuery({
    queryKey: ["densidades-fornecedores-sugestoes"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("fornecedores_material_v2")
        .select("razao_social")
        .eq("ativo", true)
        .order("razao_social", { ascending: true });
      if (error) throw error;
      const nomes = (data ?? []).map((f) => String(f.razao_social ?? "").trim()).filter(Boolean);
      return Array.from(new Set(nomes));
    },
    staleTime: 5 * 60 * 1000,
  });
}


export function useDensidades() {
  const qc = useQueryClient();

  const materiais = useQuery({
    queryKey: ["densidades-material"],
    queryFn: async (): Promise<DensidadeMaterial[]> => {
      const { data, error } = await supabase
        .from("densidades_material")
        .select("id, material, palavras_chave, unidade_base, densidade, ordem, ativo")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...d,
        palavras_chave: (d.palavras_chave ?? []) as string[],
        unidade_base: (d.unidade_base ?? "M3") as UnidadeBase,
        densidade: Number(d.densidade),
        ordem: Number(d.ordem ?? 100),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const excecoes = useQuery({
    queryKey: ["densidades-fornecedor"],
    queryFn: async (): Promise<DensidadeFornecedor[]> => {
      const { data, error } = await supabase
        .from("densidades_fornecedor")
        .select("id, densidade_material_id, fornecedor_nome, densidade")
        .order("fornecedor_nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, densidade: Number(d.densidade) }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["densidades-material"] });
    qc.invalidateQueries({ queryKey: ["densidades-fornecedor"] });
  };

  const salvarMaterial = useMutation({
    mutationFn: async (m: Partial<DensidadeMaterial>): Promise<string> => {
      const payload = {
        material: String(m.material ?? "").trim(),
        palavras_chave: (m.palavras_chave ?? []).map((p) => p.trim()).filter(Boolean),
        unidade_base: m.unidade_base ?? "M3",
        densidade: Number(m.densidade ?? 0),
        ordem: Number(m.ordem ?? 100),
        ativo: m.ativo ?? true,
      };
      if (m.id) {
        const { error } = await supabase.from("densidades_material").update(payload).eq("id", m.id);
        if (error) throw error;
        return m.id;
      }
      const { data, error } = await supabase
        .from("densidades_material")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data!.id as string;
    },
    onSuccess: invalidar,
  });

  const removerMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("densidades_material").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const salvarExcecao = useMutation({
    mutationFn: async (e: { id?: string; densidade_material_id: string; fornecedor_nome: string; densidade: number }) => {
      const payload = {
        densidade_material_id: e.densidade_material_id,
        fornecedor_nome: e.fornecedor_nome.trim(),
        densidade: Number(e.densidade),
      };
      if (e.id) {
        const { error } = await supabase.from("densidades_fornecedor").update(payload).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("densidades_fornecedor").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: invalidar,
  });

  const removerExcecao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("densidades_fornecedor").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return {
    materiais: materiais.data ?? [],
    excecoes: excecoes.data ?? [],
    isLoading: materiais.isLoading || excecoes.isLoading,
    salvarMaterial,
    removerMaterial,
    salvarExcecao,
    removerExcecao,
  };
}

/**
 * Resolvedor de densidade por fornecedor, pronto para uso no cálculo do
 * "Declarado NF" — garante que grid, KPIs e memória de cálculo usem
 * exatamente a mesma densidade (cadastro + exceção do fornecedor).
 */
export function useResolvedorDensidadePorFornecedor() {
  const { materiais, excecoes } = useDensidades();
  return useMemo(
    () => (fornecedorNome?: string | null) =>
      criarResolvedorDensidade(materiais, excecoes, fornecedorNome),
    [materiais, excecoes],
  );
}
