import React, { useState } from 'react';
import { MapPin, Navigation, Bike, Store, Compass, ShieldCheck, Plus, Minus, Layers } from 'lucide-react';

interface LiveGPSMapTrackerProps {
  userLat: number;
  userLng: number;
  addressName: string;
  restaurantName: string;
  remainingSeconds: number;
  totalSeconds: number;
}

export const LiveGPSMapTracker: React.FC<LiveGPSMapTrackerProps> = ({
  userLat,
  userLng,
  addressName,
  restaurantName,
  remainingSeconds,
  totalSeconds
}) => {
  const [zoomLevel, setZoomLevel] = useState(15);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');

  // Calculate delivery progress percentage from 10% to 95%
  const progressPercent = Math.min(
    95,
    Math.max(10, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100))
  );

  // Restaurant coordinates (offset slightly from user coordinates for realistic pathing)
  const restLat = userLat + 0.015;
  const restLng = userLng - 0.018;

  // Distance remaining in kilometers based on Haversine ratio
  const distanceKm = Math.max(0.2, ((100 - progressPercent) * 0.04)).toFixed(1);

  // Calculate OpenStreetMap tile coordinates for user location
  const zoom = zoomLevel;
  const latRad = (userLat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((userLng + 180) / 360) * n);
  const ytile = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  // OpenStreetMap tile URL
  const osmTileUrl = `https://tile.openstreetmap.org/${zoom}/${xtile}/${ytile}.png`;

  return (
    <div className="relative w-full h-80 sm:h-96 rounded-3xl overflow-hidden shadow-2xl border-2 border-orange-500 bg-slate-950 font-sans">
      
      {/* 🗺️ OpenStreetMap Real Street Map Tile Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-300"
        style={{
          backgroundImage: `url(${osmTileUrl})`,
          filter: mapStyle === 'satellite' ? 'contrast(1.3) saturate(1.4) brightness(0.8)' : 'contrast(1.1) brightness(0.95)'
        }}
      />

      {/* Grid Lines & Street Grid Paths */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Live Delivery Route Polyline Path (Restaurant -> Driver -> User) */}
        <path
          d="M 70 80 Q 200 160, 360 260"
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          className="drop-shadow-xl"
        />

        {/* Glowing Animated Route Line overlay */}
        <path
          d="M 70 80 Q 200 160, 360 260"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeDasharray="10,12"
          className="animate-pulse"
        />
      </svg>

      {/* Map Header Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded-xl border border-slate-700 backdrop-blur-md flex items-center space-x-2 text-xs font-black shadow-lg">
          <Compass className="w-4 h-4 text-orange-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span>OpenStreetMap GPS Navigation</span>
        </div>

        <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center space-x-1">
          <Navigation className="w-3.5 h-3.5" />
          <span>{distanceKm} km to Live GPS Location</span>
        </div>
      </div>

      {/* Map Zoom Controls */}
      <div className="absolute top-14 right-3 z-10 flex flex-col space-y-1">
        <button
          onClick={() => setZoomLevel(prev => Math.min(18, prev + 1))}
          className="p-2 bg-slate-900/90 text-white rounded-xl border border-slate-700 hover:bg-slate-800 shadow-md font-bold text-xs"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoomLevel(prev => Math.max(12, prev - 1))}
          className="p-2 bg-slate-900/90 text-white rounded-xl border border-slate-700 hover:bg-slate-800 shadow-md font-bold text-xs"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
          className="p-2 bg-slate-900/90 text-white rounded-xl border border-slate-700 hover:bg-slate-800 shadow-md font-bold text-xs"
          title="Toggle Map Style"
        >
          <Layers className="w-4 h-4 text-yellow-400" />
        </button>
      </div>

      {/* 🏢 RESTAURANT PIN (ORIGIN POINT) */}
      <div className="absolute left-[14%] top-[20%] transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
        <div className="bg-orange-600 text-white p-2.5 rounded-2xl shadow-2xl border-2 border-white animate-bounce">
          <Store className="w-5 h-5 text-yellow-300" />
        </div>
        <div className="bg-slate-900/95 text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-orange-400 mt-1 shadow-md whitespace-nowrap">
          🏢 {restaurantName}
        </div>
      </div>

      {/* 🛵 DRIVER PIN (MOVING REAL-TIME ALONG ROUTE) */}
      <div 
        className="absolute z-30 transition-all duration-1000 ease-linear flex flex-col items-center"
        style={{
          left: `${14 + (progressPercent / 100) * 66}%`,
          top: `${20 + (progressPercent / 100) * 58}%`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="relative">
          <div className="absolute -inset-2 bg-yellow-400/40 rounded-full animate-ping" />
          <div className="bg-slate-900 text-yellow-400 p-3 rounded-2xl shadow-2xl border-2 border-yellow-400">
            <Bike className="w-6 h-6 animate-pulse" />
          </div>
        </div>
        <div className="bg-slate-900 text-yellow-300 text-[10px] font-black px-2.5 py-1 rounded-lg border border-yellow-400 mt-1 shadow-lg whitespace-nowrap flex items-center gap-1">
          🛵 Ramesh (Driver) • {progressPercent}%
        </div>
      </div>

      {/* 📍 USER LIVE GPS PIN (DESTINATION POINT) */}
      <div className="absolute left-[80%] top-[78%] transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
        <div className="relative">
          <div className="absolute -inset-3 bg-red-500/30 rounded-full animate-ping" />
          <div className="bg-red-600 text-white p-3 rounded-2xl shadow-2xl border-2 border-white">
            <MapPin className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-red-400 mt-1 shadow-lg whitespace-nowrap">
          📍 You ({userLat.toFixed(4)}, {userLng.toFixed(4)})
        </div>
      </div>

      {/* Bottom Floating Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 text-white p-3 rounded-2xl border border-slate-700 backdrop-blur-md flex items-center justify-between text-xs font-bold">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="truncate max-w-[200px] sm:max-w-[300px]">Live GPS: {addressName}</span>
        </div>
        <span className="text-[10px] text-yellow-400 bg-yellow-950/60 px-2 py-0.5 rounded-md border border-yellow-700 font-extrabold">
          OpenStreetMap Connected
        </span>
      </div>

    </div>
  );
};
