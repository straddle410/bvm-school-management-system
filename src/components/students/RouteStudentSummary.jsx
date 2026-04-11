import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bus, Users, ChevronDown, ChevronRight, MapPin, AlertCircle } from 'lucide-react';

export default function RouteStudentSummary({ academicYear }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);

  useEffect(() => {
    if (!academicYear) return;
    setLoading(true);
    setError(null);
    base44.functions.invoke('getStudentsPerRoute', { academic_year: academicYear })
      .then(res => {
        if (res.data?.success) setData(res.data);
        else setError(res.data?.error || 'Failed to load data');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [academicYear]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3 text-red-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm">Could not load route summary: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const activeRoutes = data.routes.filter(r => r.is_active);
  const inactiveRoutes = data.routes.filter(r => !r.is_active && r.student_count > 0);

  return (
    <div className="space-y-4">

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center border border-slate-100">
          <p className="text-2xl font-bold text-[#1a237e]">{data.total_students}</p>
          <p className="text-xs text-gray-500 mt-1">Total Active Students</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center border border-green-100">
          <p className="text-2xl font-bold text-green-600">{data.transport_students}</p>
          <p className="text-xs text-gray-500 mt-1">Using School Bus</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center border border-amber-100">
          <p className="text-2xl font-bold text-amber-600">{data.no_transport_count}</p>
          <p className="text-xs text-gray-500 mt-1">No Transport</p>
        </div>
      </div>

      {/* Route List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Bus className="h-4 w-4 text-[#1a237e]" />
          <h2 className="text-sm font-bold text-slate-800">Students Per Route</h2>
          <span className="ml-auto text-xs text-gray-400">Tap a route to see student list</span>
        </div>

        {activeRoutes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No active routes found. Add routes in Transport Settings.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeRoutes.map(route => (
              <div key={route.route_id}>
                {/* Route Row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setExpandedRoute(expandedRoute === route.route_id ? null : route.route_id)}
                >
                  {/* Bus Icon */}
                  <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Bus className="h-4 w-4 text-blue-600" />
                  </div>

                  {/* Route Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{route.route_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {route.fee_type === 'yearly' ? 'Fixed Annual Fee' :
                       route.fee_type === 'monthly' ? 'Monthly Fee' : 'Stop-based Fee'}
                    </p>
                  </div>

                  {/* Student Count Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 bg-[#1a237e] text-white rounded-full px-3 py-1">
                      <Users className="h-3 w-3" />
                      <span className="text-xs font-bold">{route.student_count}</span>
                    </div>
                    {expandedRoute === route.route_id
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                </button>

                {/* Expanded Student List */}
                {expandedRoute === route.route_id && (
                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                    {route.student_count === 0 ? (
                      <p className="text-xs text-gray-400 py-2 text-center">No students assigned to this route yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Group by stop */}
                        {(() => {
                          const byStop = {};
                          route.students.forEach(s => {
                            const key = s.stop_name || 'No Stop Assigned';
                            if (!byStop[key]) byStop[key] = [];
                            byStop[key].push(s);
                          });
                          return Object.entries(byStop).map(([stopName, stopStudents]) => (
                            <div key={stopName}>
                              {stopName !== 'No Stop Assigned' && (
                                <div className="flex items-center gap-1 mb-1 mt-2">
                                  <MapPin className="h-3 w-3 text-amber-500" />
                                  <span className="text-xs font-semibold text-amber-700">{stopName}</span>
                                  <span className="text-xs text-gray-400">({stopStudents.length})</span>
                                </div>
                              )}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {stopStudents.map((s, idx) => (
                                  <div key={idx} className="bg-white rounded-lg px-2.5 py-1.5 text-xs border border-slate-100">
                                    <p className="font-medium text-slate-700 truncate">{s.name}</p>
                                    <p className="text-gray-400">Class {s.class_name} - {s.section}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive routes with students */}
      {inactiveRoutes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-700 mb-2">⚠️ Inactive Routes with Students Assigned</p>
          {inactiveRoutes.map(route => (
            <div key={route.route_id} className="flex justify-between text-xs text-amber-700 py-1 border-t border-amber-100">
              <span>{route.route_name}</span>
              <span className="font-bold">{route.student_count} students</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}