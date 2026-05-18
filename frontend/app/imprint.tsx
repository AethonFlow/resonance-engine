/**
 * v6 · Imprint screen.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TYPO } from '../src/design';
import { useT } from '../src/i18n';

export default function ImprintScreen() {
  const router = useRouter();
  const t = useT();
  return (
    <SafeAreaView style={styles.root} testID="imprint-root">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('legal.imprint').toUpperCase()}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>COHERENCE JOURNAL</Text>
        <Text style={styles.line}>AethonFlow</Text>
        <Text style={styles.line}>Andreas Wolf</Text>
        <Text style={styles.line}>contact@aethonflow.io</Text>
        <Text style={styles.section}>{t('legal.contact')}</Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@aethonflow.io')}>
          <Text style={[styles.line, { color: COLORS.amber }]}>contact@aethonflow.io</Text>
        </TouchableOpacity>
        <Text style={styles.section}>{t('legal.disclaimer')}</Text>
        <Text style={styles.disclaimer}>{t('legal.disclaimer')}</Text>
        <View style={{ height: 14 }} />
        <TouchableOpacity onPress={() => router.push('/privacy')} style={styles.linkBtn}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.linkText}>{t('legal.privacy')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.panelBorder, justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.panelBorder },
  title: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.amber, letterSpacing: 3, flex: 1, textAlign: 'center' },
  body: { padding: 18, gap: 8, paddingBottom: 40 },
  section: { fontFamily: TYPO.monoBold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, marginTop: 14 },
  line: { fontFamily: TYPO.label, fontSize: 14, color: COLORS.textPrimary, lineHeight: 22 },
  disclaimer: { fontFamily: TYPO.label, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.panelBorder, alignSelf: 'flex-start' },
  linkText: { fontFamily: TYPO.label, fontSize: 13, color: COLORS.textSecondary },
});
