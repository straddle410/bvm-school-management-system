import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function MarksImportExport({ 
  students, 
  subjects, 
  marksData, 
  onImport, 
  examInfo 
}) {
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportCSV = () => {
    if (students.length === 0) {
      toast.error('No students to export');
      return;
    }

    const headers = ['Student ID', 'Roll No', 'Name', ...subjects];
    const rows = students.map(student => [
      student.student_id || student.id,
      student.roll_no || '',
      student.name,
      ...subjects.map(subject => 
        marksData[student.student_id || student.id]?.[subject]?.marks_obtained || ''
      )
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks-${examInfo?.exam || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
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
          const marks = values[j] ? parseFloat(values[j]) : undefined;
          if (!isNaN(marks)) {
            importedData[studentId][subject] = { marks_obtained: marks };
            validRowCount++;
          }
        }
      }

      if (validRowCount === 0) {
        toast.error('No valid marks found in CSV');
        return;
      }

      onImport(importedData);
      toast.success(`Imported marks for ${Object.keys(importedData).length} students`);
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
        onClick={handleExportCSV}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Export CSV
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