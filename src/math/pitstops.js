// Pit-stop challenges: multi-step, OC-style reasoning problems built around racing.
// Each returns { title, text, answer, unit, hint, steps[] } with a whole-number answer.
// `level` runs 0 (first city) to 7 (final championship).

import { rand, pick, weightedPick } from './rng.js';
import { fmt } from './questions.js';

const T = (level, easy, hard) => (level < 3 ? easy : hard);

const TEMPLATES = [
  {
    id: 'fuel', min: 0,
    make(L) {
      const km = rand(3, T(L, 6, 9)), laps = rand(4, T(L, 6, 9)), litres = rand(2, T(L, 3, 5));
      const dist = km * laps, ans = dist * litres;
      return {
        title: 'Fuel up!',
        text: `Each lap is ${km} km long and the race is ${laps} laps. Your car burns ${litres} litres of fuel every kilometre. How many litres do you need for the whole race?`,
        answer: ans, unit: 'litres',
        hint: 'First find the total distance in km.',
        steps: [`Distance: ${km} × ${laps} = ${dist} km`, `Fuel: ${dist} × ${litres} = ${ans} litres`],
      };
    },
  },
  {
    id: 'tankLeft', min: 0,
    make(L) {
      const per = rand(4, T(L, 9, 15)), laps = rand(3, T(L, 7, 9));
      const used = per * laps, tank = used + rand(2, 12) * 5;
      return {
        title: 'Tank check',
        text: `Your tank holds ${tank} litres. You use ${per} litres every lap. After ${laps} laps, how many litres are left in the tank?`,
        answer: tank - used, unit: 'litres',
        hint: 'Work out how much fuel you used first.',
        steps: [`Used: ${per} × ${laps} = ${used} litres`, `Left: ${tank} − ${used} = ${tank - used} litres`],
      };
    },
  },
  {
    id: 'tyres', min: 0,
    make(L) {
      const cars = rand(3, T(L, 6, 9)), stops = rand(2, T(L, 3, 4)), price = pick(T(L, [5, 10, 20], [15, 25, 30, 50]));
      const tyres = 4 * cars * stops, ans = tyres * price;
      return {
        title: 'Tyre budget',
        text: `Your team has ${cars} cars. Each car makes ${stops} pit stops and gets 4 new tyres at every stop. Each tyre costs $${price}. How much does the team spend on tyres?`,
        answer: ans, unit: 'dollars',
        hint: 'How many tyres are used altogether?',
        steps: [`Tyres per car: 4 × ${stops} = ${4 * stops}`, `All cars: ${4 * stops} × ${cars} = ${tyres} tyres`, `Cost: ${tyres} × $${price} = $${fmt(ans)}`],
      };
    },
  },
  {
    id: 'grandstand', min: 0,
    make(L) {
      const rows = rand(6, T(L, 12, 25)), seats = rand(8, T(L, 15, 30)), stands = rand(2, T(L, 4, 6));
      const per = rows * seats, ans = per * stands;
      return {
        title: 'Packed grandstands',
        text: `There are ${stands} grandstands. Each one has ${rows} rows with ${seats} seats in every row. Every seat is full! How many fans are watching?`,
        answer: ans, unit: 'fans',
        hint: 'Find the seats in one grandstand first.',
        steps: [`One stand: ${rows} × ${seats} = ${per}`, `All stands: ${per} × ${stands} = ${fmt(ans)}`],
      };
    },
  },
  {
    id: 'thinkNumber', min: 1,
    make(L) {
      const n = rand(4, T(L, 12, 25)), a = rand(3, 9), b = rand(3, 30), res = n * a + b;
      return {
        title: 'Mystery number',
        text: `Your crew chief thinks of a number. She multiplies it by ${a}, then adds ${b}. The answer is ${res}. What was her number?`,
        answer: n, unit: '',
        hint: 'Work backwards: undo the adding first.',
        steps: [`Undo + ${b}: ${res} − ${b} = ${res - b}`, `Undo × ${a}: ${res - b} ÷ ${a} = ${n}`],
      };
    },
  },
  {
    id: 'sumProduct', min: 2,
    make() {
      let a, b;
      do { a = rand(3, 12); b = rand(3, 12); } while (a === b);
      const big = Math.max(a, b), small = Math.min(a, b);
      return {
        title: 'Secret code',
        text: `The pit-lane door code is two numbers. They multiply to make ${a * b} and add up to ${a + b}. What is the LARGER number?`,
        answer: big, unit: '',
        hint: `List factor pairs of ${a * b} and check which pair adds to ${a + b}.`,
        steps: [`Factor pairs of ${a * b}… try ${small} × ${big} = ${a * b}`, `${small} + ${big} = ${a + b} ✔`, `Larger number: ${big}`],
      };
    },
  },
  {
    id: 'teams', min: 0,
    make(L) {
      const a = rand(6, T(L, 15, 45)), n = rand(3, 9), b = rand(6, T(L, 15, 45)), m = rand(3, 9);
      const A = a * n, B = b * m;
      if (A === B) return null;
      const diff = Math.abs(A - B);
      return {
        title: 'Championship points',
        text: `Team Red scored ${a} points in each of ${n} races. Team Blue scored ${b} points in each of ${m} races. How many more points does the leading team have?`,
        answer: diff, unit: 'points',
        hint: 'Find each team’s total first.',
        steps: [`Red: ${a} × ${n} = ${A}`, `Blue: ${b} × ${m} = ${B}`, `Difference: ${Math.max(A, B)} − ${Math.min(A, B)} = ${diff}`],
      };
    },
  },
  {
    id: 'garage', min: 1,
    make(L) {
      const l = rand(4, T(L, 9, 15)), w = rand(3, T(L, 8, 12)), c = pick(T(L, [2, 3, 4, 5], [6, 7, 8, 9, 12, 15]));
      const area = l * w, ans = area * c;
      return {
        title: 'New garage floor',
        text: `The garage floor is a rectangle ${l} m long and ${w} m wide. Floor tiles cost $${c} for each square metre. How much will it cost to tile the whole floor?`,
        answer: ans, unit: 'dollars',
        hint: 'Area of a rectangle = length × width.',
        steps: [`Area: ${l} × ${w} = ${area} m²`, `Cost: ${area} × $${c} = $${ans}`],
      };
    },
  },
  {
    id: 'pattern', min: 1,
    make(L) {
      const start = rand(2, 5), r = pick(T(L, [2, 3], [2, 3, 4]));
      const seq = [start];
      for (let i = 0; i < 4; i++) seq.push(seq[i] * r);
      return {
        title: 'Turbo pattern',
        text: `Your turbo power follows a pattern: ${seq.slice(0, 4).join(', ')}, … What comes next?`,
        answer: seq[4], unit: '',
        hint: 'How do you get from one number to the next?',
        steps: [`Each number is × ${r}`, `${seq[3]} × ${r} = ${seq[4]}`],
      };
    },
  },
  {
    id: 'crewDrinks', min: 2,
    make(L) {
      const teams = rand(3, 8), mech = rand(4, 9), drivers = rand(2, 8), drinks = rand(2, T(L, 4, 6));
      const people = teams * mech + drivers, ans = people * drinks;
      return {
        title: 'Thirsty crew',
        text: `There are ${teams} pit crews with ${mech} mechanics in each, plus ${drivers} drivers. Everybody gets ${drinks} drinks. How many drinks are needed?`,
        answer: ans, unit: 'drinks',
        hint: 'Count all the people first — don’t forget the drivers!',
        steps: [`Mechanics: ${teams} × ${mech} = ${teams * mech}`, `People: ${teams * mech} + ${drivers} = ${people}`, `Drinks: ${people} × ${drinks} = ${ans}`],
      };
    },
  },
  {
    id: 'stickers', min: 0,
    make(L) {
      const r = rand(3, 8), c = rand(3, 9), n = rand(3, T(L, 6, 12));
      const total = r * c * n, used = rand(5, Math.floor(total * 0.6));
      return {
        title: 'Sticker sheets',
        text: `Each sheet of car stickers has ${r} rows of ${c} stickers. You buy ${n} sheets and stick ${used} stickers on your car. How many stickers are left?`,
        answer: total - used, unit: 'stickers',
        hint: 'How many stickers are on one sheet?',
        steps: [`One sheet: ${r} × ${c} = ${r * c}`, `All sheets: ${r * c} × ${n} = ${total}`, `Left: ${total} − ${used} = ${total - used}`],
      };
    },
  },
  {
    id: 'lapTime', min: 2,
    make(L) {
      const sec = rand(32, T(L, 59, 95)), laps = rand(4, 9), ans = sec * laps;
      return {
        title: 'Race clock',
        text: `Every lap takes you ${sec} seconds. How many seconds will ${laps} laps take?`,
        answer: ans, unit: 'seconds',
        hint: `Split ${sec} into tens and ones.`,
        steps: [`${Math.floor(sec / 10) * 10} × ${laps} = ${Math.floor(sec / 10) * 10 * laps}`, `${sec % 10} × ${laps} = ${(sec % 10) * laps}`, `Total: ${ans} seconds`],
      };
    },
  },
  {
    id: 'twoFactories', min: 3,
    make(L) {
      const a = rand(12, T(L, 25, 48)), d1 = rand(3, 7), b = rand(12, T(L, 25, 48)), d2 = rand(3, 7);
      const A = a * d1, B = b * d2, ans = A + B;
      return {
        title: 'Engine factory',
        text: `Factory A builds ${a} engines a day for ${d1} days. Factory B builds ${b} engines a day for ${d2} days. How many engines are built altogether?`,
        answer: ans, unit: 'engines',
        hint: 'Work out each factory separately, then add.',
        steps: [`A: ${a} × ${d1} = ${A}`, `B: ${b} × ${d2} = ${B}`, `Total: ${A} + ${B} = ${ans}`],
      };
    },
  },
  {
    id: 'sharePrize', min: 3,
    make(L) {
      const people = rand(3, 9), each = rand(12, T(L, 40, 99)) , extra = rand(2, 9) * 10;
      const total = people * each + extra;
      return {
        title: 'Prize money',
        text: `You win $${total}! You keep $${extra} for new paint, then share the rest equally between your ${people} crew members. How much does each crew member get?`,
        answer: each, unit: 'dollars',
        hint: 'Take away the paint money first.',
        steps: [`Left to share: ${total} − ${extra} = ${total - extra}`, `Each: ${total - extra} ÷ ${people} = $${each}`],
      };
    },
  },
  {
    id: 'speedDistance', min: 3,
    make(L) {
      const v = rand(12, T(L, 30, 75)), t = rand(4, 12), cars = rand(2, 4);
      const one = v * t, ans = one * cars;
      return {
        title: 'Convoy',
        text: `A race car travels ${v} metres every second. ${cars} cars drive side by side for ${t} seconds. What is the TOTAL distance travelled by all the cars together, in metres?`,
        answer: ans, unit: 'metres',
        hint: 'How far does one car go?',
        steps: [`One car: ${v} × ${t} = ${one} m`, `All cars: ${one} × ${cars} = ${fmt(ans)} m`],
      };
    },
  },
  {
    id: 'boxesOfBolts', min: 4,
    make() {
      const boxes = rand(3, 9), packs = rand(4, 12), bolts = rand(6, 25), cars = pick([2, 3, 4, 6]);
      const total = boxes * packs * bolts;
      if (total % cars !== 0) return null;
      return {
        title: 'Bolts for every car',
        text: `There are ${boxes} boxes. Each box has ${packs} packets and each packet has ${bolts} bolts. The bolts are shared equally between ${cars} cars. How many bolts does each car get?`,
        answer: total / cars, unit: 'bolts',
        hint: 'Find the total number of bolts first.',
        steps: [`Bolts per box: ${packs} × ${bolts} = ${packs * bolts}`, `All bolts: ${packs * bolts} × ${boxes} = ${fmt(total)}`, `Each car: ${fmt(total)} ÷ ${cars} = ${total / cars}`],
      };
    },
  },
  {
    id: 'compareDeals', min: 4,
    make() {
      const pa = rand(3, 6), ca = rand(12, 30), pb = rand(7, 12), cb = rand(8, 25);
      const A = pa * ca, B = pb * cb;
      if (A === B) return null;
      const cheaper = Math.min(A, B);
      return {
        title: 'Best deal',
        text: `Shop A sells ${pa} spark plugs for $${ca} each. Shop B sells ${pb} spark plugs for $${cb} each. What is the price of the CHEAPER order, in dollars?`,
        answer: cheaper, unit: 'dollars',
        hint: 'Work out the cost of each order.',
        steps: [`Shop A: ${pa} × $${ca} = $${A}`, `Shop B: ${pb} × $${cb} = $${B}`, `Cheaper: $${cheaper}`],
      };
    },
  },
];

export function generatePitStop(level = 0) {
  const pool = TEMPLATES.filter((t) => t.min <= level);
  for (let tries = 0; tries < 50; tries++) {
    // Newer templates get a bit more weight as the tour goes on.
    const t = weightedPick(pool, (x) => 1 + (x.min >= level - 1 ? 0.8 : 0));
    const p = t.make(level);
    if (p && Number.isInteger(p.answer) && p.answer > 0) return { id: t.id, ...p };
  }
  return { id: 'fuel', ...TEMPLATES[0].make(level) };
}

export const PIT_TEMPLATE_IDS = TEMPLATES.map((t) => t.id);
export function generatePitStopById(id, level = 5) {
  const t = TEMPLATES.find((x) => x.id === id);
  let p = null;
  for (let i = 0; i < 50 && !p; i++) p = t.make(level);
  return p && { id, ...p };
}
