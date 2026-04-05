import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { CalendarDays, IndianRupee, Settings2, Clock, BarChart2 } from 'lucide-react';
import StaffAttendanceReportTab from '@/components/staffSalary/StaffAttendanceReportTab';
import SalarySetupTab from '@/components/staffSalary/SalarySetupTab';
import StaffAttendanceTab from '@/components/staffSalary/StaffAttendanceTab';
import StaffSalaryTab from '@/components/staffSalary/StaffSalaryTab';
import KioskSettingsTab from '@/components/staffSalary/KioskSettingsTab';

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
          <TabsList className="w-full mb-4 grid grid-cols-5">
            <TabsTrigger value="attendance" className="gap-1 text-xs">
              <CalendarDays className="h-4 w-4" /> Attendance
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1 text-xs">
              <BarChart2 className="h-4 w-4" /> Report
            </TabsTrigger>
            <TabsTrigger value="salary" className="gap-1 text-xs">
              <IndianRupee className="h-4 w-4" /> Salary
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-1 text-xs">
              <Settings2 className="h-4 w-4" /> Setup
            </TabsTrigger>
            <TabsTrigger value="kiosk" className="gap-1 text-xs">
              <Clock className="h-4 w-4" /> Kiosk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <StaffAttendanceTab academicYear={academicYear} />
          </TabsContent>

          <TabsContent value="report">
            <StaffAttendanceReportTab academicYear={academicYear} />
          </TabsContent>

          <TabsContent value="salary">
            <StaffSalaryTab academicYear={academicYear} />
          </TabsContent>

          <TabsContent value="setup">
            <SalarySetupTab academicYear={academicYear} />
          </TabsContent>

          <TabsContent value="kiosk">
            <KioskSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}