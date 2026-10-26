import { Redirect, router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Hole } from '@/data/course';
import { formatName, matchState, stablefordPoints, standings, strokesTable } from '@/lib/scoring';
import { useStore, type Player } from '@/state/store';
import { colors, radius, type } from '@/theme';

export default function ScorecardScreen() {
  const { round, course, order, setHole, endRound } = useStore();
  if (!round) return <Redirect href="/" />;

  const holes = course.holes;

  const me = round.players.findIndex((p) => p.me);
  const myComplete = me >= 0 && round.scores[me].every((s) => s != null);
  const handicapNote =
    me < 0
      ? ''
      : !myComplete
        ? 'Only full 18-hole rounds count toward your handicap, so this one won’t be saved to your profile.'
        : !round.tee
          ? 'No course rating or slope was set for this course, so this round can’t count toward your handicap.'
          : 'Your score will be added to your profile and your handicap recalculated.';

  const finish = () =>
    Alert.alert('Finish round?', handicapNote || 'This clears the scorecard.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          const result = endRound(true);
          router.replace(result === 'saved' ? '/profile?from=home' : '/');
        },
      },
    ]);

  const open = (i: number) => {
    setHole(i);
    router.navigate('/hole');
  };

  const strokes = strokesTable(round.format, round.players.map((p) => p.handicap), holes);
  const match = round.format === 'match' ? matchState(round.players.map((p) => p.name), round.scores, holes, strokes, order) : null;

  const nines = [
    { title: 'Out', start: 0 },
    { title: 'In', start: 9 },
  ];
  // Show the nine you started on first.
  if (round.startHole === 9) nines.reverse();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: 4 }}>
          <Text style={type.title}>Scorecard</Text>
          <Text style={type.small}>{course.name}</Text>
        </View>

        <Summary />

        {nines.map((n) => (
          <Nine
            key={n.title}
            title={n.title}
            holes={holes.slice(n.start, n.start + 9)}
            offset={n.start}
            players={round.players}
            scores={round.scores}
            current={round.hole}
            onOpen={open}
            strokes={strokes}
            points={round.format === 'stableford'}
            winners={match?.results ?? null}
          />
        ))}

        <Pressable onPress={finish} style={styles.finish}>
          <Text style={styles.finishText}>Finish round</Text>
        </Pressable>
        <Text style={styles.credit}>Course map © {course.source}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Leaderboard (or match status) for the round's format. */
