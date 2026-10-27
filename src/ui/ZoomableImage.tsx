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
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const DIRECTION_SLOP: [number, number] = [-12, 12];

type Props = {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
  onDismiss: () => void;
  onShare: () => void;
};

const SHARE_DISTANCE = 90;
const SHARE_PULL_LIMIT = 70;

export function ZoomableImage({ uri, width, height, onZoomChange, onDismiss, onShare }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const drag = useSharedValue(0);

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

  const dismissPan = usePanGesture({
    runOnJS: true,
    enabled: !zoomed,
    activeOffsetY: DIRECTION_SLOP,
    failOffsetX: DIRECTION_SLOP,
    onUpdate: (e) => {
      drag.value = e.translationY >= 0 ? e.translationY : Math.max(e.translationY / 3, -SHARE_PULL_LIMIT);
    },
    onDeactivate: (e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        onDismiss();
        return;
      }
      if (e.translationY < -SHARE_DISTANCE || e.velocityY < -DISMISS_VELOCITY) onShare();
      drag.value = withTiming(0);
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

  const gesture = useSimultaneousGestures(pinch, pan, dismissPan, doubleTap);

  const animated = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.max(drag.value, 0) / 600, 0.5),
    transform: [
      { translateX: x.value },
      { translateY: y.value + drag.value },
      { scale: scale.value * (1 - Math.min(Math.max(drag.value, 0) / 2000, 0.15)) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, animated]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
