import { strokesReceived, type Hole } from '@/data/course';

export type Format = 'stroke' | 'medal' | 'stableford' | 'match';

export const FORMATS: { id: Format; name: string; blurb: string; minPlayers: number; maxPlayers: number }[] = [
  { id: 'stroke', name: 'Stroke play', blurb: 'Fewest total strokes wins. No handicaps.', minPlayers: 1, maxPlayers: 4 },
  { id: 'medal', name: 'Medal', blurb: 'Stroke play with handicaps: lowest net score wins.', minPlayers: 1, maxPlayers: 4 },
  { id: 'stableford', name: 'Stableford', blurb: 'Points per hole against your net par. Most points wins.', minPlayers: 1, maxPlayers: 4 },
  { id: 'match', name: 'Match play', blurb: 'Win holes, not strokes. The lower handicap gives shots on the hardest holes.', minPlayers: 2, maxPlayers: 2 },
];

export const formatName = (f: Format) => FORMATS.find((x) => x.id === f)!.name;

type Scores = (number | null)[][]; // [player][hole]

/** Stableford points: 2 for a net par, one more per shot better, one fewer per shot worse, never below 0. */
export const stablefordPoints = (gross: number, par: number, strokes: number) => Math.max(0, 2 + par - (gross - strokes));

/** Handicap shots per player per hole for this format. */
export function strokesTable(format: Format, handicaps: (number | null)[], holes: Hole[]): number[][] {
  if (format === 'stroke') return handicaps.map(() => holes.map(() => 0));
  if (format === 'match') {
    // Match play: only the difference between the two handicaps is given, to the higher handicap.
    const [a, b] = handicaps.map((h) => h ?? 0);
    const diff = Math.abs(a - b);
    return [0, 1].map((p) => holes.map((h) => ((p === 0 ? a > b : b > a) ? strokesReceived(diff, h.strokeIndex, holes.length) : 0)));
  }
  return handicaps.map((hcp) => holes.map((h) => strokesReceived(hcp, h.strokeIndex, holes.length)));
}

export type Standing = {
  player: number;
  value: number; // gross, net or points depending on format
  toPar: number; // gross or net against par of holes played
  thru: number;
};

/** Leaderboard for stroke, medal and Stableford, best first. */
export function standings(format: Exclude<Format, 'match'>, scores: Scores, holes: Hole[], strokes: number[][]): Standing[] {
  const rows = scores.map((row, p) => {
    let gross = 0;
    let net = 0;
    let points = 0;
    let par = 0;
    let thru = 0;
    row.forEach((s, i) => {
      if (s == null) return;
      thru++;
      gross += s;
      net += s - strokes[p][i];
      points += stablefordPoints(s, holes[i].par, strokes[p][i]);
      par += holes[i].par;
    });
    const value = format === 'stroke' ? gross : format === 'medal' ? net : points;
    return { player: p, value, toPar: (format === 'stroke' ? gross : net) - par, thru };
  });
  return rows.sort((a, b) => (format === 'stableford' ? b.value - a.value : a.value - b.value) || b.thru - a.thru);
}

export type HoleResult = 0 | 1 | null; // winner's player index, null = halved

export type MatchState = {
  results: (HoleResult | undefined)[]; // per hole index; undefined = not both scored
  leader: 0 | 1 | null;
  up: number;
  played: number;
  remaining: number;
  finished: boolean;
  summary: string; // e.g. "Sam 2 UP", "All square", "Sam wins 3&2"
};

/** Net hole-by-hole match between players 0 and 1, in the order the holes were played. */
export function matchState(names: string[], scores: Scores, holes: Hole[], strokes: number[][], order: number[]): MatchState {
  const results: (HoleResult | undefined)[] = holes.map(() => undefined);
  let margin = 0; // positive = player 0 ahead
  let played = 0;
  let decidedAt: { margin: number; remaining: number } | null = null;

  for (const i of order) {
    const a = scores[0][i];
    const b = scores[1][i];
    if (a == null || b == null) continue;
    const na = a - strokes[0][i];
    const nb = b - strokes[1][i];
    const r: HoleResult = na < nb ? 0 : nb < na ? 1 : null;
    results[i] = r;
    if (r === 0) margin++;
    if (r === 1) margin--;
    played++;
    const remaining = holes.length - played;
    if (!decidedAt && Math.abs(margin) > remaining) decidedAt = { margin, remaining };
  }

  const remaining = holes.length - played;
  const leader = margin > 0 ? 0 : margin < 0 ? 1 : null;
  const up = Math.abs(margin);
  let summary: string;
  if (decidedAt) {
    const w = names[decidedAt.margin > 0 ? 0 : 1];
    const m = Math.abs(decidedAt.margin);
    summary = decidedAt.remaining === 0 ? `${w} wins ${m} up` : `${w} wins ${m}&${decidedAt.remaining}`;
  } else if (played === holes.length) {
    summary = 'Match halved';
  } else if (leader == null) {
    summary = played ? 'All square' : 'Match not started';
  } else {
    summary = `${names[leader]} ${up} UP${up === remaining ? ' · dormie' : ''}`;
  }

  return { results, leader, up, played, remaining, finished: !!decidedAt || played === holes.length, summary };
}
