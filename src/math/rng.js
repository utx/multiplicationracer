// Small random helpers. `rng` can be swapped for a seeded generator (used for tracks).
export let rng = Math.random;

export function setRng(fn) { rng = fn || Math.random; }

export const rand = (a, b) => Math.floor(rng() * (b - a + 1)) + a;
export const pick = (arr) => arr[Math.floor(rng() * arr.length)];
export const chance = (p) => rng() < p;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Deterministic PRNG (mulberry32) for reproducible tracks. */
export function seeded(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
