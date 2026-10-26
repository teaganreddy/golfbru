import type { LatLng } from '@/data/course';
import type { Conditions } from './playsLike';

/**
 * Current conditions from Open-Meteo, which picks the best available weather model for the
 * location and updates every 15 minutes. Surface pressure is the actual pressure at the
 * course, not the sea-level figure on most weather apps.
 */
export async function fetchConditions([lat, lon]: LatLng): Promise<Conditions> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,' +
    'wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  const { current } = await res.json();
  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    dewPoint: current.dew_point_2m,
    pressure: current.surface_pressure,
    windSpeed: current.wind_speed_10m,
    windGusts: current.wind_gusts_10m,
    windFrom: current.wind_direction_10m,
    fetchedAt: Date.now(),
  };
}

const elevationCache = new Map<string, number>();

/** Ground elevation in metres, cached to ~20 m so walking around doesn't refetch. */
export async function fetchElevation([lat, lon]: LatLng): Promise<number> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = elevationCache.get(key);
  if (hit != null) return hit;
  const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
  if (!res.ok) throw new Error(`Elevation ${res.status}`);
  const { elevation } = await res.json();
  elevationCache.set(key, elevation[0]);
  return elevation[0];
}
