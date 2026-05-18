/**
 * Deterministic 3D value-noise (simplified perlin-like).
 * Used for grid instability in dissonant / overload states.
 */

const P = new Uint8Array(512);
(() => {
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  // Fixed seed shuffle for determinism
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i++) P[i] = base[i & 255];
})();

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const grad = (hash: number, x: number, y: number, z: number) => {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

export function perlin3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A  = P[X] + Y,  AA = P[A] + Z,  AB = P[A + 1] + Z;
  const B  = P[X + 1] + Y, BA = P[B] + Z,  BB = P[B + 1] + Z;
  return lerp(
    lerp(
      lerp(grad(P[AA], x,     y,     z),     grad(P[BA], x - 1, y,     z), u),
      lerp(grad(P[AB], x,     y - 1, z),     grad(P[BB], x - 1, y - 1, z), u),
      v,
    ),
    lerp(
      lerp(grad(P[AA + 1], x,     y,     z - 1), grad(P[BA + 1], x - 1, y,     z - 1), u),
      lerp(grad(P[AB + 1], x,     y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
}
