import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface UseIdleDetectionOptions {
  enabled: boolean;
  thresholdMinutes: number;
  onIdle: (idleMinutes: number) => void;
}

const TRACKED_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart'] as const;
const CHECK_INTERVAL_MS = 30_000;

export function useIdleDetection({
  enabled,
  thresholdMinutes,
  onIdle,
}: UseIdleDetectionOptions): void {
  const lastActivityRef = useRef<number>(0);
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    lastActivityRef.current = Date.now();
    hasFiredRef.current = false;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      hasFiredRef.current = false;
    };

    for (const event of TRACKED_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    const thresholdMs = thresholdMinutes * 60 * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= thresholdMs && !hasFiredRef.current) {
        hasFiredRef.current = true;
        const idleMinutes = Math.round(elapsed / 60_000);
        onIdle(idleMinutes);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const event of TRACKED_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
      clearInterval(interval);
    };
  }, [enabled, thresholdMinutes, onIdle]);
}
