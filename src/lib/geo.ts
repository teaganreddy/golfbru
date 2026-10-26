import type { Hazard, LatLng } from '@/data/course';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distance(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b, 0–360°. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x =
    Math.cos(rad(a[0])) * Math.sin(rad(b[0])) -
    Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

function centroid(poly: LatLng[]): LatLng {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

export type HazardNote = {
  kind: Hazard['kind'];
  side: 'left' | 'right' | 'short';
  reach: number;
  carry: number;
};

/**
 * Hazards between the player and the green, nearest first. Distances are to the
 * closest and furthest edges of each hazard.
 */
export function hazardsAhead(player: LatLng, target: LatLng, hazards: Hazard[]): HazardNote[] {
  const toTarget = distance(player, target);
  const targetBearing = bearing(player, target);
  const notes: HazardNote[] = [];

  for (const h of hazards) {
    const c = centroid(h.polygon);
    const d = distance(player, c);
    const off = ((bearing(player, c) - targetBearing + 540) % 360) - 180;
    if (Math.abs(off) > 40 || d > toTarget + 15) continue;

    const edges = h.polygon.map((p) => distance(player, p));
    const reach = Math.min(...edges);
    const carry = Math.max(...edges);
    if (carry < 10) continue;

    const lateral = Math.sin(rad(off)) * d;
    const side = Math.abs(lateral) < 10 ? 'short' : lateral < 0 ? 'left' : 'right';
    notes.push({ kind: h.kind, side, reach: Math.round(reach), carry: Math.round(carry) });
  }

  return notes.sort((a, b) => a.reach - b.reach).slice(0, 3);
}
