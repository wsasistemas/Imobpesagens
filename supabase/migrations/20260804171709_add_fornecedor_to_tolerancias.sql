alter table public.tolerancias_material 
  add column if not exists fornecedor text;

comment on column public.tolerancias_material.fornecedor is 'Vinculação especial de um material a um fornecedor específico. Se vazio, aplica-se a qualquer fornecedor.';
