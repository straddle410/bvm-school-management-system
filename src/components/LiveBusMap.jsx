import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { Bus, Phone, MapPin, Clock, AlertCircle, Navigation } from 'lucide-react';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const BUS_ICON = L.divIcon({
  className: '',
  html: `<div style="background:#1a237e;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M2 9V7a1 1 0 011-1h18a1 1 0 011 1v2"/></svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function MapUpdater({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], map.getZoom(), { animate: true, duration: 1 });
  }, [lat, lng]);
  return null;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LiveBusMap({ routeId }) {
  const [busLocation, setBusLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!routeId) return;

    // Initial fetch
    base44.entities.BusLocation.filter({ route_id: routeId, status: 'active' })
      .then(data => { setBusLocation(data[0] || null); setLoading(false); })
      .catch(() => setLoading(false));

    // Real-time subscription
    unsubRef.current = base44.entities.BusLocation.subscribe((event) => {
      if (event.data?.route_id !== routeId) return;
      if (event.type === 'delete') { setBusLocation(null); return; }
      if (event.data?.status === 'inactive') { setBusLocation(null); return; }
      if (event.data?.status === 'active') setBusLocation(event.data);
    });

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [routeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 bg-white rounded-2xl border border-gray-100">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Driver Info Bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bus className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">{busLocation?.driver_name || 'Driver'}</p>
              <p className="text-blue-200 text-xs">{busLocation?.bus_number ? `Bus ${busLocation.bus_number}` : busLocation?.route_name || 'Your Route'}</p>
            </div>
          </div>
          {busLocation?.driver_phone ? (
            <a href={`tel:${busLocation.driver_phone}`}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-xs font-semibold transition-all">
              <Phone className="h-3.5 w-3.5" />
              Call Driver
            </a>
          ) : null}
        </div>
      </div>

      {/* Status Bar */}
      <div className={`px-4 py-2 flex items-center gap-2 text-xs font-semibold ${busLocation ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
        <div className={`h-2 w-2 rounded-full ${busLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        {busLocation ? (
          <span>Live · Updated {formatTime(busLocation.last_updated)}</span>
        ) : (
          <span>Bus is not currently active on this route</span>
        )}
      </div>

      {/* Map */}
      {busLocation ? (
        <div style={{ height: '320px', width: '100%' }}>
          <MapContainer
            center={[busLocation.latitude, busLocation.longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapUpdater lat={busLocation.latitude} lng={busLocation.longitude} />
            <Marker position={[busLocation.latitude, busLocation.longitude]} icon={BUS_ICON}>
              <Popup>
                <div className="text-center py-1">
                  <p className="font-bold text-gray-900">{busLocation.driver_name}</p>
                  <p className="text-xs text-gray-500">{busLocation.bus_number || 'School Bus'}</p>
                  <p className="text-xs text-gray-400 mt-1">Updated {formatTime(busLocation.last_updated)}</p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <MapPin className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Bus tracking not active</p>
          <p className="text-xs mt-1 text-gray-400">Driver will start sharing location when the route begins</p>
        </div>
      )}
    </div>
  );
}