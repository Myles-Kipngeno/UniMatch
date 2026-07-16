-- ============================================================
-- UNIMATCH SUPABASE DATABASE SCHEMA MIGRATION
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. UNIVERSITIES TABLE ──
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.universities (name, domain)
VALUES ('Kabarak University', '@kabarak.ac.ke')
ON CONFLICT (domain) DO NOTHING;

-- ── 2. COURSES TABLE ──
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. PROFILES TABLE ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  campus TEXT,
  course TEXT,
  year_of_study TEXT,
  university TEXT DEFAULT 'Kabarak University',
  email_domain TEXT DEFAULT '@kabarak.ac.ke',
  bio TEXT,
  photo_url TEXT,
  preference TEXT DEFAULT 'all',
  relationship_goals TEXT,
  lifestyle TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  prompts JSONB DEFAULT '{}'::jsonb,
  interests TEXT[] DEFAULT '{}',
  profile_complete BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  location_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. INTERESTS TABLE ──
CREATE TABLE IF NOT EXISTS public.interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  emoji TEXT NOT NULL
);

-- ── 5. USER_INTERESTS TABLE ──
CREATE TABLE IF NOT EXISTS public.user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest_id UUID REFERENCES public.interests(id) ON DELETE CASCADE,
  UNIQUE(user_id, interest_id)
);

-- ── 6. PROFILE_PHOTOS TABLE ──
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'image', -- 'image' or 'video'
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. LIKES TABLE ──
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_super_like BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id),
  CONSTRAINT no_self_like CHECK (from_user_id <> to_user_id)
);

-- ── 8. PASSES TABLE ──
CREATE TABLE IF NOT EXISTS public.passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id),
  CONSTRAINT no_self_pass CHECK (from_user_id <> to_user_id)
);

-- ── 9. MATCHES TABLE ──
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  user1_unread INTEGER DEFAULT 0,
  user2_unread INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CONSTRAINT no_self_match CHECK (user1_id <> user2_id)
);

-- ── 10. MESSAGES TABLE ──
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT,
  image_url TEXT,
  file_url TEXT,
  file_name TEXT,
  audio_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. MESSAGE_ATTACHMENTS TABLE ──
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. NOTIFICATIONS TABLE ──
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'like', 'match', 'message', 'view', 'system'
  title TEXT,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. VIEWS TABLE ──
CREATE TABLE IF NOT EXISTS public.views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. BLOCKED_USERS TABLE ──
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ── 15. REPORTS TABLE ──
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 16. USER_SETTINGS TABLE ──
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_notifications BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  discovery_visible BOOLEAN DEFAULT TRUE,
  incognito BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 17. PRESENCE TABLE ──
CREATE TABLE IF NOT EXISTS public.presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  online BOOLEAN DEFAULT TRUE,
  location_name TEXT,
  lat DOUBLE PRECISION,   -- fuzzy latitude  (~1 km precision)
  lng DOUBLE PRECISION,   -- fuzzy longitude (~1 km precision)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 18. SWIPE_HISTORY TABLE ──
CREATE TABLE IF NOT EXISTS public.swipe_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 19. EVENTS TABLE ──
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'social',
  location TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  rsvps TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES FOR HIGH PERFORMANCE ──
