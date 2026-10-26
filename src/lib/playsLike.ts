export type Club = { id: string; name: string; distance: number | null };

export type Conditions = {
  windSpeed: number; // km/h at 10 m
  windGusts: number; // km/h at 10 m
  windFrom: number; // compass degrees the wind blows from
  temperature: number; // °C
  humidity: number; // %
  dewPoint: number; // °C
  pressure: number; // hPa at the surface (not sea-level)
  fetchedAt: number; // ms since epoch
};

export type PlaysLike = {
  distance: number;
  headwind: number; // km/h along the shot, negative = tailwind
  crosswind: number; // km/h across the shot, positive = blowing left to right
  aim: number; // metres to aim off into the wind, positive = aim right
  airDensity: number | null; // kg/m³
  parts: { label: string; metres: number }[];
};

const RD = 287.058; // J/(kg·K), dry air
const RV = 461.495; // J/(kg·K), water vapour

/** Saturation vapour pressure in hPa (Magnus formula). */
const vapourPressure = (tempC: number) => 6.1078 * 10 ** ((7.5 * tempC) / (237.3 + tempC));

/**
 * Air density from the actual surface pressure, temperature and dew point. Water vapour is
 * lighter than dry air, so humid air is slightly thinner and the ball goes a touch further.
 */
export function airDensity(pressureHPa: number, tempC: number, dewPointC: number) {
  const T = tempC + 273.15;
  const pv = vapourPressure(dewPointC) * 100; // Pa
  const pd = pressureHPa * 100 - pv;
  return pd / (RD * T) + pv / (RV * T);
}

// Club distances are what you hit on a "normal day": 20 °C, sea-level pressure, 50% humidity.
const REFERENCE_DENSITY = airDensity(1013.25, 20, 9.3);

/**
 * Rules of thumb, not a full ball-flight model:
 * - elevation: 1 m up plays 1 m longer
 * - air density: carry changes ~0.6% for every 1% the air is thinner or thicker than reference
 *   (this is what covers temperature, humidity, dew point and altitude/pressure together)
 * - headwind costs ~1% per mph (0.62%/km/h); a tailwind gives back about half that
 * - crosswind drift ~0.33 m per km/h for every 100 m of shot
 */
export function playsLike(
  metres: number,
  shotBearing: number,
  elevationChange: number | null,
  c: Conditions | null,
): PlaysLike {
  const parts: PlaysLike['parts'] = [];
  let d = metres;

  if (elevationChange != null && Math.abs(elevationChange) >= 1) {
    parts.push({ label: elevationChange > 0 ? 'Uphill' : 'Downhill', metres: elevationChange });
    d += elevationChange;
  }

  if (!c) return { distance: Math.round(d), headwind: 0, crosswind: 0, aim: 0, airDensity: null, parts };

  const rel = ((c.windFrom - shotBearing) * Math.PI) / 180;
  const headwind = c.windSpeed * Math.cos(rel);
  const crosswind = -c.windSpeed * Math.sin(rel);

  const rho = airDensity(c.pressure, c.temperature, c.dewPoint);
  const airPct = ((rho - REFERENCE_DENSITY) / REFERENCE_DENSITY) * 0.6;
  const windPct = headwind >= 0 ? headwind * 0.0062 : headwind * 0.0031;

  const add = (label: string, pct: number) => {
    const m = d * pct;
    if (Math.abs(m) >= 0.5) parts.push({ label, metres: m });
    return m;
  };
  const base = d;
  d += add(rho > REFERENCE_DENSITY ? 'Heavy air' : 'Thin air', airPct);
  d += add(headwind >= 0 ? 'Headwind' : 'Tailwind', windPct);

  // A left-to-right wind pushes the ball right, so aim left (negative), and vice versa.
  const aim = -crosswind * 0.0033 * base;

  return { distance: Math.round(d), headwind, crosswind, aim, airDensity: rho, parts };
}

/** The club whose distance is closest to the plays-like number. */
export function pickClub(clubs: Club[], target: number): Club | null {
  const usable = clubs.filter((c): c is Club & { distance: number } => !!c.distance);
  if (!usable.length) return null;
  return usable.reduce((best, c) =>
    Math.abs(c.distance - target) < Math.abs(best.distance - target) ? c : best,
  );
}
