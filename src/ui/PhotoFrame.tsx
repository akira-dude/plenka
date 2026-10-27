import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from './theme';

export const FEED_MIN_RATIO = 3 / 4;
export const FEED_MAX_RATIO = 16 / 9;

export const clampRatio = (ratio: number, min: number, max: number) => Math.min(max, Math.max(min, ratio));

type Props = {
  uri: string;
  blurUri?: string;
  w: number;
  h: number;
  width: number;
  frameRatio?: number;
  children?: ReactNode;
};

export function PhotoFrame({ uri, blurUri, w, h, width, frameRatio, children }: Props) {
  const ratio = w / h;
  const frame = frameRatio ?? clampRatio(ratio, FEED_MIN_RATIO, FEED_MAX_RATIO);
  const exact = Math.abs(frame - ratio) < 0.01;
  return (
    <View style={[styles.frame, { width, height: width / frame }]}>
      {!exact && (
        <>
          <Image source={{ uri: blurUri ?? uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} />
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        </>
      )}
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={exact ? 'cover' : 'contain'}
        transition={120}
        recyclingKey={uri}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.photoBg },
  dim: { backgroundColor: 'rgba(0,0,0,0.12)' },
});
