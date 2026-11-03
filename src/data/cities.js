// The World Tour. Each city ramps up the maths and the rivals.
// `mix` feeds the gate question generator; `pitLevel` sets pit-stop difficulty.

export const CITIES = [
  {
    id: 'sydney', name: 'Sydney', country: 'Australia', flag: '🇦🇺',
    lat: -33.87, lon: 151.21,
    tagline: 'Harbour Sprint',
    skills: 'Times tables 2–9 · missing numbers',
    mix: [{ skill: 'tables', w: 3, max: 9 }, { skill: 'missing', w: 1, max: 9 }],
    pitLevel: 0, pitPar: 40, laps: 2, rivalPace: [0.93, 0.97, 1.0, 1.03, 1.06], seed: 11,
    theme: {
      time: 'day', skyTop: 0x2f7fe0, skyHorizon: 0xbfe3ff, sunColor: 0xfff1d0, sunElev: 45, sunAz: 30,
      fog: 0xbfe3ff, fogDensity: 0.0009, ground: 'aerial_grass_rock', groundTint: 0x9fc27a,
      trees: 'gum', treeColor: 0x6f9a52, buildings: 0.35, buildingPalette: [0xf2efe6, 0xd9d2c3, 0xa9c4d6, 0xe8d8b8],
      water: true, landmark: 'sydney', mountains: 0x6d8f5a, bloom: 0.35, exposure: 1.0, barrier: 0x1f6fd1,
    },
  },
  {
    id: 'tokyo', name: 'Tokyo', country: 'Japan', flag: '🇯🇵',
    lat: 35.68, lon: 139.69,
    tagline: 'Neon Night Grand Prix',
    skills: 'All tables to 12 · division facts',
    mix: [{ skill: 'tables', w: 3, max: 12 }, { skill: 'division', w: 1.5, max: 12 }, { skill: 'missing', w: 1, max: 12 }],
    pitLevel: 1, pitPar: 40, laps: 2, rivalPace: [0.95, 0.99, 1.02, 1.05, 1.08], seed: 23,
    theme: {
      time: 'night', skyTop: 0x050616, skyHorizon: 0x3a1f5c, sunColor: 0x9db4ff, sunElev: 35, sunAz: 200,
      fog: 0x1a1030, fogDensity: 0.0012, ground: 'rocky_terrain_02', groundTint: 0x40404a,
      trees: 'blossom', treeColor: 0xff9ec7, buildings: 1.0, buildingPalette: [0x2a2d3a, 0x343848, 0x1f2230, 0x3b2f4a],
      neon: true, landmark: 'tokyo', mountains: 0x2b2a40, bloom: 1.1, exposure: 1.15, barrier: 0xff2d75,
    },
  },
  {
    id: 'paris', name: 'Paris', country: 'France', flag: '🇫🇷',
    lat: 48.86, lon: 2.35,
    tagline: 'Sunset Boulevard Dash',
    skills: 'Tens & hundreds · 2-digit × 1-digit',
    mix: [{ skill: 'tens', w: 2, level: 1 }, { skill: 'twoByOne', w: 2, level: 1 }, { skill: 'tables', w: 1.5, max: 12 }],
    pitLevel: 2, pitPar: 42, laps: 2, rivalPace: [0.97, 1.0, 1.03, 1.06, 1.09], seed: 37,
    theme: {
      time: 'sunset', skyTop: 0x3b4fa0, skyHorizon: 0xffa25c, sunColor: 0xffb070, sunElev: 8, sunAz: 250,
      fog: 0xe8a77c, fogDensity: 0.0011, ground: 'aerial_grass_rock', groundTint: 0x8fa66a,
      trees: 'round', treeColor: 0x5f8a3e, buildings: 0.7, buildingPalette: [0xe9dcc0, 0xd8c7a5, 0xcdb894, 0xf0e5cf],
      landmark: 'paris', mountains: 0x7a6e8a, bloom: 0.6, exposure: 1.05, barrier: 0x2346a8,
    },
  },
  {
    id: 'london', name: 'London', country: 'United Kingdom', flag: '🇬🇧',
    lat: 51.51, lon: -0.13,
    tagline: 'Foggy Thames Thunder',
    skills: 'Square numbers · mental shortcuts (×5 ×9 ×11 ×25 ×99)',
    mix: [{ skill: 'squares', w: 1.5, level: 1 }, { skill: 'strategy', w: 2.5 }, { skill: 'twoByOne', w: 1, level: 2 }, { skill: 'tables', w: 1, max: 12 }],
    pitLevel: 3, pitPar: 45, laps: 2, rivalPace: [0.98, 1.01, 1.04, 1.07, 1.1], seed: 41,
    theme: {
      time: 'overcast', skyTop: 0x7d8a99, skyHorizon: 0xc9cfd6, sunColor: 0xf3f0e8, sunElev: 30, sunAz: 140,
      fog: 0xb5bcc4, fogDensity: 0.0016, ground: 'aerial_grass_rock', groundTint: 0x7f9a6e,
      trees: 'round', treeColor: 0x4f7a3a, buildings: 0.8, buildingPalette: [0x8a5a44, 0x9c6b52, 0xcfc6b4, 0x6e6a66],
      water: true, landmark: 'london', mountains: 0x6f7a74, bloom: 0.4, exposure: 1.0, barrier: 0xc8102e,
    },
  },
  {
    id: 'rio', name: 'Rio de Janeiro', country: 'Brazil', flag: '🇧🇷',
    lat: -22.91, lon: -43.17,
    tagline: 'Carnival Coast Cup',
    skills: 'Order of operations · 2-digit × 1-digit',
    mix: [{ skill: 'orderOps', w: 2.5, max: 9 }, { skill: 'twoByOne', w: 1.5, level: 2 }, { skill: 'strategy', w: 1 }],
    pitLevel: 4, pitPar: 45, laps: 2, rivalPace: [0.99, 1.02, 1.05, 1.08, 1.11], seed: 53,
    theme: {
      time: 'day', skyTop: 0x1f8be8, skyHorizon: 0xaee8ff, sunColor: 0xfff4d6, sunElev: 60, sunAz: 80,
      fog: 0xb8ecff, fogDensity: 0.0008, ground: 'aerial_beach_01', groundTint: 0xf0e0b5,
      trees: 'palm', treeColor: 0x3f9a4a, buildings: 0.5, buildingPalette: [0xffffff, 0xffd166, 0x06d6a0, 0xef476f, 0x118ab2],
      water: true, landmark: 'rio', mountains: 0x3f7a4a, bloom: 0.4, exposure: 1.0, barrier: 0x009c3b,
    },
  },
  {
    id: 'cairo', name: 'Cairo', country: 'Egypt', flag: '🇪🇬',
    lat: 30.04, lon: 31.24,
    tagline: 'Desert Pyramid Rally',
    skills: '2-digit × 2-digit · 3-digit × 1-digit',
    mix: [{ skill: 'twoByTwo', w: 2, level: 1 }, { skill: 'threeByOne', w: 1.5 }, { skill: 'squares', w: 1, level: 2 }, { skill: 'tables', w: 1, max: 12 }],
    pitLevel: 5, pitPar: 48, laps: 2, rivalPace: [1.0, 1.03, 1.06, 1.09, 1.12], seed: 67,
    theme: {
      time: 'sunset', skyTop: 0x4a7fc0, skyHorizon: 0xffc98a, sunColor: 0xffc27a, sunElev: 14, sunAz: 280,
      fog: 0xf0c890, fogDensity: 0.0010, ground: 'aerial_beach_01', groundTint: 0xe0b878,
      trees: 'palm', treeColor: 0x5a8a3a, treeDensity: 0.4, buildings: 0.15, buildingPalette: [0xd9b98a, 0xc9a574, 0xe8cfa2],
      dunes: true, landmark: 'cairo', mountains: 0xc89a5e, bloom: 0.5, exposure: 1.05, barrier: 0xce1126,
    },
  },
  {
    id: 'newyork', name: 'New York', country: 'USA', flag: '🇺🇸',
    lat: 40.71, lon: -74.01,
    tagline: 'Skyscraper Speedway',
    skills: 'Everything so far — bigger numbers',
    mix: [{ skill: 'twoByTwo', w: 1.5, level: 2 }, { skill: 'orderOps', w: 1.5, max: 12 }, { skill: 'strategy', w: 1.5 }, { skill: 'tens', w: 1, level: 2 }, { skill: 'threeByOne', w: 1 }],
    pitLevel: 6, pitPar: 50, laps: 3, rivalPace: [1.01, 1.04, 1.07, 1.1, 1.13], seed: 79,
    theme: {
      time: 'dusk', skyTop: 0x1c2450, skyHorizon: 0xff8a7a, sunColor: 0xffb0a0, sunElev: 4, sunAz: 300,
      fog: 0x6a4a6a, fogDensity: 0.0011, ground: 'rocky_terrain_02', groundTint: 0x55585e,
      trees: 'round', treeColor: 0x3f6a3a, treeDensity: 0.5, buildings: 1.3, buildingPalette: [0x3a3f4a, 0x50566a, 0x6a6f7a, 0x2a2f38],
      neon: true, water: true, landmark: 'newyork', mountains: 0x3a3550, bloom: 0.8, exposure: 1.1, barrier: 0x3c3b6e,
    },
  },
  {
    id: 'reykjavik', name: 'Reykjavík', country: 'Iceland', flag: '🇮🇸',
    lat: 64.15, lon: -21.94,
    tagline: 'Aurora Championship Final',
    skills: 'The ultimate mix — every skill',
    mix: [
      { skill: 'tables', w: 1, max: 12 }, { skill: 'missing', w: 0.6, max: 12 }, { skill: 'division', w: 0.6, max: 12 },
      { skill: 'twoByTwo', w: 1.2, level: 2 }, { skill: 'threeByOne', w: 1 }, { skill: 'orderOps', w: 1.2, max: 12 },
      { skill: 'strategy', w: 1 }, { skill: 'squares', w: 0.8, level: 2 }, { skill: 'tens', w: 0.8, level: 2 },
    ],
    pitLevel: 7, pitPar: 50, laps: 3, rivalPace: [1.02, 1.05, 1.08, 1.11, 1.14], seed: 97,
    theme: {
      time: 'night', skyTop: 0x020814, skyHorizon: 0x10314a, sunColor: 0xa8c8ff, sunElev: 30, sunAz: 120,
      fog: 0x0c2030, fogDensity: 0.0010, ground: 'snow_02', groundTint: 0xdfe8f0,
      trees: 'pine', treeColor: 0x24503a, buildings: 0.3, buildingPalette: [0xd8d8d8, 0xb8352e, 0x2e5ab8, 0xe0c040],
      aurora: true, snow: true, landmark: 'reykjavik', mountains: 0xe6eef5, bloom: 0.9, exposure: 1.2, barrier: 0x02529c,
    },
  },
];

