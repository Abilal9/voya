import * as React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Place } from '@/services';
import { spacing } from '@/theme';
import { PlaceCard } from './PlaceCard';

const { width: SCREEN_W } = Dimensions.get('window');
const THRESHOLD = SCREEN_W * 0.28;

export type SwipeDirection = 'like' | 'dislike';

/** Imperative controls so the explicit buttons do exactly what the gesture does. */
export interface SwipeDeckHandle {
  like: () => void;
  dislike: () => void;
}

interface Props {
  places: Place[];
  onSwipe: (place: Place, direction: SwipeDirection) => void;
  onEmpty?: () => void;
}

/**
 * E04 swipe interaction.
 *
 * The gesture runs entirely on the UI thread — no JS state update per frame —
 * because the Gulf market skews mid-range Android, where that difference is the
 * difference between 60fps and visible stutter.
 */
export const SwipeDeck = React.forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { places, onSwipe, onEmpty },
  ref,
) {
  const [index, setIndex] = React.useState(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  // A new result set restarts the deck.
  React.useEffect(() => {
    setIndex(0);
    x.value = 0;
    y.value = 0;
  }, [places, x, y]);

  const current = places[index];
  const next = places[index + 1];

  const advance = React.useCallback(
    (direction: SwipeDirection) => {
      const place = places[index];
      if (!place) return;
      onSwipe(place, direction);
      const nextIndex = index + 1;
      setIndex(nextIndex);
      if (nextIndex >= places.length) onEmpty?.();
      x.value = 0;
      y.value = 0;
    },
    [index, places, onSwipe, onEmpty, x, y],
  );

  const fling = React.useCallback(
    (direction: SwipeDirection) => {
      x.value = withTiming(
        (direction === 'like' ? 1 : -1) * SCREEN_W * 1.5,
        { duration: 180 },
        () => {
          runOnJS(advance)(direction);
        },
      );
    },
    [advance, x],
  );

  React.useImperativeHandle(
    ref,
    () => ({ like: () => fling('like'), dislike: () => fling('dislike') }),
    [fling],
  );

  const pan = Gesture.Pan()
    .onChange((e) => {
      x.value += e.changeX;
      y.value += e.changeY;
    })
    .onEnd((e) => {
      if (Math.abs(x.value) > THRESHOLD || Math.abs(e.velocityX) > 900) {
        const direction: SwipeDirection = x.value > 0 ? 'like' : 'dislike';
        x.value = withTiming(Math.sign(x.value) * SCREEN_W * 1.5, { duration: 180 }, () => {
          runOnJS(advance)(direction);
        });
      } else {
        x.value = withSpring(0, { damping: 18 });
        y.value = withSpring(0, { damping: 18 });
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-SCREEN_W, 0, SCREEN_W], [-10, 0, 10])}deg` },
    ],
  }));

  const nextStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(x.value) / THRESHOLD, 1);
    return {
      transform: [{ scale: interpolate(progress, [0, 1], [0.94, 1]) }],
      opacity: interpolate(progress, [0, 1], [0.7, 1]),
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, THRESHOLD], [0, 1], 'clamp'),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-THRESHOLD, 0], [1, 0], 'clamp'),
  }));

  if (!current) return null;

  return (
    <View style={styles.wrap}>
      {next ? (
        <Animated.View style={[styles.layer, nextStyle]} pointerEvents="none">
          <PlaceCard place={next} />
        </Animated.View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.layer, topStyle]}>
          <PlaceCard place={current} />
          <Animated.View style={[styles.badge, styles.like, likeStyle]} pointerEvents="none" />
          <Animated.View style={[styles.badge, styles.nope, nopeStyle]} pointerEvents="none" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, marginVertical: spacing.sm },
  layer: { ...StyleSheet.absoluteFillObject },
  badge: { ...StyleSheet.absoluteFillObject, borderRadius: 26, borderWidth: 4 },
  like: { borderColor: '#4F7A5B' },
  nope: { borderColor: '#8E414C' },
});
