-- ══════════════════════════════════════════════════════════════════
-- UniMatch — Security fixes (privilege escalation + open reports)
-- Run this whole file once in the Supabase SQL Editor.
-- Safe to re-run: every statement is idempotent.
-- ══════════════════════════════════════════════════════════════════


-- ── 0. Make sure the privileged columns exist ─────────────────────
-- Older databases were created before these columns were added to the
-- schema file, and CREATE TABLE IF NOT EXISTS never adds new columns.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

UPDATE public.profiles SET role = 'user' WHERE role IS NULL;
UPDATE public.profiles SET verified = FALSE WHERE verified IS NULL;
UPDATE public.profiles SET is_banned = FALSE WHERE is_banned IS NULL;
UPDATE public.profiles SET email_verified = FALSE WHERE email_verified IS NULL;

-- Same for the reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reporter_id UUID;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reported_id UUID;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- The API no longer sends an id, so make sure reports.id generates one
DO $$
DECLARE id_type text;
BEGIN
  SELECT data_type INTO id_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'id';

  IF id_type = 'uuid' THEN
    ALTER TABLE public.reports ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ELSIF id_type IN ('text', 'character varying') THEN
    ALTER TABLE public.reports ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;
END $$;


-- ── 1. is_admin() helper ──────────────────────────────────────────
-- SECURITY DEFINER so it can read profiles.role without triggering
-- RLS recursion when used inside policies.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id::text = auth.uid()::text AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ── 2. Lock privileged profile columns ────────────────────────────
-- Regular users can still edit their own profile (name, bio, photos…)
-- but can no longer change role, verified, is_banned or email_verified.
-- Trusted server-side callers (SQL editor, service role, the signup
-- trigger) have no 'authenticated'/'anon' JWT role and are not affected.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.verified := false;
    NEW.is_banned := false;
    NEW.email_verified := false;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
    RAISE EXCEPTION 'You are not allowed to change role, verification or ban status.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Admins need to update other users' profiles to ban them
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 3. Reports: replace the open "allow all" policies ─────────────
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Drop EVERY existing policy on reports (including any added by hand)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reports'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', pol.policyname);
  END LOOP;
END $$;

-- Signed-in users can file a report, only as themselves, never about themselves
CREATE POLICY "Users can file reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = reporter_id::text AND reporter_id::text <> reported_id::text);

-- Reporters see their own reports; admins see all
CREATE POLICY "Reporters and admins can view reports" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid()::text = reporter_id::text OR public.is_admin());

-- Only admins can change report status
CREATE POLICY "Admins can update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- AFTER RUNNING — review these results
-- ══════════════════════════════════════════════════════════════════

-- (a) Who is admin right now? Anyone could self-promote before this fix,
--     so remove admin from any account that shouldn't have it:
--       UPDATE public.profiles SET role = 'user' WHERE id = '<their id>';
SELECT id, name, role FROM public.profiles WHERE role = 'admin';

-- (b) Who is verified? The old verify-page fallback let users verify themselves.
--     To un-verify someone:  UPDATE public.profiles SET verified = false WHERE id = '<id>';
SELECT id, name, verified FROM public.profiles WHERE verified = true;

-- (c) To grant admin to the real moderator(s), run from this SQL editor:
--       UPDATE public.profiles SET role = 'admin' WHERE id = '<moderator user id>';

-- (d) Confirm the new report policies
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'reports';
