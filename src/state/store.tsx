import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getCourse, getTee, playOrder, strokesReceived, type Course, type Tee } from '@/data/course';
import { adjustedGross, handicapIndex, type HistoryRound, type IndexResult } from '@/lib/handicap';
import type { Club } from '@/lib/playsLike';
import type { Format } from '@/lib/scoring';

const DEFAULT_BAG: Club[] = [
  'Driver', '3 Wood', '5 Wood', '4 Hybrid', '5 Iron', '6 Iron', '7 Iron', '8 Iron', '9 Iron',
  'Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge',
].map((name, i) => ({ id: String(i), name, distance: null }));

export type Player = { name: string; handicap: number | null; me?: boolean };

export type Profile = { name: string; photoUri: string | null; rounds: HistoryRound[] };

export type Round = {
  courseId: string;
  players: Player[];
  tee: Tee | null; // the tees played, for handicap maths
  format: Format;
  startHole: number; // index of the first hole played (0 = hole 1, 9 = hole 10)
  hole: number; // index of the hole on screen
  scores: (number | null)[][]; // [player][hole]
};

/** What happened to your score when a round was finished. */
export type SaveResult = 'saved' | 'incomplete' | 'no-tee' | 'not-you';

type Store = {
  ready: boolean;
  bag: Club[];
  setBag: (bag: Club[]) => void;
  lastPlayers: Player[];
  profile: Profile;
  setProfile: (patch: Partial<Omit<Profile, 'rounds'>>) => void;
  addHistory: (r: HistoryRound) => void;
  removeHistory: (id: string) => void;
  handicap: IndexResult;
  teeChoice: Record<string, string>; // courseId -> tee id you last picked
  setTeeChoice: (courseId: string, teeId: string) => void;
  round: Round | null;
  course: Course;
  order: number[];
  startRound: (courseId: string, players: Player[], startHole: number, format: Format) => void;
  /** Ends the round; with save, your 18-hole score goes into your handicap record. */
  endRound: (save: boolean) => SaveResult | null;
  setHole: (i: number) => void;
  setScore: (player: number, hole: number, score: number | null) => void;
};

const Ctx = createContext<Store | null>(null);

const today = () => new Date().toISOString().slice(0, 10);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bag, setBag] = useState<Club[]>(DEFAULT_BAG);
  const [lastPlayers, setLastPlayers] = useState<Player[]>([{ name: '', handicap: null, me: true }]);
  const [profile, setProfileState] = useState<Profile>({ name: '', photoUri: null, rounds: [] });
  const [teeChoice, setTeeChoices] = useState<Record<string, string>>({});
  const [round, setRound] = useState<Round | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet(['bag', 'round', 'players', 'profile', 'teeChoice'])
      .then(([[, b], [, r], [, p], [, pr], [, t]]) => {
        if (b) setBag(JSON.parse(b));
        // Rounds saved by older versions have no players list; drop them.
        const saved = r ? JSON.parse(r) : null;
        if (saved?.players) setRound({ tee: null, format: 'stroke', ...saved });
        if (p) setLastPlayers(JSON.parse(p));
        if (pr) setProfileState(JSON.parse(pr));
        if (t) setTeeChoices(JSON.parse(t));
      })
      .finally(() => setReady(true));
  }, []);

  const persist = (key: string, value: unknown) => {
    if (ready) AsyncStorage.setItem(key, JSON.stringify(value));
  };
  /* eslint-disable react-hooks/exhaustive-deps -- persist only depends on ready */
  useEffect(() => persist('bag', bag), [bag, ready]);
  useEffect(() => persist('round', round), [round, ready]);
  useEffect(() => persist('players', lastPlayers), [lastPlayers, ready]);
  useEffect(() => persist('profile', profile), [profile, ready]);
  useEffect(() => persist('teeChoice', teeChoice), [teeChoice, ready]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const course = getCourse(round?.courseId ?? '');

  const finish = (r: Round): SaveResult => {
    const meIdx = r.players.findIndex((p) => p.me);
    if (meIdx < 0) return 'not-you';
    const c = getCourse(r.courseId);
    const scores = r.scores[meIdx];
    if (scores.some((s) => s == null)) return 'incomplete';
    if (!r.tee) return 'no-tee';

    const hcp = r.players[meIdx].handicap;
    const strokes = c.holes.map((h) => strokesReceived(hcp, h.strokeIndex, c.holes.length));
    const gross = (scores as number[]).reduce((s, v) => s + v, 0);
    // Without a handicap yet, WHS caps each hole at par + 5.
    const adjusted =
      hcp == null
        ? (scores as number[]).reduce((s, v, i) => s + Math.min(v, c.holes[i].par + 5), 0)
        : adjustedGross(scores as number[], c.holes.map((h) => h.par), strokes);

    const entry: HistoryRound = {
      id: `${Date.now()}`,
      date: today(),
      courseName: c.name,
      teeName: r.tee.name,
      par: c.holes.reduce((s, h) => s + h.par, 0),
      rating: r.tee.rating,
      slope: r.tee.slope,
      gross,
      adjusted,
      source: 'app',
    };
    setProfileState((p) => ({ ...p, rounds: [...p.rounds, entry] }));
    return 'saved';
  };

  const store: Store = {
    ready,
    bag,
    setBag,
    lastPlayers,
    profile,
    setProfile: (patch) => setProfileState((p) => ({ ...p, ...patch })),
    addHistory: (h) => setProfileState((p) => ({ ...p, rounds: [...p.rounds, h] })),
    removeHistory: (id) => setProfileState((p) => ({ ...p, rounds: p.rounds.filter((x) => x.id !== id) })),
    handicap: handicapIndex(profile.rounds),
    teeChoice,
    setTeeChoice: (courseId, teeId) => setTeeChoices((t) => ({ ...t, [courseId]: teeId })),
    round,
    course,
    order: playOrder(course, round?.startHole ?? 0),
    startRound: (courseId, players, startHole, format) => {
      setLastPlayers(players);
      const holes = getCourse(courseId).holes.length;
      setRound({
        courseId,
        players,
        tee: getTee(getCourse(courseId), teeChoice[courseId]),
        format,
        startHole,
        hole: startHole,
        scores: players.map(() => Array.from({ length: holes }, () => null)),
      });
    },
    endRound: (save) => {
      const result = round && save ? finish(round) : null;
      setRound(null);
      return result;
    },
    setHole: (hole) => setRound((r) => r && { ...r, hole }),
    setScore: (p, h, score) =>
      setRound(
        (r) =>
          r && {
            ...r,
            scores: r.scores.map((row, i) => (i === p ? row.map((s, j) => (j === h ? score : s)) : row)),
          },
      ),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
