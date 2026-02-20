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
  const [academicYear, setAcademicYearState] = useState(
    () => localStorage.getItem('selected_academic_year') || getDefaultYear()
  );
  const [academicYears, setAcademicYears] = useState([]);

  useEffect(() => {
    base44.entities.AcademicYear.list('-start_date').then(years => {
      setAcademicYears(years);
      if (!localStorage.getItem('selected_academic_year') && years.length > 0) {
        const current = years.find(y => y.is_current) || years[0];
        setAcademicYearState(current.year);
        localStorage.setItem('selected_academic_year', current.year);
      }
    }).catch(() => {});
  }, []);

  const setAcademicYear = (year) => {
    setAcademicYearState(year);
    localStorage.setItem('selected_academic_year', year);
  };

  return (
    <AcademicYearContext.Provider value={{ academicYear, setAcademicYear, academicYears }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) {
    return {
      academicYear: localStorage.getItem('selected_academic_year') || getDefaultYear(),
      setAcademicYear: () => {},
      academicYears: []
    };
  }
  return ctx;
}