import React, { useState, useRef, useEffect } from 'react';
import { useAcademicYear } from './AcademicYearContext';
import { ChevronDown, Lock } from 'lucide-react';

export default function AcademicYearSelector() {
  const { academicYear, setAcademicYear, academicYears, isAdmin, roleLoaded } = useAcademicYear();
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }, [open]);

  // Wait until role is fully resolved — prevents dropdown flash for teachers
  if (!roleLoaded) return null;

  // Dedupe by year string
  const seen = new Set();
  let displayYears = academicYears.filter(y => { if (seen.has(y.year)) return false; seen.add(y.year); return true; });

  // Staff: locked read-only current year only, no dropdown
  if (!isAdmin) {
    const currentYear = displayYears.find(y => y.is_current === true);
    displayYears = currentYear ? [currentYear] : [];
    if (currentYear) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-blue-200 font-semibold px-2 py-1.5 bg-white/10 rounded-lg">
          <span>{academicYear}</span>
          <span className="text-[10px] text-green-300 font-bold">(Current)</span>
          <Lock className="h-3 w-3" />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-200 font-semibold px-2 py-1.5 bg-white/10 rounded-lg">
        <span>{academicYear}</span>
        <Lock className="h-3 w-3" />
      </div>
    );
  }

  // Admin: show all years (including archived) so admin can review past data
  // displayYears already contains all years — no filtering needed

  if (displayYears.length === 0) {
    return (
      <div className="text-xs text-blue-200 font-medium px-2 py-1 bg-white/10 rounded-lg">
        {academicYear}
      </div>
    );
  }

  return (
    <div className="flex-shrink-0">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-white font-semibold px-2 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-colors whitespace-nowrap"
      >
        <span>{academicYear}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div
            className="fixed bg-white rounded-xl shadow-xl border border-gray-100 min-w-40 overflow-hidden"
            style={{ top: dropdownPos.top + 8, right: dropdownPos.right, zIndex: 9999 }}
          >
            {displayYears.map(y => (
              <button
                key={y.id}
                onClick={() => { setAcademicYear(y.year); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-blue-50 transition-colors ${
                  y.year === academicYear ? 'text-[#1a237e] bg-blue-50 font-bold' : 'text-gray-700'
                }`}
              >
                <span>{y.year}</span>
                {y.is_current && <span className="ml-2 text-xs font-bold text-green-600">[Current]</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}