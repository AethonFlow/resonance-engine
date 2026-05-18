/**
 * Sinus-resonance audio synth.
 * We synthesize a short PCM sine-wave loop whose frequency tracks system energy.
 * expo-av's Audio.Sound plays the loop; we update playback rate to retune.
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let sound: Audio.Sound | null = null;
let base64Cache: string | null = null;
let enabled = false;

const SAMPLE_RATE = 22_050;
const BASE_FREQ = 110;         // A2 baseline
const DURATION_SEC = 2;        // loop length

function buildSineWav(): string {
  const samples = SAMPLE_RATE * DURATION_SEC;
  const buf = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buf);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);         // fmt chunk size
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    // Slight harmonic for warmth; envelope fade to avoid click on loop
    const fade = Math.min(1, Math.min(t / 0.05, (DURATION_SEC - t) / 0.05));
    const v = Math.sin(2 * Math.PI * BASE_FREQ * t) * 0.45
            + Math.sin(2 * Math.PI * BASE_FREQ * 2 * t) * 0.10;
    const s = Math.max(-1, Math.min(1, v * fade));
    view.setInt16(44 + i * 2, Math.floor(s * 32767), true);
  }
  // Encode to base64
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(bin);
  // RN global
  // @ts-ignore
  return global.btoa ? global.btoa(bin) : '';
}

export async function enableAudio(): Promise<void> {
  if (Platform.OS === 'web') {
    // web audio not required; skip to avoid autoplay errors
    enabled = true;
    return;
  }
  if (enabled) return;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
    if (!base64Cache) base64Cache = buildSineWav();
    if (!base64Cache) return;
    const uri = `data:audio/wav;base64,${base64Cache}`;
    const { sound: snd } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, isLooping: true, volume: 0.35, rate: 1.0, shouldCorrectPitch: false },
    );
    sound = snd;
    enabled = true;
  } catch (e) {
    // swallow – audio is non-critical
    enabled = false;
  }
}

export async function disableAudio(): Promise<void> {
  enabled = false;
  if (sound) {
    try { await sound.stopAsync(); await sound.unloadAsync(); } catch {}
    sound = null;
  }
}

export function isAudioEnabled() { return enabled; }

/**
 * Update the resonance tone based on system energy & state.
 * energy 0..50 → rate 0.5..2.0  (higher energy = higher pitch).
 */
export async function updateTone(energy: number, state: 'warm' | 'cold' | 'hot' | 'nullstelle'): Promise<void> {
  if (!enabled || !sound) return;
  const rate = Math.max(0.5, Math.min(2.0, 0.5 + energy / 30));
  let volume = 0.35;
  if (state === 'nullstelle') volume = 0.55;
  if (state === 'hot') volume = 0.22;
  try {
    await sound.setStatusAsync({ rate, shouldCorrectPitch: false, volume });
  } catch { /* ignore */ }
}
