/**
 * SpotifyMiniPlayer
 *
 * Compact mini player widget for the Timer screen.
 * Shows album art, track name, artist, and playback controls.
 * Premium users get in-app audio via the Web Playback SDK;
 * free users fall back to remote control via the Web API.
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Card, Text } from '@/components/ui';
import {
  useSpotifyConnection,
  useSpotifyPlayback,
  useSpotifyControls,
  useSpotifyProgress,
  useSpotifyTokenDeath,
  useConnectSpotify,
  useSpotifyPlayer,
  useSpotifySDKPlayback,
} from '@/hooks/useSpotify';
import { useTheme } from '@/theme';

const SPOTIFY_GREEN = '#1DB954';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Draggable bar hook — handles click + drag on a horizontal bar element.
 * Returns a ref to attach to the bar, the current drag ratio (0-1),
 * whether currently dragging, and a setter for external ratio updates.
 */
function useDraggableBar(onCommit: (ratio: number) => void) {
  const ref = useRef<View>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const dragging = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const getRatio = useCallback((pageX: number) => {
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return Math.max(0, Math.min(1, (pageX - rect.left) / rect.width));
  }, []);

  // Attach native mouse listeners for drag (stable — no onCommit dep)
  useEffect(() => {
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const r = getRatio(e.pageX);
      if (r !== null) setRatio(r);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const r = getRatio(e.pageX);
      if (r !== null) setRatio(r);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const r = getRatio(e.pageX);
      if (r !== null) {
        setRatio(r);
        onCommitRef.current(r);
        // Clear override after a short delay so playback progress takes over
        setTimeout(() => setRatio(null), 500);
      }
    };

    node.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [getRatio]);

  const handlePress = useCallback(
    (e: { nativeEvent: { pageX: number } }) => {
      // Only handle click if not already dragging (mousedown handles that)
      if (dragging.current) return;
      const r = getRatio(e.nativeEvent.pageX);
      if (r !== null) {
        setRatio(r);
        onCommitRef.current(r);
        setTimeout(() => setRatio(null), 500);
      }
    },
    [getRatio]
  );

  return { ref, ratio, isDragging: dragging, handlePress, setRatio };
}

export interface SpotifyMiniPlayerProps {
  style?: object;
}

