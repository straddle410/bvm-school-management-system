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
  const [academicYear, setAcademicYearState] = useState(getDefaultYear());
  const [academicYears, setAcademicYears] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin via base44 auth OR staff session in localStorage
    const checkAdmin = async () => {
      // First check staff session (custom login) - no network call needed
      try {
        const session = localStorage.getItem('staff_session');
        if (session) {
          const parsed = JSON.parse(session);
          const role = parsed?.role || '';
          if (role === 'Admin' || role === 'admin' || role === 'Principal' || role === 'principal') {
            setIsAdmin(true); return;
          }
        }
      } catch {}
      // Fallback: check base44 auth (only if no staff session)
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          if (user?.role === 'admin' || user?.role === 'principal') { setIsAdmin(true); return; }
        }
      } catch {}
      setIsAdmin(false);
    };
    checkAdmin();

    // Load academic years and set the current one
    base44.entities.AcademicYear.list('-start_date').then(years => {
      setAcademicYears(years);
      // Always default to the admin-set current year
      const currentYear = years.find(y => y.is_current) || years[0];
      if (currentYear) {
        setAcademicYearState(currentYear.year);
      }
    }).catch(() => {});
  }, []);

  const setAcademicYear = (year) => {
    // Only admin can change the year
    if (!isAdmin) return;
    setAcademicYearState(year);
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