import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KEYBOARD_BAR_HEIGHT } from '@/components/KeyboardBar';
import { courses } from '@/data/course';
import zaCourses from '@/data/za-courses.json';
import { scoreDifferential } from '@/lib/handicap';
import { useStore } from '@/state/store';
import { colors, radius, type } from '@/theme';

/** A course + tees whose rating and slope we already know. */
type Known = { name: string; tee: string; par: number; rating: number; slope: number };
type ZaCourse = { name: string; province: string; town?: string };

const num = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

// "Royal Cape Golf Club" should match "royal cape" and "royalcape".
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const MAX_SUGGESTIONS = 8;

export default function AddRoundScreen() {
  const { profile, addHistory } = useStore();

  // Ratings we know: the app's built-in tees, then every course + tee you've logged before (newest wins).
  const known: Known[] = courses.flatMap((c) =>
    c.tees.map((t) => ({ name: c.name, tee: t.name, par: c.holes.reduce((s, h) => s + h.par, 0), rating: t.rating, slope: t.slope })),
  );
  for (const r of [...profile.rounds].sort((a, b) => b.date.localeCompare(a.date))) {
    const tee = r.teeName ?? '';
    if (!known.some((k) => k.name === r.courseName && k.tee === tee)) {
      known.push({ name: r.courseName, tee, par: r.par, rating: r.rating, slope: r.slope });
    }
  }

  const [courseName, setCourseName] = useState('');
  const [picked, setPicked] = useState<{ province?: string; remembered: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const [teeName, setTeeName] = useState('');
  const [date, setDate] = useState(new Date());
  const [gross, setGross] = useState('');
  const [par, setPar] = useState('72');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');

  const q = norm(courseName);
  const knownMatches = q ? known.filter((k) => norm(k.name).includes(q)) : known.slice(0, 4);
  const zaMatches = q
    ? (zaCourses as ZaCourse[]).filter((c) => norm(c.name).includes(q) && !known.some((k) => k.name === c.name))
    : [];

  const pickKnown = (k: Known) => {
    setCourseName(k.name);
    setTeeName(k.tee);
    setPar(String(k.par));
    setRating(String(k.rating));
    setSlope(String(k.slope));
    setPicked({ remembered: true });
    setSearching(false);
  };

  const pickZa = (c: ZaCourse) => {
    setCourseName(c.name);
    setTeeName('');
    setRating('');
    setSlope('');
    setPicked({ province: c.province, remembered: false });
    setSearching(false);
  };

  const g = num(gross);
  const pr = num(par);
  const cr = num(rating);
  const sl = num(slope);
  const errors = [
    !courseName.trim() && 'course',
    (g == null || g < 50 || g > 200) && 'score',
    (pr == null || pr < 60 || pr > 80) && 'par',
    (cr == null || cr < 55 || cr > 85) && 'course rating',
    (sl == null || sl < 55 || sl > 155) && 'slope (55–155)',
  ].filter(Boolean);
  const valid = errors.length === 0;

  const save = () => {
    if (!valid) return;
    addHistory({
      id: `${Date.now()}`,
      date: date.toISOString().slice(0, 10),
      courseName: courseName.trim(),
      teeName: teeName.trim() || undefined,
      par: pr!,
      rating: cr!,
      slope: Math.round(sl!),
      gross: Math.round(g!),
      adjusted: Math.round(g!),
      source: 'manual',
    });
    router.back();
  };

  const showList = searching && (knownMatches.length > 0 || zaMatches.length > 0 || q.length > 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Add round</Text>
        <Pressable onPress={save} disabled={!valid} hitSlop={10}>
          <Text style={[styles.save, !valid && { color: colors.line }]}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={KEYBOARD_BAR_HEIGHT} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Field label="Course">
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={courseName}
                onChangeText={(t) => {
                  setCourseName(t);
                  setPicked(null);
                  setSearching(true);
                }}
                onFocus={() => setSearching(true)}
                placeholder="Search South African courses"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => setSearching(false)}
              />
              {courseName.length > 0 && (
                <Pressable
                  onPress={() => {
                    setCourseName('');
                    setPicked(null);
                    setSearching(true);
                  }}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>

            {showList && (
              <View style={styles.results}>
                {knownMatches.slice(0, MAX_SUGGESTIONS).map((k) => (
                  <Pressable key={`k-${k.name}-${k.tee}`} onPress={() => pickKnown(k)} style={styles.result}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {k.name}
                        {k.tee ? ` · ${k.tee}` : ''}
                      </Text>
                      <Text style={type.small}>
                        Rating {k.rating.toFixed(1)} · Slope {k.slope}
                      </Text>
                    </View>
                    <Ionicons name="bookmark" size={14} color={colors.accent} />
                  </Pressable>
                ))}
                {zaMatches.slice(0, Math.max(0, MAX_SUGGESTIONS - knownMatches.length)).map((c) => (
                  <Pressable key={`z-${c.name}-${c.province}`} onPress={() => pickZa(c)} style={styles.result}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={type.small}>{c.town ? `${c.town}, ${c.province}` : c.province}</Text>
                    </View>
                  </Pressable>
                ))}
                {q.length > 0 && !known.some((k) => norm(k.name) === q) && !zaMatches.some((c) => norm(c.name) === q) && (
                  <Pressable onPress={() => setSearching(false)} style={styles.result}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.text} />
                    <Text style={[styles.resultName, { flex: 1 }]} numberOfLines={1}>
                      Use “{courseName.trim()}”
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {!searching && picked && (
              <Text style={type.small}>
                {picked.remembered
                  ? 'Rating and slope filled in from before.'
                  : `${picked.province}. Enter the rating and slope for your tees from the scorecard or the GolfRSA app; the app remembers them for next time.`}
              </Text>
            )}
          </Field>

          <View style={styles.row}>
            <Field label="Tees" flex>
              <TextInput
                value={teeName}
                onChangeText={setTeeName}
                placeholder="e.g. Yellow"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="words"
              />
            </Field>
            <Field label="Date" flex>
              <View style={[styles.input, { justifyContent: 'center', alignItems: 'flex-start' }]}>
                <DateTimePicker value={date} mode="date" display="compact" maximumDate={new Date()} onChange={(_, d) => d && setDate(d)} />
              </View>
            </Field>
          </View>

          <View style={styles.row}>
            <Field label="Score" flex>
              <TextInput value={gross} onChangeText={setGross} keyboardType="number-pad" placeholder="e.g. 88" placeholderTextColor={colors.muted} style={styles.input} maxLength={3} />
            </Field>
            <Field label="Par" flex>
              <TextInput value={par} onChangeText={setPar} keyboardType="number-pad" style={styles.input} maxLength={2} />
            </Field>
          </View>

          <View style={styles.row}>
            <Field label="Course rating" flex>
              <TextInput value={rating} onChangeText={setRating} keyboardType="decimal-pad" placeholder="e.g. 72.4" placeholderTextColor={colors.muted} style={styles.input} maxLength={4} />
            </Field>
            <Field label="Slope" flex>
              <TextInput value={slope} onChangeText={setSlope} keyboardType="number-pad" placeholder="e.g. 131" placeholderTextColor={colors.muted} style={styles.input} maxLength={3} />
            </Field>
          </View>

          <Text style={type.small}>
            18-hole score, adjusted so no hole is worse than a net double bogey.
          </Text>

          {valid ? (
            <View style={styles.preview}>
              <Text style={type.small}>Score differential</Text>
              <Text style={styles.previewValue}>{scoreDifferential(g!, cr!, sl!).toFixed(1)}</Text>
            </View>
          ) : (
            <Text style={[type.small, { color: colors.muted }]}>Still needed: {errors.join(', ')}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <View style={[{ gap: 6 }, flex && { flex: 1 }]}>
      <Text style={type.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  cancel: { fontSize: 16, color: colors.muted },
  save: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { padding: 20, gap: 18 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
  results: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    marginTop: -StyleSheet.hairlineWidth,
  },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  preview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: 16 },
  previewValue: { fontSize: 22, fontWeight: '700', color: colors.text },
});
