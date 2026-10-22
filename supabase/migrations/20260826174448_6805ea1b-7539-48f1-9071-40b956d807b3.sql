-- =========================================================
-- Módulo WhatsApp (Zenvia) — Fase 1
-- =========================================================

CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor text NOT NULL DEFAULT 'zenvia',
  api_url text,
  api_token text,
  sender_id text,
  instance_name text,
  webhook_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_config_select" ON public.whatsapp_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'operador'));
CREATE POLICY "wa_config_write" ON public.whatsapp_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.whatsapp_automacao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respostas_automaticas jsonb NOT NULL DEFAULT '[]'::jsonb,
  horario_inicio text DEFAULT '08:00',
  horario_fim text DEFAULT '18:00',
  msg_fora_horario text,
  ia_modelo text DEFAULT 'google/gemini-3.7-flash',
  ia_temperatura numeric DEFAULT 0.7,
  ia_max_tokens integer DEFAULT 1024,
  ia_prompt_base text,
  notif_novas_msgs boolean DEFAULT false,
  notif_docs_recebidos boolean DEFAULT false,
  notif_erros boolean DEFAULT true,
  notif_relatorio_diario boolean DEFAULT false,
  notif_email text,
  debug_mode boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automacao_config TO authenticated;
GRANT ALL ON public.whatsapp_automacao_config TO service_role;
ALTER TABLE public.whatsapp_automacao_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_auto_select" ON public.whatsapp_automacao_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'operador'));
CREATE POLICY "wa_auto_write" ON public.whatsapp_automacao_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_key text NOT NULL UNIQUE,
  funcao_label text NOT NULL,
  descricao text,
  template_id text,
  sender_id text,
  sender_phone text,
  sender_status text,
  variaveis text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_tpl_select" ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'operador'));
CREATE POLICY "wa_tpl_write" ON public.whatsapp_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_whatsapp text NOT NULL,
  contato_nome text,
  contato_email text,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  mensagem text NOT NULL,
  direcao text NOT NULL DEFAULT 'enviada',
  tipo text DEFAULT 'texto',
  status text,
  provider_message_id text,
  arquivo_url text,
  arquivo_nome text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_msg_contato ON public.whatsapp_mensagens (contato_whatsapp, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.whatsapp_mensagens TO service_role;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_msg_select" ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'operador'));
CREATE POLICY "wa_msg_write" ON public.whatsapp_mensagens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.whatsapp_numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  provedor text NOT NULL DEFAULT 'zenvia',
  api_url text,
  api_token text,
  sender_id text,
  instance_name text,
  status text NOT NULL DEFAULT 'ativo',
  prioridade integer NOT NULL DEFAULT 1,
  limite_diario integer NOT NULL DEFAULT 1000,
  enviados_hoje integer NOT NULL DEFAULT 0,
  health_score integer NOT NULL DEFAULT 100,
  janela_inicio text DEFAULT '08:00',
  janela_fim text DEFAULT '18:00',
  ultimo_check_em timestamptz,
  ultima_falha_em timestamptz,
  reset_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_numeros TO authenticated;
GRANT ALL ON public.whatsapp_numeros TO service_role;
ALTER TABLE public.whatsapp_numeros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_num_select" ON public.whatsapp_numeros FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'operador'));
CREATE POLICY "wa_num_write" ON public.whatsapp_numeros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_wa_config_updated BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wa_auto_updated BEFORE UPDATE ON public.whatsapp_automacao_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wa_tpl_updated BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wa_msg_updated BEFORE UPDATE ON public.whatsapp_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wa_num_updated BEFORE UPDATE ON public.whatsapp_numeros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permissões de menu
INSERT INTO public.perfil_menu_permissoes (role, menu_key, permitido) VALUES
  ('superadmin','whatsapp',true),
  ('admin','whatsapp',true),
  ('coordenador','whatsapp',true),
  ('operador','whatsapp',false),
  ('superadmin','whatsapp_bulk',true),
  ('admin','whatsapp_bulk',true),
  ('coordenador','whatsapp_bulk',false),
  ('operador','whatsapp_bulk',false)
ON CONFLICT (role, menu_key) DO NOTHING;