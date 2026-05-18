/**
 * v6 · Privacy policy screen — local, no network.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TYPO } from '../src/design';
import { useT } from '../src/i18n';

const PRIVACY_DE = `
Deine Eingaben werden ausschliesslich genutzt, um deinen Resonanzbericht zu erzeugen.

Wir speichern lokal auf deinem Gerät:
  • deine letzten Einträge (max. 30 Tage)
  • deine Streak
  • deine Spracheinstellung
  • deinen optionalen Vornamen und Wochenfokus

Wir übertragen an unseren Server (verschlüsselt via HTTPS):
  • den Inhalt deiner einzelnen Eingabe, während ein Bericht erzeugt wird
  • nichts darüber hinaus

Wir nutzen Anthropic Claude Haiku 4.5 als KI-Auswertungs-Operator. Die Eingabe
wird im Rahmen der einmaligen Berichtserzeugung an Anthropic gesendet und
nicht zu Trainingszwecken verwendet.

Wir verkaufen keine Daten. Wir betreiben kein Tracking. Wir setzen keine
Werbe-Cookies und kein Profiling ein.

Deine Daten löschen: in der App unter Verlauf > Alles löschen, oder durch
Deinstallation der App.

Kontakt: contact@aethonflow.io

Kein medizinisches Produkt — kein Ersatz für Therapie oder Diagnose.
`.trim();

const PRIVACY_EN = `
Your input is used solely to generate your resonance report.

We store locally on your device:
  • your last entries (max 30 days)
  • your streak
  • your language preference
  • your optional first name and weekly focus

We transmit to our server (encrypted via HTTPS):
  • the content of one entry while a report is being generated
  • nothing beyond that

We use Anthropic Claude Haiku 4.5 as the AI evaluation operator. Your input
is sent to Anthropic for the one-shot report generation and is not used for
training.

We do not sell data. We do not track. We do not run ad cookies or profiling.

Delete your data: in the app under History > Clear all, or by uninstalling
the app.

Contact: contact@aethonflow.io

Not a medical product — not a substitute for therapy or diagnosis.
`.trim();

export default function PrivacyScreen() {
  const router = useRouter();
  const t = useT();
  const { lang } = require('../src/i18n').useSettings() as { lang: 'de' | 'en' };
  const body = lang === 'en' ? PRIVACY_EN : PRIVACY_DE;
  return (
    <SafeAreaView style={styles.root} testID="privacy-root">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('legal.privacy').toUpperCase()}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.text}>{body}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.void },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.panelBorder, justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.panelBorder },
  title: { fontFamily: TYPO.monoBold, fontSize: 12, color: COLORS.amber, letterSpacing: 3, flex: 1, textAlign: 'center' },
  body: { padding: 18, paddingBottom: 40 },
  text: { fontFamily: TYPO.label, fontSize: 13, color: COLORS.textPrimary, lineHeight: 21 },
});
