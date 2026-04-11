import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Bus, MapPin, Loader2, Check, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getStaffSession } from '@/components/useStaffSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const LIMIT = 25;

export default function TransportAssignment() {
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const [page, setPage] = useState(1);
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('assigned');
  const [showDialog, setShowDialog] = useState(false);
  const [studentToAssign, setStudentToAssign] = useState(null);
  const [formRouteId, setFormRouteId] = useState('');
  const [formStopId, setFormStopId] = useState('');

  const staffSession = getStaffSession();
  const isAdmin = ['admin', 'principal'].includes((staffSession?.role || '').toLowerCase());

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['transportStudents', academicYear, page, debouncedSearch, filterRoute, filterAssigned],
    queryFn: async () => {
      const session = getStaffSession();
      const res = await base44.functions.invoke('getStudentsPaginated', {
        page,
        limit: LIMIT,
        search: debouncedSearch,
        status: 'Published',
        academic_year: academicYear,
        staff_session_token: session?.staff_session_token || null,
        sort_field: 'name',
        sort_dir: 'asc',
        ...(filterRoute !== 'all' ? { transport_route_id: filterRoute } : {}),
        ...(filterAssigned === 'assigned' ? { transport_enabled: true } : {}),
        ...(filterAssigned === 'unassigned' ? { transport_enabled: false } : {}),
      });
      return res.data;
    },
    enabled: !!academicYear && isAdmin,
    keepPreviousData: true,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['transport-routes-assign'],
    queryFn: () => base44.entities.TransportRoute.filter({ is_active: true }),
    enabled: isAdmin,
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['transport-stops-assign'],
    queryFn: () => base44.entities.TransportStop.list('sort_order'),
    enabled: isAdmin,
  });

  const students = studentsData?.data || [];
  const totalPages = studentsData?.total_pages || 1;
  const totalCount = studentsData?.total_count || 0;

  const selectedRoute = routes.find(r => r.id === formRouteId);
  const stopsForRoute = stops.filter(s => s.route_id === formRouteId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const isStopBased = selectedRoute?.fee_type === 'stop_based';

  const computeFee = (route, stop) => {
    if (!route) return 0;
    if (route.fee_type === 'yearly') return route.fixed_yearly_fee || 0;
    if (route.fee_type === 'monthly') return (route.fixed_monthly_fee || 0) * 12;
    if (route.fee_type === 'stop_based') return stop?.fee_amount || 0;
    return 0;
  };

  const assignMutation = useMutation({
    mutationFn: async ({ studentId, routeId, stopId }) => {
      const session = getStaffSession();
      const res = await base44.functions.invoke('bulkUpdateStudentTransport', {
        staff_session_token: session?.staff_session_token || null,
        student_ids: [studentId],
        transport_enabled: !!routeId,
        transport_route_id: routeId || null,
        transport_route_name: routes.find(r => r.id === routeId)?.name || '',
        transport_stop_id: stopId || null,
        transport_stop_name: stops.find(s => s.id === stopId)?.name || '',
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Failed to update');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transportStudents']);
      toast.success('Transport assignment updated');
      setShowDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (studentId) => {
      const session = getStaffSession();
      const res = await base44.functions.invoke('bulkUpdateStudentTransport', {
        staff_session_token: session?.staff_session_token || null,
        student_ids: [studentId],
        transport_enabled: false,
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Failed to remove');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transportStudents']);
      toast.success('Transport removed');
    },
    onError: (e) => toast.error(e.message),
  });

  const openAssign = (student) => {
    setStudentToAssign(student);
    setFormRouteId(student.transport_route_id || '');
    setFormStopId(student.transport_stop_id || '');
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formRouteId) { toast.error('Please select a route.'); return; }
    if (isStopBased && !formStopId) { toast.error('Please select a stop.'); return; }
    assignMutation.mutate({ studentId: studentToAssign.id, routeId: formRouteId, stopId: isStopBased ? formStopId : null });
  };

  const selectedStop = stops.find(s => s.id === formStopId);
  const previewFee = computeFee(selectedRoute, selectedStop);

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Transport Assignment">
      <div className="min-h-screen bg-[#f0f4ff] dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-slate-100 sticky top-0 z-40 px-4 py-2.5">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <Link to={createPageUrl('Students')} className="p-1 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Transport Assignment</h1>
              <p className="text-xs text-slate-400 leading-tight">Assign students to routes & stops · {academicYear}</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
            </div>
            <Select value={filterRoute} onValueChange={v => { setFilterRoute(v); setPage(1); }}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Routes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routes</SelectItem>
                {routes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAssigned} onValueChange={v => { setFilterAssigned(v); setPage(1); }}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Transport Enabled" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="assigned">✅ Transport Enabled</SelectItem>
                <SelectItem value="all">All Students</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats bar */}
          <div className="bg-white rounded-xl px-4 py-2 flex items-center gap-4 text-xs text-slate-500 shadow-sm">
            <span><strong className="text-slate-800">{totalCount}</strong> students</span>
            <span className="text-slate-200">|</span>
            <span><strong className="text-blue-700">{routes.length}</strong> active routes</span>
          </div>

          {/* Student List */}
          {isLoadingStudents ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
              <Bus className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No students found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map(student => (
                <div key={student.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{student.name}</p>
                    <p className="text-xs text-slate-400">Class {student.class_name}-{student.section}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-blue-700 bg-blue-50 w-fit px-2 py-0.5 rounded-full">
                      <Bus className="h-3 w-3" />
                      <span className="font-medium">{student.transport_route_name || 'Route not set'}</span>
                      {student.transport_stop_name && (
                        <><span className="text-blue-300">·</span><MapPin className="h-3 w-3" /><span>{student.transport_stop_name}</span></>
                      )}
                      {!student.transport_stop_name && <span className="text-amber-500 ml-1">· No stop</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" onClick={() => openAssign(student)} className="bg-[#1a237e] hover:bg-[#283593] text-xs h-8 px-3 rounded-lg">
                      {student.transport_stop_name ? 'Change Stop' : 'Assign Stop'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 bg-white rounded-2xl shadow-sm p-3">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || isLoadingStudents} className="rounded-xl">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 font-medium">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isLoadingStudents} className="rounded-xl">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Assignment Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>Assign Transport</DialogTitle>
            </DialogHeader>
            {studentToAssign && (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-3 text-sm">
                  <p className="font-bold text-slate-800">{studentToAssign.name}</p>
                  <p className="text-slate-500 text-xs">Class {studentToAssign.class_name}-{studentToAssign.section}</p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">Route *</Label>
                  <Select value={formRouteId} onValueChange={v => { setFormRouteId(v); setFormStopId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Select a route" /></SelectTrigger>
                    <SelectContent>
                      {routes.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                          <span className="ml-2 text-xs text-slate-400">
                            {r.fee_type === 'yearly' ? `₹${(r.fixed_yearly_fee||0).toLocaleString()}/yr` :
                             r.fee_type === 'monthly' ? `₹${(r.fixed_monthly_fee||0).toLocaleString()}/mo` : 'Stop-based'}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isStopBased && (
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">Stop *</Label>
                    <Select value={formStopId} onValueChange={setFormStopId} disabled={stopsForRoute.length === 0}>
                      <SelectTrigger><SelectValue placeholder="Select a stop" /></SelectTrigger>
                      <SelectContent>
                        {stopsForRoute.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} <span className="text-xs text-slate-400 ml-2">₹{(s.fee_amount||0).toLocaleString()}/yr</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {stopsForRoute.length === 0 && <p className="text-xs text-red-500 mt-1">No stops configured for this route yet.</p>}
                  </div>
                )}

                {selectedRoute && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                    <p className="font-semibold">Annual Fee: ₹{previewFee.toLocaleString()}</p>
                    <p className="text-blue-600 mt-0.5">This will be reflected in the student's fee invoice after recalculation.</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>Cancel</Button>
                  <Button
                    className="flex-1 bg-[#1a237e] hover:bg-[#283593]"
                    disabled={assignMutation.isPending || !formRouteId || (isStopBased && !formStopId)}
                    onClick={handleSave}
                  >
                    {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Save Assignment
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </LoginRequired>
  );
}