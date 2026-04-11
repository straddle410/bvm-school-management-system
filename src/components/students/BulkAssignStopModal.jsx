import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Bus, MapPin, Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getStaffSession } from '@/components/useStaffSession';

export default function BulkAssignStopModal({ open, onClose, academicYear, onSuccess }) {
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const { data: routes = [] } = useQuery({
    queryKey: ['transport-routes-modal'],
    queryFn: () => base44.entities.TransportRoute.filter({ is_active: true }),
    enabled: open,
  });

  const { data: allStops = [] } = useQuery({
    queryKey: ['transport-stops-modal'],
    queryFn: () => base44.entities.TransportStop.list('sort_order'),
    enabled: open,
  });

  const { data: routeStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students-for-route', selectedRouteId, academicYear],
    queryFn: () => base44.entities.Student.filter({
      transport_route_id: selectedRouteId,
      academic_year: academicYear,
      is_deleted: false,
    }),
    enabled: !!selectedRouteId && open,
  });

  const stopsForRoute = allStops.filter(s => s.route_id === selectedRouteId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleRouteChange = (routeId) => {
    setSelectedRouteId(routeId);
    setSelectedStopId('');
    setSelectedStudentIds(new Set());
  };

  const handleToggleStudent = (id) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === routeStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(routeStudents.map(s => s.id)));
    }
  };

  const handleAssign = async () => {
    if (!selectedStopId || selectedStudentIds.size === 0) return;
    setLoading(true);
    try {
      const session = getStaffSession();
      const res = await base44.functions.invoke('bulkAssignStudentsToStop', {
        student_ids: Array.from(selectedStudentIds),
        stop_id: selectedStopId,
        staff_session_token: session?.staff_session_token || null,
      });
      if (res.data?.success) {
        toast.success(`${res.data.updatedCount} student(s) assigned to "${res.data.stop_name}" on "${res.data.route_name}"`);
        onSuccess?.();
        handleClose();
      } else {
        toast.error(res.data?.error || 'Assignment failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedRouteId('');
    setSelectedStopId('');
    setSelectedStudentIds(new Set());
    onClose();
  };

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const selectedStop = stopsForRoute.find(s => s.id === selectedStopId);

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-amber-600" /> Bulk Assign Students to Stop
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select Route */}
          <div>
            <Label className="text-sm font-semibold">1. Select Route</Label>
            <Select value={selectedRouteId} onValueChange={handleRouteChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a transport route…" />
              </SelectTrigger>
              <SelectContent>
                {routes.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Stop */}
          {selectedRouteId && (
            <div>
              <Label className="text-sm font-semibold">2. Select Destination Stop</Label>
              <Select value={selectedStopId} onValueChange={setSelectedStopId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a stop…" />
                </SelectTrigger>
                <SelectContent>
                  {stopsForRoute.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {s.name}
                        {s.scheduled_time && <span className="text-slate-400 text-xs">({s.scheduled_time})</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 3: Select Students */}
          {selectedRouteId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">3. Select Students on this Route</Label>
                {routeStudents.length > 0 && (
                  <button onClick={handleSelectAll} className="text-xs text-blue-600 hover:underline">
                    {selectedStudentIds.size === routeStudents.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>

              {loadingStudents ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                </div>
              ) : routeStudents.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm border rounded-lg bg-slate-50">
                  <Users className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No students found on this route
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {routeStudents.map(student => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                    >
                      <Checkbox
                        checked={selectedStudentIds.has(student.id)}
                        onCheckedChange={() => handleToggleStudent(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{student.name}</p>
                        <p className="text-xs text-slate-400">
                          Class {student.class_name} {student.section}
                          {student.transport_stop_name && (
                            <span className="ml-2 text-amber-600">→ {student.transport_stop_name}</span>
                          )}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedStudentIds.size > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {selectedStudentIds.size} student(s) selected
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedStudentIds.size > 0 && selectedStopId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-amber-800">Assignment Summary</p>
              <p className="text-amber-700 mt-1">
                <strong>{selectedStudentIds.size}</strong> student(s) will be assigned to stop{' '}
                <strong>"{selectedStop?.name}"</strong> on route <strong>"{selectedRoute?.name}"</strong>.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 gap-2"
              disabled={!selectedStopId || selectedStudentIds.size === 0 || loading}
              onClick={handleAssign}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {loading ? 'Assigning…' : `Assign ${selectedStudentIds.size > 0 ? selectedStudentIds.size : ''} Student(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}