import '@fontsource/russo-one';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './style.css';

import { Renderer } from './game/renderer.js';
import { GarageStage, GlobeStage } from './game/stages.js';
import { RaceStage } from './game/race.js';
import { playMusic, setAudio, unlockAudio } from './game/audio.js';
import { CITIES } from './data/cities.js';
import { progress, save } from './math/progress.js';
import { show, loading, hudRoot } from './ui/dom.js';
import { Hud } from './ui/hud.js';
import { titleScreen, mapScreen, garageScreen, settingsScreen, trainingScreen, resultsScreen } from './ui/screens.js';

const TIPS = [
  'To multiply by 5, multiply by 10 and halve it.',
  'To multiply by 9, multiply by 10 then take one lot away.',
  'Stuck on 7 × 8? Remember 5, 6, 7, 8: 56 = 7 × 8!',
  'Multiplying by 25? Divide by 4, then multiply by 100.',
  'Times first, then plus: 4 + 3 × 5 = 4 + 15 = 19.',
  'For 23 × 14, do 23 × 10 and 23 × 4, then add them together.',
  'Hold ↓ to brake if you need more thinking time — but rivals might overtake!',
  'Get answers right in a row for bigger and bigger turbo boosts.',
  'Pit stops are multi-step puzzles. Use the working-out pad!',
  'Squares: 15² = 15 × 15 = 225.',
];

const renderer = new Renderer(document.getElementById('scene'));
const garage = new GarageStage(renderer);
let globe = null;
let race = null;
let hud = null;

const app = {
  currentCity: 0,

  applySettings() {
    const s = progress().settings;
    renderer.setQuality(s.quality);
    setAudio({ sound: s.sound, music: s.music });
  },

  leaveRace() {
    hud?.destroy();
    hud = null;
    race = null;
    hudRoot().classList.add('hidden');
  },

  goTitle() {
    this.leaveRace();
    const s = progress();
    garage.setView('title');
    garage.setCar(s.car, s.paint);
    renderer.setStage(garage);
    show(titleScreen(app));
    playMusic('menu');
  },

  goMap() {
    this.leaveRace();
    const s = progress();
    if (!globe) globe = new GlobeStage(renderer, CITIES, s);
    else globe.refresh(s);
    renderer.setStage(globe);
    show(mapScreen(app, globe));
    playMusic('menu');
  },

  goGarage() {
    garage.setView('garage');
    renderer.setStage(garage);
    show(garageScreen(app, garage));
  },

  goTraining() {
    garage.setView('title');
    renderer.setStage(garage);
    show(trainingScreen(app));
  },

  goSettings() {
    show(settingsScreen(app));
  },

  startRace(i) {
    this.leaveRace();
    unlockAudio();
    this.currentCity = i;
    const city = CITIES[i];
    if (globe) globe.selected = i;
    show(null);
    loading(true, `Travelling to ${city.flag} ${city.name}…`, TIPS[Math.floor(Math.random() * TIPS.length)]);
    // Let the loading screen paint before the heavy build.
    setTimeout(() => {
      race = new RaceStage(renderer, city, i);
      renderer.setStage(race);
      hud = new Hud(race, app);
      race.on('finish', (res) => this.raceFinished(res, i));
      playMusic('race');
      setTimeout(() => {
        loading(false);
        hud.toast(`${city.flag} ${city.name.toUpperCase()}`, 'info', 2400, city.tagline);
      }, 400);
      setTimeout(() => race?.start(), 3000);
    }, 60);
  },

  raceFinished(res, i) {
    const s = progress();
    const city = CITIES[i];
    const alreadyUnlocked = s.unlocked > i + 1;
    s.coins += res.coins;
    s.races++;
    s.stars[city.id] = Math.max(s.stars[city.id] || 0, res.stars);
    s.best[city.id] = Math.min(s.best[city.id] || 99, res.position);
    let unlocked = false;
    if (res.position <= 3 && i + 1 < CITIES.length && s.unlocked < i + 2) { s.unlocked = i + 2; unlocked = true; }
    const tourComplete = res.position <= 3 && i === CITIES.length - 1;
    save();
    show(resultsScreen(app, res, i, { unlocked, alreadyUnlocked, tourComplete }));
  },
};

window.__app = app; // handy for debugging & automated tests
app.debug = () => ({ race, hud, renderer, globe, garage });
app.applySettings();
app.goTitle();
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });
