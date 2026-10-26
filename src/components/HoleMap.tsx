import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline, type Camera } from 'react-native-maps';

import type { Hole, LatLng } from '@/data/course';
import { bearing, distance } from '@/lib/geo';
import { colors } from '@/theme';

const pt = ([latitude, longitude]: LatLng) => ({ latitude, longitude });

/** Satellite view turned so the tee is at the bottom and the green at the top. */
function holeCamera(hole: Hole): Camera {
  const [a, b] = [hole.tee, hole.green.middle];
  const length = distance(a, b);
  return {
    // nudge the centre slightly towards the green so the flag clears the header
    center: pt([a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55]),
    heading: bearing(a, b),
    pitch: 0,
    altitude: Math.max(320, length * 1.9),
  };
}

export function HoleMap({ hole, player, metres }: { hole: Hole; player: LatLng | null; metres: number }) {
  const map = useRef<MapView>(null);

  useEffect(() => {
    map.current?.animateCamera(holeCamera(hole), { duration: 600 });
  }, [hole]);

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      mapType="satellite"
      initialCamera={holeCamera(hole)}
      pitchEnabled={false}
      showsCompass={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
    >
      {hole.fairways.map((f, i) => (
        <Polygon key={`fw${i}`} coordinates={f.map(pt)} fillColor="rgba(140,230,140,0.22)" strokeColor="rgba(255,255,255,0.55)" strokeWidth={1} />
      ))}
      {hole.teeBoxes.map((t, i) => (
        <Polygon key={`tee${i}`} coordinates={t.map(pt)} fillColor="rgba(255,255,255,0.35)" strokeColor="#FFFFFF" strokeWidth={1.5} />
      ))}
      {hole.hazards.map((h, i) => (
        <Polygon
          key={`hz${i}`}
          coordinates={h.polygon.map(pt)}
          strokeColor={h.kind === 'water' ? colors.water : colors.sand}
          fillColor={h.kind === 'water' ? 'rgba(47,125,246,0.18)' : 'rgba(217,164,65,0.22)'}
          strokeWidth={1.5}
        />
      ))}
      <Polygon coordinates={hole.green.polygon.map(pt)} strokeColor="#FFFFFF" fillColor="rgba(18,161,80,0.45)" strokeWidth={2.5} />

      {/* line of play, tee to green */}
      <Polyline coordinates={hole.path.map(pt)} strokeColor="rgba(255,255,255,0.75)" strokeWidth={2} />

      <Marker coordinate={pt(hole.tee)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
        <View style={styles.teeLabel}>
          <Text style={styles.teeText}>TEE</Text>
        </View>
      </Marker>

      {player && (
        <>
          <Polyline coordinates={[pt(player), pt(hole.green.middle)]} strokeColor={colors.water} strokeWidth={2.5} lineDashPattern={[6, 6]} />
          <Marker coordinate={pt(player)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.player} />
          </Marker>
        </>
      )}

      <Marker coordinate={pt(hole.green.middle)} anchor={{ x: 0.5, y: 1 }}>
        <View style={styles.flag}>
          <Ionicons name="flag" size={13} color={colors.accent} />
          <Text style={styles.flagText}>{metres} m</Text>
        </View>
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  player: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.water,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  teeLabel: { backgroundColor: colors.text, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  teeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 6,
  },
  flagText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
