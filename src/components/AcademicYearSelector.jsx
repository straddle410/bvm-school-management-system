import React, { useState } from 'react';
import { useAcademicYear } from './AcademicYearContext';
import { ChevronDown, Lock } from 'lucide-react';

export default function AcademicYearSelector() {
  const { academicYear, setAcademicYear, academicYears, isAdmin, roleLoaded } = useAcademicYear();
  const [open, setOpen] = useState(false);

  // Wait until role is fully resolved — prevents dropdown flash for teachers
  if (!roleLoaded) return null;

  // Teachers/Staff: locked read-only year display, no dropdown
  if (!isAdmin) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-200 font-semibold px-2 py-1.5 bg-white/10 rounded-lg">
        <span>{academicYear}</span>
        <Lock className="h-3 w-3" />
      </div>
    );
  }

  // Dedupe by year string and exclude archived (safety net in case context still has stale data)
  const seen = new Set();
  const filteredYears = academicYears
    .filter(y => (y.status || '').toLowerCase() !== 'archived')
    .filter(y => { if (seen.has(y.year)) return false; seen.add(y.year); return true; });

  if (filteredYears.length === 0) {
    return (
      <div className="text-xs text-blue-200 font-medium px-2 py-1 bg-white/10 rounded-lg">
        {academicYear}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-white font-semibold px-2 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
      >
        <span>{academicYear}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-28 overflow-hidden">
            {filteredYears.map(y => (
              <button
                key={y.id}
                onClick={() => { setAcademicYear(y.year); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-blue-50 transition-colors ${
                  y.year === academicYear ? 'text-[#1a237e] bg-blue-50 font-bold' : 'text-gray-700'
                }`}
              >
                {y.year}
                {y.is_current && <span className="ml-1 text-xs text-green-600">(current)</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}