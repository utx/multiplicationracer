// Quick-fire questions shown on the race gates.
// Every generator returns { skill, text, answer, explain, time, fact?, distractors[] }.
// `time` is the suggested thinking time in seconds at cruising speed.
// No ×0, ×1 or ×10 "freebies" in the times tables.

import { rand, pick, shuffle, weightedPick, chance } from './rng.js';

export const TABLE_NUMS = [2, 3, 4, 5, 6, 7, 8, 9, 11, 12];

const fmt = (n) => n.toLocaleString('en-AU');

function tableNums(min = 2, max = 12) {
  return TABLE_NUMS.filter((n) => n >= min && n <= max);
}

/** Pick a times-table fact, leaning toward facts the player has been getting wrong. */
export function pickFact(opts = {}, ctx = {}) {
  const nums = tableNums(opts.min ?? 2, opts.max ?? 12);
  const facts = [];
  for (const a of nums) for (const b of nums) if (a <= b) facts.push([a, b]);
  // Hard facts (6,7,8,9,12 combos) get a bit more airtime by default.
  const base = ([a, b]) => (a >= 6 && b >= 6 ? 1.6 : a <= 3 && b <= 5 ? 0.5 : 1);
  const extra = ctx.factWeight || (() => 1);
  const [a, b] = weightedPick(facts, (f) => base(f) * extra(factKey(f[0], f[1])));
  return chance(0.5) ? [a, b] : [b, a];
}

export const factKey = (a, b) => (a <= b ? `${a}×${b}` : `${b}×${a}`);

function near(answer, offsets) {
  return offsets.map((o) => answer + o);
}

// ---------------------------------------------------------------- generators

