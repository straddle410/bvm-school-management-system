import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AcademicYearContext = createContext(null);

const getDefaultYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`;
  } else {
    return `${year - 1}-${String(year).slice(2)}`;
  }
};

export function AcademicYearProvider({ children }) {
  const [academicYear, setAcademicYearState] = useState(() => {
    try {
      const saved = localStorage.getItem('selected_academic_year');
      return saved || getDefaultYear();
    } catch {
      return getDefaultYear();
    }
  });
  const [academicYears, setAcademicYears] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Step 1: Resolve role fully before anything else (no race condition)
      let resolvedRole = null;
      
      // CRITICAL: Check student_session FIRST — students never call base44.auth.me()
      try {
        const studentSession = localStorage.getItem('student_session');
        if (studentSession) {
          // Student session exists — skip all Base44 auth calls
          resolvedRole = 'student'; // Students are never admin
          setIsAdmin(false);
          setRoleLoaded(true);
          // Load years with no role requirement
          try {
            const allYears = await base44.entities.AcademicYear.list('-start_date');
            const seen = new Set();
            const years = allYears
              .filter(y => (y.status || '').toLowerCase() !== 'archived')
              .filter(y => { if (seen.has(y.year)) return false; seen.add(y.year); return true; });
            setAcademicYears(years);
            const saved = localStorage.getItem('selected_academic_year') || getDefaultYear();
            setAcademicYearState(saved);
          } catch {}
          return; // Exit early — don't call auth.me()
        }
      } catch {}

      // Staff/Admin: Check staff_session
      try {
        const session = localStorage.getItem('staff_session');
        if (session) {
          const parsed = JSON.parse(session);
          resolvedRole = (parsed?.role || '').trim().toLowerCase();
        }
      } catch {}

      // Only call auth.me() if NO student_session AND NO staff_session
      if (!resolvedRole) {
        // HARD BLOCK: Double-check student_session NOT in sessionStorage either
        try {
          const studentSessionSession = sessionStorage.getItem('student_session');
          if (studentSessionSession) {
            resolvedRole = 'student'; // Student in sessionStorage — skip auth.me()
          }
        } catch {}
        
        if (!resolvedRole) {
          try {
            const isAuth = await base44.auth.isAuthenticated();
            if (isAuth) {
              const user = await base44.auth.me();
              resolvedRole = (user?.role || '').trim().toLowerCase();
            }
          } catch (error) {
            console.error('[AcademicYearContext] auth.me() error:', error.message);
          }
        }
      }

      const adminAccess = resolvedRole === 'admin' || resolvedRole === 'principal';
      setIsAdmin(adminAccess);
      setRoleLoaded(true); // Role is now fully known — safe to render selector

      // Step 2: Load years with resolved role
      try {
        const allYears = await base44.entities.AcademicYear.list('-start_date');
        // Filter out archived, then dedupe by year string (keep first occurrence = latest start_date)
        const seen = new Set();
        const years = allYears
          .filter(y => (y.status || '').toLowerCase() !== 'archived')
          .filter(y => { if (seen.has(y.year)) return false; seen.add(y.year); return true; });
        setAcademicYears(years);

        if (!adminAccess) {
          // TEACHER LOCK: Always force Active year, ignore localStorage
          const activeYear = years.find(y => y.status === 'Active');
          if (activeYear) {
            setAcademicYearState(activeYear.year);
            localStorage.setItem('selected_academic_year', activeYear.year);
          }
        } else {
          // ADMIN/PRINCIPAL: Honour saved selection or fall back to current year
          const saved = localStorage.getItem('selected_academic_year');
          const yearExists = years.find(y => y.year === saved);
          if (yearExists) {
            setAcademicYearState(saved);
          } else {
            const currentYear = years.find(y => y.is_current) || years[0];
            if (currentYear) {
              setAcademicYearState(currentYear.year);
              localStorage.setItem('selected_academic_year', currentYear.year);
            }
          }
        }
      } catch {}
    };

    init();

    // Subscribe to AcademicYear changes
    const unsubscribe = base44.entities.AcademicYear.subscribe(() => {
      base44.entities.AcademicYear.list('-start_date').then(setAcademicYears).catch(() => {});
    });

    return unsubscribe;
  }, []);

  const setAcademicYear = (year) => {
    // Only admin can change the year
    if (!isAdmin) return;
    setAcademicYearState(year);
    localStorage.setItem('selected_academic_year', year);
  };

  return (
    <AcademicYearContext.Provider value={{ academicYear, setAcademicYear, academicYears, isAdmin, roleLoaded }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) {
    return {
      academicYear: getDefaultYear(),
      setAcademicYear: () => {},
      academicYears: [],
      isAdmin: false,
      roleLoaded: false
    };
  }
  return ctx;
}