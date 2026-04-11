import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bus, MapPin, Phone, ChevronLeft, RefreshCw, Clock, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const BUS_ICON = L.divIcon({
  className: '',
  html: `<div style="background:#1a237e;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M2 9V7a1 1 0 011-1h18a1 1 0 011 1v2"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true, duration: 1 });
  }, [center]);
  return null;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TransportTracking() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [busLocations, setBusLocations] = useState({});
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  useEffect(() => {
    // Auth check
    try {
      const s = JSON.parse(localStorage.getItem('staff_session') || '{}');
      const role = s.role || '';
      if (!['admin', 'principal', 'ceo'].includes(role)) {
        navigate('/Dashboard');
        return;
      }
    } catch { navigate('/Dashboard'); return; }

    loadData();

    unsubRef.current = base44.entities.BusLocation.subscribe((event) => {
      if (!event.data?.route_id) return;
      setBusLocations(prev => {
        if (event.data.status === 'inactive') {
          const next = { ...prev };
          delete next[event.data.route_id];
          return next;
        }
        return { ...prev, [event.data.route_id]: event.data };
      });
    });

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [routeList, locationList] = await Promise.all([
      base44.entities.TransportRoute.filter({ is_active: true }),
      base44.entities.BusLocation.filter({ status: 'active' }),
    ]);
    setRoutes(routeList);
    const locMap = {};
    for (const loc of locationList) locMap[loc.route_id] = loc;
    setBusLocations(locMap);
    if (routeList.length > 0) setSelectedRoute(routeList[0].id);
    setLoading(false);
  };

  const selectedBus = busLocations[selectedRoute];
  const selectedRouteObj = routes.find(r => r.id === selectedRoute);

  if (loading) return (
    <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition-all">
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Live Transport Tracking</h1>
            <p className="text-xs text-gray-500">{Object.keys(busLocations).length} bus{Object.keys(busLocations).length !== 1 ? 'es' : ''} active</p>
          </div>
          <button onClick={loadData} className="ml-auto p-2 hover:bg-white rounded-xl transition-all">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Route Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {routes.map(route => {
            const isActive = !!busLocations[route.id];
            const isSelected = selectedRoute === route.id;
            return (
              <button
                key={route.id}
                onClick={() => setSelectedRoute(route.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-[#1a237e] text-white border-[#1a237e]'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isActive ? 'bg-green-400' : isSelected ? 'bg-white/40' : 'bg-gray-300'}`} />
                {route.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map & Driver Info */}
      <div className="px-4 flex-1 flex flex-col gap-3">
        {/* Driver Card */}
        {selectedBus ? (
          <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm">{selectedBus.driver_name}</p>
                  <p className="text-blue-200 text-xs">{selectedBus.bus_number ? `Bus ${selectedBus.bus_number}` : selectedRouteObj?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedBus.driver_phone && (
                  <a href={`tel:${selectedBus.driver_phone}`} className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full text-xs font-semibold">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                )}
                <div className="flex items-center gap-1 text-xs text-green-300 font-semibold">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  Live
                </div>
              </div>
            </div>
            <p className="text-xs text-blue-300 mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Updated: {formatTime(selectedBus.last_updated)}
              {selectedBus.accuracy && ` · ±${Math.round(selectedBus.accuracy)}m accuracy`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Bus className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-700 text-sm">{selectedRouteObj?.name || 'Route'}</p>
              <p className="text-xs text-gray-400">Driver not broadcasting — route inactive</p>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '420px' }}>
          {selectedBus ? (
            <MapContainer
              center={[selectedBus.latitude, selectedBus.longitude]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapUpdater center={[selectedBus.latitude, selectedBus.longitude]} />
              <Marker position={[selectedBus.latitude, selectedBus.longitude]} icon={BUS_ICON}>
                <Popup>
                  <div className="text-center">
                    <p className="font-bold">{selectedBus.driver_name}</p>
                    <p className="text-xs text-gray-500">{selectedBus.bus_number || 'School Bus'}</p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
              <MapPin className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No live location for this route</p>
              <p className="text-xs mt-1">Driver needs to start the route from their device</p>
            </div>
          )}
        </div>

        {/* All Active Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">All Routes Status</h3>
          <div className="space-y-2">
            {routes.map(route => {
              const loc = busLocations[route.id];
              return (
                <button key={route.id} onClick={() => setSelectedRoute(route.id)}
                  className="w-full flex items-center justify-between text-left py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${loc ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-800 font-medium">{route.name}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {loc ? <span className="text-green-600 font-semibold">● Live</span> : 'Inactive'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}