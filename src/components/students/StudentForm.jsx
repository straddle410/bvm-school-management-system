import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Lock, Bus, BedDouble, MapPin } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getProxiedImageUrl } from '@/components/imageProxy';
import { isLocked, getAllowedTransitions, STATUS_LABELS, ACTIVE_STATUSES } from '@/components/students/studentStatusUtils';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function StudentForm({ formData, onChange, onPhotoChange, photoFile, isEdit, onSubmit, onCancel, loading, isAdmin = true }) {
  const set = (key, val) => onChange({ ...formData, [key]: val });

  const locked = isEdit && isLocked(formData);
  const allowedNextStatuses = isEdit ? getAllowedTransitions(formData.status) : Object.keys(STATUS_LABELS).filter(s => ACTIVE_STATUSES.includes(s));
  const statusOptions = isEdit ? [formData.status, ...allowedNextStatuses] : ['Pending'];
  const dis = locked || !isAdmin;

  // Dynamic class/section
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const academicYear = formData.academic_year;

  useEffect(() => {
    if (!academicYear) return;
    setLoadingClasses(true);
    getClassesForYear(academicYear)
      .then(res => setAvailableClasses(res.classes || []))
      .catch(() => setAvailableClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [academicYear]);

  useEffect(() => {
    if (!academicYear || !formData.class_name) { setAvailableSections([]); return; }
    setLoadingSections(true);
    getSectionsForClass(academicYear, formData.class_name)
      .then(res => {
        const sections = res.sections || [];
        setAvailableSections(sections);
        if (sections.length === 1 && !formData.section) onChange({ ...formData, section: sections[0] });
        if (formData.section && sections.length > 0 && !sections.includes(formData.section)) onChange({ ...formData, section: '' });
      })
      .catch(() => setAvailableSections([]))
      .finally(() => setLoadingSections(false));
  }, [academicYear, formData.class_name]);

  const handleClassChange = (newClass) => onChange({ ...formData, class_name: newClass, section: '' });
  const classDisabled = !isAdmin || loadingClasses;
  const sectionDisabled = !isAdmin || loadingSections || !formData.class_name;

  // Transport routes & stops
  const { data: allRoutes = [] } = useQuery({
    queryKey: ['transport-routes-active'],
    queryFn: () => base44.entities.TransportRoute.filter({ is_active: true })
  });
  const { data: allStops = [] } = useQuery({
    queryKey: ['transport-stops-all'],
    queryFn: () => base44.entities.TransportStop.list('sort_order')
  });

  const selectedRoute = allRoutes.find(r => r.id === formData.transport_route_id) || null;
  const stopsForRoute = formData.transport_route_id
    ? allStops.filter(s => s.route_id === formData.transport_route_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    : [];

  const computeAnnualFee = (route, stop) => {
    if (!route) return 0;
    if (route.fee_type === 'yearly') return route.fixed_yearly_fee || 0;
    if (route.fee_type === 'monthly') return (route.fixed_monthly_fee || 0) * 12;
    if (route.fee_type === 'stop_based') return stop?.fee_amount || 0;
    return 0;
  };

  const handleRouteChange = (routeId) => {
    if (!routeId || routeId === 'none') {
      onChange({
        ...formData,
        transport_route_id: null,
        transport_route_name: '',
        transport_stop_id: null,
        transport_stop_name: '',
        transport_enabled: false,
        annual_transport_fee: 0
      });
      return;
    }
    const route = allRoutes.find(r => r.id === routeId) || null;
    onChange({
      ...formData,
      transport_route_id: routeId,
      transport_route_name: route?.name || '',
      transport_stop_id: null,
      transport_stop_name: '',
      transport_enabled: true,
      annual_transport_fee: computeAnnualFee(route, null)
    });
  };

  const handleStopChange = (stopId) => {
    const stop = allStops.find(s => s.id === stopId) || null;
    onChange({
      ...formData,
      transport_stop_id: stopId || null,
      transport_stop_name: stop?.name || '',
      annual_transport_fee: computeAnnualFee(selectedRoute, stop)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.class_name) { alert('Class is required. Please select a class.'); return; }
    if (!formData.parent_phone || formData.parent_phone.trim() === '') { alert('Parent phone number is required.'); return; }
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {locked && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>This student is <strong>{formData.status}</strong>. Record is read-only.</span>
        </div>
      )}

      {/* Photo */}
      <div className="flex justify-center">
        <div className="relative">
          <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
            <AvatarImage src={photoFile ? URL.createObjectURL(photoFile) : getProxiedImageUrl(formData.photo_url)} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-2xl font-bold">
              {formData.name?.[0] || 'S'}
            </AvatarFallback>
          </Avatar>
          <label className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[#1a237e] flex items-center justify-center cursor-pointer hover:bg-[#283593] shadow">
            <Camera className="h-3.5 w-3.5 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={e => onPhotoChange(e.target.files[0])} />
          </label>
        </div>
      </div>

      {/* Academic */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Academic Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Student ID</Label>
            <Input value={formData.student_id || ''} placeholder="Auto-generated on approval" className="mt-1 rounded-xl bg-gray-50" readOnly disabled />
            {!isEdit && <p className="text-xs text-green-600 mt-1">✓ Generated when status→Approved</p>}
            {isEdit && !formData.student_id && <p className="text-xs text-amber-600 mt-1">⚠ ID will be auto-assigned on approval</p>}
            {isEdit && formData.student_id && <p className="text-xs text-gray-400 mt-1">Assigned: {formData.student_id}</p>}
          </div>
          <div>
            <Label className="text-xs">Username</Label>
            <Input value={formData.username || ''} placeholder="Auto-generated" className="mt-1 rounded-xl bg-gray-50 opacity-60 cursor-not-allowed" readOnly disabled />
          </div>
          <div>
            <Label className="text-xs">Password</Label>
            <Input value={formData.password || 'BVM123'} onChange={e => set('password', e.target.value)} placeholder="BVM123" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
          <div>
            <Label className="text-xs">Academic Year</Label>
            <Input value={formData.academic_year || ''} onChange={e => set('academic_year', e.target.value)} placeholder="2024-25" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
          <div>
            <Label className="text-xs">Class *</Label>
            <Select value={formData.class_name || ''} onValueChange={locked ? undefined : handleClassChange} disabled={classDisabled}>
              <SelectTrigger className="mt-1 rounded-xl bg-gray-50">
                <SelectValue placeholder={loadingClasses ? 'Loading...' : 'Select class'} />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Section</Label>
            <Select value={formData.section || ''} onValueChange={v => set('section', v)} disabled={sectionDisabled}>
              <SelectTrigger className="mt-1 rounded-xl bg-gray-50">
                <SelectValue placeholder={loadingSections ? 'Loading...' : 'Select section'} />
              </SelectTrigger>
              <SelectContent>
                {availableSections.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Roll No {!isEdit && <span className="text-gray-400 normal-case font-normal">(on approval)</span>}</Label>
            <Input
              type="number"
              value={formData.roll_no || ''}
              onChange={(isEdit && !locked) ? (e => set('roll_no', parseInt(e.target.value))) : undefined}
              readOnly={!isEdit || locked || !formData.status || formData.status !== 'Published'}
              disabled={!isEdit || locked || !formData.status || formData.status !== 'Published'}
              placeholder={isEdit && !formData.roll_no ? 'Not assigned yet' : 'Auto'}
              className={`mt-1 rounded-xl bg-gray-50 ${(!isEdit || locked || !formData.roll_no) ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {!isEdit && <p className="text-xs text-gray-500 mt-1">✓ Assigned automatically when status → Approved</p>}
            {isEdit && !locked && formData.roll_no && <p className="text-xs text-amber-600 mt-1">⚠ Use "Manage Roll Numbers" for bulk edits</p>}
            {isEdit && !locked && !formData.roll_no && <p className="text-xs text-amber-600 mt-1">⚠ Roll number not yet assigned (approve student first)</p>}
          </div>
          <div>
            <Label className="text-xs">Admission Date</Label>
            <Input type="date" value={formData.admission_date || ''} onChange={e => set('admission_date', e.target.value)} className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
        </div>
      </div>

      {/* Personal */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Personal Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Full Name *</Label>
            <Input value={formData.name || ''} onChange={e => set('name', e.target.value)} placeholder="Full name" required className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
          <div>
            <Label className="text-xs">Date of Birth</Label>
            <Input type="date" value={formData.dob || ''} onChange={e => set('dob', e.target.value)} className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
          <div>
            <Label className="text-xs">Gender</Label>
            <Select value={formData.gender || 'Male'} onValueChange={locked ? undefined : v => set('gender', v)} disabled={dis}>
              <SelectTrigger className="mt-1 rounded-xl bg-gray-50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Blood Group</Label>
            <Select value={formData.blood_group || ''} onValueChange={locked ? undefined : v => set('blood_group', v)} disabled={dis}>
              <SelectTrigger className="mt-1 rounded-xl bg-gray-50"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={formData.status || 'Pending'} onValueChange={locked ? undefined : v => set('status', v)} disabled={locked}>
                <SelectTrigger className="mt-1 rounded-xl bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>)}
                </SelectContent>
              </Select>
              {!locked && statusOptions.length === 1 && <p className="text-xs text-gray-400 mt-1">No further transitions available</p>}
            </div>
          )}
          <div className="col-span-2">
            <Label className="text-xs">Address</Label>
            <Textarea value={formData.address || ''} onChange={e => set('address', e.target.value)} placeholder="Home address" rows={2} className="mt-1 rounded-xl bg-gray-50 resize-none" readOnly={dis} disabled={dis} />
          </div>
        </div>
      </div>

      {/* Transport & Hostel */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Transport & Hostel</p>
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <Bus className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-slate-800">School Transport</p>
            </div>
            <div>
              <Label className="text-xs">Route</Label>
              <Select
                value={formData.transport_route_id || 'none'}
                onValueChange={v => handleRouteChange(v === 'none' ? null : v)}
                disabled={dis}
              >
                <SelectTrigger className="mt-1 rounded-xl bg-white">
                  <SelectValue placeholder="No transport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Transport</SelectItem>
                  {allRoutes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedRoute?.fee_type === 'stop_based' && (
              <div>
                <Label className="text-xs">Boarding Stop</Label>
                <Select
                  value={formData.transport_stop_id || 'none'}
                  onValueChange={v => handleStopChange(v === 'none' ? null : v)}
                  disabled={dis}
                >
                  <SelectTrigger className="mt-1 rounded-xl bg-white">
                    <SelectValue placeholder="Select stop" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select Stop —</SelectItem>
                    {stopsForRoute.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{s.name}{s.fee_amount ? ` — ₹${s.fee_amount.toLocaleString()}` : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.transport_route_id && (
              <p className="text-xs text-amber-700 font-medium">
                Annual transport fee: ₹{(formData.annual_transport_fee || 0).toLocaleString()}
                {selectedRoute?.fee_type === 'monthly' && ` (₹${selectedRoute.fixed_monthly_fee}/month × 12)`}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-slate-800">Hostel</p>
                <p className="text-xs text-slate-500">Class-wise hostel fee will be added to annual invoice</p>
              </div>
            </div>
            <Switch checked={!!formData.hostel_enabled} onCheckedChange={v => set('hostel_enabled', v)} disabled={dis} />
          </div>
        </div>
      </div>

      {/* Parent */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Parent / Guardian</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Parent Name</Label>
            <Input value={formData.parent_name || ''} onChange={e => set('parent_name', e.target.value)} placeholder="Guardian name" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
          <div>
            <Label className="text-xs">Phone <span className="text-red-500">*</span></Label>
            <Input value={formData.parent_phone || ''} onChange={e => set('parent_phone', e.target.value)} placeholder="+91 98765 43210" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} required />
          </div>
          <div>
            <Label className="text-xs">Alternate Phone</Label>
            <Input value={formData.alternate_parent_phone || ''} onChange={e => set('alternate_parent_phone', e.target.value)} placeholder="+91 98765 43210" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={formData.parent_email || ''} onChange={e => set('parent_email', e.target.value)} placeholder="parent@email.com" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50">
          {locked ? 'Close' : 'Cancel'}
        </button>
        {!locked && (
          <button type="submit" disabled={loading} className="flex-1 bg-[#1a237e] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 hover:bg-[#283593]">
            {loading ? 'Saving...' : isEdit ? 'Update Student' : 'Add Student'}
          </button>
        )}
      </div>
    </form>
  );
}