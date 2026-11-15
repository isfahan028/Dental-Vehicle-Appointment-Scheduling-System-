import { Activity, Droplet, Gauge, HeartPulse, Thermometer, Wind } from 'lucide-react';
import { vitalStatus, type VitalDefinition, type VitalKey, type VitalStatus } from '../../lib/vitals';
import type { VitalState } from '../../hooks/useVitals';

const ICONS: Record<VitalKey, typeof Activity> = {
  heartRate: HeartPulse,
  spo2: Droplet,
  bloodPressure: Gauge,
  temperature: Thermometer,
  respiratoryRate: Wind,
  glucose: Activity,
};

const STATUS_STYLES: Record<VitalStatus, { ring: string; value: string; line: string; label: string }> = {
  normal: { ring: 'border-gray-200', value: 'text-gray-900', line: '#16a34a', label: 'bg-green-100 text-green-800' },
  warning: { ring: 'border-yellow-300', value: 'text-yellow-700', line: '#ca8a04', label: 'bg-yellow-100 text-yellow-800' },
  critical: { ring: 'border-red-400', value: 'text-red-600', line: '#dc2626', label: 'bg-red-100 text-red-800' },
};

// Tiny line chart of the first channel's recent values. Scaled to the
// data's own min/max (padded) so small fluctuations stay visible.
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <div className="h-10" />;
  const w = 120;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const span = max + pad - lo;
  const d = points
    .map((v, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - ((v - lo) / span) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-10" aria-hidden="true">
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function VitalCard({ def, state, simulated }: { def: VitalDefinition; state: VitalState; simulated: boolean }) {
  const Icon = ICONS[def.key];
  const values = state.latest?.values;
  const status = values ? vitalStatus(def, values) : 'normal';
  const styles = STATUS_STYLES[status];
  const display = values ? values.map(v => v.toFixed(def.decimals)).join(' / ') : '—';
  const normalText = def.channels
    .map(c => `${c.normal[0]}–${c.normal[1]}`)
    .join(' / ');

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${styles.ring} p-4 flex flex-col gap-2 transition-colors`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={18} className="text-gray-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700 truncate">{def.label}</span>
        </div>
        {simulated && (
          <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex-shrink-0">
            SIMULATED
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tabular-nums ${styles.value}`}>{display}</span>
        <span className="text-sm text-gray-500">{def.unit}</span>
      </div>

      <Sparkline points={state.history.map(v => v[0])} color={styles.line} />

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Normal {normalText}</span>
        <span className={`px-1.5 py-0.5 rounded font-semibold capitalize ${styles.label}`}>{status}</span>
      </div>
    </div>
  );
}
