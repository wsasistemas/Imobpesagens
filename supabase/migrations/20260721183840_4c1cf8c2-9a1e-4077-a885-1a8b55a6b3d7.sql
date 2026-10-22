DROP TRIGGER IF EXISTS on_auth_user_created_calper ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed_calper ON auth.users;
DROP FUNCTION IF EXISTS public.handle_calper_user();