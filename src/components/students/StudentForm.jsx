import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Lock, Bus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getProxiedImageUrl } from '@/components/imageProxy';
import { isLocked, getAllowedTransitions, STATUS_LABELS, ACTIVE_STATUSES, ARCHIVED_STATUSES } from '@/components/students/studentStatusUtils';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function StudentForm({ formData, onChange, onPhotoChange, photoFile, isEdit, onSubmit, onCancel, loading, isAdmin = true }) {
  const set = (key, val) => onChange({ ...formData, [key]: val });

  const locked = isEdit && isLocked(formData);
  const allowedNextStatuses = isEdit ? getAllowedTransitions(formData.status) : Object.keys(STATUS_LABELS).filter(s => ACTIVE_STATUSES.includes(s));
  // For edit: show current status + allowed next ones
  const statusOptions = isEdit
    ? [formData.status, ...allowedNextStatuses]
    : ['Pending'];

  // Readonly wrapper — if locked, disable all inputs
  const dis = locked || !isAdmin;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
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
            <Input
              value={formData.student_id || ''}
              onChange={e => set('student_id', e.target.value)}
              placeholder="Auto-generated"
              className="mt-1 rounded-xl bg-gray-50"
              readOnly={dis || locked || !isEdit}
              disabled={dis || locked || !isEdit}
            />
            {!isEdit && <p className="text-xs text-gray-400 mt-1">Generated on save</p>}
            {isAdmin && isEdit && !locked && (
              <p className="text-xs text-amber-600 mt-1">⚠ Changing ID will be audit-logged</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Username</Label>
            <Input value={formData.username || ''} onChange={e => set('username', e.target.value)} placeholder="Login username" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
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
            <Select value={formData.class_name || ''} onValueChange={locked ? undefined : v => set('class_name', v)} disabled={dis}>
              <SelectTrigger className="mt-1 rounded-xl bg-gray-50"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Section *</Label>
            <Select value={formData.section || 'A'} onValueChange={locked ? undefined : v => set('section', v)} disabled={dis}>
              <SelectTrigger className="mt-1 rounded-xl bg-gray-50"><SelectValue /></SelectTrigger>
              <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Roll No {!isEdit && <span className="text-gray-400 normal-case font-normal">(auto-assigned)</span>}</Label>
            <Input
              type="number"
              value={formData.roll_no || ''}
              onChange={(isEdit && !locked) ? (e => set('roll_no', parseInt(e.target.value))) : undefined}
              readOnly={!isEdit || locked}
              disabled={!isEdit || locked}
              placeholder={isEdit ? '1' : 'Auto'}
              className={`mt-1 rounded-xl bg-gray-50 ${(!isEdit || locked) ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {isEdit && !locked && <p className="text-xs text-amber-600 mt-1">⚠ Use "Manage Roll Numbers" for bulk edits</p>}
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
          {/* Status — only admin, only valid transitions */}
          {isAdmin && (
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={formData.status || 'Pending'} onValueChange={locked ? undefined : v => set('status', v)} disabled={locked}>
                <SelectTrigger className="mt-1 rounded-xl bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!locked && statusOptions.length === 1 && (
                <p className="text-xs text-gray-400 mt-1">No further transitions available</p>
              )}
            </div>
          )}
          <div className="col-span-2">
            <Label className="text-xs">Address</Label>
            <Textarea value={formData.address || ''} onChange={e => set('address', e.target.value)} placeholder="Home address" rows={2} className="mt-1 rounded-xl bg-gray-50 resize-none" readOnly={dis} disabled={dis} />
          </div>
        </div>
      </div>

      {/* Transport */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Transport</p>
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-slate-800">School Transport</p>
              <p className="text-xs text-slate-500">Transport fee will be added to annual invoice</p>
            </div>
          </div>
          <Switch
            checked={!!formData.transport_enabled}
            onCheckedChange={v => set('transport_enabled', v)}
            disabled={dis}
          />
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
            <Label className="text-xs">Phone</Label>
            <Input value={formData.parent_phone || ''} onChange={e => set('parent_phone', e.target.value)} placeholder="+91 98765 43210" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={formData.parent_email || ''} onChange={e => set('parent_email', e.target.value)} placeholder="parent@email.com" className="mt-1 rounded-xl bg-gray-50" readOnly={dis} disabled={dis} />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50">
          {locked ? 'Close' : 'Cancel'}
        </button>
        {!locked && (
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1a237e] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 hover:bg-[#283593]">
            {loading ? 'Saving...' : isEdit ? 'Update Student' : 'Add Student'}
          </button>
        )}
      </div>
    </form>
  );
}