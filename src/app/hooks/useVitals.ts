import { useEffect, useState } from 'react';
import { VITALS, type VitalKey, type VitalReading, type VitalsSource } from '../lib/vitals';

const HISTORY_LENGTH = 40;

export type VitalState = { latest: VitalReading | null; history: number[][] };

/** Latest reading + a short history per vital, from any VitalsSource. */
export function useVitals(source: VitalsSource) {
  const [state, setState] = useState<Record<VitalKey, VitalState>>(
    () => Object.fromEntries(VITALS.map(d => [d.key, { latest: null, history: [] }])) as unknown as Record<VitalKey, VitalState>,
  );

  useEffect(() => {
    return source.subscribe((reading) => {
      setState(prev => {
        const history = [...prev[reading.key].history, reading.values].slice(-HISTORY_LENGTH);
        return { ...prev, [reading.key]: { latest: reading, history } };
      });
    });
  }, [source]);

  return state;
}
