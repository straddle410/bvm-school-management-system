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
    // Load from localStorage if available, otherwise use default
    try {
      const saved = localStorage.getItem('selected_academic_year');
      return saved || getDefaultYear();
    } catch {
      return getDefaultYear();
    }
  });
  const [academicYears, setAcademicYears] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin via base44 auth OR staff session in localStorage
    let userRole = null;
    const checkAdmin = async () => {
      // First check staff session (custom login) - no network call needed
      try {
        const session = localStorage.getItem('staff_session');
        if (session) {
          const parsed = JSON.parse(session);
          userRole = parsed?.role?.toLowerCase() || '';
          if (userRole === 'admin' || userRole === 'principal') {
            setIsAdmin(true); return;
          }
        }
      } catch {}
      // Fallback: check base44 auth (only if no staff session)
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          userRole = user?.role?.toLowerCase() || '';
          if (userRole === 'admin' || userRole === 'principal') { setIsAdmin(true); return; }
        }
      } catch {}
      setIsAdmin(false);
    };
    checkAdmin();

    // Load academic years and set the current one
    const loadYears = async () => {
      const years = await base44.entities.AcademicYear.list('-start_date');
      setAcademicYears(years);
      
      // TEACHER LOCK: Teachers MUST use Active year only
      if (userRole && userRole !== 'admin' && userRole !== 'principal') {
        const activeYear = years.find(y => y.status === 'Active');
        if (activeYear) {
          setAcademicYearState(activeYear.year);
          localStorage.setItem('selected_academic_year', activeYear.year);
        }
        return;
      }

      // ADMIN/PRINCIPAL: Can use saved selection or fallback to current year
      const saved = localStorage.getItem('selected_academic_year');
      const yearExists = years.find(y => y.year === saved);
      if (yearExists) {
        setAcademicYearState(saved);
      } else {
        // If saved year doesn't exist, use admin-set current year
        const currentYear = years.find(y => y.is_current) || years[0];
        if (currentYear) {
          setAcademicYearState(currentYear.year);
          localStorage.setItem('selected_academic_year', currentYear.year);
        }
      }
    };
    
    loadYears().catch(() => {});

    // Subscribe to AcademicYear changes - react when admin changes current year
    const unsubscribe = base44.entities.AcademicYear.subscribe((event) => {
      loadYears().catch(() => {});
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
    <AcademicYearContext.Provider value={{ academicYear, setAcademicYear, academicYears, isAdmin }}>
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
      isAdmin: false
    };
  }
  return ctx;
}