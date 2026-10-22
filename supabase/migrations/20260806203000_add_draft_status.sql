-- Adiciona os novos status para rascunho incremental e fluxo de pesagem
-- 1. RASCUNHO_ENTRADA
-- 2. AGUARDANDO_SAIDA (já existe como aguardando_saida)
-- 3. RASCUNHO_SAIDA
-- 4. CONCLUIDO (já existe como concluida)

-- Como não podemos alterar um ENUM diretamente no PostgreSQL (depende da versão e se há transações), 
-- vamos adicionar os novos valores.
ALTER TYPE public.status_pesagem ADD VALUE IF NOT EXISTS 'rascunho_entrada';
ALTER TYPE public.status_pesagem ADD VALUE IF NOT EXISTS 'rascunho_saida';
