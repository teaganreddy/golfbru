import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KEYBOARD_BAR_HEIGHT } from '@/components/KeyboardBar';
import { Segmented } from '@/components/Segmented';
import { courses, getCourse, getTee } from '@/data/course';
import { courseHandicap, formatIndex } from '@/lib/handicap';
import { FORMATS, type Format } from '@/lib/scoring';
import { useStore, type Player } from '@/state/store';
import { colors, radius, type } from '@/theme';

const MAX_PLAYERS = 4;

export default function HomeScreen() {
  const { ready, round, course, lastPlayers, startRound, profile, setProfile, handicap, teeChoice, setTeeChoice } = useStore();
  const [courseId, setCourseId] = useState(courses[0].id);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [startHole, setStartHole] = useState(0);
  const [format, setFormat] = useState<Format>('stroke');

  if (!ready) return <View style={styles.screen} />;

  // You are always player 1; older saved lists didn't mark that.
  const list = (players ?? lastPlayers).map((p, i) => (i === 0 ? { ...p, me: true } : p));
  const thru = round ? round.scores[0].filter((s) => s != null).length : 0;

  const selected = getCourse(courseId);
  const par = selected.holes.reduce((s, h) => s + h.par, 0);
  const tee = getTee(selected, teeChoice[courseId]);

  // Your handicap for this round comes from your index once you have one.
  const myHcp =
    handicap.index == null
      ? list[0].handicap
      : Math.max(0, courseHandicap(handicap.index, tee.slope, tee.rating, par));

  const setCount = (n: number) =>
    setPlayers(Array.from({ length: n }, (_, i) => list[i] ?? { name: '', handicap: null }));

  const formats = FORMATS.filter((f) => list.length >= f.minPlayers && list.length <= f.maxPlayers);
  // Match play needs exactly two; fall back if the player count changes.
  const chosen = formats.find((f) => f.id === format) ?? formats[0];

  const edit = (i: number, patch: Partial<Player>) =>
    setPlayers(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const start = () => {
    startRound(
      courseId,
      list.map((p, i) =>
        i === 0
          ? { name: profile.name.trim() || 'Me', handicap: myHcp, me: true }
          : { name: p.name.trim() || `Player ${i + 1}`, handicap: p.handicap },
      ),
      startHole,
      chosen.id,
    );
    router.replace('/hole');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={KEYBOARD_BAR_HEIGHT} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.header}>
            <Image source={require('../../assets/golfbru-wordmark.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="GolfBru" />
            <View style={styles.headerRight}>
              <Pressable onPress={() => router.push('/bag?from=home')} style={styles.iconButton} hitSlop={8}>
                <Ionicons name="golf-outline" size={20} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => router.push('/profile?from=home')} hitSlop={8}>
                {profile.photoUri ? (
                  <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Ionicons name="person" size={18} color={colors.muted} />
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 2 }}>
            <Text style={type.small}>
              {profile.name ? `Howzit, ${profile.name.split(' ')[0]}` : 'Howzit'}
              {handicap.index == null ? '' : ` · Handicap ${formatIndex(handicap.index)}`}
            </Text>
            <Text style={type.title}>New round</Text>
          </View>

          {round && (
            <Pressable style={styles.resume} onPress={() => router.replace('/hole')}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.resumeTitle}>Continue round</Text>
                <Text style={type.small}>
                  Hole {course.holes[round.hole].number} · {thru} played · {round.players.map((p) => p.name).join(', ')}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.text} />
            </Pressable>
          )}

          <Section label="Course">
            {courses.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCourseId(c.id)}
                style={styles.courseRow}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={type.small}>
                    {c.area} · Par {c.holes.reduce((s, h) => s + h.par, 0)}
                  </Text>
                  {courseId === c.id && (
                    <Text style={type.small}>
                      {tee.name} tees · Rating {tee.rating.toFixed(1)} · Slope {tee.slope}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name={courseId === c.id ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={courseId === c.id ? colors.text : colors.line}
                />
              </Pressable>
            ))}
          </Section>

          <Section label="Tees">
            <View style={styles.teeGrid}>
              {selected.tees.map((t) => {
                const on = tee.id === t.id;
                return (
                  <Pressable key={t.id} onPress={() => setTeeChoice(courseId, t.id)} style={[styles.teeOption, on && styles.teeOptionOn]}>
                    <View style={[styles.teeDot, { backgroundColor: t.colour }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.teeName, on && { color: colors.onPrimary }]} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={[type.small, on && { color: '#C9C9CE' }]}>
                        {t.rating.toFixed(1)} / {t.slope}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section label="Players">
            <Segmented
              options={Array.from({ length: MAX_PLAYERS }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
              value={list.length}
              onChange={setCount}
            />
            <View style={styles.group}>
              {list.map((p, i) => (
                <View key={i} style={[styles.playerRow, i > 0 && styles.divider]}>
                  <TextInput
                    value={i === 0 ? profile.name : p.name}
                    onChangeText={(name) => (i === 0 ? setProfile({ name }) : edit(i, { name }))}
                    placeholder={i === 0 ? 'Your name' : `Player ${i + 1}`}
                    placeholderTextColor={colors.muted}
                    style={styles.nameInput}
                    returnKeyType="done"
                    autoCapitalize="words"
                  />
                  <Text style={type.small}>HCP</Text>
                  {i === 0 && handicap.index != null ? (
                    // Worked out from your handicap index; change it by adding rounds in your profile.
                    <Text style={[styles.hcpInput, styles.hcpAuto]}>{myHcp}</Text>
                  ) : (
                    <TextInput
                      value={p.handicap == null ? '' : String(p.handicap)}
                      onChangeText={(t) => {
                        const n = parseInt(t.replace(/\D/g, ''), 10);
                        edit(i, { handicap: Number.isNaN(n) ? null : Math.min(n, 54) });
                      }}
                      keyboardType="number-pad"
                      placeholder="–"
                      placeholderTextColor={colors.muted}
                      maxLength={2}
                      style={styles.hcpInput}
                    />
                  )}
                </View>
              ))}
            </View>
            {handicap.index != null && (
              <Text style={type.small}>
                Your handicap of {myHcp} is your course handicap off the {tee.name.toLowerCase()} tees, from your index of{' '}
                {formatIndex(handicap.index)}.
              </Text>
            )}
          </Section>

          <Section label="Format">
            <View style={styles.formatGrid}>
              {formats.map((f) => {
                const on = chosen.id === f.id;
                return (
                  <Pressable key={f.id} onPress={() => setFormat(f.id)} style={[styles.formatOption, on && styles.formatOptionOn]}>
                    <Text style={[styles.formatName, on && { color: colors.onPrimary }]}>{f.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={type.small}>{chosen.blurb}</Text>
          </Section>

          <Section label="First tee">
            <Segmented
              options={[
                { value: 0, label: 'Hole 1' },
                { value: 9, label: 'Hole 10' },
              ]}
              value={startHole}
              onChange={setStartHole}
            />
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={({ pressed }) => [styles.start, pressed && { opacity: 0.8 }]} onPress={start}>
            <Text style={styles.startText}>{round ? 'Start new round' : 'Start round'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={type.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 110, height: 31 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarEmpty: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  resumeTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  teeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teeOption: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  teeOptionOn: { backgroundColor: colors.primary },
  teeDot: { width: 16, height: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#B5B5BA' },
  teeName: { fontSize: 15, fontWeight: '600', color: colors.text },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  nameInput: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
  hcpInput: { width: 36, fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'right', height: '100%' },
  hcpAuto: { height: undefined, color: colors.accent },
  formatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formatOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface },
  formatOptionOn: { backgroundColor: colors.primary },
  formatName: { fontSize: 15, fontWeight: '600', color: colors.text },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  start: { backgroundColor: colors.primary, borderRadius: radius.md, height: 56, alignItems: 'center', justifyContent: 'center' },
  startText: { color: colors.onPrimary, fontSize: 17, fontWeight: '600' },
});
