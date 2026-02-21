import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import ExamTypeManager from '@/components/hallTicket/ExamTypeManager';
import TimetableManager from '@/components/hallTicket/TimetableManager';
import HallTicketGenerator from '@/components/hallTicket/HallTicketGenerator';
import HallTicketList from '@/components/hallTicket/HallTicketList';
import TemplateUploader from '@/components/hallTicket/TemplateUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function HallTicketManagement() {
  const [user, setUser] = useState(null);
  const { academicYear } = useAcademicYear();

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

  // Only admin can access this page
  if (user && user.role !== 'admin') {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 font-semibold">Access Denied: Only administrators can manage hall tickets</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <PageHeader
        title="Exam Hall Ticket Management"
        subtitle={`Academic Year: ${academicYear}`}
      />

      <div className="mt-6">
        <Tabs defaultValue="exam-types" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="exam-types">Exam Types</TabsTrigger>
            <TabsTrigger value="timetable">Timetable</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>

          <TabsContent value="exam-types" className="mt-6">
            <ExamTypeManager />
          </TabsContent>

          <TabsContent value="timetable" className="mt-6">
            <TimetableManager />
          </TabsContent>

          <TabsContent value="generate" className="mt-6">
            <div className="space-y-6">
              <HallTicketGenerator />
            </div>
          </TabsContent>

          <TabsContent value="manage" className="mt-6">
            <div className="space-y-6">
              <HallTicketList />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}