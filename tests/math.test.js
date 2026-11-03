import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSkill, makeChoices, ALL_SKILLS } from '../src/math/questions.js';
import { generatePitStopById, PIT_TEMPLATE_IDS, generatePitStop } from '../src/math/pitstops.js';

// Evaluate a question's text to check the stored answer is right.
function evalText(text, answer) {
  let t = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '');
  t = t.replace(/(\d+)²/g, '($1*$1)');
  if (t.includes('?')) {
    const [lhs, rhs] = t.split('=');
    return Function(`return (${lhs.replace('?', answer)}) === ${rhs}`)();
  }
  return Function(`return ${t}`)() === answer;
}

test('every quick-fire skill gives correct, non-trivial answers', () => {
  for (const skill of ALL_SKILLS) {
    for (let i = 0; i < 400; i++) {
      const q = generateSkill(skill, { level: i % 3, max: 12 });
      assert.ok(Number.isInteger(q.answer) && q.answer > 0, `${skill}: ${q.text}`);
      assert.ok(evalText(q.text, q.answer), `${skill}: ${q.text} = ${q.answer}`);
      assert.ok(!/(^|\D)[01] ×|× [01](\D|$)/.test(q.text), `no ×0/×1 in ${q.text}`);
      const c = makeChoices(q, 3);
      assert.equal(c.length, 3);
      assert.equal(new Set(c).size, 3);
      assert.ok(c.includes(q.answer));
      assert.ok(c.every((x) => Number.isInteger(x) && x > 0));
    }
  }
});

test('times tables never use 0, 1 or 10', () => {
  for (let i = 0; i < 2000; i++) {
    const q = generateSkill('tables', { max: 12 });
    const [a, b] = q.text.split(' × ').map(Number);
    for (const n of [a, b]) assert.ok(![0, 1, 10].includes(n), q.text);
  }
});

test('pit stops always have whole-number answers that match their steps', () => {
  for (const id of PIT_TEMPLATE_IDS) {
    for (let L = 0; L <= 7; L++) {
      for (let i = 0; i < 60; i++) {
        const p = generatePitStopById(id, L);
        assert.ok(p, id);
        assert.ok(Number.isInteger(p.answer) && p.answer > 0, `${id}: ${p.answer}`);
        assert.ok(p.steps.length >= 2, id);
        const last = p.steps[p.steps.length - 1].replace(/,/g, '');
        assert.ok(last.includes(String(p.answer)), `${id}: "${last}" should show ${p.answer}`);
      }
    }
  }
  for (let L = 0; L <= 7; L++) for (let i = 0; i < 100; i++) assert.ok(generatePitStop(L).answer > 0);
});
