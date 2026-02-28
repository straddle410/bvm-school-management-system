import React, { useState } from 'react';
import { useAcademicYear } from './AcademicYearContext';
import { ChevronDown, Lock } from 'lucide-react';

export default function AcademicYearSelector() {
  const { academicYear, setAcademicYear, academicYears, isAdmin } = useAcademicYear();
  const [open, setOpen] = useState(false);

  // Teachers see locked read-only year display
  if (!isAdmin) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-200 font-semibold px-2 py-1.5 bg-white/10 rounded-lg">
        <span>{academicYear}</span>
        <Lock className="h-3 w-3" />
      </div>
    );
  }

  if (academicYears.length === 0) {
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
            {academicYears.map(y => (
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