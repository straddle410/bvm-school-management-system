import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import ExamTypeManager from '@/components/hallTicket/ExamTypeManager';
import TimetableManager from '@/components/hallTicket/TimetableManager';
import HallTicketGenerator from '@/components/hallTicket/HallTicketGenerator';
import HallTicketList from '@/components/hallTicket/HallTicketList';
import ProgressCardsList from '@/components/hallTicket/ProgressCardsList';
import ExamTypeProgressCardGenerator from '@/components/hallTicket/ExamTypeProgressCardGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function HallTicketManagement() {
  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Hall Ticket Management">
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <PageHeader
        title="Exam Hall Ticket Management"
        subtitle={`Academic Year: ${academicYear}`}
      />

      <div className="mt-6">
        <Tabs defaultValue="exam-types" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="exam-types">Exam Types</TabsTrigger>
            <TabsTrigger value="timetable">Timetable</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="progress-cards">Progress Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="exam-types" className="mt-6">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Exams & Marks</h2>
                    <p className="text-slate-600 text-sm mt-1">Manage exam types and enter marks</p>
                  </div>
                </div>
              </div>
              <ExamTypeManager />
            </div>
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

          <TabsContent value="progress-cards" className="mt-6">
            <div className="space-y-6">
              <ExamTypeProgressCardGenerator />
              <ProgressCardsList />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </LoginRequired>
  );
}