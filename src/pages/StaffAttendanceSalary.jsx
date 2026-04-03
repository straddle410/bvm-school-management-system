import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { CalendarDays, IndianRupee } from 'lucide-react';
import StaffAttendanceTab from '@/components/staffSalary/StaffAttendanceTab';
import StaffSalaryTab from '@/components/staffSalary/StaffSalaryTab';

export default function StaffAttendanceSalary() {
  const { academicYear } = useAcademicYear();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Attendance & Salary</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Academic Year: {academicYear}</p>
        </div>

        <Tabs defaultValue="attendance">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="attendance" className="flex-1 gap-2">
              <CalendarDays className="h-4 w-4" /> Attendance
            </TabsTrigger>
            <TabsTrigger value="salary" className="flex-1 gap-2">
              <IndianRupee className="h-4 w-4" /> Salary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <StaffAttendanceTab academicYear={academicYear} />
          </TabsContent>

          <TabsContent value="salary">
            <StaffSalaryTab academicYear={academicYear} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}