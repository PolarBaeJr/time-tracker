/**
 * SpotifyMiniPlayer
 *
 * Compact mini player widget for the Timer screen.
 * Shows album art, track name, artist, and playback controls.
 * Premium users get in-app audio via the Web Playback SDK;
 * free users fall back to remote control via the Web API.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { Card, Text } from '@/components/ui';
import {
  useSpotifyConnection,
  useSpotifyPlayback,
  useSpotifyControls,
  useSpotifyPlayer,
  useSpotifySDKPlayback,
  useSpotifyProgress,
} from '@/hooks/useSpotify';
import { useTheme } from '@/theme';

const SPOTIFY_GREEN = '#1DB954';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface SpotifyMiniPlayerProps {
  style?: object;
}

function SpotifyMiniPlayerWeb({ style }: SpotifyMiniPlayerProps): React.ReactElement | null {
  const { colors, borderRadius } = useTheme();
  const { data: connection, isConnected } = useSpotifyConnection();
  const { isReady, isPremium } = useSpotifyPlayer(connection);

  // SDK playback (Premium users)
  const sdkPlayback = useSpotifySDKPlayback();

  // Web API polling fallback (free users or when SDK not ready)
  const useSdkState = isPremium && isReady && !!sdkPlayback;
  const { data: apiPlayback } = useSpotifyPlayback(isConnected && !useSdkState);

  const playback = useSdkState ? sdkPlayback : apiPlayback;
  const controls = useSpotifyControls();
  const { progressMs, durationMs } = useSpotifyProgress(useSdkState ? sdkPlayback : null);

  // Volume state
  const [volume, setVolume] = useState(0.5);

  // Progress bar seek
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const onProgressBarLayout = useCallback((e: LayoutChangeEvent) => {
    setProgressBarWidth(e.nativeEvent.layout.width);
  }, []);

  const handleProgressSeek = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (!progressBarWidth || !durationMs) return;
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / progressBarWidth));
      const seekMs = Math.floor(ratio * durationMs);
      void controls.seek(seekMs);
    },
    [progressBarWidth, durationMs, controls]
  );

  // Volume bar
  const [volumeBarWidth, setVolumeBarWidth] = useState(0);
  const onVolumeBarLayout = useCallback((e: LayoutChangeEvent) => {
    setVolumeBarWidth(e.nativeEvent.layout.width);
  }, []);

  const handleVolumeSeek = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (!volumeBarWidth) return;
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / volumeBarWidth));
      setVolume(ratio);
      void controls.setVolume(ratio);
    },
    [volumeBarWidth, controls]
  );

  if (!isConnected || !playback?.track) {
    return null;
  }

  const { track, isPlaying } = playback;

  // Use SDK progress when available, otherwise fall back to track data
  const displayProgress = useSdkState ? progressMs : (track.progressMs ?? 0);
  const displayDuration = useSdkState ? durationMs : (track.durationMs ?? 0);
  const progressRatio = displayDuration > 0 ? displayProgress / displayDuration : 0;

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
        {track.albumArt && (
          <Image
            source={{ uri: track.albumArt }}
            style={[styles.albumArt, { borderRadius: borderRadius.sm }]}
          />
        )}

        <View style={styles.trackInfo}>
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={{ color: colors.text, fontWeight: '600' }}
          >
            {track.name}
          </Text>
          <Text variant="caption" numberOfLines={1} style={{ color: colors.textSecondary }}>
            {track.artist}
          </Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={controls.previous}
            style={[styles.controlButton, { backgroundColor: colors.surfaceVariant }]}
            accessibilityRole="button"
            accessibilityLabel="Previous track"
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{'\u23EE'}</Text>
          </Pressable>

          <Pressable
            onPress={controls.togglePlay}
            style={[styles.controlButton, { backgroundColor: colors.surfaceVariant }]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              {isPlaying ? '||' : '\u25B6'}
            </Text>
          </Pressable>

          <Pressable
            onPress={controls.next}
            style={[styles.controlButton, { backgroundColor: colors.surfaceVariant }]}
            accessibilityRole="button"
            accessibilityLabel="Next track"
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{'\u23ED'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <Text variant="caption" style={{ color: colors.textSecondary, fontSize: 10 }}>
          {formatTime(displayProgress)}
        </Text>
        <Pressable
          onPress={handleProgressSeek}
          onLayout={onProgressBarLayout}
          style={[styles.progressBarTrack, { backgroundColor: colors.surfaceVariant }]}
        >
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, progressRatio * 100)}%`, backgroundColor: SPOTIFY_GREEN },
            ]}
          />
        </Pressable>
        <Text variant="caption" style={{ color: colors.textSecondary, fontSize: 10 }}>
          {formatTime(displayDuration)}
        </Text>
      </View>

      {/* Volume control (only when SDK is active) */}
      {useSdkState && (
        <View style={styles.volumeSection}>
          <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{'\uD83D\uDD0A'}</Text>
          <Pressable
            onPress={handleVolumeSeek}
            onLayout={onVolumeBarLayout}
            style={[styles.volumeBarTrack, { backgroundColor: colors.surfaceVariant }]}
          >
            <View
              style={[
                styles.volumeBarFill,
                { width: `${Math.min(100, volume * 100)}%`, backgroundColor: SPOTIFY_GREEN },
              ]}
            />
          </Pressable>
        </View>
      )}

      {/* Premium required notice */}
      {!isPremium && (
        <Text
          variant="caption"
          style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4, textAlign: 'center' }}
        >
          Premium required for in-app playback
        </Text>
      )}
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
    width: 40,
    height: 40,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  volumeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 20,
  },
  volumeBarTrack: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    borderRadius: 1,
  },
});

export function SpotifyMiniPlayer(props: SpotifyMiniPlayerProps): React.ReactElement | null {
  if (Platform.OS !== 'web') return null;
  return <SpotifyMiniPlayerWeb {...props} />;
}

export default SpotifyMiniPlayer;