const GEN = {
  tables(opts, ctx) {
    const [a, b] = pickFact(opts, ctx);
    const p = a * b;
    return {
      text: `${a} × ${b}`,
      answer: p,
      fact: factKey(a, b),
      explain: `${a} × ${b} = ${p}`,
      time: 4.5,
      distractors: [(a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), p + 1, p - 2, p + 10],
    };
  },

  missing(opts, ctx) {
    const [a, b] = pickFact(opts, ctx);
    const p = a * b;
    const left = chance(0.5);
    return {
      text: left ? `? × ${b} = ${p}` : `${a} × ? = ${p}`,
      answer: left ? a : b,
      fact: factKey(a, b),
      explain: `${a} × ${b} = ${p}`,
      time: 5,
      distractors: left ? [a + 1, a - 1, a + 2, b] : [b + 1, b - 1, b - 2, a],
    };
  },

  division(opts, ctx) {
    const [a, b] = pickFact(opts, ctx);
    const p = a * b;
    return {
      text: `${p} ÷ ${a}`,
      answer: b,
      fact: factKey(a, b),
      explain: `${a} × ${b} = ${p}, so ${p} ÷ ${a} = ${b}`,
      time: 5,
      distractors: [b + 1, b - 1, b + 2, b - 2, a],
    };
  },

  tens(opts) {
    const a = pick(tableNums(2, 9));
    const b = pick(tableNums(2, 9));
    const lvl = opts.level ?? 1;
    const forms = [
      () => [`${a * 10} × ${b}`, a * 10 * b, `${a} × ${b} = ${a * b}, then × 10`],
      () => [`${a} × ${b * 100}`, a * b * 100, `${a} × ${b} = ${a * b}, then × 100`],
      () => [`${a * 10} × ${b * 10}`, a * b * 100, `${a} × ${b} = ${a * b}, then × 10 × 10`],
    ];
    if (lvl >= 2) forms.push(() => [`${a * 100} × ${b * 10}`, a * b * 1000, `${a} × ${b} = ${a * b}, then × 1000`]);
    if (lvl >= 2) forms.push(() => [`${fmt(a * b * 100)} ÷ ${b * 10}`, a * 10, `${a} × ${b} = ${a * b}, so ${a * b * 100} ÷ ${b * 10} = ${a * 10}`]);
    const [text, answer, explain] = pick(forms)();
    return {
      text, answer, explain, time: 5.5,
      distractors: [answer * 10, answer / 10, answer + (answer >= 1000 ? 1000 : 100), answer - (answer >= 1000 ? 1000 : 100)],
    };
  },

  twoByOne(opts) {
    let n;
    do n = rand(13, opts.level >= 2 ? 99 : 59); while (n % 10 === 0);
    const m = pick([3, 4, 6, 7, 8, 9]);
    const t = Math.floor(n / 10) * 10, u = n % 10;
    const ans = n * m;
    return {
      text: `${n} × ${m}`,
      answer: ans,
      explain: `${t} × ${m} = ${t * m}, ${u} × ${m} = ${u * m}, total ${ans}`,
      time: 7,
      // Classic slip: forgetting to carry.
      distractors: [ans - 10, ans + 10, ans + m, ans - m, t * m + u * m - Math.floor((u * m) / 10) * 10],
    };
  },

  threeByOne() {
    let n;
    do n = rand(102, 489); while (n % 10 === 0);
    const m = pick([3, 4, 6, 7, 8, 9]);
    const h = Math.floor(n / 100) * 100, t = Math.floor((n % 100) / 10) * 10, u = n % 10;
    const ans = n * m;
    return {
      text: `${n} × ${m}`,
      answer: ans,
      explain: `${h}×${m} = ${h * m}, ${t}×${m} = ${t * m}, ${u}×${m} = ${u * m} → ${fmt(ans)}`,
      time: 9,
      distractors: [ans + 100, ans - 100, ans + 10, ans - 10, ans + m],
    };
  },

  squares(opts) {
    const n = pick(opts.level >= 2 ? [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25] : [6, 7, 8, 9, 11, 12, 13, 15]);
    const ans = n * n;
    return {
      text: chance(0.5) ? `${n}²` : `${n} × ${n}`,
      answer: ans,
      explain: `${n}² means ${n} × ${n} = ${ans}`,
      time: 5.5,
      distractors: [n * (n + 1), n * (n - 1), n * 2, ans + 10, ans - 10],
    };
  },

  strategy() {
    const forms = [
      () => { const n = rand(7, 49) * 2; return [`${n} × 5`, n * 5, `${n} × 10 = ${n * 10}, halve it → ${n * 5}`, n]; },
      () => { const n = rand(2, 24) * 4; return [`${n} × 25`, n * 25, `${n} ÷ 4 = ${n / 4}, then × 100 → ${n * 25}`, 25]; },
      () => { const n = rand(12, 49); return [`${n} × 9`, n * 9, `${n} × 10 = ${n * 10}, minus ${n} → ${n * 9}`, n]; },
      () => { const n = rand(12, 81); return [`${n} × 11`, n * 11, `${n} × 10 + ${n} = ${n * 11}`, n]; },
      () => { const n = rand(3, 12); return [`${n} × 99`, n * 99, `${n} × 100 = ${n * 100}, minus ${n} → ${n * 99}`, n]; },
      () => { const n = rand(4, 19) * 2; return [`${n} × 15`, n * 15, `Halve & double: ${n / 2} × 30 = ${n * 15}`, 15]; },
      () => { const n = rand(2, 19); return [`${n} × 50`, n * 50, `${n} × 100 = ${n * 100}, halve it → ${n * 50}`, 50]; },
    ];
    const [text, answer, explain, step] = pick(forms)();
    return {
      text, answer, explain, time: 6.5,
      distractors: [answer + step, answer - step, answer + 10, answer - 10, answer + 100],
    };
  },

  orderOps(opts) {
    const [b, c] = pickFact({ max: opts.max ?? 9 });
    const a = rand(2, 20);
    const forms = [
      // a + b × c  — the classic trap is working left to right.
      () => [`${a} + ${b} × ${c}`, a + b * c, `× first: ${b} × ${c} = ${b * c}, then + ${a} = ${a + b * c}`, (a + b) * c],
      () => [`(${a} + ${b}) × ${c}`, (a + b) * c, `Brackets first: ${a} + ${b} = ${a + b}, × ${c} = ${(a + b) * c}`, a + b * c],
      () => { const d = rand(1, Math.min(b * c - 1, 20)); return [`${b} × ${c} − ${d}`, b * c - d, `${b} × ${c} = ${b * c}, − ${d} = ${b * c - d}`, b * (c - d)]; },
      () => { const [d, e] = pickFact({ max: 6 }); return [`${b} × ${c} + ${d} × ${e}`, b * c + d * e, `${b * c} + ${d * e} = ${b * c + d * e}`, (b * c + d) * e]; },
      () => { const d = rand(1, c - 1 || 1); return [`${b} × (${c + d} − ${d})`, b * c, `Brackets: ${c + d} − ${d} = ${c}, × ${b} = ${b * c}`, b * (c + d) - d]; },
    ];
    const [text, answer, explain, trap] = pick(forms)();
    return {
      text, answer, explain, time: 7.5,
      distractors: [trap, trap, answer + c, answer - b, answer + 10].filter((x) => x > 0),
    };
  },

  twoByTwo(opts) {
    let n, m;
    do { n = rand(12, opts.level >= 2 ? 49 : 29); m = rand(11, opts.level >= 2 ? 29 : 19); } while (n % 10 === 0 || m % 10 === 0);
    const mt = Math.floor(m / 10) * 10, mu = m % 10;
    const ans = n * m;
    return {
      text: `${n} × ${m}`,
      answer: ans,
      explain: `${n} × ${mt} = ${n * mt}, ${n} × ${mu} = ${n * mu}, total ${fmt(ans)}`,
      time: 11,
      // Classic slip: n × units + n × (tens digit, not tens).
      distractors: [ans + 10, ans - 10, ans + n, ans - n, n * mu + n * (mt / 10), ans + 100],
    };
  },
};

