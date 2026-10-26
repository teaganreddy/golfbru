import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

type Look = { label: string; bg: string; fg: string };

export function scoreLook(score: number, par: number): Look {
  if (score === 1) return { label: 'Hole in one!', bg: '#FFF1CC', fg: '#8A5A00' };
  const diff = score - par;
  if (diff <= -3) return { label: 'Albatross', bg: '#0A0A0B', fg: '#FFFFFF' };
  if (diff === -2) return { label: 'Eagle', bg: '#12A150', fg: '#FFFFFF' };
  if (diff === -1) return { label: 'Birdie', bg: '#E4F6EA', fg: '#0B7A3B' };
  if (diff === 0) return { label: 'Par', bg: '#F0F0F2', fg: '#3F3F46' };
  if (diff === 1) return { label: 'Bogey', bg: '#FFF0E0', fg: '#B54708' };
  if (diff === 2) return { label: 'Double bogey', bg: '#FDE8E8', fg: '#C0262D' };
  if (diff === 3) return { label: 'Triple bogey', bg: '#FAD4D4', fg: '#A01B21' };
  return { label: `+${diff}`, bg: '#FAD4D4', fg: '#A01B21' };
}

/** Little pill naming the score; pops in whenever the name changes. */
export function ScoreBadge({ score, par }: { score: number; par: number }) {
  const look = scoreLook(score, par);
  const [pop] = useState(() => new Animated.Value(1));

  useEffect(() => {
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }).start();
  }, [look.label, pop]);

  return (
    <Animated.View
      style={[
        styles.pill,
        { backgroundColor: look.bg, opacity: pop.interpolate({ inputRange: [0.6, 1], outputRange: [0, 1] }), transform: [{ scale: pop }] },
      ]}
    >
      <Animated.Text style={[styles.text, { color: look.fg }]}>{look.label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 3 },
  text: { fontSize: 12, fontWeight: '600' },
});
