import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { formatStamp } from '@/domain/dates';
import { useDbQuery } from '@/hooks/useDbQuery';
import { listWithCoords } from '@/storage/posts';
import { MAP_BASE_URL, buildMapHtml, type MapPoint } from '@/ui/mapHtml';
import { space, type Palette } from '@/ui/theme';
import { useStyles, useTheme } from '@/ui/ThemeProvider';

const EXCERPT = 120;

export default function MapScreen() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { data } = useDbQuery(listWithCoords, []);

  const points = useMemo<MapPoint[]>(
    () =>
      data.flatMap(({ post, frame }) =>
        post.place?.lat != null && post.place.lon != null
          ? [
              {
                id: post.id,
                lat: post.place.lat,
                lon: post.place.lon,
                title: `№ ${frame} · ${formatStamp(post.createdAt)}`,
                text: post.text.slice(0, EXCERPT),
              },
            ]
          : [],
      ),
    [data],
  );

  const html = useMemo(() => buildMapHtml(points, focus ?? null, scheme, colors), [points, focus, scheme, colors]);

  return (
    <View style={styles.screen}>
      <WebView
        style={styles.map}
        originWhitelist={['*']}
        source={{ html, baseUrl: MAP_BASE_URL }}
        onMessage={(e) => router.push(`/post/${e.nativeEvent.data}`)}
      />
      {points.length === 0 && (
        <View style={[styles.hint, { bottom: space.gutter * 2 + insets.bottom }]}>
          <Text style={styles.hintText}>Пока нет записей с координатами. Они появятся, когда в записи будет место по GPS.</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    map: { flex: 1, backgroundColor: c.bg },
    hint: {
      position: 'absolute',
      left: space.gutter,
      right: space.gutter,
      bottom: space.gutter * 2,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
    },
    hintText: { fontSize: 14, color: c.ink },
  });
