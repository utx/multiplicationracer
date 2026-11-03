# 🏎️ Multiplication Racer: World Tour

A 3D racing game where your **multiplication skills are your engine**. Race through 8 cities around the world. Steer into the gate with the right answer to get a turbo boost, and solve multi-step puzzles at the pit stop to beat the rival crews.

It's made for confident young mathematicians (about age 8–11) and goes well past the basic times tables, including the multi-step reasoning used in Opportunity Class (OC) style tests.

## Play on Windows (easiest)

1. Go to the **[Releases page](https://github.com/utx/multiplicationracer/releases/latest)**.
2. Download **MultiplicationRacer-Setup.exe** (installs it with a desktop shortcut) or **MultiplicationRacer-Portable.exe** (no install, just double-click).
3. If Windows shows *"Windows protected your PC"*, click **More info → Run anyway**. The app just isn't code-signed.
4. Press **F11** for full screen.

A new Windows build is made automatically each time code is pushed (see `.github/workflows/windows.yml`).

## Play in a browser (for developers)

```bash
npm install
npm run dev        # then open the link it prints (http://localhost:5173)
```

To run the desktop version locally: `npm run desktop`. To build the Windows .exe: `npm run dist:win` (output in `release/`).
To build a version you can host anywhere: `npm run build` (output goes to `dist/`).
`.github/workflows/deploy.yml` publishes it to GitHub Pages on every push to `main`. To turn that on, go to **Settings → Pages → Source: GitHub Actions**.

### Controls
| Key | Action |
| --- | --- |
| `←` `→` (or `A` `D`) | Change lane |
| `1` `2` `3` | Jump straight to a lane |
| `↓` (or `S`) | Brake: more thinking time, but rivals catch up |
| `Esc` / `P` | Pause |
| Mouse / touch | Tap an answer card to steer into that lane |

## How the maths works

**Answer gates (quick-fire).** A question appears at the top of the screen and three answers hang over the three lanes. Drive through the right one to get a turbo, and the boost grows with your streak. A wrong answer makes you spin out and shows the correct working.

**Pit stops (multi-step, OC style).** Halfway through each race you pull into the pits for a word problem: fuel for a race, tyre budgets, packed grandstands, mystery numbers worked backwards, factor-pair codes, area × cost, sharing prize money, and more. Your pit time is compared with the rival crews' time, so being quick *and* right gains you track position. A wrong answer gives you a hint, then the first step, then the full worked solution. There's also a doodle pad for working out.

**It adapts.** Every times-table fact you get wrong is tracked, and tricky facts come back more often. The training menu has a "My tricky facts" sprint.

| City | Skills |
| --- | --- |
| 🇦🇺 Sydney | Times tables 2–9, missing numbers |
| 🇯🇵 Tokyo | All tables to 12, division facts |
| 🇫🇷 Paris | ×10 / ×100 with tables, 2-digit × 1-digit |
| 🇬🇧 London | Square numbers, mental shortcuts (×5 ×9 ×11 ×25 ×99, halve-and-double) |
| 🇧🇷 Rio | Order of operations (with the classic left-to-right trap as a wrong answer), 2-digit × 1-digit |
| 🇪🇬 Cairo | 2-digit × 2-digit, 3-digit × 1-digit |
| 🇺🇸 New York | Everything so far with bigger numbers (3 laps) |
| 🇮🇸 Reykjavík | Championship final: every skill, under the northern lights |

No ×0, ×1 or ×10 freebies. Wrong answers are designed to be *believable* (neighbouring facts, forgotten carries, working left to right instead of times first), so guessing doesn't pay.

Finish in the top 3 to unlock the next city. Coins buy faster cars in the garage (the paint shop is free). **Pit Crew Training** has 60-second typing sprints for every skill and a pit-puzzle practice mode.

Settings let you change the *thinking time* (Relaxed / Normal / Pro), the graphics quality, and sound.

## Tech

- [Three.js](https://threejs.org) with physically based materials, ACES tone mapping, soft shadows, bloom, and reflections from a baked environment map.
- Cars, tracks, landmarks and scenery are all built in code (procedurally). Every track is a seeded, closed spline.
- Textures are CC0 from [Poly Haven](https://polyhaven.com) (asphalt, grass, sand, snow, rock). The globe uses NASA Blue Marble imagery (via the three.js examples).
- Music and sound effects are made live with the Web Audio API, so there are no audio files.
- `npm test` checks that every question generator and pit-stop puzzle always produces correct, whole-number answers.

```
src/
  math/       questions.js (gate questions), pitstops.js (multi-step puzzles), progress.js (save + adaptive tracking)
  game/       renderer, track, cars, scenery, landmarks, race logic, audio, menu/globe stages
  ui/         HUD, pit stop, menus, results, training
  data/       cities.js (tour, rivals, cars, paints)
```
