import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KEYBOARD_BAR_HEIGHT } from '@/components/KeyboardBar';
import { MIN_ROUNDS, formatIndex, scoreDifferential } from '@/lib/handicap';
import { useStore } from '@/state/store';
import { colors, radius, type } from '@/theme';

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ProfileScreen() {
  const { profile, setProfile, handicap, removeHistory } = useStore();
  const canGoBack = useLocalSearchParams<{ from?: string }>().from === 'home';

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled) return;
    // The picker hands back a temporary file; keep our own copy so it survives cache clears.
    const dest = new File(Paths.document, `avatar-${Date.now()}.jpg`);
    new File(res.assets[0].uri).copySync(dest);
    if (profile.photoUri) {
      try {
        new File(profile.photoUri).delete();
      } catch {}
    }
    setProfile({ photoUri: dest.uri });
  };

  const confirmDelete = (id: string, label: string) =>
    Alert.alert('Delete round?', `${label} will be removed and your handicap recalculated.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeHistory(id) },
    ]);

  const rounds = [...profile.rounds].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const missing = MIN_ROUNDS - profile.rounds.length;
  const initials = profile.name.trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 2);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={KEYBOARD_BAR_HEIGHT} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {canGoBack && (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
          )}

          <View style={styles.identity}>
            <Pressable onPress={pickPhoto} style={styles.avatar}>
              {profile.photoUri ? (
                <Image source={{ uri: profile.photoUri }} style={styles.avatarImage} />
              ) : initials ? (
                <Text style={styles.initials}>{initials}</Text>
              ) : (
                <Ionicons name="person" size={36} color={colors.muted} />
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={13} color={colors.onPrimary} />
              </View>
            </Pressable>
            <TextInput
              value={profile.name}
              onChangeText={(name) => setProfile({ name })}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              style={styles.nameInput}
              autoCapitalize="words"
              returnKeyType="done"
              textAlign="center"
            />
          </View>

          <View style={styles.hcpCard}>
            <Text style={type.label}>Handicap index</Text>
            <Text style={styles.hcpValue}>{handicap.index == null ? '–' : formatIndex(handicap.index)}</Text>
            <Text style={type.small}>
              {handicap.index == null
                ? `Add ${missing} more 18-hole round${missing === 1 ? '' : 's'} to get your handicap`
                : `Average of your best ${handicap.used} of ${handicap.considered} recent rounds`}
            </Text>
          </View>

          <View style={styles.sectionHead}>
            <Text style={type.heading}>Rounds</Text>
            <Pressable onPress={() => router.push('/add-round')} style={styles.addButton} hitSlop={8}>
              <Ionicons name="add" size={18} color={colors.onPrimary} />
              <Text style={styles.addText}>Add round</Text>
            </Pressable>
          </View>

          {rounds.length === 0 ? (
            <Text style={[type.small, { textAlign: 'center', paddingVertical: 24 }]}>
              Add scores from previous rounds, or finish a round in the app, to build your handicap.
            </Text>
          ) : (
            <View style={styles.list}>
              {rounds.map((r, i) => {
                const counts = handicap.counting.has(r.id);
                return (
                  <Pressable
                    key={r.id}
                    onLongPress={() => confirmDelete(r.id, `${r.courseName} on ${formatDate(r.date)}`)}
                    style={[styles.roundRow, i > 0 && styles.divider]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.courseName} numberOfLines={1}>
                        {r.courseName}
                      </Text>
                      <Text style={type.small}>
                        {formatDate(r.date)} · Diff {scoreDifferential(r.adjusted, r.rating, r.slope).toFixed(1)}
                        {r.source === 'app' ? ' · Played in app' : ''}
                      </Text>
                    </View>
                    {counts && (
                      <View style={styles.countsPill}>
                        <Text style={styles.countsText}>Counts</Text>
                      </View>
                    )}
                    <Text style={styles.gross}>{r.gross}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.footnote}>
            Worked out with the World Handicap System: the average of your lowest score differentials from your last 20
            rounds (best 8 of 20 once you have 20). It updates every time you add or finish a round. Press and hold a
            round to delete it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 20 },
  identity: { alignItems: 'center', gap: 12, marginTop: 8 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  initials: { fontSize: 32, fontWeight: '700', color: colors.text },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.4, minWidth: 200 },
  hcpCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, alignItems: 'center', gap: 4 },
  hcpValue: { fontSize: 56, fontWeight: '700', letterSpacing: -2, color: colors.text, fontVariant: ['tabular-nums'] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addText: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
  list: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  roundRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  courseName: { fontSize: 16, fontWeight: '600', color: colors.text },
  countsPill: { backgroundColor: '#E4F6EA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  countsText: { fontSize: 12, fontWeight: '600', color: '#0B7A3B' },
  gross: { fontSize: 22, fontWeight: '700', color: colors.text, minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  footnote: { fontSize: 12, color: colors.muted, lineHeight: 17 },
});
