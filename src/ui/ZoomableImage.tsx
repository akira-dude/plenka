import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = { uri: string; width: number; height: number; onZoomChange: (zoomed: boolean) => void };

export function ZoomableImage({ uri, width, height, onZoomChange }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const clampOffset = (value: number, size: number, s: number) => {
    const limit = (size * (s - 1)) / 2;
    return Math.min(limit, Math.max(-limit, value));
  };

  const setZoom = (next: boolean) => {
    setZoomed(next);
    onZoomChange(next);
  };

  const reset = () => {
    scale.value = withTiming(1);
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
    setZoom(false);
  };

  const pinch = usePinchGesture({
    runOnJS: true,
    onUpdate: (e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    },
    onDeactivate: () => {
      if (scale.value <= 1.02) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      x.value = clampOffset(x.value, width, scale.value);
      y.value = clampOffset(y.value, height, scale.value);
      savedX.value = x.value;
      savedY.value = y.value;
      setZoom(true);
    },
  });

  const pan = usePanGesture({
    runOnJS: true,
    enabled: zoomed,
    onUpdate: (e) => {
      x.value = clampOffset(savedX.value + e.translationX, width, scale.value);
      y.value = clampOffset(savedY.value + e.translationY, height, scale.value);
    },
    onDeactivate: () => {
      savedX.value = x.value;
      savedY.value = y.value;
    },
  });

  const doubleTap = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    onActivate: () => {
      if (zoomed) {
        reset();
        return;
      }
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      savedScale.value = DOUBLE_TAP_SCALE;
      setZoom(true);
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, animated]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
