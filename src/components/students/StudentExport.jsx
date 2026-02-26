import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentExport({ students, academicYear }) {
  const [loading, setLoading] = useState(false);

  const downloadCSV = () => {
    if (students.length === 0) {
      toast.error('No students to export');
      return;
    }

    setLoading(true);
    try {
      const headers = ['student_id', 'name', 'class_name', 'section', 'roll_no', 'parent_name', 'parent_phone', 'parent_email', 'dob', 'gender', 'address', 'blood_group', 'admission_date', 'status'];
      
      const rows = students.map(s => [
        s.student_id || '',
        s.name || '',
        s.class_name || '',
        s.section || '',
        s.roll_no || '',
        s.parent_name || '',
        s.parent_phone || '',
        s.parent_email || '',
        s.dob || '',
        s.gender || '',
        s.address || '',
        s.blood_group || '',
        s.admission_date || '',
        s.status || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `students-${academicYear}-${new Date().toISOString().split('T')[0]}.csv`);
      link.click();

      toast.success('Students exported successfully');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={downloadCSV}
      disabled={loading || students.length === 0}
      variant="outline"
      className="rounded-xl"
    >
      <Download className="h-4 w-4 mr-1" />
      Export ({students.length})
    </Button>
  );
}