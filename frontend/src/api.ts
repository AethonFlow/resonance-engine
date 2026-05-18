import axios from 'axios';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
const api = axios.create({ baseURL: `${BASE}/api`, timeout: 60_000 });

// ── Legacy 8-knot DTOs ─────────────────────────────────────────
export type PresetDTO = {
  id: string; name: string; magnitudes: number[]; phases: number[]; omega: number;
  created_at: string; note?: string | null;
};

export type SnapshotDTO = {
  id: string; event: string; energy: number; incoherence: number;
  magnitudes: number[]; phases: number[]; resonance_state: string; created_at: string;
};

// ── Coherence Engine 24-knot DTOs ─────────────────────────────
export type ProbeResponseDTO = {
  scores: number[]; vectors: number[]; markers: string[]; elapsed_ms: number;
};

export type Snapshot24DTO = {
  id: string; event: string; sing_index: number; energy: number;
  R_layer: number[]; T_inter: number; C_E: number;
  q: number[]; p: number[]; A: number[];
  llm_scores?: number[] | null; llm_markers?: string[] | null;
  label?: string | null; resonance_state: string; created_at: string;
};

export type ResidueDTO = {
  id: string; noise_score: number; energy: number; incoherence: number;
  q: number[]; p: number[]; A: number[]; reason?: string | null; created_at: string;
};

// ── New: aspects + mirror DTOs ────────────────────────────────
export type AspectEffectsDTO = Partial<{
  amplitude: number; damping: number; coupling: number; noise: number; phase_shift: number;
}>;

export type AspectDTO = {
  name: string;
  scope: 'global' | 'local';
  target_houses: number[];
  effects: AspectEffectsDTO;
  marker: string;
};

export type MirrorDTO = {
  core: string;
  value: string;
  friction: string;
  next_step: string;
  tone: 'clear' | 'guided' | 'questioning' | 'incomplete';
  house_indices: { core: number; value: number; friction: number; next_step: number };
  incoherence: number;
  origin_sign: number;
  trace: {
    core_idx: number;
    value_idx: number;
    friction_idx: number;
    origin_sign: number;
    origin_drive?: number;
    sing_index: number;
    R_layer?: number[];
    phase_var?: number[];
    amp_total?: number[];
    friction_per_house?: number[];
    aspect_signal_per_house?: number[];
    tone_threshold?: { clear: number; guided: number; incomplete: number };
  };
};

export type TuneResponseDTO = {
  ok: boolean;
  layer0_ok: boolean;
  clarification?: string | null;
  probe?: ProbeResponseDTO | null;
  aspects?: AspectDTO[] | null;
  mirror?: MirrorDTO | null;
  elapsed_ms: number;
};

// ── TENZOR Orchestrator DTOs ───────────────────────────────────
export type TenzorInvokeResponseDTO = {
  report:          string;
  state:           'COLD' | 'DRIFT' | 'WARM' | 'SINGING' | 'NULLSTELLE' | 'INSUFFICIENT_DATA';
  factor:          string;
  score:           number;
  energy:          number;
  vector_4d:       [number, number, number, number];
  agent_feedback:  string;
  insight:         string;
  action:          string;
  lang:            'de' | 'en';
  elapsed_ms:      number;
  history_id?:     string | null;
};

export type TenzorHistoryDTO = {
  id:         string;
  input:      string;
  state:      string;
  factor:     string;
  score:      number;
  energy:     number;
  vector_4d:  [number, number, number, number];
  insight:    string;
  action:     string;
  lang:       'de' | 'en';
  created_at: string;
};

// ── Stats / sparkline / daily alignment ────────────────────────
export type TenzorDayDTO = {
  date:       string;        // YYYY-MM-DD (UTC)
  count:      number;
  avg_score:  number | null;
  max_score:  number | null;
  aligned:    boolean;
  last_state: string | null;
};

