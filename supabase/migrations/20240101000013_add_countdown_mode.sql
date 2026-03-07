-- Add countdown timer mode
ALTER TABLE public.active_timers DROP CONSTRAINT IF EXISTS active_timers_timer_mode_check;
ALTER TABLE public.active_timers ADD CONSTRAINT active_timers_timer_mode_check CHECK (timer_mode IN ('normal', 'pomodoro', 'countdown'));