export const RIVALS = [
  { name: 'Turbo Tilly', color: 0xff3b30, body: 'gt' },
  { name: 'Max Velocity', color: 0xffcc00, body: 'formula' },
  { name: 'Captain Crankshaft', color: 0x34c759, body: 'rally' },
  { name: 'Lightning Lee', color: 0xaf52de, body: 'hyper' },
  { name: 'Rosie Revs', color: 0xff9500, body: 'gt' },
];

export const CARS = [
  { id: 'gt', name: 'Street GT', cost: 0, boost: 1.0, desc: 'A sleek all-rounder. Perfect for your first tour.' },
  { id: 'rally', name: 'Rally Raptor', cost: 300, boost: 1.03, desc: 'Tough, chunky and loves a turbo.' },
  { id: 'formula', name: 'Formula Flash', cost: 800, boost: 1.06, desc: 'Open wheels, huge wings, serious speed.' },
  { id: 'hyper', name: 'Hyper X', cost: 1500, boost: 1.1, desc: 'The ultimate hypercar with glowing neon.' },
];

export const PAINTS = [
  { name: 'Rocket Red', color: 0xe8202a },
  { name: 'Ocean Blue', color: 0x1769ff },
  { name: 'Lime Zap', color: 0x7ed321 },
  { name: 'Sunburst', color: 0xffb800 },
  { name: 'Galaxy Purple', color: 0x8e3cff },
  { name: 'Hot Pink', color: 0xff3ea5 },
  { name: 'Arctic White', color: 0xf2f4f7 },
  { name: 'Midnight', color: 0x1b1d24 },
  { name: 'Teal Turbo', color: 0x00b8a9 },
  { name: 'Copper', color: 0xc8733a },
];
