-- ============================================================
-- UNIMATCH PERFORMANCE OPTIMIZATION INDEXES
-- Run this in your Supabase SQL Editor
-- ============================================================

-- These indexes eliminate seq scans on hot query paths identified in the performance audit.
-- Total estimated impact: ~70-85% reduction in query time for affected operations.

-- 1. profile_photos by user_id
-- Used by: dashboard modal (N+1 elimination), profile page, upload-photos page
-- Impact: Converts O(n) seq scan to O(log n) index seek per photo fetch
CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON public.profile_photos(user_id);

-- 2. blocked_users by blocked_id
-- Used by: discover page filtering (`blocked_id = me`)
-- Impact: The existing UNIQUE(blocker_id, blocked_id) only serves blocker_id prefix lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON public.blocked_users(blocked_id);

-- 3. matches by user2_id
-- Used by: real-time subscription filter `user2_id=eq.${uid}` in matches page
-- Impact: The existing idx_matches_users(user1_id, user2_id) cannot serve user2_id alone
CREATE INDEX IF NOT EXISTS idx_matches_user2_id ON public.matches(user2_id);

-- 4. messages by sender_id
-- Used by: chat history queries, unread counts, sender-specific filters
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- 5. messages partial index for unread queries
-- Used by: unread message counts (very common query)
-- Impact: Partial index is smaller and faster than full-table index for is_read checks
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(match_id, created_at DESC)
  WHERE is_read = false;

-- 6. Remove duplicate notification index (cleanup)
-- idx_notifications_user_created (line 174) and idx_notifications_user (line 243) are identical
DROP INDEX IF EXISTS public.idx_notifications_user_created;

-- ============================================================
-- VERIFICATION QUERIES (optional - run these to verify indexes exist)
-- ============================================================
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_profile_photos%'
--    OR indexname LIKE 'idx_blocked_users%'
--    OR indexname LIKE 'idx_matches%'
--    OR indexname LIKE 'idx_messages%'
-- ORDER BY tablename, indexname;
