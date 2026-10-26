/**
 * World Handicap System (WHS) maths for 18-hole rounds.
 *
 * Not modelled: the Playing Conditions Calculation (taken as 0), soft/hard caps,
 * exceptional score reductions and 9-hole scores.
 */

export type HistoryRound = {
  id: string;
  date: string; // YYYY-MM-DD
  courseName: string;
  teeName?: string;
  par: number;
  rating: number; // course rating of the tees played
  slope: number; // slope rating of the tees played
  gross: number; // as entered
  adjusted: number; // adjusted gross score used for the differential
  source: 'manual' | 'app';
};

/** (113 / slope) × (adjusted gross − course rating), rounded to 1 decimal. */
export function scoreDifferential(adjusted: number, rating: number, slope: number) {
  return Math.round(((113 / slope) * (adjusted - rating)) * 10) / 10;
}

// How many of the lowest differentials count, and the adjustment, by number of scores (WHS rule 5.2).
const TABLE: Record<number, [count: number, adjust: number]> = {
  3: [1, -2], 4: [1, -1], 5: [1, 0], 6: [2, -1], 7: [2, 0], 8: [2, 0],
  9: [3, 0], 10: [3, 0], 11: [3, 0], 12: [4, 0], 13: [4, 0], 14: [4, 0],
  15: [5, 0], 16: [5, 0], 17: [6, 0], 18: [6, 0], 19: [7, 0], 20: [8, 0],
};

export const MIN_ROUNDS = 3;
const MAX_INDEX = 54;

export type IndexResult = {
  index: number | null;
  counting: Set<string>; // ids of the rounds whose differentials were averaged
  considered: number; // how many recent rounds were looked at (max 20)
  used: number;
};

/** Handicap Index from the most recent 20 rounds. Null until there are 3. */
export function handicapIndex(rounds: HistoryRound[]): IndexResult {
  const recent = [...rounds]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 20);
  if (recent.length < MIN_ROUNDS) return { index: null, counting: new Set(), considered: recent.length, used: 0 };

  const [count, adjust] = TABLE[recent.length];
  const lowest = recent
    .map((r) => ({ id: r.id, d: scoreDifferential(r.adjusted, r.rating, r.slope) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count);
  const avg = lowest.reduce((s, x) => s + x.d, 0) / count;
  // WHS rounds the average to the nearest tenth before applying the adjustment.
  const index = Math.min(MAX_INDEX, Math.round(avg * 10) / 10 + adjust);

  return { index: Math.round(index * 10) / 10, counting: new Set(lowest.map((x) => x.id)), considered: recent.length, used: count };
}

/** Course Handicap = Index × slope / 113 + (course rating − par), rounded to a whole number. */
export function courseHandicap(index: number, slope: number, rating: number, par: number) {
  return Math.round(index * (slope / 113) + (rating - par));
}

/**
 * Adjusted gross score for a hole-by-hole round: each hole is capped at net double bogey
 * (par + 2 + handicap strokes received on that hole).
 */
export function adjustedGross(scores: number[], pars: number[], strokes: number[]) {
  return scores.reduce((sum, s, i) => sum + Math.min(s, pars[i] + 2 + strokes[i]), 0);
}

export const formatIndex = (n: number) => (n < 0 ? `+${Math.abs(n).toFixed(1)}` : n.toFixed(1));
