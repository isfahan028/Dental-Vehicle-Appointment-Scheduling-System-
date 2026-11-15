import { AlertCircle, ExternalLink, RefreshCw, Video, VideoOff } from 'lucide-react';
import type { useLiveVehicles } from '../../hooks/useLiveVehicles';
import { Button } from '../ui/Button';

// Live camera feeds from the V-Track vehicle-video cloud. The data comes from
// the dashboard (useLiveVehicles), which also feeds the "Live Cameras" stat.
//
// The player opens in a new tab rather than inline: the platform only serves
// http and streams over ws://, which an https page can't embed or proxy.
export function LiveTab({ live }: { live: ReturnType<typeof useLiveVehicles> }) {
  const { vehicles, onlineCount, error, isLoading, isRefreshing, reload } = live;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Live Camera</h2>
          <p className="text-sm text-gray-500">
            {isLoading
              ? 'Loading vehicles…'
              : `${onlineCount} of ${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} online · video opens in a new tab`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={isRefreshing} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && vehicles.length === 0 && (
        <p className="text-center text-gray-500 py-12">No vehicles found on the camera platform.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-6">
            <div className="flex justify-between items-start gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex-shrink-0 p-3 rounded-full ${vehicle.online ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {vehicle.online ? <Video size={20} /> : <VideoOff size={20} />}
                </div>
                <h3 className="text-lg font-bold text-gray-900 truncate">{vehicle.name}</h3>
              </div>
              <span className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded font-bold flex-shrink-0 ${vehicle.online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                <span className={`w-2 h-2 rounded-full ${vehicle.online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {vehicle.online ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="space-y-1 text-sm text-gray-600 mb-6">
              <p>Device: {vehicle.deviceNo ?? '—'}</p>
              <p>Cameras: {vehicle.channelCount}</p>
            </div>
            <div className="pt-4 border-t border-gray-100">
              {vehicle.playerUrl ? (
                <a
                  href={vehicle.playerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full h-9 rounded-md bg-blue-600 text-white text-sm font-medium shadow hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink size={15} />
                  Watch live
                </a>
              ) : (
                <Button variant="secondary" size="sm" disabled className="w-full h-9">
                  Offline — no video
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
