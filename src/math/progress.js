// Save game + learning tracker (stored in localStorage).
// Tracks every times-table fact and skill so the game can re-serve tricky ones.

const KEY = 'multiplication-racer-save-v1';

const DEFAULT = () => ({
  name: '',
  coins: 0,
  stars: {},          // cityId -> best stars (0-3)
  best: {},           // cityId -> best finishing position
  unlocked: 1,        // number of cities unlocked
  owned: ['gt'],
  car: 'gt',
  paint: 0xe8202a,
  facts: {},          // '7×8' -> { r, w }
  skills: {},         // skill -> { r, w }
  pit: { r: 0, w: 0 },
  settings: { thinking: 'normal', quality: 'high', sound: true, music: true },
  races: 0,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT(), ...JSON.parse(raw), settings: { ...DEFAULT().settings, ...JSON.parse(raw).settings } };
  } catch { /* storage unavailable */ }
  return DEFAULT();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export const progress = () => state;

export function reset() {
  state = DEFAULT();
  save();
}

export function recordAnswer(q, correct) {
  const bump = (obj, k) => {
    obj[k] = obj[k] || { r: 0, w: 0 };
    obj[k][correct ? 'r' : 'w']++;
  };
  if (q.fact) bump(state.facts, q.fact);
  bump(state.skills, q.skill);
}

/** Facts you get wrong come back more often; facts never seen get a small boost too. */
export function factWeight(key) {
  const f = state.facts[key];
  if (!f) return 1.3;
  const total = f.r + f.w;
  const errRate = (f.w + 0.5) / (total + 1);
  return 0.5 + errRate * 4;
}

export function skillWeight(skill) {
  const s = state.skills[skill];
  if (!s) return 1;
  return 0.8 + ((s.w + 0.5) / (s.r + s.w + 1)) * 1.5;
}

export function trickyFacts(limit = 6) {
  return Object.entries(state.facts)
    .filter(([, f]) => f.w > 0)
    .sort((a, b) => b[1].w / (b[1].r + b[1].w) - a[1].w / (a[1].r + a[1].w) || b[1].w - a[1].w)
    .slice(0, limit)
    .map(([k]) => k);
}

export const mathCtx = { factWeight, skillWeight };
