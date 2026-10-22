import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const erroTolerancia = (e: any) => {
  const msg = String(e?.message ?? e ?? "");
  if (/row-level security|permission|not authorized|policy/i.test(msg)) {
    toast.error("Sem permissão para alterar a tabela padrão de tolerâncias.");
  } else {
    toast.error("Não foi possível salvar a alteração.", { description: msg });
  }
};

export type Condicao = "Seco" | "Úmido";

export type ToleranciaPadrao = {
  id: string;
  categoria: string;
  condicao: Condicao;
  tolerancia: number;
  palavras_chave: string;
  created_at: string;
};

export type FornecedorMaterial = {
  id: string;
  razao_social: string;
  cnpj: string | null;
  created_at: string;
  created_by: string | null;
  created_by_nome: string | null;
  ativo: boolean;
  origem: "lista" | "manual";
  vinculado: boolean;
  updated_at: string;
};

export type OverrideTolerancia = {
  id: string;
  fornecedor_id: string;
  tolerancia_padrao_id: string;
  tolerancia: number;
};

const KEY_PADRAO = ["tolerancias_padrao"] as const;
const KEY_FORNECEDORES = ["fornecedores_material_v2"] as const;
const KEY_OVERRIDES = ["tolerancias_fornecedor_v2"] as const;

