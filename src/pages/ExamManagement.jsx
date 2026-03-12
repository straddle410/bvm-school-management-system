import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';
import ProgressCardGenerator from '@/components/hallTicket/ProgressCardGenerator';
import ProgressCardsList from '@/components/hallTicket/ProgressCardsList';

export default function ExamManagement() {
  const { academicYear } = useAcademicYear();

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'exam_staff']} pageName="Exam Management">
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-6">
      <PageHeader
        title="Exam Management"
        subtitle={`Academic Year: ${academicYear}`}
      />

      <div className="mt-6">
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate Cards</TabsTrigger>
            <TabsTrigger value="view">View Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-6">
            <ProgressCardGenerator />
          </TabsContent>

          <TabsContent value="view" className="mt-6">
            <ProgressCardsList />
          </TabsContent>
        </Tabs>
        </div>
        </div>
        </LoginRequired>
  );
}