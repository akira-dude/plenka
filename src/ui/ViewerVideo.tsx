import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { MediaItem } from '@/domain/post';
import { useMediaUri } from '@/hooks/useMediaUri';
import { mediaUri } from '@/storage/paths';
import { fetchOriginal, hasOriginal } from '@/sync/media';

const VIEWER_FG = '#FFFFFF';
const NOTE_BG = 'rgba(0,0,0,0.55)';

type Props = { dir: string; item: MediaItem; width: number; height: number; active: boolean };

export function ViewerVideo({ dir, item, width, height, active }: Props) {
  const db = useSQLiteContext();
  const uri = useMediaUri(dir, item, true);
  const local = hasOriginal(dir, item);
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(local ? uri : null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (local) return;
    let alive = true;
    void fetchOriginal(db, dir, item).then((ok) => {
      if (alive) setFailed(!ok);
    });
    return () => {
      alive = false;
    };
  }, [db, dir, item, local]);

  useEffect(() => {
    if (!local) return;
    if (active) player.play();
    else player.pause();
  }, [active, local, player]);

  if (!local) {
    return (
      <View style={[styles.page, { width, height }]}>
        <Image source={{ uri: mediaUri(dir, item.thumb) }} style={StyleSheet.absoluteFill} contentFit="contain" />
        {failed ? (
          <Text style={styles.note}>Видео хранится только в облаке, а скачать его сейчас не получилось. Проверь интернет.</Text>
        ) : (
          <ActivityIndicator color={VIEWER_FG} size="large" />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.page, { width, height }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        surfaceType="textureView"
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', justifyContent: 'center' },
  note: {
    color: VIEWER_FG,
    backgroundColor: NOTE_BG,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
