import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

export const KEYBOARD_BAR_HEIGHT = 44;

type Register = (fn: (() => void) | null) => void;
const Ctx = createContext<Register>(() => {});

/**
 * The iOS number pad has no return key, so a Done bar sits on top of the keyboard
 * whenever it's open. Mounted once at the root; screens can add a Next button with
 * useKeyboardNext.
 */
export function KeyboardBarHost({ children }: { children: ReactNode }) {
  const next = useRef<(() => void) | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const register = useCallback<Register>((fn) => {
    next.current = fn;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      setTop(e.endCoordinates.screenY - KEYBOARD_BAR_HEIGHT);
      setHasNext(!!next.current);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setTop(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Ctx.Provider value={register}>
      {children}
      {top != null && (
        <View style={[styles.bar, { top }]}>
          {hasNext ? (
            <Pressable onPress={() => next.current?.()} hitSlop={10}>
              <Text style={styles.next}>Next</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={Keyboard.dismiss} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
      )}
    </Ctx.Provider>
  );
}

/** Shows a Next button on the keyboard bar while this screen is mounted. */
export function useKeyboardNext(onNext: () => void) {
  const register = useContext(Ctx);
  useEffect(() => {
    register(onNext);
    return () => register(null);
  }, [register, onNext]);
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: KEYBOARD_BAR_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  next: { color: colors.text, fontSize: 17 },
  done: { color: colors.text, fontSize: 17, fontWeight: '600' },
});
