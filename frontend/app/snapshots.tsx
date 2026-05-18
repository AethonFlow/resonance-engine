import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API, type Snapshot24DTO, type ResidueDTO } from '../src/api';
import { COLORS, TYPO } from '../src/design';

type Tab = 'singing' | 'caput';

export default function SnapshotsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('singing');
  const [snaps, setSnaps] = useState<Snapshot24DTO[]>([]);
  const [residues, setResidues] = useState<ResidueDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([API.listSnapshots24(200), API.listResidues(100)]);
      setSnaps(s);
      setResidues(r);
    } catch (e: any) {
      Alert.alert('Network', e?.message ?? 'Could not reach backend');
    }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.root} testID="snapshots-root">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="snapshots-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>FIELD ARCHIVE</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            testID="tab-singing"
            onPress={() => setTab('singing')}
            style={[styles.tab, tab === 'singing' && styles.tabActiveAmber]}
          >
            <MaterialCommunityIcons name="waveform" size={14} color={tab === 'singing' ? COLORS.amber : COLORS.textMuted} />
            <Text style={[styles.tabText, tab === 'singing' && { color: COLORS.amber }]}>SINGING · NULLSTELLE</Text>
            <Text style={[styles.tabCount, tab === 'singing' && { color: COLORS.amber }]}>{snaps.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-caput"
            onPress={() => setTab('caput')}
            style={[styles.tab, tab === 'caput' && styles.tabActiveCrimson]}
          >
            <MaterialCommunityIcons name="recycle-variant" size={14} color={tab === 'caput' ? '#FF3C5F' : COLORS.textMuted} />
            <Text style={[styles.tabText, tab === 'caput' && { color: '#FF3C5F' }]}>CAPUT MORTUUM</Text>
            <Text style={[styles.tabCount, tab === 'caput' && { color: '#FF3C5F' }]}>{residues.length}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.amber} /></View>
        ) : tab === 'singing' ? (
          snaps.length === 0 ? (
            <EmptyState
              icon="pulse"
              text="No singing/Nullstelle events recorded."
              sub="Lead the sphere into coherence to capture an event."
            />
          ) : (
            <FlatList
              testID="snapshots-list"
              data={snaps}
              keyExtractor={i => i.id}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.amber} />}
              renderItem={({ item, index }) => {
                const color =
                  item.event === 'nullstelle' ? COLORS.amber
                  : item.event === 'singing' ? COLORS.amberSoft
                  : COLORS.lime;
                const hasLLM = !!(item.llm_markers && item.llm_markers.some(m => m && m.length > 0));
                return (
                  <View style={[styles.row, { borderLeftColor: color }]}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>
                        #{snaps.length - index} · {item.event.toUpperCase()}
                      </Text>
                      <Text style={[styles.rowSing, { color }]}>S {item.sing_index.toFixed(2)}</Text>
                    </View>
                    <Text style={styles.rowMeta}>
                      E={item.energy.toFixed(2)} · R₀={item.R_layer[0]?.toFixed(2)} · R₁={item.R_layer[1]?.toFixed(2)} · R₂={item.R_layer[2]?.toFixed(2)} · T={item.T_inter.toFixed(2)}
                    </Text>
                    {hasLLM && (
                      <View style={styles.markerBox}>
                        {item.llm_markers!.slice(0, 8).map((m, idx) => (
                          m ? (
                            <Text key={idx} style={styles.markerLine} numberOfLines={1}>
                              <Text style={styles.markerHouse}>{['I','II','III','IV','V','VI','VII','VIII'][idx]}</Text>
                              {' '}{m}
                            </Text>
                          ) : null
                        ))}
                      </View>
                    )}
                    <Text style={styles.rowTime}>{new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                );
              }}
            />
          )
        ) : (
          residues.length === 0 ? (
            <EmptyState
              icon="recycle-variant"
              text="No Caput Mortuum residues archived."
              sub="When N(t) > 0.45, accumulated noise is purified and stored here."
              tone="crimson"
            />
          ) : (
            <FlatList
              testID="residues-list"
              data={residues}
              keyExtractor={i => i.id}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3C5F" />}
              renderItem={({ item, index }) => (
                <View style={[styles.row, { borderLeftColor: '#FF3C5F' }]}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowTitle}>
                      #{residues.length - index} · {(item.reason || 'manual').toUpperCase()}
                    </Text>
                    <Text style={[styles.rowSing, { color: '#FF3C5F' }]}>N {item.noise_score.toFixed(3)}</Text>
                  </View>
                  <Text style={styles.rowMeta}>
                    E={item.energy.toFixed(2)} · I={item.incoherence.toFixed(3)}
                  </Text>
                  <Text style={styles.rowTime}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              )}
            />
          )
        )}
      </SafeAreaView>
    </View>
  );
}

function EmptyState({ icon, text, sub, tone }: { icon: any; text: string; sub: string; tone?: 'crimson' }) {
  return (
    <View style={styles.center}>
      <MaterialCommunityIcons name={icon} size={40} color={tone === 'crimson' ? '#FF3C5F' : COLORS.textMuted} />
      <Text style={styles.empty}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.panelBorder },
  title: { fontFamily: TYPO.monoBold, fontSize: 13, letterSpacing: 2, color: COLORS.textPrimary },

  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: COLORS.deepVoid,
  },
  tabActiveAmber: { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.06)' },
  tabActiveCrimson: { borderColor: '#FF3C5F', backgroundColor: 'rgba(255,60,95,0.06)' },
  tabText: { fontFamily: TYPO.monoBold, fontSize: 9, letterSpacing: 1.5, color: COLORS.textMuted },
  tabCount: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  empty: { fontFamily: TYPO.labelBold, color: COLORS.textSecondary, fontSize: 14, marginTop: 12 },
  emptySub: { fontFamily: TYPO.label, color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 },

  row: {
    padding: 14, borderRadius: 10,
    backgroundColor: COLORS.deepVoid,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    borderLeftWidth: 3,
    gap: 4,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.textPrimary, letterSpacing: 1 },
  rowSing: { fontFamily: TYPO.monoBold, fontSize: 12, letterSpacing: 1 },
  rowMeta: { fontFamily: TYPO.mono, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 0.5 },
  rowTime: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, marginTop: 4, letterSpacing: 1 },

  markerBox: { marginTop: 6, gap: 2 },
  markerLine: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.amberSoft, letterSpacing: 0.5 },
  markerHouse: { color: COLORS.amber, fontFamily: TYPO.monoBold },
});
