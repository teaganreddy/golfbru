import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KEYBOARD_BAR_HEIGHT, useKeyboardNext } from '@/components/KeyboardBar';
import type { Club } from '@/lib/playsLike';
import { useStore } from '@/state/store';
import { colors, radius, type } from '@/theme';

const ROW_H = 56;

type Drag = { id: string; from: number; to: number };

export default function BagScreen() {
  const { bag, setBag } = useStore();
  // Opened from the home screen rather than the tab bar, so show a back button.
  const canGoBack = useLocalSearchParams<{ from?: string }>().from === 'home';
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragY] = useState(() => new Animated.Value(0));
  const inputs = useRef(new Map<string, ComponentRef<typeof TextInput>>());

  const update = (id: string, text: string) => {
    const n = parseInt(text.replace(/\D/g, ''), 10);
    setBag(bag.map((c) => (c.id === id ? { ...c, distance: Number.isNaN(n) ? null : n } : c)));
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    const id = String(Math.max(0, ...bag.map((c) => Number(c.id) || 0)) + 1);
    setBag([...bag, { id, name, distance: null }]);
    setNewName('');
    if (!editing) setTimeout(() => inputs.current.get(id)?.focus(), 50);
  };

  const focusNext = useCallback(() => {
    const next = bag[bag.findIndex((c) => c.id === focused) + 1];
    if (next) inputs.current.get(next.id)?.focus();
    else Keyboard.dismiss();
  }, [bag, focused]);
  useKeyboardNext(focusNext);

  const startDrag = (id: string, from: number) => {
    dragY.setValue(0);
    setDrag({ id, from, to: from });
  };
  const moveDrag = (dy: number) => {
    dragY.setValue(dy);
    setDrag((d) => {
      if (!d) return d;
      const to = Math.max(0, Math.min(bag.length - 1, d.from + Math.round(dy / ROW_H)));
      return to === d.to ? d : { ...d, to };
    });
  };
  const endDrag = () => {
    if (drag && drag.from !== drag.to) {
      const next = [...bag];
      const [moved] = next.splice(drag.from, 1);
      next.splice(drag.to, 0, moved);
      setBag(next);
    }
    dragY.setValue(0);
    setDrag(null);
  };

  // How far each row should slide to make room for the one being dragged.
  const shiftFor = (i: number) => {
    if (!drag) return 0;
    if (drag.from < i && i <= drag.to) return -ROW_H;
    if (drag.to <= i && i < drag.from) return ROW_H;
    return 0;
  };

  const sortByDistance = () => setBag([...bag].sort((a, b) => (b.distance ?? -1) - (a.distance ?? -1)));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={KEYBOARD_BAR_HEIGHT} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEnabled={!drag}
        >
          <View style={styles.headerLeft}>
            {canGoBack && (
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="chevron-back" size={26} color={colors.text} />
              </Pressable>
            )}
            <Text style={type.title}>My Bag</Text>
          </View>

          {/* Edit sits beside the list rather than in the top corner, where Expo Go's dev button floats. */}
          <View style={styles.toolbar}>
            <Text style={[type.small, { flex: 1 }]}>
              {editing
                ? 'Drag ≡ to reorder. Tap − to remove a club.'
                : 'Total distance for each club, carry plus roll. Tap a club to set it.'}
            </Text>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setEditing((e) => !e);
              }}
              hitSlop={10}
              style={[styles.editButton, editing && styles.editButtonOn]}
            >
              <Text style={[styles.editText, editing && { color: colors.onPrimary }]}>{editing ? 'Done' : 'Edit'}</Text>
            </Pressable>
          </View>

          <View style={styles.list}>
            {bag.map((c, i) => (
              <ClubRow
                key={c.id}
                club={c}
                index={i}
                editing={editing}
                focused={focused === c.id}
                dragging={drag?.id === c.id}
                dragY={dragY}
                shift={shiftFor(i)}
                first={i === 0}
                inputRef={(el) => {
                  if (el) inputs.current.set(c.id, el);
                  else inputs.current.delete(c.id);
                }}
                onFocusRow={() => inputs.current.get(c.id)?.focus()}
                onChange={(t) => update(c.id, t)}
                onFocus={() => setFocused(c.id)}
                onBlur={() => setFocused((f) => (f === c.id ? null : f))}
                onRemove={() => setBag(bag.filter((x) => x.id !== c.id))}
                onDragStart={() => startDrag(c.id, i)}
                onDragMove={moveDrag}
                onDragEnd={endDrag}
              />
            ))}
          </View>

          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={add}
              placeholder="Add a club"
              placeholderTextColor={colors.muted}
              style={styles.addInput}
              returnKeyType="done"
              autoCapitalize="words"
            />
            <Pressable onPress={add} hitSlop={10} disabled={!newName.trim()}>
              <Ionicons name="add-circle" size={26} color={newName.trim() ? colors.text : colors.line} />
            </Pressable>
          </View>

          {editing && (
            <Pressable onPress={sortByDistance} style={styles.sortButton}>
              <Ionicons name="swap-vertical" size={16} color={colors.text} />
              <Text style={styles.sortText}>Sort longest to shortest</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type RowProps = {
  club: Club;
  index: number;
  editing: boolean;
  focused: boolean;
  dragging: boolean;
  dragY: Animated.Value;
  shift: number;
  first: boolean;
  inputRef: (el: ComponentRef<typeof TextInput> | null) => void;
  onFocusRow: () => void;
  onChange: (t: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
};

// The drag handle's PanResponder is created once and reads the latest callbacks
// through a ref at gesture time, which the React Compiler's refs rule can't follow.
/* eslint-disable react-hooks/refs */
function ClubRow(props: RowProps) {
  const [offset] = useState(() => new Animated.Value(0));
  const handlers = useRef<RowProps | null>(null);
  useEffect(() => {
    handlers.current = props;
  });

  useEffect(() => {
    if (props.dragging) return;
    Animated.timing(offset, { toValue: props.shift, duration: 140, useNativeDriver: true }).start();
  }, [props.shift, props.dragging, offset]);

  // Rows snap back to their slot when the list re-renders in its new order.
  useEffect(() => {
    offset.setValue(0);
  }, [props.index, offset]);

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => handlers.current?.onDragStart(),
      onPanResponderMove: (_, g) => handlers.current?.onDragMove(g.dy),
      onPanResponderRelease: () => handlers.current?.onDragEnd(),
      onPanResponderTerminate: () => handlers.current?.onDragEnd(),
    }),
  );

  const c = props.club;
  return (
    <Animated.View
      style={[
        styles.row,
        !props.first && styles.rowLine,
        props.focused && styles.rowFocused,
        props.dragging && styles.rowDragging,
        { transform: [{ translateY: props.dragging ? props.dragY : offset }] },
      ]}
    >
      {props.editing && (
        <Pressable onPress={props.onRemove} hitSlop={10} style={{ marginRight: 12 }}>
          <Ionicons name="remove-circle" size={22} color={colors.danger} />
        </Pressable>
      )}
      <Pressable style={styles.rowMain} onPress={props.editing ? undefined : props.onFocusRow}>
        <Text style={styles.name} numberOfLines={1}>
          {c.name}
        </Text>
        {props.editing ? (
          <Text style={type.small}>{c.distance == null ? '' : `${c.distance} m`}</Text>
        ) : (
          <>
            <TextInput
              ref={props.inputRef}
              value={c.distance == null ? '' : String(c.distance)}
              onChangeText={props.onChange}
              onFocus={props.onFocus}
              onBlur={props.onBlur}
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder="–"
              placeholderTextColor={colors.muted}
              style={styles.input}
              maxLength={3}
            />
            <Text style={type.small}>m</Text>
          </>
        )}
      </Pressable>
      {props.editing && (
        <View {...pan.panHandlers} style={styles.handle} hitSlop={10}>
          <Ionicons name="reorder-three" size={24} color={colors.muted} />
        </View>
      )}
    </Animated.View>
  );
}

/* eslint-enable react-hooks/refs */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface },
  editButtonOn: { backgroundColor: colors.primary },
  editText: { fontSize: 15, fontWeight: '600', color: colors.text },
  list: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', height: ROW_H, backgroundColor: colors.surface },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowFocused: { backgroundColor: '#ECECEE', marginHorizontal: -16, paddingHorizontal: 16 },
  rowDragging: {
    zIndex: 10,
    backgroundColor: colors.bg,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%' },
  name: { flex: 1, fontSize: 16, color: colors.text },
  input: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    minWidth: 56,
    height: '100%',
    marginRight: 4,
    fontVariant: ['tabular-nums'],
  },
  handle: { paddingLeft: 16, height: '100%', justifyContent: 'center' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  addInput: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
  sortButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  sortText: { fontSize: 15, fontWeight: '500', color: colors.text },
});