CREATE INDEX IF NOT EXISTS idx_profiles_campus ON public.profiles(campus);
CREATE INDEX IF NOT EXISTS idx_profiles_course ON public.profiles(course);
CREATE INDEX IF NOT EXISTS idx_profiles_complete ON public.profiles(profile_complete);
CREATE INDEX IF NOT EXISTS idx_likes_from_to ON public.likes(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_likes_to ON public.likes(to_user_id);
CREATE INDEX IF NOT EXISTS idx_passes_from_to ON public.passes(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_users ON public.matches(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_match ON public.messages(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_target ON public.views(target_id);

-- ── AUTOMATIC TRIGGERS ──

-- A. Auto-create Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, university, email_domain, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'Kabarak University',
    '@kabarak.ac.ke',
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET email_verified = (NEW.email_confirmed_at IS NOT NULL);

  INSERT INTO public.user_settings (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. Auto-create Match on Mutual Like
CREATE OR REPLACE FUNCTION public.handle_like_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_u1 UUID;
  v_u2 UUID;
  v_from_name TEXT;
  v_to_name TEXT;
BEGIN
  -- Track in swipe history
  INSERT INTO public.swipe_history (user_id, target_id, action)
  VALUES (NEW.from_user_id, NEW.to_user_id, CASE WHEN NEW.is_super_like THEN 'superlike' ELSE 'like' END);

  -- Check if reverse like exists
  IF EXISTS (SELECT 1 FROM public.likes WHERE from_user_id = NEW.to_user_id AND to_user_id = NEW.from_user_id) THEN
    -- Sort UUIDs consistently so user1_id < user2_id
    IF NEW.from_user_id < NEW.to_user_id THEN
      v_u1 := NEW.from_user_id; v_u2 := NEW.to_user_id;
    ELSE
      v_u1 := NEW.to_user_id; v_u2 := NEW.from_user_id;
    END IF;

    -- Insert Match
    INSERT INTO public.matches (user1_id, user2_id)
    VALUES (v_u1, v_u2)
    ON CONFLICT (user1_id, user2_id) DO NOTHING;

    -- Create Notifications
    SELECT name INTO v_from_name FROM public.profiles WHERE id = NEW.from_user_id;
    SELECT name INTO v_to_name FROM public.profiles WHERE id = NEW.to_user_id;

    INSERT INTO public.notifications (user_id, sender_id, type, title, body, link)
    VALUES
      (NEW.to_user_id, NEW.from_user_id, 'match', 'It''s a Match! 🎉', 'You matched with ' || COALESCE(v_from_name, 'someone') || '!', 'matches.html'),
      (NEW.from_user_id, NEW.to_user_id, 'match', 'It''s a Match! 🎉', 'You matched with ' || COALESCE(v_to_name, 'someone') || '!', 'matches.html');
  ELSE
    -- Create Like Notification
    SELECT name INTO v_from_name FROM public.profiles WHERE id = NEW.from_user_id;
    INSERT INTO public.notifications (user_id, sender_id, type, title, body, link)
    VALUES (NEW.to_user_id, NEW.from_user_id, 'like', 'New Like ❤️', COALESCE(v_from_name, 'Someone') || ' liked your profile', 'discover.html');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_inserted ON public.likes;
CREATE TRIGGER on_like_inserted
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_like_insert();

-- C. Auto-update Match Last Message & Notifications on New Message
CREATE OR REPLACE FUNCTION public.handle_message_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_match RECORD;
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_preview TEXT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = NEW.match_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_recipient_id := CASE WHEN v_match.user1_id = NEW.sender_id THEN v_match.user2_id ELSE v_match.user1_id END;
  v_preview := COALESCE(NEW.text, CASE WHEN NEW.image_url IS NOT NULL THEN '📷 Photo' WHEN NEW.file_url IS NOT NULL THEN '📎 File' WHEN NEW.audio_url IS NOT NULL THEN '🎤 Voice message' ELSE 'New message' END);

  -- Update Match last message and unread count
  IF v_match.user1_id = NEW.sender_id THEN
    UPDATE public.matches
    SET last_message = v_preview, last_message_at = NEW.created_at, user2_unread = user2_unread + 1
    WHERE id = NEW.match_id;
  ELSE
    UPDATE public.matches
    SET last_message = v_preview, last_message_at = NEW.created_at, user1_unread = user1_unread + 1
    WHERE id = NEW.match_id;
  END IF;

  -- Create Notification for recipient
  SELECT name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, sender_id, type, title, body, link)
  VALUES (v_recipient_id, NEW.sender_id, 'message', 'New Message 💬', COALESCE(v_sender_name, 'Someone') || ': ' || v_preview, 'matches.html?matchId=' || NEW.match_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_insert();

-- ── ROW LEVEL SECURITY (RLS) POLICIES ──

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
-- Universities / Courses / Interests Public Read Policies
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Universities viewable" ON public.universities;
CREATE POLICY "Universities viewable" ON public.universities FOR SELECT USING (true);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Courses viewable" ON public.courses;
CREATE POLICY "Courses viewable" ON public.courses FOR SELECT USING (true);

ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Interests viewable" ON public.interests;
CREATE POLICY "Interests viewable" ON public.interests FOR SELECT USING (true);

-- Profiles Policies (SELECT, INSERT, UPDATE)
DROP POLICY IF EXISTS "Public profiles viewable" ON public.profiles;
CREATE POLICY "Public profiles viewable" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Profile Photos Policies
DROP POLICY IF EXISTS "Photos viewable" ON public.profile_photos;
CREATE POLICY "Photos viewable" ON public.profile_photos FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users insert own photos" ON public.profile_photos;
CREATE POLICY "Users insert own photos" ON public.profile_photos FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own photos" ON public.profile_photos;
CREATE POLICY "Users delete own photos" ON public.profile_photos FOR DELETE USING (auth.uid() = user_id);

-- Likes Policies
DROP POLICY IF EXISTS "Insert own likes" ON public.likes;
CREATE POLICY "Insert own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Select own likes" ON public.likes;
CREATE POLICY "Select own likes" ON public.likes FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Passes Policies
DROP POLICY IF EXISTS "Insert own passes" ON public.passes;
CREATE POLICY "Insert own passes" ON public.passes FOR INSERT WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Select own passes" ON public.passes;
CREATE POLICY "Select own passes" ON public.passes FOR SELECT USING (auth.uid() = from_user_id);

-- Views Policies
DROP POLICY IF EXISTS "Insert own views" ON public.views;
CREATE POLICY "Insert own views" ON public.views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Select views" ON public.views;
CREATE POLICY "Select views" ON public.views FOR SELECT USING (auth.uid() = viewer_id OR auth.uid() = target_id);

-- Matches Policies
DROP POLICY IF EXISTS "Select own matches" ON public.matches;
CREATE POLICY "Select own matches" ON public.matches FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Update own matches" ON public.matches;
CREATE POLICY "Update own matches" ON public.matches FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages Policies
DROP POLICY IF EXISTS "Select match messages" ON public.messages;
CREATE POLICY "Select match messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.matches WHERE id = match_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
);

DROP POLICY IF EXISTS "Insert match messages" ON public.messages;
CREATE POLICY "Insert match messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM public.matches WHERE id = match_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
);

-- Notifications Policies
DROP POLICY IF EXISTS "Select own notifications" ON public.notifications;
CREATE POLICY "Select own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- User Settings Policies
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can select own settings" ON public.user_settings;
CREATE POLICY "Users can select own settings" ON public.user_settings FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = id);

-- Presence Policies
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Presence viewable" ON public.presence;
CREATE POLICY "Presence viewable" ON public.presence FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert own presence" ON public.presence;
CREATE POLICY "Users can insert own presence" ON public.presence FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own presence" ON public.presence;
CREATE POLICY "Users can update own presence" ON public.presence FOR UPDATE USING (auth.uid() = user_id);

-- Swipe History Policies
ALTER TABLE public.swipe_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own swipe history" ON public.swipe_history;
CREATE POLICY "Users insert own swipe history" ON public.swipe_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own swipe history" ON public.swipe_history;
CREATE POLICY "Users select own swipe history" ON public.swipe_history FOR SELECT USING (auth.uid() = user_id);

-- Blocked Users Policies
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users select own blocked" ON public.blocked_users;
CREATE POLICY "Users select own blocked" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users insert own blocked" ON public.blocked_users;
CREATE POLICY "Users insert own blocked" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Reports Policies
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert reports" ON public.reports;
CREATE POLICY "Users insert reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Events Policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events viewable" ON public.events;
CREATE POLICY "Events viewable" ON public.events FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert own events" ON public.events;
CREATE POLICY "Insert own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Update own events or rsvp" ON public.events;
CREATE POLICY "Update own events or rsvp" ON public.events FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Delete own events" ON public.events;
CREATE POLICY "Delete own events" ON public.events FOR DELETE USING (auth.uid() = creator_id);

-- STORAGE BUCKETS SETUP --
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-images', 'verification-images', true) ON CONFLICT DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public access to profile images" ON storage.objects;
CREATE POLICY "Public access to profile images" ON storage.objects FOR SELECT USING (bucket_id IN ('profile-images', 'chat-images', 'verification-images'));

DROP POLICY IF EXISTS "Authenticated upload profile images" ON storage.objects;
CREATE POLICY "Authenticated upload profile images" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('profile-images', 'chat-images', 'verification-images') AND auth.role() = 'authenticated');

-- ============================================================
-- CAMPUS RADAR MIGRATION
-- Run this in Supabase SQL Editor if your database already
-- exists and the presence table was created without lat/lng.
-- ============================================================
ALTER TABLE public.presence ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.presence ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Allow all authenticated users to read presence (for radar dots)
DROP POLICY IF EXISTS "Presence viewable by all" ON public.presence;
CREATE POLICY "Presence viewable by all" ON public.presence
  FOR SELECT USING (auth.role() = 'authenticated');
