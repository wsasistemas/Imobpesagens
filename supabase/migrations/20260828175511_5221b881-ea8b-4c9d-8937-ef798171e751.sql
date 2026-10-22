ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS engenheiro_todas_coligadas boolean NOT NULL DEFAULT false;

DROP INDEX IF EXISTS public.usuario_coligadas_eng_resp_unico;
CREATE INDEX IF NOT EXISTS usuario_coligadas_eng_resp_idx
  ON public.usuario_coligadas (codcoligada)
  WHERE engenheiro_responsavel;

ALTER TABLE public.whatsapp_alertas DROP CONSTRAINT IF EXISTS whatsapp_alertas_unico;
DROP INDEX IF EXISTS public.whatsapp_alertas_unico;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_alertas_unico
  ON public.whatsapp_alertas (pesagem_id, tipo_alerta, destinatario_user_id);