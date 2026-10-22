import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getFornecedoresConcreto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fornecedores_concreto")
      .select(`
        *,
        tracos:tracos_concreto(*)
      `)
      .order("nome");
    if (error) throw error;
    return data;
  });

export const upsertFornecedorConcreto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string(),
    cnpj: z.string().nullable().optional(),
    emissor_keywords: z.array(z.string()).optional(),
    tolerancia_padrao: z.number().optional(),
    teor_ar: z.number().nullable().optional(),
    observacoes: z.string().nullable().optional(),
    ativo: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fornecedores_concreto")
      .upsert(data);
    if (error) throw error;
    return { success: true };
  });

export const deleteFornecedorConcreto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fornecedores_concreto")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const upsertTracoConcreto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    fornecedor_id: z.string().uuid(),
    codigo: z.string().nullable().optional(),
    fck: z.number().nullable().optional(),
    aplicacao: z.string().nullable().optional(),
    slump_nominal: z.number().nullable().optional(),
    slump_unidade: z.enum(["cm", "mm"]).nullable().optional(),
    slump_tolerancia: z.number().nullable().optional(),
    densidade_teorica: z.number().nullable().optional(),
    densidade_pratica: z.number().nullable().optional(),
    tolerancia_peso: z.number().nullable().optional(),
    match_keywords: z.array(z.string()).optional(),
    consumo_cimento: z.number().nullable().optional(),
    ativo: z.boolean().optional(),

  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tracos_concreto")
      .upsert(data);
    if (error) throw error;
    return { success: true };
  });

export const deleteTracoConcreto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tracos_concreto")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });
