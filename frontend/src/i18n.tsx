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
const KEY_PREMIUM = '@sphere/premium/v1';
const KEY_FREE_USAGE = '@sphere/free_usage/v1';
const KEY_USER_NAME = '@sphere/user_name/v1';
const KEY_FOCUS = '@sphere/weekly_focus/v1';
const KEY_EXPERT = '@sphere/expert_mode/v1';
// v7 — conversion-funnel keys
const KEY_FIRST_SEEN     = '@sphere/first_seen/v1';
const KEY_TRIAL_END      = '@sphere/trial_end/v1';
const KEY_SOFT_PAYWALL   = '@sphere/soft_paywall_shown/v1';
const KEY_REVIEW_SHOWN   = '@sphere/review_shown/v1';

export const FREE_REPORTS_PER_WEEK = 7;
export const TRIAL_DAYS            = 7;

function isoWeekStart(date: Date = new Date()): string {
  // ISO week starts on Monday.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

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
    'tune.title':            'EINTRAG ERSTELLEN',
    'tune.title_mirror':     'SPIEGEL',
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

    // ── v6 · check-in & ritual
    'home.checkin':           'Neuer Check-in',
    'home.checkin.second':    'Zweiten Check-in (Premium)',
    'home.checkin.done_today':'Heute schon eingetragen',
    'home.checkin.empty_today':'Heute noch kein Eintrag',
    'home.streak.title':      'STREAK',
    'home.quota.left':        'Noch {{n}} freie Einträge diese Woche',
    'home.quota.none':        'Kein freier Eintrag mehr diese Woche',
    'home.quota.unlimited':   'Unbegrenzte Einträge · Premium',

    // ── v6.1 · check-in card (welcome / CTA)
    'home.checkin.greet.morning':   'Guten Morgen',
    'home.checkin.greet.afternoon': 'Schön, dass du da bist',
    'home.checkin.greet.evening':   'Guten Abend',
    'home.checkin.prompt':          'Schreib einen ehrlichen Satz für heute.',
    'home.checkin.cta':             'EINTRAG ERSTELLEN',
    'home.checkin.hint':            '~ 60 Sekunden · Score · Insight · Action',
    'home.checkin.open':            'VERLAUF ÖFFNEN',

    // ── v6 · paywall
    'paywall.title':          'COHERENCE PREMIUM',
    'paywall.sub':             'Stoische Klarheit, jeden Tag',
    'paywall.feat.unlimited': 'Unbegrenzte Einträge',
    'paywall.feat.export':    'Unbegrenzter PDF-Export',
    'paywall.feat.history':   '30-Tage-Verlauf',
    'paywall.feat.journal':   'Unbegrenztes Insight-Journal',
    'paywall.plan.month':     'MONATLICH',
    'paywall.plan.year':      'JÄHRLICH',
    'paywall.plan.month.price':'4,99 € / Monat',
    'paywall.plan.year.price': '19,99 € / Jahr',
    'paywall.plan.year.save': 'spare 67 %',
    'paywall.cta':            'Premium freischalten',
    'paywall.restore':        'Kauf wiederherstellen',
    'paywall.simulate':       'DEV · Premium aktivieren',
    'paywall.simulate.off':   'DEV · Premium deaktivieren',
    'paywall.legal':           'Test-Build · Kauf-Funktion folgt im Store-Release',
    'paywall.locked':         'Diese Funktion ist Teil von Premium.',

    // ── v6 · onboarding (rewrite)
    'onb1.title':             '60 Sekunden Klarheit pro Tag',
    'onb1.body':              'Ein Satz rein — ein klarer Bericht raus. Score, Insight und nächste Aktion in unter zwei Sekunden.',
    'onb2.title':             'Streak hält dich stabil',
    'onb2.body':              'Trag jeden Tag einen Gedanken ein. Deine Streak und der 7-Tage-Verlauf zeigen, wo du wirklich stehst.',
    'onb3.title':             'Teile deine Entwicklung',
    'onb3.body':              'Jeden Bericht als sauberes PDF exportieren — für dich, deinen Coach oder deine Therapeutin.',
    'onb.name.title':         'Wie sollen wir dich nennen?',
    'onb.name.placeholder':   'Vorname (optional)',
    'onb.focus.title':        'Was ist dein Fokus diese Woche?',
    'onb.focus.placeholder':  'z.B. "Klarer bei Entscheidungen werden"',
    'onb.focus.skip':         'Überspringen',

    // ── v6 · legal
    'legal.privacy':          'Datenschutz',
    'legal.imprint':          'Impressum',
    'legal.disclaimer':       'Kein medizinisches Produkt — kein Ersatz für Therapie oder Diagnose.',
    'legal.contact':          'Kontakt',

    // ── v6 · settings
    'set.premium.status':     'Premium-Status',
    'set.premium.active':     'AKTIV',
    'set.premium.inactive':   'NICHT AKTIV',
    'set.premium.upgrade':    'Auf Premium upgraden',
    'set.name':               'Dein Name',
    'set.focus':              'Wochenfokus',
    'set.version':            'Version',

    // ── v7 · conversion funnel
    'onb.try.title':          'Dein erster Eintrag',
    'onb.try.body':           'Schreib einen ehrlichen Satz über das, was dich heute bewegt. Du bekommst sofort deinen ersten Insight.',
    'onb.try.placeholder':    'z.B. "Ich starte heute ein neues Projekt."',
    'onb.try.cta':            'Insight erzeugen',
    'onb.try.skip':           'Später',
    'onb.try.result':         'Dein erster Insight',
    'onb.try.continue':       'Loslegen',
    'onb.try.error':          'Eingabe zu dünn — schreib einen vollständigen Satz.',

    'soft.title':             'Drei Tage stabil',
    'soft.body':              'Du hast eine Streak von {{n}} Tagen aufgebaut. Verlier sie nicht.',
    'soft.benefit':           'Premium sichert deine Entwicklung — unbegrenzte Einträge, 30-Tage-Verlauf, PDF-Export.',
    'soft.cta':               '7 Tage gratis testen',
    'soft.later':             'Nicht jetzt',

    'trial.cta':              'Jetzt 7 Tage gratis testen',
    'trial.sub':              'Dann 19,99 € / Jahr · jederzeit kündbar',
    'trial.active':           'Trial läuft · noch {{n}} Tag(e)',
    'trial.expired':          'Trial beendet',
    'trial.dev_start':        'DEV · Trial starten (7 Tage)',

    'review.title':           'Die Sphäre singt',
    'review.body':            'Du hast soeben SINGING erreicht. Wenn dir die App hilft, hilf ihr mit einer kurzen Bewertung.',
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

    'tune.title':            'NEW ENTRY',
    'tune.title_mirror':     'MIRROR',
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

    // ── v6 · check-in & ritual
    'home.checkin':           'New check-in',
    'home.checkin.second':    'Second check-in (Premium)',
    'home.checkin.done_today':'Logged today',
    'home.checkin.empty_today':'No entry yet today',
    'home.streak.title':      'STREAK',
    'home.quota.left':        '{{n}} free entries left this week',
    'home.quota.none':        'No free entries left this week',
    'home.quota.unlimited':   'Unlimited entries · Premium',

    // ── v6.1 · check-in card (welcome / CTA)
    'home.checkin.greet.morning':   'Good morning',
    'home.checkin.greet.afternoon': 'Glad you are here',
    'home.checkin.greet.evening':   'Good evening',
    'home.checkin.prompt':          'Write one honest sentence for today.',
    'home.checkin.cta':             'NEW ENTRY',
    'home.checkin.hint':            '~ 60 seconds · score · insight · action',
    'home.checkin.open':            'OPEN HISTORY',

    // ── v6 · paywall
    'paywall.title':          'COHERENCE PREMIUM',
    'paywall.sub':             'Stoic clarity, every day',
    'paywall.feat.unlimited': 'Unlimited entries',
    'paywall.feat.export':    'Unlimited PDF export',
    'paywall.feat.history':   '30-day history',
    'paywall.feat.journal':   'Unlimited insight journal',
    'paywall.plan.month':     'MONTHLY',
    'paywall.plan.year':      'YEARLY',
    'paywall.plan.month.price':'€4.99 / month',
    'paywall.plan.year.price': '€19.99 / year',
    'paywall.plan.year.save': 'save 67 %',
    'paywall.cta':            'Unlock premium',
    'paywall.restore':        'Restore purchase',
    'paywall.simulate':       'DEV · enable premium',
    'paywall.simulate.off':   'DEV · disable premium',
    'paywall.legal':           'Test build · in-app purchase ships with the store release',
    'paywall.locked':         'This feature is part of Premium.',

    // ── v6 · onboarding (rewrite)
    'onb1.title':             '60 seconds of clarity a day',
    'onb1.body':              'One sentence in — one clean report out. Score, insight, and next action in under two seconds.',
    'onb2.title':             'Streak keeps you steady',
    'onb2.body':              'Log one thought every day. Your streak and 7-day trace show where you really stand.',
    'onb3.title':             'Share your trajectory',
    'onb3.body':              'Export every report as a clean PDF — for yourself, your coach, or your therapist.',
    'onb.name.title':         'What should we call you?',
    'onb.name.placeholder':   'First name (optional)',
    'onb.focus.title':        'What is your focus this week?',
    'onb.focus.placeholder':  'e.g. "Get clearer about decisions"',
    'onb.focus.skip':         'Skip',

    // ── v6 · legal
    'legal.privacy':          'Privacy',
    'legal.imprint':          'Imprint',
    'legal.disclaimer':       'Not a medical product — not a substitute for therapy or diagnosis.',
    'legal.contact':          'Contact',

    // ── v6 · settings
    'set.premium.status':     'Premium status',
    'set.premium.active':     'ACTIVE',
    'set.premium.inactive':   'NOT ACTIVE',
    'set.premium.upgrade':    'Upgrade to Premium',
    'set.name':               'Your name',
    'set.focus':              'Weekly focus',
    'set.version':            'Version',

    // ── v7 · conversion funnel
    'onb.try.title':          'Your first entry',
    'onb.try.body':           'Write one honest sentence about what is moving you today. You will see your first insight immediately.',
    'onb.try.placeholder':    'e.g. "I am starting a new project today."',
    'onb.try.cta':            'Generate insight',
    'onb.try.skip':           'Later',
    'onb.try.result':         'Your first insight',
    'onb.try.continue':       'Continue',
    'onb.try.error':          'Input too thin — write a complete sentence.',

    'soft.title':             'Three days steady',
    'soft.body':              'You have built a streak of {{n}} days. Do not lose it.',
    'soft.benefit':           'Premium protects your progress — unlimited entries, 30-day history, PDF export.',
    'soft.cta':               'Try 7 days free',
    'soft.later':             'Not now',

    'trial.cta':              'Start 7-day free trial',
    'trial.sub':              'Then €19.99 / year · cancel anytime',
    'trial.active':           'Trial active · {{n}} day(s) left',
    'trial.expired':          'Trial ended',
    'trial.dev_start':        'DEV · start trial (7 days)',

    'review.title':           'The Sphere is singing',
    'review.body':            'You just reached SINGING. If the app helps you, please leave a short review.',
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

  // v6 · premium
  isPremium: boolean;
  setPremium: (next: boolean) => void;

  // v6 · free-quota
  weekStart: string;
  freeUsed: number;
  freeRemaining: number;
  /** Returns true if the caller may proceed (and increments the counter),
      false if the weekly limit is reached and the user is not premium. */
  consumeFreeReport: () => boolean;
  /** Re-sync from storage; called after a real network success. */
  refreshQuota: () => Promise<void>;

  // v6 · user profile
  userName: string;
  setUserName: (n: string) => void;
  weeklyFocus: string;
  setWeeklyFocus: (s: string) => void;

  // v6.2 · expert mode (hide technical HUD by default)
  expertMode: boolean;
  setExpertMode: (next: boolean) => void;

  ready: boolean;
  t: (key: TKey) => string;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de');
  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(true);
  const [isPremium, setPremiumState] = useState<boolean>(false);
  const [weekStart, setWeekStart] = useState<string>(isoWeekStart());
  const [freeUsed, setFreeUsed] = useState<number>(0);
  const [userName, setUserNameState] = useState<string>('');
  const [weeklyFocus, setWeeklyFocusState] = useState<string>('');
  const [expertMode,  setExpertModeState]  = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);

  // hydrate from disk
  useEffect(() => {
    (async () => {
      try {
        const [storedLang, storedOnb, storedPrem, storedUsage, storedName, storedFocus, storedExpert] = await Promise.all([
          AsyncStorage.getItem(KEY_LANG),
          AsyncStorage.getItem(KEY_ONBOARDING),
          AsyncStorage.getItem(KEY_PREMIUM),
          AsyncStorage.getItem(KEY_FREE_USAGE),
          AsyncStorage.getItem(KEY_USER_NAME),
          AsyncStorage.getItem(KEY_FOCUS),
          AsyncStorage.getItem(KEY_EXPERT),
        ]);
        if (storedLang === 'de' || storedLang === 'en') setLangState(storedLang);
        setOnboardingSeen(storedOnb === '1');
        setPremiumState(storedPrem === '1');
        setExpertModeState(storedExpert === '1');
        if (storedUsage) {
          try {
            const o = JSON.parse(storedUsage);
            const currentWeek = isoWeekStart();
            if (o?.weekStart === currentWeek && typeof o.used === 'number') {
              setWeekStart(currentWeek);
              setFreeUsed(Math.max(0, Math.floor(o.used)));
            } else {
              // new week → reset
              setWeekStart(currentWeek);
              setFreeUsed(0);
              await AsyncStorage.setItem(KEY_FREE_USAGE,
                JSON.stringify({ weekStart: currentWeek, used: 0 }));
            }
          } catch { /* ignore */ }
        }
        if (storedName)  setUserNameState(storedName);
        if (storedFocus) setWeeklyFocusState(storedFocus);
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

  const setPremium = useCallback((next: boolean) => {
    setPremiumState(next);
    AsyncStorage.setItem(KEY_PREMIUM, next ? '1' : '0').catch(() => {});
  }, []);

  const consumeFreeReport = useCallback((): boolean => {
    const currentWeek = isoWeekStart();
    if (currentWeek !== weekStart) {
      setWeekStart(currentWeek);
      setFreeUsed(1);
      AsyncStorage.setItem(KEY_FREE_USAGE,
        JSON.stringify({ weekStart: currentWeek, used: 1 })).catch(() => {});
      return true;
    }
    if (isPremium) {
      // do not decrement quota for premium users
      return true;
    }
    if (freeUsed >= FREE_REPORTS_PER_WEEK) {
      return false;
    }
    const nextUsed = freeUsed + 1;
    setFreeUsed(nextUsed);
    AsyncStorage.setItem(KEY_FREE_USAGE,
      JSON.stringify({ weekStart: currentWeek, used: nextUsed })).catch(() => {});
    return true;
  }, [weekStart, freeUsed, isPremium]);

  const refreshQuota = useCallback(async () => {
    const currentWeek = isoWeekStart();
    if (currentWeek !== weekStart) {
      setWeekStart(currentWeek);
      setFreeUsed(0);
      await AsyncStorage.setItem(KEY_FREE_USAGE,
        JSON.stringify({ weekStart: currentWeek, used: 0 })).catch(() => {});
    }
  }, [weekStart]);

  const setUserName = useCallback((n: string) => {
    const v = (n || '').slice(0, 40);
    setUserNameState(v);
    AsyncStorage.setItem(KEY_USER_NAME, v).catch(() => {});
  }, []);
  const setWeeklyFocus = useCallback((s: string) => {
    const v = (s || '').slice(0, 200);
    setWeeklyFocusState(v);
    AsyncStorage.setItem(KEY_FOCUS, v).catch(() => {});
  }, []);

  const setExpertMode = useCallback((next: boolean) => {
    setExpertModeState(next);
    AsyncStorage.setItem(KEY_EXPERT, next ? '1' : '0').catch(() => {});
  }, []);

  const freeRemaining = Math.max(0, FREE_REPORTS_PER_WEEK - freeUsed);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    onboardingSeen,
    markOnboardingSeen,
    resetOnboarding,
    isPremium,
    setPremium,
    weekStart,
    freeUsed,
    freeRemaining,
    consumeFreeReport,
    refreshQuota,
    userName,
    setUserName,
    weeklyFocus,
    setWeeklyFocus,
    expertMode,
    setExpertMode,
    ready,
    t: (k: TKey) => translate(lang, k),
  }), [
    lang, onboardingSeen, isPremium, weekStart, freeUsed, freeRemaining,
    userName, weeklyFocus, expertMode, ready,
    setLang, markOnboardingSeen, resetOnboarding,
    setPremium, consumeFreeReport, refreshQuota,
    setUserName, setWeeklyFocus, setExpertMode,
  ]);

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) {
    return {
      lang: 'de',
      setLang: () => {},
      onboardingSeen: true,
      markOnboardingSeen: () => {},
      resetOnboarding: () => {},
      isPremium: false,
      setPremium: () => {},
      weekStart: isoWeekStart(),
      freeUsed: 0,
      freeRemaining: FREE_REPORTS_PER_WEEK,
      consumeFreeReport: () => true,
      refreshQuota: async () => {},
      userName: '',
      setUserName: () => {},
      weeklyFocus: '',
      setWeeklyFocus: () => {},
      expertMode: false,
      setExpertMode: () => {},
      ready: true,
      t: (k: TKey) => translate('de', k),
    };
  }
  return ctx;
}

export function useT(): (key: TKey) => string {
  return useSettings().t;
}
