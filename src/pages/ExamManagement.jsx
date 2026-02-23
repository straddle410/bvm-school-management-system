import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { useAcademicYear } from '@/components/AcademicYearContext';
import ProgressCardGenerator from '@/components/hallTicket/ProgressCardGenerator';

export default function ExamManagement() {
  const [user, setUser] = useState(null);
  const { academicYear } = useAcademicYear();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const session = localStorage.getItem('staff_session');
        if (session) {
          setUser(JSON.parse(session));
          return;
        }
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        console.error('Failed to load user');
      }
    };
    loadUser();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <PageHeader
        title="Exam Management"
        subtitle={`Academic Year: ${academicYear}`}
      />

      <div className="mt-6">
        <ProgressCardGenerator />
      </div>
    </div>
  );
}