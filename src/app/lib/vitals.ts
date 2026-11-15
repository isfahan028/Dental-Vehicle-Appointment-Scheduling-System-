// Patient vital signs shown around the live video on the monitor page.
//
// Today every value is SIMULATED (createMockVitalsSource). When the real
// sensors arrive, write another VitalsSource that pushes real readings
// through the same `subscribe` callback — the page and the cards don't
// change. Ranges are general adult reference values for display colouring
// only, not clinical decision support.

export type VitalKey = 'heartRate' | 'spo2' | 'bloodPressure' | 'temperature' | 'respiratoryRate' | 'glucose';
export type VitalStatus = 'normal' | 'warning' | 'critical';

type Range = [number, number];

export type VitalDefinition = {
  key: VitalKey;
  label: string;
  unit: string;
  decimals: number;
  // One entry per displayed number (blood pressure has two: systolic/diastolic).
  // Inside `normal` = normal, inside `warning` = warning, anything else = critical.
  channels: { name: string; normal: Range; warning: Range }[];
};

export const VITALS: VitalDefinition[] = [
  { key: 'heartRate', label: 'Heart Rate', unit: 'bpm', decimals: 0,
    channels: [{ name: 'HR', normal: [60, 100], warning: [50, 120] }] },
  { key: 'spo2', label: 'SpO₂', unit: '%', decimals: 0,
    channels: [{ name: 'SpO₂', normal: [95, 100], warning: [90, 100] }] },
  { key: 'bloodPressure', label: 'Blood Pressure', unit: 'mmHg', decimals: 0,
    channels: [
      { name: 'Systolic', normal: [90, 129], warning: [80, 159] },
      { name: 'Diastolic', normal: [60, 84], warning: [50, 99] },
    ] },
  { key: 'temperature', label: 'Body Temp', unit: '°C', decimals: 1,
    channels: [{ name: 'Temp', normal: [36.1, 37.2], warning: [35.5, 38.0] }] },
  { key: 'respiratoryRate', label: 'Respiratory Rate', unit: '/min', decimals: 0,
    channels: [{ name: 'RR', normal: [12, 20], warning: [9, 24] }] },
  { key: 'glucose', label: 'Blood Glucose', unit: 'mg/dL', decimals: 0,
    channels: [{ name: 'Glucose', normal: [70, 140], warning: [60, 180] }] },
];

export type VitalReading = {
  key: VitalKey;
  values: number[]; // aligned with the definition's channels
  at: number;       // epoch ms
};

export type VitalsSource = {
  simulated: boolean;
  // Calls `onReading` for each new reading; returns an unsubscribe function.
  subscribe: (onReading: (reading: VitalReading) => void) => () => void;
};

const RANK: Record<VitalStatus, number> = { normal: 0, warning: 1, critical: 2 };

export function vitalStatus(def: VitalDefinition, values: number[]): VitalStatus {
  let worst: VitalStatus = 'normal';
  def.channels.forEach((ch, i) => {
    const v = values[i];
    const s: VitalStatus =
      v >= ch.normal[0] && v <= ch.normal[1] ? 'normal'
      : v >= ch.warning[0] && v <= ch.warning[1] ? 'warning'
      : 'critical';
    if (RANK[s] > RANK[worst]) worst = s;
  });
  return worst;
}

// ----- Simulation -----

// Per channel: resting baseline, how far a tick can wander, how hard it's
// pulled back to baseline, and the physically plausible clamp.
type SimChannel = { base: number; noise: number; pull: number; clamp: Range };

const SIM: Record<VitalKey, SimChannel[]> = {
  heartRate: [{ base: 78, noise: 1.6, pull: 0.12, clamp: [40, 160] }],
  spo2: [{ base: 98, noise: 0.35, pull: 0.2, clamp: [85, 100] }],
  bloodPressure: [
    { base: 118, noise: 1.4, pull: 0.1, clamp: [80, 190] },
    { base: 77, noise: 1.0, pull: 0.1, clamp: [45, 120] },
  ],
  temperature: [{ base: 36.7, noise: 0.03, pull: 0.08, clamp: [35, 40] }],
  respiratoryRate: [{ base: 16, noise: 0.5, pull: 0.15, clamp: [8, 30] }],
  glucose: [{ base: 105, noise: 1.2, pull: 0.05, clamp: [55, 220] }],
};

function gaussian() {
  // Box–Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Mean-reverting random walk: values drift believably instead of jumping,
// and now and then an "episode" nudges one vital out of range for a while so
// the warning/critical colours actually get exercised in a demo.
export function createMockVitalsSource(intervalMs = 1500): VitalsSource {
  return {
    simulated: true,
    subscribe(onReading) {
      const current = Object.fromEntries(
        VITALS.map(d => [d.key, SIM[d.key].map(c => c.base)]),
      ) as Record<VitalKey, number[]>;
      const offset = Object.fromEntries(VITALS.map(d => [d.key, 0])) as Record<VitalKey, number>;

      const tick = () => {
        const at = Date.now();
        for (const def of VITALS) {
          // ~1% chance per vital per tick to start or end an episode.
          if (Math.random() < 0.01) {
            const span = def.channels[0].normal[1] - def.channels[0].normal[0];
            offset[def.key] = offset[def.key] === 0 ? (Math.random() < 0.5 ? -1 : 1) * span * 0.45 : 0;
          }
          current[def.key] = current[def.key].map((x, i) => {
            const c = SIM[def.key][i];
            const target = c.base + (i === 0 ? offset[def.key] : offset[def.key] * 0.6);
            const next = x + c.pull * (target - x) + c.noise * gaussian();
            return Math.min(c.clamp[1], Math.max(c.clamp[0], next));
          });
          onReading({ key: def.key, values: [...current[def.key]], at });
        }
      };

      tick();
      const id = setInterval(tick, intervalMs);
      return () => clearInterval(id);
    },
  };
}
