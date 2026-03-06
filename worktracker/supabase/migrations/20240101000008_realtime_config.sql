-- Migration: Configure Supabase Realtime for active_timers
-- Publishes active_timers changes so timer state syncs across devices.
-- RLS policies on public.active_timers still apply to every subscription payload.

-- Publish active_timers changes to the default Supabase Realtime publication.
ALTER PUBLICATION supabase_realtime
    ADD TABLE public.active_timers;

-- DELETE filters rely on user_id being present in the old row image.
-- FULL replica identity ensures realtime payloads include the complete old record
-- so user_id=eq.<uuid> filters keep working for UPDATE/DELETE events.
ALTER TABLE public.active_timers
    REPLICA IDENTITY FULL;

COMMENT ON TABLE public.active_timers IS
    'Currently running timer for each user (max one per user). Published to Supabase Realtime; RLS policies scope subscription payloads per user.';
