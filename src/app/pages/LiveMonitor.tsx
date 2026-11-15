import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AlertCircle, ArrowLeft, ExternalLink, Maximize, RotateCw, VideoOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveVehicles } from '../hooks/useLiveVehicles';
import { useVitals } from '../hooks/useVitals';
import { createMockVitalsSource, VITALS } from '../lib/vitals';
import { VitalCard } from '../components/monitor/VitalCard';
import { Button } from '../components/ui/Button';

// Doctor's monitor for one vehicle: one live camera in the middle, patient
// vital signs around it. Vitals are simulated until the real sensors are
// wired in (see lib/vitals.ts).
//
// The video can only be embedded when this page is served over http (local
// demo) or the V-Track player itself is https: the platform is http-only and
// streams over ws://, which browsers block inside an https page. On the
// https site we fall back to opening the player in a new tab.
export default function LiveMonitor() {
  const { vehicleId } = useParams();
  const { accessToken } = useAuth();
  const live = useLiveVehicles(accessToken);
  const vehicle = live.vehicles.find(v => v.id === vehicleId) ?? null;

  const vitalsSource = useMemo(() => createMockVitalsSource(), []);
  const vitals = useVitals(vitalsSource);

  const [channel, setChannel] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // Freeze the player URL once we have one: the 30s vehicle poll can hand back
  // a fresh jsession, and swapping the iframe src would restart the stream.
  // (Adjusted during render rather than in an effect — React's pattern for
  // state derived from props.)
  const latestPlayerUrl = vehicle?.playerUrl ?? null;
  const [playerBase, setPlayerBase] = useState<string | null>(null);
  if (latestPlayerUrl === null && playerBase !== null) setPlayerBase(null);
  else if (latestPlayerUrl !== null && playerBase === null) setPlayerBase(latestPlayerUrl);

  const playerSrc = playerBase ? `${playerBase}&index=${channel}` : null;
  const canEmbed = window.location.protocol === 'http:' || !!playerBase?.startsWith('https:');

  const monitorRef = useRef<HTMLDivElement>(null);
  const goFullscreen = () => monitorRef.current?.requestFullscreen?.();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const channelCount = Math.max(vehicle?.channelCount ?? 0, 1);
  const leftVitals = VITALS.slice(0, 3);
  const rightVitals = VITALS.slice(3);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/admin" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0" title="Back to dashboard">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {vehicle?.name ?? (live.isLoading ? 'Loading…' : 'Vehicle not found')}
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              {vehicle && (
                <span className={`inline-flex items-center gap-1.5 font-semibold ${vehicle.online ? 'text-green-700' : 'text-gray-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${vehicle.online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  {vehicle.online ? 'Online' : 'Offline'}
                </span>
              )}
              <span className="tabular-nums">{now.toLocaleTimeString('en-GB')}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {Array.from({ length: channelCount }, (_, i) => i + 1).map(ch => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  channel === ch ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                CH{ch}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setReloadKey(k => k + 1)} disabled={!playerSrc} className="gap-1.5">
            <RotateCw size={14} /> Reload video
          </Button>
          <Button variant="outline" size="sm" onClick={goFullscreen} className="gap-1.5">
            <Maximize size={14} /> Full screen
          </Button>
        </div>
      </div>

      {live.error && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{live.error}</span>
        </div>
      )}

      {/* Monitor: vitals | video | vitals. On small screens the video comes first. */}
      <div
        ref={monitorRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.6fr)_minmax(0,1fr)] gap-4 bg-gray-50 [&:fullscreen]:p-4 [&:fullscreen]:overflow-auto"
      >
        <div className="sm:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:min-h-[420px]">
          <div className="relative w-full aspect-video lg:aspect-auto lg:h-full bg-gray-900 rounded-xl overflow-hidden shadow-sm">
            {playerSrc && canEmbed ? (
              <iframe
                key={`${channel}-${reloadKey}`}
                src={playerSrc}
                title={`${vehicle?.name ?? 'Vehicle'} camera CH${channel}`}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-gray-300">
                <VideoOff size={40} className="text-gray-500" />
                {!vehicle || !vehicle.online ? (
                  <p>{live.isLoading ? 'Connecting to camera…' : 'Camera is offline — no live video.'}</p>
                ) : (
                  <>
                    <p className="max-w-md text-sm">
                      Live video can't be embedded on the secure (https) site yet — the camera platform only
                      serves plain http. Open it in a new tab for now.
                    </p>
                    {playerSrc && (
                      <a
                        href={playerSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                      >
                        <ExternalLink size={15} /> Open CH{channel} in new tab
                      </a>
                    )}
                  </>
                )}
              </div>
            )}
            <span className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-white text-xs font-semibold pointer-events-none">
              CH{channel}
            </span>
          </div>
        </div>

        {leftVitals.map((def, i) => (
          <div key={def.key} className={`lg:col-start-1 ${['lg:row-start-1', 'lg:row-start-2', 'lg:row-start-3'][i]}`}>
            <VitalCard def={def} state={vitals[def.key]} simulated={vitalsSource.simulated} />
          </div>
        ))}
        {rightVitals.map((def, i) => (
          <div key={def.key} className={`lg:col-start-3 ${['lg:row-start-1', 'lg:row-start-2', 'lg:row-start-3'][i]}`}>
            <VitalCard def={def} state={vitals[def.key]} simulated={vitalsSource.simulated} />
          </div>
        ))}
      </div>

      {vitalsSource.simulated && (
        <p className="text-xs text-gray-400 text-center">
          Vital signs are simulated for demonstration — real sensor readings will replace them. Not for clinical use.
        </p>
      )}
    </div>
  );
}
