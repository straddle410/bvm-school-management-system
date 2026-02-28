import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil, Archive, RotateCcw, Trash2, User, BookOpen, Phone, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { getProxiedImageUrl } from '@/components/imageProxy';

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Verified: 'bg-blue-100 text-blue-700',
  Approved: 'bg-indigo-100 text-indigo-700',
  Published: 'bg-green-100 text-green-700',
  'Passed Out': 'bg-gray-100 text-gray-600',
  Transferred: 'bg-orange-100 text-orange-700',
};

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium w-28 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-semibold text-right flex-1">{value}</span>
    </div>
  );
}

export default function StudentProfileSheet({ student, open, onClose, onEdit, onArchive, onDelete, isAdmin }) {
  if (!student) return null;

  const initials = student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isArchived = student.status === 'Passed Out' || student.status === 'Transferred';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] px-6 pt-6 pb-14">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-bold text-base">Student Profile</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[student.status] || 'bg-gray-100 text-gray-600'}`}>
              {student.status}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-3 border-white/50 shadow-lg">
              <AvatarImage src={getProxiedImageUrl(student.photo_url)} />
              <AvatarFallback className="bg-indigo-300 text-white font-bold text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{student.name}</h2>
              <p className="text-blue-200 text-xs mt-0.5">{student.student_id}</p>
              <p className="text-blue-200 text-xs">Class {student.class_name}-{student.section} · Roll #{student.roll_no}</p>
            </div>
          </div>
        </div>

        <div className="px-4 -mt-8 pb-6 space-y-4">
          {/* Academic */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-bold text-gray-700">Academic Details</span>
            </div>
            <InfoRow label="Student ID" value={student.student_id} />
            <InfoRow label="Username" value={student.username} />
            <InfoRow label="Class" value={`${student.class_name}-${student.section}`} />
            <InfoRow label="Roll No" value={student.roll_no?.toString()} />
            <InfoRow label="Academic Year" value={student.academic_year} />
            <InfoRow label="Admission Date" value={student.admission_date ? format(new Date(student.admission_date), 'dd MMM yyyy') : null} />
          </div>

          {/* Personal */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-bold text-gray-700">Personal Details</span>
            </div>
            <InfoRow label="Full Name" value={student.name} />
            <InfoRow label="Gender" value={student.gender} />
            <InfoRow label="Date of Birth" value={student.dob ? format(new Date(student.dob), 'dd MMM yyyy') : null} />
            <InfoRow label="Blood Group" value={student.blood_group} />
            <InfoRow label="Address" value={student.address} />
          </div>

          {/* Parent */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-bold text-gray-700">Parent / Guardian</span>
            </div>
            <InfoRow label="Name" value={student.parent_name} />
            <InfoRow label="Phone" value={student.parent_phone} />
            <InfoRow label="Email" value={student.parent_email} />
          </div>

          {/* Admin Actions */}
          {isAdmin && (
            <div className="space-y-2">
              <button onClick={onEdit}
                className="w-full flex items-center justify-center gap-2 bg-[#1a237e] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#283593] transition-all">
                <Pencil className="h-4 w-4" /> Edit Student
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onArchive}
                  className="flex items-center justify-center gap-2 border border-orange-200 text-orange-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-50">
                  {isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {isArchived ? 'Reactivate' : 'Archive'}
                </button>
                <button onClick={onDelete}
                  className="flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}