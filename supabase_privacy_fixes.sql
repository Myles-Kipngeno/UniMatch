-- ══════════════════════════════════════════════════════════════════
-- UniMatch — Privacy fix: stop exposing student emails
-- Run this whole file once in the Supabase SQL Editor, AFTER
-- supabase_security_fixes.sql (it uses public.is_admin()).
-- Safe to re-run.
--
-- Why: any signed-in student could read every profile row, including
-- the email column. Emails already live in auth.users (Supabase Auth),
-- so profiles no longer keeps a copy. Admins look emails up through
-- admin_user_emails(), which refuses non-admins.
--
-- To undo (restore the copies from auth.users):
--   DROP TRIGGER IF EXISTS strip_profile_email ON public.profiles;
--   UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id;
-- ══════════════════════════════════════════════════════════════════


-- ── 1. Admin-only email lookup ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_user_emails(user_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE u.id = ANY(user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_emails(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid[]) TO authenticated;


-- ── 2. Stop storing emails on profiles ────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
  END IF;
END $$;

-- Any insert/update (signup trigger, profile saves) gets its email blanked
CREATE OR REPLACE FUNCTION public.strip_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := NULL;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    DROP TRIGGER IF EXISTS strip_profile_email ON public.profiles;
    CREATE TRIGGER strip_profile_email
      BEFORE INSERT OR UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.strip_profile_email();

    -- Clear the copies that are already there
    UPDATE public.profiles SET email = NULL WHERE email IS NOT NULL;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════
-- CHECK — should return 0
-- ══════════════════════════════════════════════════════════════════
SELECT count(*) AS profiles_still_holding_email
FROM public.profiles
WHERE email IS NOT NULL;
