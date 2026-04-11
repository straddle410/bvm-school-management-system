import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { LogOut, Bus, MapPin, Phone, User, Users, ChevronDown, ChevronUp, Search, Navigation, Square, PlayCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

function getDriverSession() {
  try {
    const s = localStorage.getItem('staff_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// GPS broadcast interval in ms — 10 seconds (battery & data friendly)
const BROADCAST_INTERVAL = 10000;

export default function DriverDashboard() {
  const [driver, setDriver] = useState(null);
  const [route, setRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedStop, setExpandedStop] = useState(null);
  const [error, setError] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const intervalRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    const session = getDriverSession();
    if (!session || session.role !== 'driver') {
      window.location.href = createPageUrl('StaffLogin');
      return;
    }
    setDriver(session);
    sessionRef.current = session;
    loadData(session);

    return () => stopBroadcasting();
  }, []);

  const loadData = async (session) => {
    setLoading(true);
    try {
      const [profiles] = await Promise.all([
        base44.entities.SchoolProfile.list().catch(() => []),
      ]);
      if (profiles[0]) setSchoolProfile(profiles[0]);

      // Session token may not carry assigned_route_id — fetch full staff record
      let assignedRouteId = session.assigned_route_id;
      if (!assignedRouteId && session.id) {
        const staffRecords = await base44.entities.StaffAccount.filter({ id: session.id }).catch(() => []);
        assignedRouteId = staffRecords[0]?.assigned_route_id;
        // Update sessionRef so GPS broadcast also has it
        if (assignedRouteId) sessionRef.current = { ...session, assigned_route_id: assignedRouteId };
      }

      if (!assignedRouteId) {
        setError('No route assigned to your account. Please contact admin.');
        setLoading(false);
        return;
      }

      const [routeData, stopsData, studentsData] = await Promise.all([
        base44.entities.TransportRoute.filter({ id: assignedRouteId }).catch(() => []),
        base44.entities.TransportStop.filter({ route_id: assignedRouteId }).catch(() => []),
        base44.entities.Student.filter({ transport_route_id: assignedRouteId, is_deleted: false }).catch(() => []),
      ]);

      if (routeData[0]) setRoute(routeData[0]);
      const sortedStops = stopsData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setStops(sortedStops);
      const activeStudents = studentsData.filter(s => ['Approved', 'Published'].includes(s.status) && s.transport_enabled);
      setStudents(activeStudents);
      if (sortedStops.length > 0) setExpandedStop(sortedStops[0].id);
    } catch (e) {
      setError('Failed to load route data.');
    }
    setLoading(false);
  };

  const sendLocation = () => {
    const session = sessionRef.current;
    if (!session || !session.assigned_route_id) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsError('');
        const { latitude, longitude, accuracy } = pos.coords;
        setLastLocation({ latitude, longitude, accuracy, time: new Date() });
        try {
          await base44.functions.invoke('updateBusLocation', {
            action: 'update',
            route_id: session.assigned_route_id,
            latitude,
            longitude,
            accuracy,
            staff_session_token: session.staff_session_token,
          });
        } catch (e) {
          console.warn('Location send failed:', e);
        }
      },
      (err) => {
        setGpsError('GPS unavailable: ' + (err.message || 'Permission denied'));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5000 }
    );
  };

  const startBroadcasting = () => {
    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device.');
      return;
    }
    setIsTracking(true);
    setGpsError('');
    sendLocation(); // immediate first send
    intervalRef.current = setInterval(sendLocation, BROADCAST_INTERVAL);
    toast.success('Route started — sharing location');
  };

  const stopBroadcasting = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
    const session = sessionRef.current;
    if (session?.staff_session_token) {
      await base44.functions.invoke('updateBusLocation', {
        action: 'stop',
        staff_session_token: session.staff_session_token,
      }).catch(() => {});
    }
    toast.success('Route ended — location sharing stopped');
  };

  const handleLogout = async () => {
    await stopBroadcasting();
    localStorage.removeItem('staff_session');
    window.location.href = createPageUrl('StaffLogin');
  };

  const filteredStudents = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.parent_name?.toLowerCase().includes(q) || s.parent_phone?.includes(q) || s.transport_stop_name?.toLowerCase().includes(q);
  });

  const studentsByStop = stops.reduce((acc, stop) => {
    acc[stop.id] = filteredStudents.filter(s => s.transport_stop_id === stop.id);
    return acc;
  }, {});
  const unassignedStudents = filteredStudents.filter(s => !s.transport_stop_id);

  if (loading) return (
    <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading route...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {schoolProfile?.logo_url ? (
              <img src={schoolProfile.logo_url} alt="Logo" className="h-9 w-9 object-contain rounded-full bg-white p-0.5 flex-shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Bus className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="leading-tight min-w-0">
              <p className="font-bold text-sm truncate">{schoolProfile?.school_name || 'School'}</p>
              <p className="text-blue-200 text-xs">Driver Portal</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/20 rounded-lg transition-all">
            <LogOut className="h-5 w-5 text-white" />
          </button>
        </div>
      </header>

      {/* Driver Info Card */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <User className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base truncate">{driver?.name}</p>
              <p className="text-xs text-gray-500">{driver?.designation || 'Driver'}</p>
            </div>
            {driver?.mobile && (
              <a href={`tel:${driver.mobile}`} className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                <Phone className="h-4 w-4" />{driver.mobile}
              </a>
            )}
          </div>

          {error ? (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          ) : route ? (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <Bus className="h-4 w-4 text-indigo-600" />
                <span className="font-bold text-indigo-800 text-sm">{route.name}</span>
                {driver?.bus_number && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{driver.bus_number}</span>
                )}
              </div>
              {route.description && <p className="text-xs text-gray-500 ml-6">{route.description}</p>}
              <div className="flex items-center gap-4 mt-2 ml-6">
                <span className="text-xs text-gray-600"><span className="font-bold text-gray-900">{students.length}</span> Students</span>
                <span className="text-xs text-gray-600"><span className="font-bold text-gray-900">{stops.length}</span> Stops</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* GPS Control */}
      {!error && (
        <div className="px-4 pt-3">
          {gpsError && (
            <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{gpsError}</div>
          )}
          {lastLocation && isTracking && (
            <div className="mb-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
              <span>Broadcasting location · ±{Math.round(lastLocation.accuracy || 0)}m · updated {lastLocation.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
          {isTracking ? (
            <button
              onClick={stopBroadcasting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 text-white font-bold text-base active:scale-95 transition-transform shadow-sm"
            >
              <Square className="h-5 w-5 fill-white" />
              Stop Route
            </button>
          ) : (
            <button
              onClick={startBroadcasting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-600 text-white font-bold text-base active:scale-95 transition-transform shadow-sm"
            >
              <PlayCircle className="h-6 w-6" />
              Start Route
            </button>
          )}
        </div>
      )}

      {/* Search */}
      {!error && (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, parent, stop..." className="pl-9 bg-white border-gray-200 rounded-xl" />
          </div>
        </div>
      )}

      {/* Student List by Stop */}
      {!error && (
        <main className="flex-1 px-4 pt-3 pb-8 space-y-3">
          {stops.length === 0 && students.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Bus className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No students found for this route.</p>
            </div>
          ) : (
            <>
              {stops.map(stop => {
                const stopStudents = studentsByStop[stop.id] || [];
                const isExpanded = expandedStop === stop.id;
                return (
                  <div key={stop.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{stop.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">{stopStudents.length} student{stopStudents.length !== 1 ? 's' : ''}</p>
                            {stop.scheduled_time && <p className="text-xs text-blue-600 font-semibold">🕐 {stop.scheduled_time}</p>}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {stopStudents.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-gray-400 italic">No students at this stop</p>
                        ) : stopStudents.map(student => <StudentRow key={student.id} student={student} />)}
                      </div>
                    )}
                  </div>
                );
              })}
              {unassignedStudents.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
                  <button onClick={() => setExpandedStop(expandedStop === 'unassigned' ? null : 'unassigned')}
                    className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">No Stop Assigned</p>
                        <p className="text-xs text-amber-600">{unassignedStudents.length} student{unassignedStudents.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {expandedStop === 'unassigned' ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>
                  {expandedStop === 'unassigned' && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {unassignedStudents.map(student => <StudentRow key={student.id} student={student} />)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}

function StudentRow({ student }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">Class {student.class_name}-{student.section} · #{student.roll_no || '—'}</p>
          {student.parent_name && <p className="text-xs text-indigo-700 mt-1 font-medium"><span className="text-gray-400">Parent: </span>{student.parent_name}</p>}
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          {student.parent_phone && (
            <a href={`tel:${student.parent_phone}`} className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-lg active:bg-green-100">
              <Phone className="h-3.5 w-3.5" />{student.parent_phone}
            </a>
          )}
          {student.alternate_parent_phone && (
            <a href={`tel:${student.alternate_parent_phone}`} className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg active:bg-blue-100">
              <Phone className="h-3 w-3" />{student.alternate_parent_phone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}