function SpotifyMiniPlayerWeb({ style }: SpotifyMiniPlayerProps): React.ReactElement | null {
  const { colors, borderRadius, spacing } = useTheme();
  const { isConnected } = useSpotifyConnection();
  const { isDead: tokenDead, reset: resetTokenDeath } = useSpotifyTokenDeath();
  const connectMutation = useConnectSpotify();

  const { data: connection } = useSpotifyConnection();
  const { isReady, isPremium } = useSpotifyPlayer(connection);
  const sdkPlayback = useSpotifySDKPlayback();

  const { data: playback } = useSpotifyPlayback(isConnected && !sdkPlayback);
  const controls = useSpotifyControls();
  const activePlayback = sdkPlayback ?? playback ?? null;
  const { progressMs, durationMs } = useSpotifyProgress(activePlayback);

  // Volume state
  const [volume, setVolume] = useState(0.5);

  const handleProgressCommit = useCallback(
    (ratio: number) => {
      if (!durationMs) return;
      void controls.seek(Math.floor(ratio * durationMs));
    },
    [durationMs, controls]
  );

  const handleVolumeCommit = useCallback(
    (ratio: number) => {
      setVolume(ratio);
      void controls.setVolume(ratio);
    },
    [controls]
  );

  const progressBar = useDraggableBar(handleProgressCommit);
  const volumeBar = useDraggableBar(handleVolumeCommit);

  // Show reconnect banner when token dies
  if (tokenDead || (!isConnected && tokenDead)) {
    return (
      <Card
        style={{ ...styles.container, backgroundColor: colors.surface, ...(style as ViewStyle) } as ViewStyle}
        padding="sm"
        elevation="sm"
      >
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Spotify session expired
          </Text>
          <Pressable
            onPress={() => {
              resetTokenDeath();
              connectMutation.mutate();
            }}
            style={{
              backgroundColor: '#1DB954',
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Reconnect Spotify</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  if (!isConnected) {
    return null;
  }

  const track = activePlayback?.track ?? null;
  const isPlaying = activePlayback?.isPlaying ?? false;

  const displayProgress = progressMs;
  const displayDuration = durationMs;
  // When dragging, show the drag position; otherwise show actual progress
  const progressRatio = progressBar.ratio !== null && displayDuration > 0
    ? progressBar.ratio
    : displayDuration > 0
      ? displayProgress / displayDuration
      : 0;

  const volumeRatio = volumeBar.ratio ?? volume;

  return (
    <Card
      style={
        {
          ...styles.container,
          backgroundColor: colors.surface,
          ...(style as ViewStyle),
        } as ViewStyle
      }
      padding="sm"
      elevation="sm"
    >
      <View style={styles.content}>
        {track?.albumArt ? (
          <Image
            source={{ uri: track.albumArt }}
            style={[styles.albumArt, { borderRadius: borderRadius.sm }]}
          />
        ) : (
          <View
            style={[
              styles.albumArt,
              {
                borderRadius: borderRadius.sm,
                backgroundColor: colors.surfaceVariant,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Text style={{ color: SPOTIFY_GREEN, fontSize: 22 }}>{'\u266B'}</Text>
          </View>
        )}

        <View style={styles.trackInfo}>
          <Text
            variant="body"
            numberOfLines={1}
            style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}
          >
            {track?.name ?? 'Spotify Connected'}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13 }}>
            {track?.artist ?? 'Play something in Spotify first'}
          </Text>
        </View>
      </View>

      {/* Progress bar (middle) — draggable */}
      {track && (
        <View style={styles.progressSection}>
          <Text variant="caption" style={{ color: colors.textSecondary, fontSize: 11 }}>
            {formatTime(displayProgress)}
          </Text>
          <Pressable
            ref={progressBar.ref as React.Ref<View>}
            style={[styles.progressBarHitArea, { cursor: 'pointer' } as ViewStyle]}
          >
            <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceVariant }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, progressRatio * 100)}%`, backgroundColor: SPOTIFY_GREEN },
                ]}
              />
            </View>
          </Pressable>
          <Text variant="caption" style={{ color: colors.textSecondary, fontSize: 11 }}>
            {formatTime(displayDuration)}
          </Text>
        </View>
      )}

      {/* Controls (centered) */}
      <View style={styles.controlsRow}>
        <View style={styles.controls}>
          <Pressable
            onPress={controls.previous}
            style={[styles.controlButton, { backgroundColor: colors.surfaceVariant }]}
            accessibilityRole="button"
            accessibilityLabel="Previous track"
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{'\u23EE'}</Text>
          </Pressable>

          <Pressable
            onPress={() => controls.togglePlay(isPlaying)}
            style={[styles.playButton, { backgroundColor: colors.surfaceVariant }]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600' }}>
              {isPlaying ? '||' : '\u25B6'}
            </Text>
          </Pressable>

          <Pressable
            onPress={controls.next}
            style={[styles.controlButton, { backgroundColor: colors.surfaceVariant }]}
            accessibilityRole="button"
            accessibilityLabel="Next track"
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{'\u23ED'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Volume */}
      <View style={styles.volumeSection}>
        <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{'\uD83D\uDD0A'}</Text>
        <Pressable
          ref={volumeBar.ref as React.Ref<View>}
          style={[styles.volumeHitArea, { cursor: 'pointer' } as ViewStyle]}
        >
          <View style={[styles.volumeBarTrack, { backgroundColor: colors.surfaceVariant }]}>
            <View
              style={[
                styles.volumeBarFill,
                { width: `${Math.min(100, volumeRatio * 100)}%`, backgroundColor: SPOTIFY_GREEN },
              ]}
            />
          </View>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  albumArt: {
    width: 48,
    height: 48,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  progressBarHitArea: {
    flex: 1,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 40,
  },
  volumeHitArea: {
    flex: 1,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  volumeBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export function SpotifyMiniPlayer(props: SpotifyMiniPlayerProps): React.ReactElement | null {
  if (Platform.OS !== 'web') return null;
  return <SpotifyMiniPlayerWeb {...props} />;
}

export default SpotifyMiniPlayer;
