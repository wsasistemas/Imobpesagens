-- Adiciona a coluna dados_adicionais_nf à tabela pesagens
ALTER TABLE public.pesagens ADD COLUMN IF NOT EXISTS dados_adicionais_nf text;

-- Comentário para documentar o campo
COMMENT ON COLUMN public.pesagens.dados_adicionais_nf IS 'Conteúdo do campo DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES extraído via OCR da nota fiscal.';
