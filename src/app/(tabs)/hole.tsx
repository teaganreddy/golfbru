import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HoleMap } from '@/components/HoleMap';
import { ScoreBadge } from '@/components/ScoreBadge';
import type { LatLng } from '@/data/course';
import { useOnDemandLocation } from '@/hooks/useOnDemandLocation';
import { bearing, distance, hazardsAhead, type HazardNote } from '@/lib/geo';
import { pickClub, playsLike, type Conditions, type PlaysLike } from '@/lib/playsLike';
import { formatName, matchState, stablefordPoints, standings, strokesTable } from '@/lib/scoring';
import { fetchConditions, fetchElevation } from '@/lib/weather';
import { useStore } from '@/state/store';
import { colors, radius, type } from '@/theme';

const OFF_COURSE_M = 2000;
const WEATHER_MAX_AGE_MS = 15 * 60 * 1000;

export default function HoleScreen() {
  const { round } = useStore();
  if (!round) return <Redirect href="/" />;
  return <HoleView />;
}

function HoleView() {
  const { round, course, order, setHole, setScore, bag } = useStore();
  const r = round!;
  const hole = course.holes[r.hole];
  const target = hole.green.middle;

  const { fix, updating, denied, update } = useOnDemandLocation(r.hole);
  // A fix only counts on the hole it was taken on; a new hole measures from its tee until you update.
  const offCourse = !!fix && distance(fix.coords, target) > OFF_COURSE_M;
  const live = !!fix && fix.hole === r.hole && !offCourse;
  const player: LatLng = live ? fix.coords : hole.tee;
  const [lat, lon] = player;

  // Weather: once at start, then at most every 15 min, and only while the screen is in use.
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const fetchedAt = useRef(0);
  useEffect(() => {
    if (Date.now() - fetchedAt.current < WEATHER_MAX_AGE_MS) return;
    fetchedAt.current = Date.now();
    fetchConditions(hole.tee)
      .then(setConditions)
      .catch(() => (fetchedAt.current = 0));
  }, [fix, hole.tee]);

  const [showWhy, setShowWhy] = useState(false);
  const [playerElevation, setPlayerElevation] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    fetchElevation([lat, lon])
      .then((e) => live && setPlayerElevation(e))
      .catch(() => live && setPlayerElevation(null));
    return () => {
      live = false;
    };
  }, [lat, lon]);

  const metres = Math.round(distance(player, target));
  const elevationChange = playerElevation == null ? null : hole.green.elevation - playerElevation;
  const pl = playsLike(metres, bearing(player, target), elevationChange, conditions);
  const club = pickClub(bag, pl.distance);
  const hazards = hazardsAhead(player, target, hole.hazards);

  const pos = order.indexOf(r.hole);
  const prev = pos > 0 ? course.holes[order[pos - 1]] : null;
  const next = pos < order.length - 1 ? course.holes[order[pos + 1]] : null;

  const strokes = strokesTable(r.format, r.players.map((p) => p.handicap), course.holes);
  const match =
    r.format === 'match' ? matchState(r.players.map((p) => p.name), r.scores, course.holes, strokes, order) : null;

  // First tap on either button fills in par, then it steps from there.
  const bump = (p: number, by: number) => {
    const s = r.scores[p][r.hole];
    setScore(p, r.hole, s == null ? hole.par : Math.max(1, s + by));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.mapWrap}>
        <HoleMap hole={hole} player={live ? player : null} metres={metres} />
        <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="box-none">
            <Pressable onPress={() => router.replace('/')} style={styles.floatButton} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.holePill}>
              <Text style={styles.holeTitle}>Hole {hole.number}</Text>
              <Text style={type.small}>
                Par {hole.par} · SI {hole.strokeIndex}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
        <Pressable
          onPress={update}
          disabled={updating}
          style={({ pressed }) => [styles.gpsButton, pressed && { opacity: 0.85 }]}
          hitSlop={6}
        >
          {updating ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="locate" size={18} color={colors.onPrimary} />}
          <Text style={styles.gpsText}>{updating ? 'Locating…' : 'Update GPS'}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={styles.body}>
        {denied && <Banner text="Location is off. Allow “While Using the App” in Settings to get live distances." />}
        {!denied && offCourse && <Banner text="You're not at the course, so distances are from the tee." />}

        <View style={styles.distanceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.distance}>
              {metres}
              <Text style={styles.distanceUnit}> m</Text>
            </Text>
            <Text style={type.small}>Middle of green</Text>
          </View>
          <View style={styles.vline} />
          <Pressable style={{ flex: 1 }} onPress={() => setShowWhy((v) => !v)} hitSlop={8}>
            <Text style={[styles.distance, { color: colors.accent }]}>
              {pl.distance}
              <Text style={styles.distanceUnit}> m</Text>
            </Text>
            <View style={styles.whyRow}>
              <Text style={type.small}>Plays like</Text>
              <Ionicons name={showWhy ? 'chevron-up' : 'information-circle-outline'} size={14} color={colors.muted} />
            </View>
          </Pressable>
        </View>

        {showWhy && <PlaysLikeDetails pl={pl} metres={metres} conditions={conditions} shotBearing={bearing(player, target)} />}

        <View style={styles.clubCard}>
          <Ionicons name="golf-outline" size={20} color={colors.muted} />
          <Text style={styles.club} numberOfLines={1} adjustsFontSizeToFit>
            {club ? club.name : 'Set up My Bag for a club'}
          </Text>
          {club && <Text style={type.small}>{club.distance} m</Text>}
        </View>

        {hazards.length > 0 && (
          <View style={{ gap: 8 }}>
            {hazards.map((h, i) => (
              <HazardRow key={i} note={h} />
            ))}
          </View>
        )}

        <Text style={[type.small, { textAlign: 'right', marginTop: -8 }]}>
          {updating
            ? 'Getting an accurate fix…'
            : live
              ? `Your position · ±${Math.round(fix.accuracy ?? 0)} m · ${new Date(fix.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
              : 'From the tee · tap Update GPS for your position'}
        </Text>

        <Standings />

        <View style={styles.group}>
          {r.players.map((p, i) => {
            const s = r.scores[i][r.hole];
            const shots = strokes[i][r.hole];
            return (
              <View key={i} style={[styles.scoreRow, i > 0 && styles.divider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    {s != null && <ScoreBadge score={s} par={hole.par} />}
                    {s != null && r.format === 'stableford' && (
                      <Text style={styles.points}>{stablefordPoints(s, hole.par, shots)} pts</Text>
                    )}
                    {s != null && match?.results[r.hole] === i && <Text style={styles.points}>Wins hole</Text>}
                    {shots > 0 && <Text style={[type.small, { marginTop: 3 }]}>{shots === 1 ? '1 shot' : `${shots} shots`}</Text>}
                  </View>
                </View>
                <StepButton icon="remove" onPress={() => bump(i, -1)} />
                <Text style={[styles.score, s == null && { color: colors.muted }]}>{s ?? hole.par}</Text>
                <StepButton icon="add" onPress={() => bump(i, 1)} />
              </View>
            );
          })}
        </View>

        <View style={styles.navRow}>
          <Pressable
            style={[styles.navButton, styles.navPrev, !prev && { opacity: 0.35 }]}
            disabled={!prev}
            onPress={() => prev && setHole(order[pos - 1])}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <Text style={styles.navPrevText}>{prev ? `Hole ${prev.number}` : 'Hole'}</Text>
          </Pressable>
          <Pressable
            style={[styles.navButton, styles.navNext]}
            onPress={() => (next ? setHole(order[pos + 1]) : router.navigate('/scorecard'))}
          >
            <Text style={styles.navNextText}>{next ? `Hole ${next.number}` : 'Finish'}</Text>
            <Ionicons name={next ? 'arrow-forward' : 'checkmark'} size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

/** What went into the plays-like number: live weather, air density and each adjustment. */
function PlaysLikeDetails(props: { pl: PlaysLike; metres: number; conditions: Conditions | null; shotBearing: number }) {
  const { pl, conditions: c } = props;
  if (!c) return <Text style={type.small}>Waiting for live weather…</Text>;

  const along = Math.abs(pl.headwind) < 2 ? null : pl.headwind > 0 ? 'into you' : 'behind you';
  const across = Math.abs(pl.crosswind) < 2 ? null : pl.crosswind > 0 ? 'left to right' : 'right to left';
  const updated = new Date(c.fetchedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  const total = pl.distance - props.metres;

  return (
    <View style={styles.why}>
      <Line label="Wind" value={c.windSpeed < 2 ? 'Calm' : `${Math.round(c.windSpeed)} km/h from ${compass(c.windFrom)}, gusts ${Math.round(c.windGusts)}`} />
      {(along || across) && <Line label="On this shot" value={[along, across].filter(Boolean).join(', ')} />}
      {Math.abs(pl.aim) >= 2 && <Line label="Aim" value={`${Math.round(Math.abs(pl.aim))} m ${pl.aim > 0 ? 'right' : 'left'}`} />}
      <Line label="Temperature" value={`${Math.round(c.temperature)}°C · dew point ${Math.round(c.dewPoint)}°C · ${Math.round(c.humidity)}%`} />
      <Line label="Pressure" value={`${Math.round(c.pressure)} hPa at the course`} />
      {pl.airDensity != null && <Line label="Air density" value={`${pl.airDensity.toFixed(3)} kg/m³`} />}
      <View style={styles.whyDivider} />
      {pl.parts.length === 0 ? (
        <Line label="Adjustment" value="None, plays as it measures" />
      ) : (
        pl.parts.map((p) => <Line key={p.label} label={p.label} value={`${p.metres > 0 ? '+' : '−'}${Math.abs(Math.round(p.metres))} m`} />)
      )}
      <Line label="Plays like" value={`${props.metres} ${total >= 0 ? '+' : '−'} ${Math.abs(total)} = ${pl.distance} m`} strong />
      <Text style={[type.small, { fontSize: 11 }]}>Live weather from Open-Meteo, updated at {updated}.</Text>
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={type.small}>{label}</Text>
      <Text style={[styles.lineValue, strong && { fontWeight: '700', color: colors.text }]}>{value}</Text>
    </View>
  );
}

/** One-line live status for the round's format, above the score entry. */
function Standings() {
  const { round, course, order } = useStore();
  const r = round!;
  const strokes = strokesTable(r.format, r.players.map((p) => p.handicap), course.holes);
  let text: string;
  if (r.format === 'match') {
    const m = matchState(r.players.map((p) => p.name), r.scores, course.holes, strokes, order);
    text = m.played ? `${m.summary}${m.finished ? '' : ` · thru ${m.played}`}` : m.summary;
  } else {
    const rows = standings(r.format, r.scores, course.holes, strokes).filter((x) => x.thru > 0);
    if (!rows.length) return null;
    const show = (x: (typeof rows)[number]) => {
      const name = r.players[x.player].name;
      const toPar = x.toPar === 0 ? 'E' : x.toPar > 0 ? `+${x.toPar}` : `${x.toPar}`;
      return r.format === 'stableford' ? `${name} ${x.value} pts` : `${name} ${x.value} (${toPar})`;
    };
    text = r.players.length === 1 ? `${show(rows[0])} · thru ${rows[0].thru}` : rows.map(show).join('  ·  ');
  }
  return (
    <View style={styles.standings}>
      <Text style={styles.standingsFormat}>{formatName(r.format)}</Text>
      <Text style={styles.standingsText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function HazardRow({ note }: { note: HazardNote }) {
  const name = note.kind === 'water' ? 'Water' : 'Bunker';
  const where = note.side === 'short' ? 'in front' : note.side;
  return (
    <View style={styles.hazardRow}>
      <View style={[styles.dot, { backgroundColor: note.kind === 'water' ? colors.water : colors.sand }]} />
      <Text style={[type.body, { flex: 1 }]}>
        {name} {where}
      </Text>
      <Text style={type.small}>
        {note.reach} m reach · {note.carry} m carry
      </Text>
    </View>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

function StepButton(props: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.stepButton, pressed && { backgroundColor: colors.line }]}>
      <Ionicons name={props.icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { height: '58%', backgroundColor: colors.surface },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 4 },
  floatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  gpsButton: {
    position: 'absolute',
    right: 14,
    bottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    ...shadow,
  },
  gpsText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  holePill: { backgroundColor: colors.bg, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 6, alignItems: 'center', ...shadow },
  holeTitle: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  sheet: { flex: 1, marginTop: -20, backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 18 },
  distanceRow: { flexDirection: 'row', alignItems: 'center' },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.line, marginHorizontal: 16 },
  distance: { fontSize: 52, fontWeight: '700', letterSpacing: -1.5, color: colors.text, fontVariant: ['tabular-nums'], lineHeight: 56 },
  distanceUnit: { fontSize: 22, fontWeight: '500', letterSpacing: 0, color: colors.muted },
  hazardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  clubCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14 },
  club: { flex: 1, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  banner: { backgroundColor: colors.warnBg, borderRadius: radius.sm, padding: 12 },
  bannerText: { color: colors.warnText, fontSize: 14 },
  group: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 64 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  why: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 7 },
  whyDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineValue: { flex: 1, textAlign: 'right', fontSize: 13, color: '#3F3F46' },
  points: { fontSize: 12, fontWeight: '600', color: colors.accent, marginTop: 3 },
  standings: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -6 },
  standingsFormat: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  standingsText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  playerName: { fontSize: 16, fontWeight: '600', color: colors.text },
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: { fontSize: 22, fontWeight: '700', color: colors.text, minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
  navRow: { flexDirection: 'row', gap: 10 },
  navButton: { flex: 1, height: 54, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navPrev: { backgroundColor: colors.surface },
  navPrevText: { fontSize: 16, fontWeight: '600', color: colors.text },
  navNext: { backgroundColor: colors.primary },
  navNextText: { fontSize: 16, fontWeight: '600', color: colors.onPrimary },
});
