-- Alertas de tolerância via WhatsApp Business Platform (Meta)

-- 1) Engenheiro responsável por coligada (cadastro de usuários)
ALTER TABLE public.usuario_coligadas
  ADD COLUMN IF NOT EXISTS engenheiro_responsavel boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS usuario_coligadas_eng_resp_unico
  ON public.usuario_coligadas (codcoligada)
  WHERE engenheiro_responsavel;

-- 2) Telefone WhatsApp normalizado (E.164) no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_e164 text;

-- 3) Configuração do canal oficial da Meta + alertas de tolerância
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text,
  ADD COLUMN IF NOT EXISTS meta_waba_id text,
  ADD COLUMN IF NOT EXISTS meta_display_name text,
  ADD COLUMN IF NOT EXISTS alertas_tolerancia_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_template_nome text DEFAULT 'alerta_pesagem_acima_tolerancia',
  ADD COLUMN IF NOT EXISTS alerta_template_idioma text DEFAULT 'pt_BR';

-- 4) Log de alertas (único por pesagem + tipo de alerta)
CREATE TABLE IF NOT EXISTS public.whatsapp_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesagem_id uuid NOT NULL REFERENCES public.pesagens(id) ON DELETE CASCADE,
  tipo_alerta text NOT NULL DEFAULT 'alerta_tolerancia_acima',
  obra_id uuid REFERENCES public.obras(id),
  coligada text,
  placa text,
  ocorrencia_ref text,
  destinatario_user_id uuid,
  destinatario_nome text,
  telefone text,
  template text,
  template_idioma text,
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  meta_message_id text,
  erro_detalhe text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_alertas_unico UNIQUE (pesagem_id, tipo_alerta)
);

CREATE INDEX IF NOT EXISTS whatsapp_alertas_meta_msg_idx
  ON public.whatsapp_alertas (meta_message_id);

GRANT SELECT ON public.whatsapp_alertas TO authenticated;
GRANT ALL ON public.whatsapp_alertas TO service_role;

ALTER TABLE public.whatsapp_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis autorizados leem alertas" ON public.whatsapp_alertas;
CREATE POLICY "Perfis autorizados leem alertas"
  ON public.whatsapp_alertas
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'superadmin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'operador')
  );

DROP TRIGGER IF EXISTS trg_whatsapp_alertas_updated ON public.whatsapp_alertas;
CREATE TRIGGER trg_whatsapp_alertas_updated
  BEFORE UPDATE ON public.whatsapp_alertas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();