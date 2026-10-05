-- ══════════════════════════════════════════════════════════════════
-- UniMatch — Fixes for buttons that could never work because of RLS
-- Run this whole file once in the Supabase SQL Editor. Safe to re-run.
--
-- In Supabase, a DELETE/UPDATE that RLS doesn't allow returns success with
-- 0 rows changed, so these buttons looked like they worked but didn't.
-- ══════════════════════════════════════════════════════════════════


-- ── 1. Notifications: allow users to delete their own ─────────────
-- Fixes "Delete notification", "Clear all" and "Clear stack".
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ── 2. Blocked users: allow users to unblock ──────────────────────
-- Fixes Settings → Unblock.
DROP POLICY IF EXISTS "Users delete own blocks" ON public.blocked_users;
CREATE POLICY "Users delete own blocks" ON public.blocked_users
  FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);


-- ── 3. Who to hide from the current user in Discover ──────────────
-- Users can only read their OWN blocked_users and user_settings rows, so
-- Discover couldn't see (a) people who blocked them or (b) people who turned
-- off "visible in discovery". This returns just those IDs — nothing else.
CREATE OR REPLACE FUNCTION public.discovery_hidden_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blocker_id FROM public.blocked_users WHERE blocked_id = auth.uid()
  UNION
  SELECT id FROM public.user_settings WHERE discovery_visible = false AND id <> auth.uid();
$$;

REVOKE ALL ON FUNCTION public.discovery_hidden_user_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.discovery_hidden_user_ids() TO authenticated;


-- ── 4. Delete my account ──────────────────────────────────────────
-- Settings → Delete Account. Only ever deletes the CALLER's own account.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.profiles WHERE id = uid;   -- app data cascades from profiles
  DELETE FROM auth.users WHERE id = uid;        -- removes the login itself
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Keep moderation reports when a user deletes their account
-- (otherwise a reported user could erase reports against them by deleting).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname, att.attname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.reports'::regclass
      AND con.contype = 'f'
      AND att.attname IN ('reporter_id', 'reported_id')
  LOOP
    EXECUTE format('ALTER TABLE public.reports DROP CONSTRAINT %I', c.conname);
    EXECUTE format(
      'ALTER TABLE public.reports ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      c.conname, c.attname
    );
  END LOOP;
END $$;


-- ── 5. Only @kabarak.ac.ke accounts can be created ────────────────
-- Applies to email signup, Google sign-in and direct API calls alike
-- (the signup form check alone could be bypassed).
CREATE OR REPLACE FUNCTION public.enforce_university_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@kabarak.ac.ke' THEN
    RAISE EXCEPTION 'Only Kabarak University (@kabarak.ac.ke) email addresses can join UniMatch.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_university_email ON auth.users;
CREATE TRIGGER enforce_university_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_university_email();


-- ══════════════════════════════════════════════════════════════════
-- CHECK — should list the two new policies and three functions
-- ══════════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('Users delete own notifications', 'Users delete own blocks');

SELECT proname FROM pg_proc
WHERE proname IN ('discovery_hidden_user_ids', 'delete_my_account', 'enforce_university_email');
