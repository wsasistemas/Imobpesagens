-- Adicionar campo consumo_cimento à tabela tracos_concreto
alter table public.tracos_concreto 
  add column if not exists consumo_cimento numeric;

-- Adicionar campo para armazenar a volumetria derivada por insumo se necessário
alter table public.pesagens
  add column if not exists volume_derivado_detalhe jsonb;
