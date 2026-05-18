/**
 * THE SPHERE – Design tokens
 * Pure black canvas · Amber = coherence · Cyber-Lime = dissonance
 *
 * House topology lives in `./houses.ts` (single source of truth — mirrored
 * from the backend). This module re-exports `HOUSES` for backward compatibility
 * with the rest of the codebase, plus a `roman`/`name` shim that keeps the
 * existing physics/scene code working while the UI migrates to CODE · TITLE.
 */

import { HOUSES as HOUSE_META, type HouseMeta } from './houses';

export const COLORS = {
  void: '#000000',
  deepVoid: '#050608',
  panel: 'rgba(10, 12, 14, 0.85)',
  panelBorder: 'rgba(255, 255, 255, 0.06)',

  amber: '#F5B041',
  amberSoft: '#FFD28A',
  amberGlow: 'rgba(245, 176, 65, 0.55)',

  lime: '#B8FF3C',
  limeSoft: '#D5FF7A',
  limeGlow: 'rgba(184, 255, 60, 0.55)',

  crimson: '#FF3C5F',

  textPrimary: '#F2F4F5',
  textSecondary: '#8A8F95',
  textMuted: '#4A4E54',
  grid: 'rgba(255,255,255,0.08)',
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const RADII = { sm: 6, md: 12, lg: 20, pill: 999 };
export const TYPO = {
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
  label: 'SpaceGrotesk_500Medium',
  labelBold: 'SpaceGrotesk_700Bold',
};

export const NULLSTELLE_ENERGY = 25;
export const NULLSTELLE_THRESHOLD = 0.05;

/**
 * Legacy House shape used by physics/scene. Each entry now exposes both the
 * original `name`/`roman` fields and the canonical `code`/`title` from the
 * lifecycle topology.
 */
export type House = {
  index: number;
  name: string;        // canonical title (e.g. ORIGIN)
  axis: string;        // human axis label
  vector: [number, number, number];
  roman: string;       // legacy field — now holds `code` (e.g. NNO) for UI symmetry
  code: string;        // explicit alias
  title: string;
  opposite: number;    // 1-based antipode index
  meta: HouseMeta;
};

export const HOUSES: House[] = HOUSE_META.map((h) => ({
  index: h.index,
  name: h.title,
  axis: `${h.code} · ${h.title}`,
  vector: h.vector,
  roman: h.code,           // historical name kept; value is now the compass code
  code: h.code,
  title: h.title,
  opposite: h.oppositeIndex,
  meta: h,
}));

export const HOUSE_COLOR = (state: 'warm' | 'cold' | 'hot' | 'nullstelle' | 'singing'): string => {
  if (state === 'warm' || state === 'nullstelle' || state === 'singing') return COLORS.amber;
  if (state === 'hot') return COLORS.crimson;
  return COLORS.lime;
};
