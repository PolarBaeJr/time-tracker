/**
 * SpotifyMiniPlayer
 *
 * Compact mini player widget for the Timer screen.
 * Shows album art, track name, artist, and playback controls.
 */

import * as React from 'react';
import { View, StyleSheet, Pressable, Image, type ViewStyle } from 'react-native';
import { Card, Text } from '@/components/ui';
import { useSpotifyConnection, useSpotifyPlayback, useSpotifyControls } from '@/hooks/useSpotify';
import { useTheme } from '@/theme';

export interface SpotifyMiniPlayerProps {
  style?: object;
}

export function SpotifyMiniPlayer({ style }: SpotifyMiniPlayerProps): React.ReactElement | null {
  const { colors, spacing, borderRadius } = useTheme();
  const { isConnected } = useSpotifyConnection();
  const { data: playback } = useSpotifyPlayback(isConnected);
  const controls = useSpotifyControls();

  if (!isConnected || !playback?.track) {
    return null;
  }

  const { track, isPlaying } = playback;

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
            onPress={isPlaying ? controls.pause : controls.play}
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
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
              {'\u25B6\u25B6'}
            </Text>
          </Pressable>
        </View>
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
});

export default SpotifyMiniPlayer;
