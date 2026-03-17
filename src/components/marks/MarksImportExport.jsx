import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';

export default function MarksImportExport({ 
  students, 
  subjects, 
  marksData, 
  onImport, 
  examInfo 
}) {
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportExcel = async () => {
    if (students.length === 0) {
      toast.error('No students to export');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Marks');

    const headers = ['Student ID', 'Roll No', 'Name', ...subjects];
    worksheet.addRow(headers);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center' };

    // Add data rows
    students.forEach(student => {
      const row = [
        student.student_id || student.id,
        student.roll_no || '',
        student.name,
        ...subjects.map(subject => 
          marksData[student.student_id || student.id]?.[subject]?.marks_obtained || ''
        )
      ];
      worksheet.addRow(row);
    });

    // Set column widths evenly
    const colWidth = 15;
    worksheet.columns.forEach(col => {
      col.width = colWidth;
      col.alignment = { horizontal: 'center', vertical: 'center' };
    });

    // Generate buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks-${examInfo?.exam || 'export'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Marks exported successfully');
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        toast.error('Invalid CSV format');
        return;
      }

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const studentIdIndex = headers.findIndex(h => h.toLowerCase() === 'student id');
      const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
      
      if (studentIdIndex === -1 || nameIndex === -1) {
        toast.error('CSV must have "Student ID" and "Name" columns');
        return;
      }

      const importedData = {};
      const rowErrors = [];
      let validRowCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        if (values.length < headers.length) continue;

        const studentId = values[studentIdIndex];
        const student = students.find(s => (s.student_id || s.id) === studentId);
        
        if (!student) continue;

        importedData[studentId] = {};
        
        for (let j = 3; j < headers.length; j++) {
          const subject = headers[j];
          if (!subject) continue;
          const rawVal = values[j];
          if (!rawVal && rawVal !== '0') continue;
          const marks = parseFloat(rawVal);

          // PRIORITY 7: Validate marks against max_marks and reject negatives
          if (isNaN(marks)) {
            rowErrors.push(`Row ${i + 1}: "${rawVal}" is not a valid number for ${subject} (student ${studentId})`);
            continue;
          }
          if (marks < 0) {
            rowErrors.push(`Row ${i + 1}: Negative marks (${marks}) not allowed for ${subject} (student ${studentId})`);
            continue;
          }
          // Check against max_marks from examInfo if available
          const maxMarks = examInfo?.max_marks;
          if (maxMarks !== undefined && marks > maxMarks) {
            rowErrors.push(`Row ${i + 1}: ${marks} exceeds max marks (${maxMarks}) for ${subject} (student ${studentId})`);
            continue;
          }

          importedData[studentId][subject] = { marks_obtained: marks };
          validRowCount++;
        }
      }

      // Show all row errors clearly before proceeding
      if (rowErrors.length > 0) {
        const errorMsg = rowErrors.slice(0, 5).join('\n') + (rowErrors.length > 5 ? `\n...and ${rowErrors.length - 5} more errors` : '');
        toast.error(`Import errors:\n${errorMsg}`, { duration: 8000 });
        if (validRowCount === 0) return; // abort entirely if nothing valid
      }

      if (validRowCount === 0) {
        toast.error('No valid marks found in CSV');
        return;
      }

      onImport(importedData);
      toast.success(`Imported marks for ${Object.keys(importedData).length} students${rowErrors.length > 0 ? ` (${rowErrors.length} rows skipped due to errors)` : ''}`);
    } catch (error) {
      toast.error('Failed to import CSV');
      console.error(error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExportExcel()}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Export Excel
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImportCSV}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {isImporting ? 'Importing...' : 'Import CSV'}
      </Button>
    </div>
  );
}