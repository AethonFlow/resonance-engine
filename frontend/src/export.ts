/**
 * Export utilities for resonance reports.
 *  - shareReportText  : universal (always works)  — Share API plain text
 *  - shareReportPdf   : iOS/Android only — expo-print + expo-sharing
 */

import { Platform, Share } from 'react-native';

import type { TenzorHistoryDTO, TenzorJournalEntryDTO } from './api';
import { translate, type Lang } from './i18n';

export type ExportableReport = {
  input:      string;
  state:      string;
  score:      number;
  energy?:    number;
  factor?:    string;
  vector_4d?: [number, number, number, number];
  insight:    string;
  action:     string;
  lang?:      string;
  created_at?: string;
};

/**
 * Render the report into the canonical strict template + the host's UI lang.
 * Adds a footer line that links back to the app.
 */
export function renderReportText(r: ExportableReport, uiLang: Lang = 'de'): string {
  const lang = (r.lang === 'en' || r.lang === 'de') ? (r.lang as Lang) : uiLang;
  const ts = r.created_at ?? new Date().toISOString();
  const v = r.vector_4d ?? [0, 0, 0, 0];
  const lines = [
    '[RESONANCE REPORT]',
    `Timestamp: ${ts}`,
    `Input: ${r.input}`,
    `Coherence Score: ${r.score.toFixed(2)}`,
    `Energy Level: ${(r.energy ?? 0.5).toFixed(2)} (Target: 0.5)`,
    `Field state: ${r.state}`,
    `Factor: ${r.factor ?? '—'}`,
    `Vector-4D: [${v.map((x) => x.toFixed(4)).join(', ')}]`,
    '',
    translate(lang, 'tnz.insight'),
    r.insight,
    '',
    translate(lang, 'tnz.action'),
    r.action,
    '',
    '— THE SPHERE · Resonance Engine',
  ];
  return lines.join('\n');
}

export async function shareReportText(r: ExportableReport, uiLang: Lang = 'de'): Promise<boolean> {
  try {
    const text = renderReportText(r, uiLang);
    const res = await Share.share({
      message: text,
      title: `THE SPHERE · ${r.state}`,
    });
    return res.action !== 'dismissedAction';
  } catch {
    return false;
  }
}

function renderReportHtml(r: ExportableReport, uiLang: Lang = 'de'): string {
  const lang = (r.lang === 'en' || r.lang === 'de') ? (r.lang as Lang) : uiLang;
  const ts = r.created_at ?? new Date().toISOString();
  const v = r.vector_4d ?? [0, 0, 0, 0];
  const stateColor = (s: string): string => {
    switch (s) {
      case 'NULLSTELLE': return '#F5B041';
      case 'SINGING':    return '#DCA146';
      case 'WARM':       return '#F5B041';
      case 'DRIFT':      return '#B8FF3C';
      case 'COLD':       return '#B8FF3C';
      default:           return '#FF3C5F';
    }
  };
  const accent = stateColor(r.state);
  const t = (k: string) => translate(lang, k as any);
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <title>THE SPHERE · ${r.state}</title>
  <style>
    @page { size: A4; margin: 24mm 18mm; }
    html, body { background: #06080A; color: #ECE9E2; font-family: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { padding: 0; margin: 0; }
    h1 { font-size: 13px; letter-spacing: 4px; color: ${accent}; margin: 0 0 4px 0; }
    .sub { font-size: 9px; letter-spacing: 2px; color: #888; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; gap: 16px; margin: 6px 0; }
    .k   { font-size: 9px; letter-spacing: 2px; color: #888; text-transform: uppercase; }
    .v   { font-size: 13px; color: #ECE9E2; }
    .big { font-size: 28px; color: ${accent}; }
    hr   { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 16px 0; }
    blockquote { margin: 8px 0; padding: 10px 14px; border-left: 3px solid ${accent}; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 12px; line-height: 18px; }
    .label { font-size: 9px; letter-spacing: 2px; color: ${accent}; margin-bottom: 4px; }
    .action { border-left-color: #F5B041; }
    .action .label { color: #F5B041; }
    .input { background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 6px; font-size: 11px; color: #C9C5BD; }
    .vec  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 4px; }
    .vec span { display: block; padding: 6px; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; text-align: center; font-size: 10px; }
    .foot { margin-top: 28px; font-size: 9px; color: #555; letter-spacing: 2px; text-align: center; }
  </style></head><body>
  <h1>[RESONANCE REPORT]</h1>
  <div class="sub">${ts}</div>

  <div class="input">${(r.input || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>

  <hr/>

  <div class="row">
    <div><div class="k">${t('tnz.score')}</div><div class="big">${r.score.toFixed(2)}</div></div>
    <div><div class="k">${t('tnz.energy')}</div><div class="big">${(r.energy ?? 0.5).toFixed(2)} <span style="font-size:11px;color:#888">/ 0.5</span></div></div>
    <div><div class="k">FIELD</div><div class="big" style="font-size:18px">${r.state}</div></div>
  </div>

  <div class="row">
    <div><div class="k">${t('tnz.factor')}</div><div class="v">${r.factor ?? '—'}</div></div>
  </div>

  <div class="k" style="margin-top:8px">${t('tnz.vector')}</div>
  <div class="vec">
    <span><b>x</b> ${v[0].toFixed(4)}</span>
    <span><b>y</b> ${v[1].toFixed(4)}</span>
    <span><b>dx</b> ${v[2].toFixed(4)}</span>
    <span><b>dy</b> ${v[3].toFixed(4)}</span>
  </div>

  <hr/>

  <blockquote><div class="label">${t('tnz.insight')}</div>${r.insight}</blockquote>
  <blockquote class="action"><div class="label">${t('tnz.action')}</div>${r.action}</blockquote>

  <div class="foot">THE SPHERE · RESONANCE ENGINE</div>
  </body></html>`;
}

export async function shareReportPdf(r: ExportableReport, uiLang: Lang = 'de'): Promise<boolean> {
  if (Platform.OS === 'web') {
    // expo-print on web opens a print dialog — fall back to text share for parity.
    return shareReportText(r, uiLang);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Print = require('expo-print');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing = require('expo-sharing');
    const html = renderReportHtml(r, uiLang);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = (Sharing.isAvailableAsync ? await Sharing.isAvailableAsync() : true);
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'THE SPHERE',
        UTI: 'com.adobe.pdf',
      });
      return true;
    }
    return false;
  } catch {
    return shareReportText(r, uiLang);
  }
}

/** Convenience: convert a history row to ExportableReport. */
export function fromHistory(e: TenzorHistoryDTO | TenzorJournalEntryDTO): ExportableReport {
  const h = e as TenzorHistoryDTO;
  return {
    input:      e.input,
    state:      e.state,
    score:      e.score,
    energy:     (h as any).energy,
    factor:     (h as any).factor,
    vector_4d:  (h as any).vector_4d,
    insight:    e.insight,
    action:     e.action,
    lang:       e.lang,
    created_at: e.created_at,
  };
}
