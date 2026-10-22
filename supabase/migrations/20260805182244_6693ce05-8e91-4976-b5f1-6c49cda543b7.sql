-- Seed the CALPER PADRAO supplier if it doesn't exist
INSERT INTO public.fornecedores_concreto (nome, tolerancia_padrao, ativo, emissor_keywords)
SELECT 'CALPER PADRAO', 4, true, ARRAY['CALPER']
WHERE NOT EXISTS (
    SELECT 1 FROM public.fornecedores_concreto WHERE nome = 'CALPER PADRAO'
);
