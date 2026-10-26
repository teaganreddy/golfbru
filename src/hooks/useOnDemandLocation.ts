import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LatLng } from '@/data/course';

export type Fix = { coords: LatLng; accuracy: number | null; at: number; hole: number };

const GOOD_ENOUGH_M = 6; // stop as soon as GPS is this accurate
const MAX_WAIT_MS = 10_000; // otherwise take the best reading after this long

/**
 * Location only when you ask for it. Nothing runs in the background or between taps:
 * update() switches GPS on, waits for one accurate reading, then switches it straight off.
 * Each fix remembers which hole it was taken on, so a new hole falls back to its tee
 * until you update again.
 */
export function useOnDemandLocation(hole: number) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [updating, setUpdating] = useState(false);
  const [denied, setDenied] = useState(false);
  const holeRef = useRef(hole);
  useEffect(() => {
    holeRef.current = hole;
  }, [hole]);

  const update = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setDenied(status !== 'granted');
    if (status !== 'granted') return;

    setUpdating(true);
    try {
      const best = await new Promise<Location.LocationObject | null>((resolve) => {
        let bestSoFar: Location.LocationObject | null = null;
        let sub: Location.LocationSubscription | null = null;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          sub?.remove();
          resolve(bestSoFar);
        };
        const timer = setTimeout(finish, MAX_WAIT_MS);
        Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0 }, (l) => {
          if (!bestSoFar || (l.coords.accuracy ?? 999) < (bestSoFar.coords.accuracy ?? 999)) bestSoFar = l;
          if ((l.coords.accuracy ?? 999) <= GOOD_ENOUGH_M) finish();
        }).then((s) => {
          sub = s;
          if (done) s.remove();
        });
      });
      if (best) {
        setFix({
          coords: [best.coords.latitude, best.coords.longitude],
          accuracy: best.coords.accuracy,
          at: Date.now(),
          hole: holeRef.current,
        });
      }
    } finally {
      setUpdating(false);
    }
  }, []);

  // Ask for permission up front so the first tap is instant; no GPS is switched on here.
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'denied') setDenied(true);
      else if (status !== 'granted') Location.requestForegroundPermissionsAsync().then((r) => setDenied(r.status !== 'granted'));
    });
  }, []);

  return { fix, updating, denied, update };
}
