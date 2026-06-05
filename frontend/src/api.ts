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
  mirror_layer1:   string;
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

// ── TheOrbit V6 DTOs ──────────────────────────────────────────
export type CycleStateDTO = {
  theta: number;
  theta_deg: number;
  house_index: number;
  house_code: string;
  house_title: string;
  operator: string;
  archetype: string;
  opposite_house: { index: number; code: string; title: string; operator: string };
  warm_kalt: string;
  warm_score: number;
  flow: number;
  force: number;
  character: string;
  sin2: number;
  cos2: number;
};

export type SpinDialogDTO = {
  active_operator: string;
  complement_operator: string;
  axis: string;
  message_count: number;
  last_theta: number;
  last_warm_kalt: string;
  cycle_id: string;
};

export type AgentStatusDTO = {
  house: number;
  operator: string;
  drift: number;
  cycle_count: number;
  beliefs: Record<string, unknown>;
  observations: number;
};

export type OrbitInvokeResponseDTO = TenzorInvokeResponseDTO & {
  cycle_state: CycleStateDTO;
  spin_dialog: SpinDialogDTO | null;
  agent_statuses: AgentStatusDTO[];
  bus_cycle_id: string;
  orbit_version: string;
};

export type DevCompassAgentViewDTO = {
  house: number;
  operator: string;
  archetype: string;
  drift: number;
  relevance: number;
  beliefs: Record<string, unknown>;
  perspective: string;
};

export type DevCompassResponseDTO = {
  idea: string;
  lang: string;
  compass_reading: {
    house_index: number;
    house_title: string;
    operator: string;
    theta_deg: number;
    sing: number;
    warm_kalt: string;
    character: string;
  };
  recommendation: string;
  urgency: string;
  spin_dialog: SpinDialogDTO | null;
  agent_views: DevCompassAgentViewDTO[];
  insight: string;
  action: string;
  elapsed_ms: number;
};


// ── Resonanzgedächtnis DTOs ──────────────────────────────────────────────────
export type SignaturePoint = { x: number; y: number; t: number };

export type SignatureBBox = {
  x_min: number; x_max: number;
  y_min: number; y_max: number;
  width: number; height: number;
};

export type ResonanceSignatureDTO = {
  user_id: string;
  created_at: string;
  coherence: number;
  n_points: number;
  label: 'synchronized' | 'coherent' | 'transitional' | 'chaotic';
  symmetry: number;
  bbox: SignatureBBox;
  path: SignaturePoint[];
  v_omega: { re: number; im: number }[];
};

export type NodeStateDTO = {
  house_index: number; code: string; title: string;
  amplitude: number; theta: number; phase_label: string;
  marker: string; confidence: number;
};

export type JournalSubmitResponseDTO = {
  id: string;
  echo: string;
  coherence: number;
  nodes: NodeStateDTO[];
  cycle: number | null;
};

export type TrajectoryEntryDTO = {
  created_at: string;
  coherence: number;
  points: { house_index: number; x: number; y: number; r: number; theta: number }[];
  centroid: { x: number; y: number };
  resonance_signature: {
    path: SignaturePoint[];
    symmetry: number;
    bbox: SignatureBBox;
    label: string;
  };
};

export type OmegaStateDTO = {
  coherence: number; entropy: number; energy: number; coupling: number;
  dominant_mode: number; dominant_phase: number; mu: number;
  c_target: number | null; label: string;
};

export type SonifyResponseDTO = {
  tones: { frequency_hz: number; amplitude: number; stereo_pos: number; eigenvalue: number; mode_index: number; is_dominant: boolean }[];
  eigenvalues: number[];
  coherence: number;
  mu: number;
  conservation: { H: number; S: number; K: number; C: number; H_norm: number; S_norm: number };
  omega_state: OmegaStateDTO;
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

  // ── TheOrbit V6 ──────────────────────────────────────────────
  async orbitInvoke(
    input: string,
    opts?: { lang?: 'de' | 'en' },
  ): Promise<OrbitInvokeResponseDTO> {
    return (
      await api.post('/orbit/invoke', { input, lang: opts?.lang ?? 'de' }, { timeout: 12_000 })
    ).data;
  },

  async orbitAgents(): Promise<{ available: boolean; agents: AgentStatusDTO[]; bus_cycle_id: string; bus_log_size: number }> {
    return (await api.get('/orbit/agents')).data;
  },

  async devCompassAnalyze(
    idea: string,
    opts?: { lang?: 'de' | 'en' },
  ): Promise<DevCompassResponseDTO> {
    return (
      await api.post('/devcompass/analyze', { idea, lang: opts?.lang ?? 'de' }, { timeout: 12_000 })
    ).data;
  },

  // ── Resonanzgedächtnis ───────────────────────────────────────
  async journalSubmit(text: string, userId = 'anonymous', deltaT = 1.0): Promise<JournalSubmitResponseDTO> {
    return (await api.post('/journal/submit', { text, user_id: userId, delta_t: deltaT })).data;
  },
  async resonanceSignature(userId = 'anonymous', nPoints = 256): Promise<ResonanceSignatureDTO> {
    return (await api.get('/resonance/signature', { params: { user_id: userId, n_points: nPoints } })).data;
  },
  async resonanceHistory(userId = 'anonymous', limit = 30): Promise<{ user_id: string; count: number; entries: unknown[] }> {
    return (await api.get('/resonance/history', { params: { user_id: userId, limit } })).data;
  },
  async resonanceTrajectory(userId = 'anonymous', limit = 20): Promise<{ user_id: string; count: number; trajectory: TrajectoryEntryDTO[] }> {
    return (await api.get('/resonance/trajectory', { params: { user_id: userId, limit } })).data;
  },
  async resonanceSonify(userId = 'anonymous', limit = 10): Promise<SonifyResponseDTO> {
    return (await api.post('/resonance/sonify', { user_id: userId, limit })).data;
  },
  async resonanceOmega(userId = 'anonymous', cTarget = 0.72): Promise<unknown> {
    return (await api.post('/resonance/omega', { user_id: userId, c_target: cTarget })).data;
  },

};