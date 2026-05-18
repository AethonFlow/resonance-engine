import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API, PresetDTO } from '../src/api';
import { COLORS, HOUSES, TYPO } from '../src/design';

export default function PresetsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PresetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await API.listPresets();
      setItems(data);
    } catch (e: any) {
      Alert.alert('Network', e?.message ?? 'Could not reach backend');
    }
  }, []);

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  };

  const onDelete = async (id: string) => {
    try {
      await API.deletePreset(id);
      setItems(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? 'Unknown error');
    }
  };

  return (
    <View style={styles.root} testID="presets-root">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="presets-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>FIELD LIBRARY</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.amber} /></View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="bookmark-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.empty}>No resonance states stored yet.</Text>
            <Text style={styles.emptySub}>Save a snapshot from the sphere to archive its field.</Text>
          </View>
        ) : (
          <FlatList
            testID="presets-list"
            data={items}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.amber} />}
            renderItem={({ item }) => (
              <PresetRow item={item} onDelete={() => onDelete(item.id)} />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function PresetRow({ item, onDelete }: { item: PresetDTO; onDelete: () => void }) {
  const maxA = Math.max(...item.magnitudes);
  return (
    <View style={styles.card} testID={`preset-${item.id}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardMeta}>
          ω={item.omega.toFixed(2)} · max A={maxA.toFixed(2)} · {new Date(item.created_at).toLocaleString()}
        </Text>
        <View style={styles.bars}>
          {item.magnitudes.map((m, idx) => (
            <View key={idx} style={[styles.bar, { height: 4 + m * 10 }]}>
              <View style={styles.barInner} />
              <Text style={styles.barLabel}>{HOUSES[idx].roman}</Text>
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity onPress={onDelete} testID={`preset-delete-${item.id}`} style={styles.delBtn}>
        <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.panelBorder },
  title: { fontFamily: TYPO.monoBold, fontSize: 13, letterSpacing: 3, color: COLORS.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  empty: { fontFamily: TYPO.labelBold, color: COLORS.textSecondary, fontSize: 14, marginTop: 12 },
  emptySub: { fontFamily: TYPO.label, color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  card: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    backgroundColor: COLORS.deepVoid,
    gap: 12,
  },
  cardName: { fontFamily: TYPO.labelBold, fontSize: 14, color: COLORS.textPrimary },
  cardMeta: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textMuted, marginTop: 4, letterSpacing: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 12, height: 46 },
  bar: { width: 22, alignItems: 'center', justifyContent: 'flex-end' },
  barInner: { width: 4, flex: 1, backgroundColor: COLORS.amber, borderRadius: 2, opacity: 0.8 },
  barLabel: { fontFamily: TYPO.mono, fontSize: 8, color: COLORS.textMuted, marginTop: 2 },
  delBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