function Summary() {
  const { round, course, order } = useStore();
  const r = round!;
  const holes = course.holes;
  const strokes = strokesTable(r.format, r.players.map((p) => p.handicap), holes);

  if (r.format === 'match') {
    const m = matchState(r.players.map((p) => p.name), r.scores, holes, strokes, order);
    const won = [0, 1].map((p) => m.results.filter((x) => x === p).length);
    const halved = m.results.filter((x) => x === null).length;
    return (
      <View style={styles.summary}>
        <Text style={type.label}>Match play</Text>
        <Text style={styles.matchSummary}>{m.summary}</Text>
        <Text style={type.small}>
          Holes won: {r.players[0].name} {won[0]} · {r.players[1].name} {won[1]} · halved {halved}
        </Text>
        {strokes.some((row) => row.some((x) => x > 0)) && (
          <Text style={type.small}>
            {r.players[strokes[0].some((x) => x > 0) ? 0 : 1].name} gets{' '}
            {strokes.flat().reduce((a, b) => a + b, 0)} shots (holes marked •)
          </Text>
        )}
      </View>
    );
  }

  const rows = standings(r.format, r.scores, holes, strokes);
  const unit = r.format === 'stableford' ? 'pts' : r.format === 'medal' ? 'net' : '';
  return (
    <View style={styles.summary}>
      <Text style={type.label}>{formatName(r.format)}</Text>
      {rows.map((x, rank) => (
        <View key={x.player} style={styles.totalRow}>
          {r.players.length > 1 && <Text style={styles.rank}>{x.thru ? rank + 1 : '–'}</Text>}
          <View style={{ flex: 1 }}>
            <Text style={styles.totalName} numberOfLines={1}>
              {r.players[x.player].name}
            </Text>
            <Text style={type.small}>
              {x.thru ? `Thru ${x.thru}` : 'Not started'}
              {r.format !== 'stroke' && r.players[x.player].handicap ? ` · hcp ${r.players[x.player].handicap}` : ''}
            </Text>
          </View>
          <Text style={styles.totalGross}>
            {x.thru ? x.value : '–'}
            {x.thru && unit ? <Text style={type.small}> {unit}</Text> : null}
          </Text>
          {r.format !== 'stableford' && (
            <Text style={[styles.totalToPar, { color: x.toPar < 0 ? colors.accent : colors.muted }]}>
              {x.thru ? formatToPar(x.toPar) : ''}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Nine(props: {
  title: string;
  holes: Hole[];
  offset: number;
  players: Player[];
  scores: (number | null)[][];
  current: number;
  onOpen: (i: number) => void;
  strokes: number[][]; // handicap shots per player per hole for this format
  points: boolean; // show Stableford points
  winners: (0 | 1 | null | undefined)[] | null; // match play hole winners
}) {
  const par = props.holes.reduce((s, h) => s + h.par, 0);
  const slice = props.scores.map((row) => row.slice(props.offset, props.offset + props.holes.length));

  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headRow]}>
        <Text style={[styles.cell, styles.holeCell, styles.head]}>Hole</Text>
        <Text style={[styles.cell, styles.head]}>Par</Text>
        {props.players.map((p, i) => (
          <Text key={i} style={[styles.cell, styles.head]} numberOfLines={1}>
            {initials(p.name)}
          </Text>
        ))}
      </View>
      {props.holes.map((h, i) => {
        const idx = props.offset + i;
        return (
          <Pressable key={h.number} onPress={() => props.onOpen(idx)} style={[styles.row, idx === props.current && styles.current]}>
            <Text style={[styles.cell, styles.holeCell]}>
              {h.number}
              <Text style={styles.si}>
                {'  '}SI {h.strokeIndex}
                {props.strokes.some((row) => row[idx] > 0) ? ' •' : ''}
              </Text>
            </Text>
            <Text style={[styles.cell, { color: colors.muted }]}>{h.par}</Text>
            {props.players.map((p, j) => {
              const sc = slice[j][i];
              const pts = props.points && sc != null ? stablefordPoints(sc, h.par, props.strokes[j][idx]) : null;
              return <ScoreCell key={j} score={sc} par={h.par} points={pts} won={props.winners?.[idx] === j} />;
            })}
          </Pressable>
        );
      })}
      <View style={[styles.row, styles.footRow]}>
        <Text style={[styles.cell, styles.holeCell, styles.foot]}>{props.title}</Text>
        <Text style={[styles.cell, styles.foot]}>{par}</Text>
        {slice.map((row, j) => (
          <Text key={j} style={[styles.cell, styles.foot]}>
            {row.some((s) => s != null) ? row.reduce<number>((s, v) => s + (v ?? 0), 0) : '–'}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Circle for birdie or better, square for bogey or worse, like a paper card. */
function ScoreCell({ score, par, points, won }: { score: number | null; par: number; points: number | null; won: boolean }) {
  if (score == null) return <Text style={[styles.cell, { color: colors.line }]}>–</Text>;
  const diff = score - par;
  return (
    <View style={styles.cellWrap}>
      <View style={[styles.mark, diff < 0 && styles.under, diff > 0 && styles.over]}>
        <Text style={[styles.markText, diff < 0 && { color: colors.onPrimary }]}>{score}</Text>
      </View>
      {points != null && <Text style={styles.cellPts}>{points}</Text>}
      {won && <View style={styles.wonDot} />}
    </View>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 2) || '?';

function formatToPar(n: number) {
  return n === 0 ? 'E' : n > 0 ? `+${n}` : String(n);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 20 },
  summary: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 2 },
  matchSummary: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5, marginTop: 2 },
  rank: { fontSize: 15, fontWeight: '700', color: colors.muted, width: 18 },
  cellPts: { position: 'absolute', right: 2, bottom: -2, fontSize: 9, fontWeight: '700', color: colors.accent },
  wonDot: { position: 'absolute', bottom: -3, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  totalName: { fontSize: 16, fontWeight: '600', color: colors.text },
  totalGross: { fontSize: 24, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  totalToPar: { fontSize: 15, fontWeight: '600', minWidth: 32, textAlign: 'right' },
  table: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 12 },
  headRow: { backgroundColor: colors.surface, height: 36 },
  footRow: { backgroundColor: colors.surface },
  current: { backgroundColor: '#F0FAF4' },
  cell: { flex: 1, fontSize: 15, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cellWrap: { flex: 1, alignItems: 'center' },
  holeCell: { flex: 1.6, textAlign: 'left', fontWeight: '600' },
  si: { fontSize: 11, fontWeight: '400', color: colors.muted },
  head: { fontSize: 12, fontWeight: '600', color: colors.muted },
  foot: { fontWeight: '700' },
  mark: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  under: { backgroundColor: colors.accent, borderRadius: 15 },
  over: { borderWidth: 1.5, borderColor: colors.text, borderRadius: 4 },
  markText: { fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  finish: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  finishText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  credit: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
