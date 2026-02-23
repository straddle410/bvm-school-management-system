import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';
import ExamTypeManager from '@/components/hallTicket/ExamTypeManager';
import TimetableManager from '@/components/hallTicket/TimetableManager';
import HallTicketGenerator from '@/components/hallTicket/HallTicketGenerator';
import HallTicketList from '@/components/hallTicket/HallTicketList';
import ProgressCardGenerator from '@/components/hallTicket/ProgressCardGenerator';

export default function ExamManagement() {
  const [user, setUser] = useState(null);
  const { academicYear, isAdmin } = useAcademicYear();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        console.error('Failed to load user');
      }
    };
    loadUser();
  }, []);

  // Only admin can access Exam Types and Timetable tabs
  const canManageExams = isAdmin || (user && user.role === 'admin');

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <PageHeader
        title="Exam Management"
        subtitle={`Academic Year: ${academicYear}`}
      />

      <div className="mt-6">
        <Tabs defaultValue="marks-entry" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2 h-auto">
            {canManageExams && <TabsTrigger value="exam-types">Exam Types</TabsTrigger>}
            <TabsTrigger value="marks-entry">Marks Entry</TabsTrigger>
            <TabsTrigger value="review-marks">Review Marks</TabsTrigger>
            <TabsTrigger value="hall-tickets">Hall Tickets</TabsTrigger>
            <TabsTrigger value="progress-cards">Progress Cards</TabsTrigger>
          </TabsList>

          {canManageExams && (
            <TabsContent value="exam-types" className="mt-6">
              <ExamTypeManager isAdmin={canManageExams} />
            </TabsContent>
          )}

          <TabsContent value="marks-entry" className="mt-6">
            <ExamTypeManager isAdmin={canManageExams} showAddButton={false} />
          </TabsContent>

          <TabsContent value="review-marks" className="mt-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Review Marks</h2>
              <p className="text-slate-600">Review marks functionality coming soon...</p>
            </div>
          </TabsContent>

          <TabsContent value="hall-tickets" className="mt-6">
            <div className="space-y-6">
              <HallTicketGenerator />
              <HallTicketList />
            </div>
          </TabsContent>

          <TabsContent value="progress-cards" className="mt-6">
            <ProgressCardGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}