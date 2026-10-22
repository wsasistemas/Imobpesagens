
-- 1) Enum values
ALTER TYPE public.status_pesagem ADD VALUE IF NOT EXISTS 'fechada_com_ocorrencia';
ALTER TYPE public.tipo_evidencia ADD VALUE IF NOT EXISTS 'ocorrencia';

-- 2) Colunas de ocorrência em pesagens
ALTER TABLE public.pesagens
  ADD COLUMN IF NOT EXISTS ocorrencia_tipo text,
  ADD COLUMN IF NOT EXISTS ocorrencia_tipo_outro text,
  ADD COLUMN IF NOT EXISTS ocorrencia_relato text,
  ADD COLUMN IF NOT EXISTS ocorrencia_em timestamptz,
  ADD COLUMN IF NOT EXISTS ocorrencia_por uuid REFERENCES auth.users(id);

-- 3) Tabela profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  cargo text,
  setor text,
  telefone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario le proprio perfil" ON public.profiles;
CREATE POLICY "Usuario le proprio perfil" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Usuario edita proprio perfil" ON public.profiles;
CREATE POLICY "Usuario edita proprio perfil" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Usuario cria proprio perfil" ON public.profiles;
CREATE POLICY "Usuario cria proprio perfil" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Trigger set_updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Trigger de auto-criação no signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, telefone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'celular', NEW.phone, NULL),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 5) Backfill dos usuários existentes
INSERT INTO public.profiles (id, nome, telefone, email)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', NULL),
  COALESCE(u.raw_user_meta_data->>'celular', u.phone, NULL),
  u.email
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = COALESCE(public.profiles.nome, EXCLUDED.nome),
      telefone = COALESCE(public.profiles.telefone, EXCLUDED.telefone);
