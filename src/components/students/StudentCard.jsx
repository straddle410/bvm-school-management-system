import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye, Pencil, Archive, MoreVertical, RotateCcw, Lock, Trash2, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createPageUrl } from '@/utils';
import { getProxiedImageUrl } from '@/components/imageProxy';

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Verified: 'bg-blue-100 text-blue-700',
  Approved: 'bg-indigo-100 text-indigo-700',
  Published: 'bg-green-100 text-green-700',
  'Passed Out': 'bg-gray-100 text-gray-500',
  Transferred: 'bg-orange-100 text-orange-600',
};

export default function StudentCard({ student, onView, onEdit, onArchive, onDelete, onRestore, isAdmin }) {
  const navigate = useNavigate();
  const initials = student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isArchived = student.status === 'Passed Out' || student.status === 'Transferred';
  const isDeleted = student.is_deleted === true;
  const locked = isArchived;

  const handleViewProfile = () => {
    navigate(createPageUrl('StudentProfile') + `?id=${student.id}`);
  };

  return (
    <div className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${isDeleted ? 'bg-red-50 border border-red-200' : 'bg-white'}`}>
      {/* Mobile layout */}
      <button onClick={handleViewProfile} className="w-full text-left sm:hidden p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={getProxiedImageUrl(student.photo_url)} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
            <p className="text-xs text-gray-500">Class {student.class_name}-{student.section} · Roll #{student.roll_no}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[student.status] || 'bg-gray-100 text-gray-500'}`}>
            {student.status === 'Published' ? 'Active' : student.status}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 pl-13">
          <span className="text-xs text-gray-400">{student.student_id}</span>
          {student.transport_enabled && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Transport ON</span>
          )}
        </div>
      </button>

      {/* Desktop table row layout */}
      <button onClick={handleViewProfile} className="hidden sm:flex w-full text-left items-center gap-4 px-4 py-3 group-hover:opacity-90">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={getProxiedImageUrl(student.photo_url)} />
          <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-xs">{initials}</AvatarFallback>
        </Avatar>
        {/* Name */}
        <div className="w-48 min-w-0 flex-shrink-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
          <p className="text-xs text-gray-400 truncate">{student.student_id}</p>
        </div>
        {/* Class */}
        <div className="w-20 flex-shrink-0 text-sm text-gray-700 font-medium">{student.class_name}</div>
        {/* Section */}
        <div className="w-16 flex-shrink-0 text-sm text-gray-700">{student.section}</div>
        {/* Roll No */}
        <div className="w-16 flex-shrink-0 text-sm text-gray-500">#{student.roll_no || '—'}</div>
        {/* Status */}
        <div className="w-24 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[student.status] || 'bg-gray-100 text-gray-500'}`}>
            {student.status === 'Published' ? 'Active' : student.status}
          </span>
        </div>
        {/* Transport */}
        <div className="flex-1 flex-shrink-0">
          {student.transport_enabled ? (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">ON</span>
          ) : (
            <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">OFF</span>
          )}
        </div>
      </button>

      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}><Eye className="mr-2 h-4 w-4" /> View Profile</DropdownMenuItem>
            {isDeleted ? (
              <DropdownMenuItem onClick={onRestore} className="text-green-600">
                <RefreshCw className="mr-2 h-4 w-4" /> Restore Student
              </DropdownMenuItem>
            ) : (
              <>
                {locked ? (
                  <DropdownMenuItem className="text-gray-400 cursor-not-allowed" disabled>
                    <Lock className="mr-2 h-4 w-4" /> Read-only
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onArchive} className={isArchived ? 'text-green-600' : 'text-orange-600'}>
                  {isArchived ? <RotateCcw className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                  {isArchived ? 'Reactivate' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Soft Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}