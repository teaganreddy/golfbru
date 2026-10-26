import raw from './mowbray.json';

export type LatLng = [number, number];

export type Hazard = {
  kind: 'bunker' | 'water';
  polygon: LatLng[];
};

export type Hole = {
  number: number;
  par: number;
  strokeIndex: number;
  tee: LatLng;
  green: { middle: LatLng; polygon: LatLng[]; elevation: number };
  hazards: Hazard[];
  path: LatLng[]; // tee to green along the line of play
  teeBoxes: LatLng[][];
  fairways: LatLng[][];
};

/** Rating and slope of one set of tees, for handicap maths. */
export type Tee = { id: string; name: string; colour: string; rating: number; slope: number };

export type Course = {
  id: string;
  name: string;
  area: string;
  source: string;
  tees: Tee[];
  defaultTee: string;
  holes: Hole[];
};

export const courses: Course[] = [
  {
    ...(raw as Omit<Course, 'id' | 'area' | 'tees' | 'defaultTee'>),
    id: 'mowbray',
    area: 'Mowbray, CT',
    // "Re-Rate 1" figures from golfhandicapcalculator.co (Oct 2026); not yet checked against the club card.
    tees: [
      { id: 'yellow', name: 'Yellow', colour: '#F2C230', rating: 71.7, slope: 124 },
      { id: 'white', name: 'White', colour: '#FFFFFF', rating: 70.0, slope: 121 },
      { id: 'red', name: 'Red', colour: '#E5322D', rating: 67.3, slope: 116 },
      { id: 'red-ladies', name: 'Red (ladies)', colour: '#E5322D', rating: 73.1, slope: 124 },
    ],
    defaultTee: 'white',
  },
];

export const getTee = (c: Course, id: string | undefined) =>
  c.tees.find((t) => t.id === id) ?? c.tees.find((t) => t.id === c.defaultTee) ?? c.tees[0];

export const getCourse = (id: string) => courses.find((c) => c.id === id) ?? courses[0];

/** Hole indexes in the order they're played, e.g. 10–18 then 1–9 for a back-nine start. */
export const playOrder = (c: Course, startIndex: number) =>
  c.holes.map((_, i) => (startIndex + i) % c.holes.length);

/** Handicap strokes received on a hole, from its stroke index. */
export const strokesReceived = (handicap: number | null, strokeIndex: number, holes = 18) => {
  if (!handicap || handicap <= 0) return 0;
  return Math.floor(handicap / holes) + (strokeIndex <= handicap % holes ? 1 : 0);
};
