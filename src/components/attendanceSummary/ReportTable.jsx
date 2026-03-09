import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { exportToExcel, exportToPDF } from '@/components/attendanceSummary/exportUtils';

export default function ReportTable({ data, searchTerm, setSearchTerm, sortBy, setSortBy, fromDate, toDate }) {
  const handleHeaderClick = (field) => {
    if (sortBy === field) {
      setSortBy(`${field}-desc`); // Toggle to descending
    } else if (sortBy === `${field}-desc`) {
      setSortBy('name'); // Reset to default
    } else {
      setSortBy(field);
    }
  };

  const handleExcelExport = async () => {
    try {
      const filename = `Attendance_Report_${format(new Date(fromDate), 'dd-MMM-yyyy')}_to_${format(new Date(toDate), 'dd-MMM-yyyy')}.xlsx`;
      await exportToExcel(data, filename, fromDate, toDate);
      toast.success('Exported to Excel');
    } catch (err) {
      toast.error('Failed to export Excel');
    }
  };

  const handlePDFExport = async () => {
    try {
      const filename = `Attendance_Report_${format(new Date(fromDate), 'dd-MMM-yyyy')}_to_${format(new Date(toDate), 'dd-MMM-yyyy')}.pdf`;
      await exportToPDF(data, filename, fromDate, toDate);
      toast.success('Exported to PDF');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Attendance Report</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleExcelExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handlePDFExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Sort Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search student name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="attendance-asc">Attendance ↑ Low to High</SelectItem>
              <SelectItem value="attendance-desc">Attendance ↓ High to Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-sm text-slate-600 flex items-center">
            Showing {data.length} student{data.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th onClick={() => handleHeaderClick('name')} className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center gap-2">
                    Student Name
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
                <th onClick={() => handleHeaderClick('rollNo')} className="px-4 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center justify-center gap-2">
                    Roll No
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
                <th onClick={() => handleHeaderClick('class')} className="px-4 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center justify-center gap-2">
                    Class
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
                <th onClick={() => handleHeaderClick('totalWorkingDays')} className="px-4 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center justify-center gap-2">
                    Working Days
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
                <th onClick={() => handleHeaderClick('totalHolidays')} className="px-4 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center justify-center gap-2">
                    Holidays
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
                <th onClick={() => handleHeaderClick('presentDays')} className="px-4 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center justify-center gap-2">
                    Present
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
                <th onClick={() => handleHeaderClick('absentDays')} className="px-4 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center justify-center gap-2">
                    Absent
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
                <th onClick={() => handleHeaderClick('attendance-desc')} className="px-4 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group">
                  <div className="flex items-center justify-center gap-2">
                    Attendance %
                    <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((student) => {
                const isLowAttendance = student.attendancePercent < 75;
                return (
                  <tr key={student.id} className={`border-b transition-colors ${isLowAttendance ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3 text-slate-900 font-medium">{student.name}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{student.rollNo}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{student.class}-{student.section}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{student.totalWorkingDays}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{student.totalHolidays}</td>
                    <td className="px-4 py-3 text-center font-medium text-green-600">{student.presentDays}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-600">{student.absentDays}</td>
                    <td className={`px-4 py-3 text-center font-bold ${isLowAttendance ? 'text-red-600 bg-red-100' : 'text-green-600'}`}>
                      {student.attendancePercent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No students match your search
          </div>
        )}
      </CardContent>
    </Card>
  );
}