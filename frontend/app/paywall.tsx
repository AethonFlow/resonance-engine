/**
 * v6 · Paywall screen — Premium upgrade UI.
 * No real billing yet — in dev a „simulate premium“ button toggles the flag
 * locally via the SettingsProvider.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, TYPO } from '../src/design';
import { useSettings, useT } from '../src/i18n';

export default function PaywallScreen() {
  const router = useRouter();
  const t = useT();
  const { isPremium, setPremium } = useSettings();
  const [plan, setPlan] = useState<'month' | 'year'>('year');

  const onCta = () => {
    Alert.alert(
      t('paywall.title'),
      t('paywall.legal'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('paywall.simulate'),
          onPress: () => {
            setPremium(true);
            router.back();
          },
        },
      ],
    );
  };

  const features: Array<{ key: string; icon: any }> = [
    { key: 'paywall.feat.unlimited', icon: 'infinity' },
    { key: 'paywall.feat.export',    icon: 'file-pdf-box' },
    { key: 'paywall.feat.history',   icon: 'calendar-month-outline' },
    { key: 'paywall.feat.journal',   icon: 'book-open-outline' },
  ];

  return (
    <SafeAreaView style={styles.root} testID="paywall-root">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="paywall-back" hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{t('paywall.title')}</Text>
          <Text style={styles.sub}>{t('paywall.sub')}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.featureBox}>
          {features.map((f, i) => (
            <View key={f.key} style={[styles.featureRow, i > 0 && { borderTopWidth: 1, borderTopColor: COLORS.panelBorder }]}>
              <MaterialCommunityIcons name={f.icon} size={20} color={COLORS.amber} />
              <Text style={styles.featureText}>{t(f.key as any)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planRow}>
          <TouchableOpacity
            testID="plan-month"
            onPress={() => setPlan('month')}
            style={[styles.planCard, plan === 'month' && styles.planCardActive]}
          >
            <Text style={[styles.planLabel, plan === 'month' && { color: COLORS.amber }]}>{t('paywall.plan.month')}</Text>
            <Text style={[styles.planPrice, plan === 'month' && { color: COLORS.amber }]}>{t('paywall.plan.month.price')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="plan-year"
            onPress={() => setPlan('year')}
            style={[styles.planCard, plan === 'year' && styles.planCardActive]}
          >
            <View style={styles.savePill}><Text style={styles.saveText}>{t('paywall.plan.year.save')}</Text></View>
            <Text style={[styles.planLabel, plan === 'year' && { color: COLORS.amber }]}>{t('paywall.plan.year')}</Text>
            <Text style={[styles.planPrice, plan === 'year' && { color: COLORS.amber }]}>{t('paywall.plan.year.price')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="paywall-cta"
          onPress={onCta}
          style={styles.cta}
        >
          <Ionicons name="diamond-outline" size={18} color={COLORS.void} />
          <Text style={styles.ctaText}>{t('paywall.cta')}</Text>
        </TouchableOpacity>

        {isPremium ? (
          <TouchableOpacity
            testID="paywall-dev-off"
            onPress={() => { setPremium(false); }}
            style={styles.devOff}
          >
            <Text style={styles.devOffText}>{t('paywall.simulate.off')}</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.legal}>{t('paywall.legal')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.panelBorder },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.panelBorder },
  title: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.amber, letterSpacing: 3 },
  sub: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, marginTop: 2 },

  body: { padding: 18, gap: 18, paddingBottom: 40 },

  featureBox: { borderRadius: 14, borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: 'rgba(6,8,10,0.85)' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  featureText: { fontFamily: TYPO.label, fontSize: 14, color: COLORS.textPrimary },

  planRow: { flexDirection: 'row', gap: 12 },
  planCard: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: 'rgba(6,8,10,0.85)', gap: 4, minHeight: 84, justifyContent: 'center', position: 'relative' },
  planCardActive: { borderColor: COLORS.amber, backgroundColor: 'rgba(245,176,65,0.08)' },
  planLabel: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 2 },
  planPrice: { fontFamily: TYPO.monoBold, fontSize: 16, color: COLORS.textPrimary },
  savePill: { position: 'absolute', top: 6, right: 6, backgroundColor: COLORS.lime, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  saveText: { fontFamily: TYPO.monoBold, fontSize: 8, color: COLORS.void, letterSpacing: 0.5 },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.amber, paddingVertical: 16, borderRadius: 12, minHeight: 52 },
  ctaText: { fontFamily: TYPO.monoBold, fontSize: 13, color: COLORS.void, letterSpacing: 3 },

  devOff: { paddingVertical: 10, alignItems: 'center' },
  devOffText: { fontFamily: TYPO.mono, fontSize: 11, color: COLORS.crimson, letterSpacing: 1 },

  legal: { fontFamily: TYPO.mono, fontSize: 9, color: COLORS.textMuted, textAlign: 'center', lineHeight: 14, letterSpacing: 0.5 },
});
