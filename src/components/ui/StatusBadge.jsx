import React from 'react';
import { Badge } from "@/components/ui/badge";

const statusStyles = {
  // Workflow statuses
  'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
  'Verified': 'bg-blue-50 text-blue-700 border-blue-200',
  'Approved': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Published': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected': 'bg-red-50 text-red-700 border-red-200',
  'Draft': 'bg-slate-50 text-slate-600 border-slate-200',
  'Submitted': 'bg-purple-50 text-purple-700 border-purple-200',
  'Under Review': 'bg-orange-50 text-orange-700 border-orange-200',
  'Converted': 'bg-green-50 text-green-700 border-green-200',
  'Taken': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  
  // Student statuses
  'Passed Out': 'bg-violet-50 text-violet-700 border-violet-200',
  'Transferred': 'bg-rose-50 text-rose-700 border-rose-200',
  
  // General statuses
  'Active': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Inactive': 'bg-slate-50 text-slate-600 border-slate-200',
  'On Leave': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  
  // Attendance
  'Present': 'bg-green-50 text-green-700 border-green-200',
  'Absent': 'bg-red-50 text-red-700 border-red-200',
};

export default function StatusBadge({ status, className = '' }) {
  const style = statusStyles[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  
  return (
    <Badge 
      variant="outline" 
      className={`font-medium border ${style} ${className}`}
    >
      {status}
    </Badge>
  );
}