import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme';

export function Segmented<T extends string | number>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.track}>
      {props.options.map((o) => {
        const on = o.value === props.value;
        return (
          <Pressable key={String(o.value)} onPress={() => props.onChange(o.value)} style={[styles.item, on && styles.itemOn]}>
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3 },
  item: { flex: 1, height: 40, borderRadius: radius.sm + 1, alignItems: 'center', justifyContent: 'center' },
  itemOn: {
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  text: { fontSize: 15, fontWeight: '500', color: colors.muted },
  textOn: { color: colors.text, fontWeight: '600' },
});
