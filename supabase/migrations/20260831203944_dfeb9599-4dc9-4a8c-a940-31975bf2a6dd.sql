ALTER TABLE public.whatsapp_alertas
  ADD COLUMN IF NOT EXISTS mensagem_texto text,
  ADD COLUMN IF NOT EXISTS campos_enviados jsonb,
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS template_nome_real text,
  ADD COLUMN IF NOT EXISTS reenvio_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS destinatario_email text;