const stripAcentos = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Normaliza nome de fornecedor para comparação (sem acento, caixa alta, espaços colapsados). */
export function chaveNomeFornecedor(nome?: string | null): string {
  return stripAcentos((nome ?? "").toUpperCase())
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Regra de herança: tolerância aplicada = override(fornecedor, material) ?? padrão(material).
 */
export function resolverTolerancia(
  categoria: ToleranciaPadrao | null | undefined,
  fornecedorNome: string | null | undefined,
  fornecedores: FornecedorMaterial[],
  overrides: OverrideTolerancia[],
): number | null {
  if (!categoria) return null;
  const chave = chaveNomeFornecedor(fornecedorNome);
  if (chave) {
    const forn = fornecedores.find((f) => chaveNomeFornecedor(f.razao_social) === chave);
    if (forn) {
      const ov = overrides.find(
        (o) => o.fornecedor_id === forn.id && o.tolerancia_padrao_id === categoria.id,
      );
      if (ov) return Number(ov.tolerancia);
    }
  }
  return categoria.tolerancia;
}

export type OrigemTolerancia = "carta_traco" | "fornecedor" | "padrao" | "geral";

export type ToleranciaResolvida = {
  pct: number;
  origem: OrigemTolerancia;
  rotulo: string;
};

type PesagemTolerancia = {
  base_calculo?: string | null;
  tolerancia_aplicada?: number | string | null;
  resultado_afericao?: unknown;
  traco_id?: string | null;
  descricao?: string | null;
};

type ContextoTolerancia = {
  categorias: ToleranciaPadrao[];
  fornecedores: FornecedorMaterial[];
  overrides: OverrideTolerancia[];
  fornecedorNome?: string | null;
  /** Tolerância do filtro/geral, usada quando não há categoria cadastrada. */
  fallbackPct: number;
  /** Tolerância da carta de traço vinda do cadastro (traço → fornecedor de concreto). */
  toleranciaCarta?: number | null;
  categorizar: (descricao: string, categorias: ToleranciaPadrao[]) => ToleranciaPadrao | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Resolvedor único de tolerância por registro.
 * Carta de traço → tolerância do cadastro da carta.
 * Itens da NF → override do fornecedor ?? tabela padrão ?? tolerância geral.
 */
export function resolverToleranciaDaPesagem(
  pesagem: PesagemTolerancia | null | undefined,
  ctx: ContextoTolerancia,
): ToleranciaResolvida {
  const af = (pesagem?.resultado_afericao ?? null) as { tol?: unknown } | null;
  const porCarta =
    num(ctx.toleranciaCarta) ?? num(pesagem?.tolerancia_aplicada) ?? num(af?.tol);
  const temCarta = pesagem?.base_calculo === "carta_traco" || !!pesagem?.traco_id;

  if (temCarta && porCarta != null) {
    return { pct: porCarta, origem: "carta_traco", rotulo: "tolerância da carta de traço" };
  }

  const cat = pesagem?.descricao ? ctx.categorizar(pesagem.descricao, ctx.categorias) : null;
  if (cat) {
    const chave = chaveNomeFornecedor(ctx.fornecedorNome);
    const forn = chave
      ? ctx.fornecedores.find((f) => chaveNomeFornecedor(f.razao_social) === chave)
      : undefined;
    const ov = forn
      ? ctx.overrides.find(
          (o) => o.fornecedor_id === forn.id && o.tolerancia_padrao_id === cat.id,
        )
      : undefined;
    if (ov) {
      return {
        pct: Number(ov.tolerancia),
        origem: "fornecedor",
        rotulo: `tolerância por material — ${forn?.razao_social ?? "fornecedor"}`,
      };
    }
    return {
      pct: Number(cat.tolerancia),
      origem: "padrao",
      rotulo: "tolerância por material — tabela padrão",
    };
  }

  return { pct: ctx.fallbackPct, origem: "geral", rotulo: "tolerância geral do filtro" };
}


export function useToleranciasPadrao() {
  const qc = useQueryClient();
  const { data: categorias = [], isLoading } = useQuery({
    queryKey: KEY_PADRAO,
    queryFn: async () => {
      const { data, error } = await (supabase.from("tolerancias_padrao" as any) as any)
        .select("*")
        .order("categoria", { ascending: true })
        .order("condicao", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        tolerancia: Number(d.tolerancia)
      })) as ToleranciaPadrao[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: KEY_PADRAO });

  const adicionar = useMutation({
    mutationFn: async (nova: Partial<ToleranciaPadrao>) => {
      const { error } = await (supabase.from("tolerancias_padrao" as any) as any).insert(nova);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Material adicionado."); },
    onError: erroTolerancia,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ToleranciaPadrao> }) => {
      const { error } = await (supabase.from("tolerancias_padrao" as any) as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Alteração salva."); },
    onError: erroTolerancia,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("tolerancias_padrao" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Material excluído."); },
    onError: erroTolerancia,
  });

  return { categorias, isLoading, adicionar, atualizar, remover };
}

export function useGerenciamentoFornecedores() {
  const qc = useQueryClient();
  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: KEY_FORNECEDORES,
    queryFn: async () => {
      const { data, error } = await (supabase.from("fornecedores_material_v2" as any) as any)
        .select("*")
        .order("razao_social", { ascending: true });
      if (error) throw error;
      return (data || []) as FornecedorMaterial[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY_FORNECEDORES });
    qc.invalidateQueries({ queryKey: KEY_OVERRIDES });
  };

  const vincular = useMutation({
    mutationFn: async (dados: Partial<FornecedorMaterial>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', user?.id || '').single();
      
      const { data, error } = await (supabase.from("fornecedores_material_v2" as any) as any)
        .insert({
          ...dados,
          origem: dados.origem || 'manual',
          vinculado: true,
          created_by: user?.id,
          created_by_nome: profile?.nome || user?.email,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FornecedorMaterial;
    },
    onSuccess: invalidate,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FornecedorMaterial> }) => {
      const { error } = await (supabase.from("fornecedores_material_v2" as any) as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const revincular = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("fornecedores_material_v2" as any) as any)
        .update({ vinculado: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const desvincular = useMutation({
    mutationFn: async (fornecedor: FornecedorMaterial) => {
      if (fornecedor.origem === 'manual') {
        const { error } = await (supabase.from("fornecedores_material_v2" as any) as any)
          .update({ vinculado: false })
          .eq("id", fornecedor.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("fornecedores_material_v2" as any) as any)
          .delete()
          .eq("id", fornecedor.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const excluirFisicamente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("fornecedores_material_v2" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { fornecedores, isLoading, vincular, atualizar, revincular, desvincular, excluirFisicamente };
}

export function useOverridesFornecedor() {
  const qc = useQueryClient();
  const { data: overrides = [], isLoading } = useQuery({
    queryKey: KEY_OVERRIDES,
    queryFn: async () => {
      const { data, error } = await (supabase.from("tolerancias_fornecedor_v2" as any) as any).select("*");
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        tolerancia: Number(d.tolerancia)
      })) as OverrideTolerancia[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: KEY_OVERRIDES });

  const definir = useMutation({
    mutationFn: async (ov: Omit<OverrideTolerancia, "id">) => {
      const { error } = await (supabase.from("tolerancias_fornecedor_v2" as any) as any)
        .upsert(ov, { onConflict: "fornecedor_id,tolerancia_padrao_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remover = useMutation({
    mutationFn: async ({ fornecedor_id, tolerancia_padrao_id }: { fornecedor_id: string; tolerancia_padrao_id: string }) => {
      const { error } = await (supabase.from("tolerancias_fornecedor_v2" as any) as any)
        .delete()
        .eq("fornecedor_id", fornecedor_id)
        .eq("tolerancia_padrao_id", tolerancia_padrao_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { overrides, isLoading, definir, remover };
}

export function validarCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== Number(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== Number(digitos.charAt(1))) return false;

  return true;
}

export function formatarCNPJ(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length > 14) v = v.slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return v.replace(/^(\d{2})(\d)/, "$1.$2");
  if (v.length <= 8) return v.replace(/^(\d{2})(\d{3})(\d)/, "$1.$2.$3");
  if (v.length <= 12) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d)/, "$1.$2.$3/$4");
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}