export const SKILL_INFO = {
  tables: { name: 'Times tables', blurb: 'Lightning-fast facts' },
  missing: { name: 'Missing numbers', blurb: '? × 7 = 56' },
  division: { name: 'Division facts', blurb: 'Tables in reverse' },
  tens: { name: 'Tens & hundreds', blurb: '40 × 300' },
  twoByOne: { name: '2-digit × 1-digit', blurb: '47 × 6' },
  threeByOne: { name: '3-digit × 1-digit', blurb: '236 × 7' },
  squares: { name: 'Square numbers', blurb: '15²' },
  strategy: { name: 'Mental shortcuts', blurb: '×5, ×9, ×11, ×25, ×99' },
  orderOps: { name: 'Order of operations', blurb: '4 + 3 × 6' },
  twoByTwo: { name: '2-digit × 2-digit', blurb: '23 × 17' },
};

/** Build distinct, believable wrong answers that are near the right one. */
export function makeChoices(q, count = 3) {
  const seen = new Set([q.answer]);
  const out = [];
  const add = (v) => {
    if (out.length >= count - 1) return;
    if (!Number.isInteger(v) || v <= 0 || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  shuffle(q.distractors || []).forEach(add);
  // Fallback: small offsets.
  const fallback = shuffle(near(q.answer, [1, -1, 2, -2, 3, -3, 4, 5, 6, 10, -10, 12]));
  fallback.forEach(add);
  return shuffle([q.answer, ...out]);
}

/**
 * Generate a question from a weighted skill list:
 * mix = [{ skill: 'tables', w: 3, max: 9, level: 1 }, ...]
 */
export function generate(mix, ctx = {}) {
  const entry = weightedPick(mix, (m) => (m.w ?? 1) * (ctx.skillWeight ? ctx.skillWeight(m.skill) : 1));
  const q = GEN[entry.skill](entry, ctx);
  q.skill = entry.skill;
  return q;
}

export function generateSkill(skill, opts = {}, ctx = {}) {
  const q = GEN[skill](opts, ctx);
  q.skill = skill;
  return q;
}

export const ALL_SKILLS = Object.keys(GEN);
export { fmt };
