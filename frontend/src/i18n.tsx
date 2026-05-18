/**
 * Lightweight i18n + Settings store for THE SPHERE.
 * No external libs — React Context + AsyncStorage hydration.
 *
 * Exposes:
 *   useSettings()         -> { lang, setLang, onboardingSeen, markOnboardingSeen, ready }
 *   useT()                -> translate function: t('home.title')
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

export type Lang = 'de' | 'en';

const KEY_LANG = '@sphere/lang/v1';
const KEY_ONBOARDING = '@sphere/onboarding_seen/v1';

const STRINGS = {
  de: {
    // ── common
    'common.back':       'Zurück',
    'common.close':      'Schließen',
    'common.cancel':     'Abbrechen',
    'common.save':       'Speichern',
    'common.next':       'Weiter',
    'common.done':       'Fertig',
    'common.skip':       'Überspringen',
    'common.again':      'Nochmal',
    'common.share':      'Teilen',
    'common.delete':     'Löschen',
    'common.confirm':    'Bestätigen',
    'common.clear':      'Leeren',
    'common.loading':    'Lade…',
    'common.empty':      'Noch leer',
    'common.lang.short': 'DE',

    // ── onboarding
    'onb.skip':              'Überspringen',
    'onb.start':             'Loslegen',
    'onb.next':              'Weiter',

    'onb.1.title':           'Die Sphäre',
    'onb.1.body':            'Ein lebendiges 3D-Feld aus 24 Knoten. Jede deiner Eingaben verändert ihre Resonanz – warm, kalt, oder singend.',
    'onb.2.title':           'Stimmen mit TUNE',
    'onb.2.body':            'Drücke TUNE und schreibe einen Satz über das, was dich gerade bewegt. Die Sphäre antwortet mit Energie und Markern.',
    'onb.3.title':           'TENZOR liest dich',
    'onb.3.body':            'Öffne TNZ rechts oben und erhalte in ~2 Sekunden einen klaren Resonanzbericht mit Score, Insight und Action.',

    // ── tooltips
    'tip.energy':            'Energie · E ist die Gesamtschwingung der Sphäre. Ziel: 25.0 = perfekter Gleichgewichtspunkt (Nullstelle).',
    'tip.incoherence':       'Inkohärenz · I = 1 − R₀. Wie weit die untere Schicht (Ground) vom synchronen Zustand entfernt ist. 0 = perfekt synchron.',
    'tip.sing':              'SING INDEX · Maß für die Drei-Schichten-Synchronität. 0.85 = SINGING, 0.95+ = NULLSTELLE.',
    'tip.null':              'NULL · Setzt die Sphäre instantan auf den perfekten Resonanz-Zustand. Lang drücken: Caput Mortuum.',
    'tip.tune':              'TUNE · Schicke einen Satz an die Sphäre. 8 Mess-Operatoren analysieren Tonalität, Tiefe und Erdung.',
    'tip.tnz':               'TENZOR · Ein klarer Resonanzbericht in ~2 s. Score · Insight · Action. Single-Pass.',
    'tip.audio':             'Ton · Schaltet die Resonanz-Sinuswelle ein. Tonhöhe folgt der Energie.',
    'tip.house':             'Haus · Eine der 8 Lebenszyklus-Achsen (Origin → Evaluation). Tippen wählt aus, der Slider unten ändert die Amplitude.',
    'tip.slider':            'Amplitude · Stärke des gewählten Hauses. 1.77 = neutral, 0 = ruhig, 3.5 = überladen.',
    'tip.vector4d':          'Vector-4D · [x, y, dx, dy] = [cos θ, sin θ, −sin θ, cos θ]. Die kanonische Troika-Rotor-Form der Sphäre.',
    'tip.score':             'Coherence Score · 0.00 – 1.00. Wie ausgerichtet das Feld nach deiner Eingabe ist.',
    'tip.energy_target':     'Energy Level · Kinetische Energie des Rotors. Konstantes Ziel = 0.5 (Hamiltonian-Invariante).',
    'tip.factor':            'Dominant Factor · Die Dimension, die am stärksten vom Neutralpunkt abweicht.',
    'tip.agent':             'Agent Feedback · Was der Resonant-Agent über die Troika-Ausrichtung sagt.',
    'tip.history':           'History · Deine letzten Resonanzberichte. Tippe für Detail.',

    // ── home HUD labels
    'hud.energy':            'ENERGY · E',
    'hud.incoherence':       'INKOHÄRENZ · I',
    'hud.target':            'Ziel · ',
    'hud.minus_r0':          '1 − R₀',
    'hud.sing':              'SING',

    // ── probe modal (legacy TUNE)
    'tune.title':            'STIMME DAS FELD',
    'tune.title_mirror':     'PROJECT MIRROR',
    'tune.body':             'Was möchtest du der Sphäre sagen? Eine klare Intention reicht.',
    'tune.placeholder':      'z.B. "Ich starte einen Podcast"',
    'tune.cancel':           'ABBRECHEN',
    'tune.send':             'STIMMEN',
    'tune.again':            'NOCHMAL',
    'tune.close':            'SCHLIESSEN',
    'tune.hint':             '1 Haiku-Call · 8 Mess-Operatoren · ~2-3 s',

    // ── tenzor screen
    'tnz.title':             'TENZOR · ORCHESTRATOR',
    'tnz.sub':               'single-pass · 8000 ms · deterministic',
    'tnz.input':             'EINGABE',
    'tnz.placeholder':       'z.B. "Das Upwork-Projekt LBLX116 ist aktiv geschaltet."',
    'tnz.clear':             'LEEREN',
    'tnz.invoke':            'INVOKE',
    'tnz.score':             'SCORE',
    'tnz.energy':            'ENERGIE',
    'tnz.factor':            'FAKTOR',
    'tnz.agent':             'AGENT FEEDBACK',
    'tnz.vector':            'INPUT VECTOR · [x, y, dx, dy]',
    'tnz.insight':           '[INSIGHT]',
    'tnz.action':            '[ACTION]',
    'tnz.raw':               'RAW REPORT',
    'tnz.share':             'TEILEN',
    'tnz.history':           'VERLAUF',
    'tnz.empty':             'Noch keine Resonanzberichte.\nGib oben einen Satz ein und tippe INVOKE.',
    'tnz.delete_one':        'Eintrag löschen?',
    'tnz.delete_all':        'Verlauf vollständig leeren?',
    'tnz.contract.1':        '· single-pass · keine Schleifen · keine Spekulation',
    'tnz.contract.2':        '· 4D-Vektor [cos θ, sin θ, −sin θ, cos θ] · H = 0.5',
    'tnz.contract.3':        '· fail-safe: score 0.00 · factor INSUFFICIENT_DATA',

    // ── settings
    'set.language':          'Sprache',
    'set.language.de':       'Deutsch',
    'set.language.en':       'English',
    'set.replay_onboarding': 'Einführung erneut zeigen',
    'set.reminder':          'Täglich an die Sphäre erinnern',
    'set.reminder.time':     'Erinnerungszeit',

    // ── daily alignment / journal
    'journal.aligned':       'Heute ausgerichtet',
    'journal.not_aligned':   'Heute noch nicht ausgerichtet',
    'journal.empty_today':   'Heute noch keine Resonanz',
    'journal.calls_today':   'Resonanzen heute',
    'journal.spark.title':   '7-Tage-Kohärenz',
    'journal.spark.empty':   'Noch keine Daten für die letzten 7 Tage.',
    'journal.spark.avg':     'Ø',
    'journal.spark.high':    '↑',
    'journal.spark.low':     '↓',
    'tip.aligned':           'Tägliche Ausrichtung · Sobald du heute mindestens einen TENZOR-Aufruf mit Score ≥ 0.60 hast, gilt der Tag als „ausgerichtet".',
    'tip.sparkline':         'Kohärenz-Verlauf · Maximaler Score pro Tag der letzten 7 Tage. Steigend → Vertrauen wächst.',
    'tip.streak':            'Streak · Aufeinanderfolgende Tage mit Ausrichtung. Heute zählt mit, sobald ein TENZOR-Score ≥ 0.60 erreicht ist.',
    'tip.journal_feed':      'Insight-Feed · Deine letzten 7 Resonanzberichte als blätterbare Karten. Antippen → Details.',

    // ── journal feed
    'journal.feed.title':    'INSIGHT FEED',
    'journal.feed.all':      'Alle',
    'journal.feed.empty':    'noch kein Eintrag',
    'journal.range.7':       '7 TAGE',
    'journal.range.30':      '30 TAGE',
    'journal.streak_unit':   ' Tag(e) in Folge',
    'journal.share.text':    'Als Text teilen',
    'journal.share.pdf':     'Als PDF teilen',

    // ── notifications
    'notif.permission_title': 'Erinnerung erlauben?',
    'notif.permission_body':  'Damit dich die Sphäre einmal täglich an deine Resonanz erinnern kann.',
    'notif.daily.title':      'Wie ist dein Feld heute?',
    'notif.daily.body':       'Eine Eingabe in TENZOR reicht. Öffne die Sphäre.',
    'notif.unsupported':      'Auf dieser Plattform sind Push-Erinnerungen nicht verfügbar. Die Einstellung ist sicher gespeichert.',
  },

  en: {
    'common.back':       'Back',
    'common.close':      'Close',
    'common.cancel':     'Cancel',
    'common.save':       'Save',
    'common.next':       'Next',
    'common.done':       'Done',
    'common.skip':       'Skip',
    'common.again':      'Again',
    'common.share':      'Share',
    'common.delete':     'Delete',
    'common.confirm':    'Confirm',
    'common.clear':      'Clear',
    'common.loading':    'Loading…',
    'common.empty':      'Empty',
    'common.lang.short': 'EN',

    'onb.skip':              'Skip',
    'onb.start':             'Start',
    'onb.next':              'Next',

    'onb.1.title':           'The Sphere',
    'onb.1.body':            'A living 3D field of 24 nodes. Every input you send changes its resonance — warm, cold, or singing.',
    'onb.2.title':           'Tune with TUNE',
    'onb.2.body':            'Tap TUNE and write one sentence about what is moving you right now. The sphere answers with energy and markers.',
    'onb.3.title':           'TENZOR reads you',
    'onb.3.body':            'Open TNZ on the right and get a clear resonance report in ~2 seconds — score, insight, action.',

    'tip.energy':            'Energy · E is the total oscillation of the sphere. Target: 25.0 = perfect equilibrium (zero-point).',
    'tip.incoherence':       'Incoherence · I = 1 − R₀. How far the ground layer is from synchrony. 0 = perfectly synchronous.',
    'tip.sing':              'SING INDEX · Three-layer synchrony measure. 0.85 = SINGING, 0.95+ = NULLSTELLE (zero-point).',
    'tip.null':              'NULL · Snaps the sphere to perfect resonance instantly. Long-press: Caput Mortuum reset.',
    'tip.tune':              'TUNE · Send a sentence to the sphere. 8 measurement operators analyse tone, depth and grounding.',
    'tip.tnz':               'TENZOR · A clean resonance report in ~2 s. Score · Insight · Action. Single-pass.',
    'tip.audio':             'Audio · Toggles the resonance sine wave. Pitch follows the energy.',
    'tip.house':             'House · One of the 8 life-cycle axes (Origin → Evaluation). Tap to select; slider below changes amplitude.',
    'tip.slider':            'Amplitude · Strength of the selected house. 1.77 = neutral, 0 = silent, 3.5 = overloaded.',
    'tip.vector4d':          'Vector-4D · [x, y, dx, dy] = [cos θ, sin θ, −sin θ, cos θ]. Canonical Troika rotor form of the sphere.',
    'tip.score':             'Coherence Score · 0.00 – 1.00. How aligned the field is after your input.',
    'tip.energy_target':     'Energy Level · Rotor kinetic energy. Constant target = 0.5 (Hamiltonian invariant).',
    'tip.factor':            'Dominant Factor · The dimension that deviates the most from the neutral point.',
    'tip.agent':             'Agent Feedback · What the Resonant Agent reports about Troika alignment.',
    'tip.history':           'History · Your most recent resonance reports. Tap for detail.',

    'hud.energy':            'ENERGY · E',
    'hud.incoherence':       'INCOHERENCE · I',
    'hud.target':            'target · ',
    'hud.minus_r0':          '1 − R₀',
    'hud.sing':              'SING',

    'tune.title':            'TUNE THE FIELD',
    'tune.title_mirror':     'PROJECT MIRROR',
    'tune.body':             'What do you want to tell the sphere? One clear intention is enough.',
    'tune.placeholder':      'e.g. "I am starting a podcast"',
    'tune.cancel':           'CANCEL',
    'tune.send':             'TUNE',
    'tune.again':            'AGAIN',
    'tune.close':            'CLOSE',
    'tune.hint':             '1 Haiku call · 8 measurement operators · ~2-3 s',

    'tnz.title':             'TENZOR · ORCHESTRATOR',
    'tnz.sub':               'single-pass · 8000 ms · deterministic',
    'tnz.input':             'INPUT',
    'tnz.placeholder':       'e.g. "The Upwork project LBLX116 is now live."',
    'tnz.clear':             'CLEAR',
    'tnz.invoke':            'INVOKE',
    'tnz.score':             'SCORE',
    'tnz.energy':            'ENERGY',
    'tnz.factor':            'FACTOR',
    'tnz.agent':             'AGENT FEEDBACK',
    'tnz.vector':            'INPUT VECTOR · [x, y, dx, dy]',
    'tnz.insight':           '[INSIGHT]',
    'tnz.action':            '[ACTION]',
    'tnz.raw':               'RAW REPORT',
    'tnz.share':             'SHARE',
    'tnz.history':           'HISTORY',
    'tnz.empty':             'No resonance reports yet.\nType a sentence above and tap INVOKE.',
    'tnz.delete_one':        'Delete this entry?',
    'tnz.delete_all':        'Clear the whole history?',
    'tnz.contract.1':        '· single-pass · no loops · no speculation',
    'tnz.contract.2':        '· 4D vector [cos θ, sin θ, −sin θ, cos θ] · H = 0.5',
    'tnz.contract.3':        '· fail-safe: score 0.00 · factor INSUFFICIENT_DATA',

    'set.language':          'Language',
    'set.language.de':       'Deutsch',
    'set.language.en':       'English',
    'set.replay_onboarding': 'Replay onboarding',
    'set.reminder':          'Daily resonance reminder',
    'set.reminder.time':     'Reminder time',

    // ── daily alignment / journal
    'journal.aligned':       'Aligned today',
    'journal.not_aligned':   'Not aligned today',
    'journal.empty_today':   'No resonance yet today',
    'journal.calls_today':   'resonances today',
    'journal.spark.title':   '7-day coherence',
    'journal.spark.empty':   'No data for the last 7 days yet.',
    'journal.spark.avg':     'avg',
    'journal.spark.high':    '↑',
    'journal.spark.low':     '↓',
    'tip.aligned':           'Daily Alignment · Once you have at least one TENZOR call today with score ≥ 0.60, the day counts as "aligned".',
    'tip.sparkline':         'Coherence trace · Daily peak score over the last 7 days. Rising → confidence builds.',
    'tip.streak':            'Streak · Consecutive aligned days. Today counts the moment a TENZOR score ≥ 0.60 is reached.',
    'tip.journal_feed':      'Insight feed · Your last 7 resonance reports as swipeable cards. Tap → details.',

    // ── journal feed
    'journal.feed.title':    'INSIGHT FEED',
    'journal.feed.all':      'All',
    'journal.feed.empty':    'no entries yet',
    'journal.range.7':       '7 DAYS',
    'journal.range.30':      '30 DAYS',
    'journal.streak_unit':   ' day(s) in a row',
    'journal.share.text':    'Share as text',
    'journal.share.pdf':     'Share as PDF',

    // ── notifications
    'notif.permission_title': 'Allow reminders?',
    'notif.permission_body':  'So the sphere can remind you of your daily resonance.',
    'notif.daily.title':      'How is your field today?',
    'notif.daily.body':       'One TENZOR call is enough. Open the sphere.',
    'notif.unsupported':      'Push reminders are not available on this platform. Your preference is saved safely.',
  },
} as const;

export type TKey = keyof typeof STRINGS['de'];

export function translate(lang: Lang, key: TKey): string {
  const table = STRINGS[lang] || STRINGS.de;
  return (table as Record<string, string>)[key] ?? (STRINGS.de as Record<string, string>)[key] ?? key;
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  onboardingSeen: boolean;
  markOnboardingSeen: () => void;
  resetOnboarding: () => void;
  ready: boolean;
  t: (key: TKey) => string;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de');
  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(true);
  const [ready, setReady] = useState<boolean>(false);

  // hydrate from disk
  useEffect(() => {
    (async () => {
      try {
        const [storedLang, storedOnb] = await Promise.all([
          AsyncStorage.getItem(KEY_LANG),
          AsyncStorage.getItem(KEY_ONBOARDING),
        ]);
        if (storedLang === 'de' || storedLang === 'en') setLangState(storedLang);
        setOnboardingSeen(storedOnb === '1');
      } catch { /* ignore */ }
      setReady(true);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY_LANG, l).catch(() => {});
  }, []);
  const markOnboardingSeen = useCallback(() => {
    setOnboardingSeen(true);
    AsyncStorage.setItem(KEY_ONBOARDING, '1').catch(() => {});
  }, []);
  const resetOnboarding = useCallback(() => {
    setOnboardingSeen(false);
    AsyncStorage.removeItem(KEY_ONBOARDING).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    onboardingSeen,
    markOnboardingSeen,
    resetOnboarding,
    ready,
    t: (k: TKey) => translate(lang, k),
  }), [lang, onboardingSeen, ready, setLang, markOnboardingSeen, resetOnboarding]);

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) {
    // Defensive default so screens still render even if the provider is missing.
    return {
      lang: 'de',
      setLang: () => {},
      onboardingSeen: true,
      markOnboardingSeen: () => {},
      resetOnboarding: () => {},
      ready: true,
      t: (k: TKey) => translate('de', k),
    };
  }
  return ctx;
}

export function useT(): (key: TKey) => string {
  return useSettings().t;
}