export type TenzorStatsDTO = {
  days:           number;
  today:          string;
  today_aligned:  boolean;
  today_count:    number;
  today_score:    number | null;
  today_state:    string | null;
  streak_current: number;
  streak_best:    number;
  series:         TenzorDayDTO[];
};

export type TenzorJournalEntryDTO = {
  id:         string;
  created_at: string;
  input:      string;
  state:      string;
  score:      number;
  insight:    string;
  action:     string;
  lang:       'de' | 'en';
};

export const API = {
  async root() { return (await api.get('/')).data; },
  async health() { return (await api.get('/health')).data; },

  // legacy 8-knot
  async listPresets(): Promise<PresetDTO[]> { return (await api.get('/presets')).data; },
  async createPreset(b: Omit<PresetDTO, 'id' | 'created_at'>) { return (await api.post('/presets', b)).data as PresetDTO; },
  async deletePreset(id: string) { return (await api.delete(`/presets/${id}`)).data; },
  async listSnapshots(limit = 100): Promise<SnapshotDTO[]> { return (await api.get('/snapshots', { params: { limit } })).data; },
  async createSnapshot(b: Omit<SnapshotDTO, 'id' | 'created_at'>) { return (await api.post('/snapshots', b)).data as SnapshotDTO; },

  // Coherence Engine
  async probe(text: string): Promise<ProbeResponseDTO> {
    return (await api.post('/probe', { text })).data;
  },
  async tune(text: string, baseline?: { q: number[]; p: number[]; A: number[] }): Promise<TuneResponseDTO> {
    const body: any = { text };
    if (baseline) { body.q = baseline.q; body.p = baseline.p; body.A = baseline.A; }
    return (await api.post('/tune', body)).data;
  },
  async houses() { return (await api.get('/houses')).data; },
  async aspects() { return (await api.get('/aspects')).data; },

  async createSnapshot24(b: Omit<Snapshot24DTO, 'id' | 'created_at'>) {
    return (await api.post('/snapshots24', b)).data as Snapshot24DTO;
  },
  async listSnapshots24(limit = 100): Promise<Snapshot24DTO[]> {
    return (await api.get('/snapshots24', { params: { limit } })).data;
  },
  async coherenceReset(payload: {
    noise_score: number; energy: number; incoherence: number;
    q: number[]; p: number[]; A: number[]; reason?: string;
  }) {
    return (await api.post('/coherence/reset', payload)).data as { purified: boolean; residue_id: string; n_threshold: number };
  },
  async listResidues(limit = 50): Promise<ResidueDTO[]> {
    return (await api.get('/coherence/residues', { params: { limit } })).data;
  },

  // ── TENZOR Orchestrator ───────────────────────────────────────
  async tenzorInvoke(input: string, opts?: { lang?: 'de' | 'en'; save?: boolean }): Promise<TenzorInvokeResponseDTO> {
    const body: any = { input };
    if (opts?.lang) body.lang = opts.lang;
    if (opts?.save !== undefined) body.save = opts.save;
    return (await api.post('/tenzor/invoke', body, { timeout: 10_000 })).data;
  },
  async tenzorMeta(): Promise<any> {
    return (await api.get('/tenzor')).data;
  },
  async tenzorHistory(limit = 20): Promise<TenzorHistoryDTO[]> {
    return (await api.get('/tenzor/history', { params: { limit } })).data;
  },
  async tenzorHistoryDelete(id: string): Promise<{ deleted: boolean; id: string }> {
    return (await api.delete(`/tenzor/history/${id}`)).data;
  },
  async tenzorHistoryClear(): Promise<{ deleted: number }> {
    return (await api.delete('/tenzor/history')).data;
  },
  async tenzorStats(days = 7): Promise<TenzorStatsDTO> {
    return (await api.get('/tenzor/stats', { params: { days } })).data;
  },
  async tenzorJournal(limit = 7): Promise<TenzorJournalEntryDTO[]> {
    return (await api.get('/tenzor/journal', { params: { limit } })).data;
  },
};
