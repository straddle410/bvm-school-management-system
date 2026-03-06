import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getStaffSession } from '@/components/useStaffSession';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, FileText, Mail, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function ReportsManagement() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    report_type: 'Monthly Attendance',
    class_name: '',
    section: 'A',
    start_date: '',
    end_date: '',
    scheduled_date: '',
    include_in_email: true,
    delivery_recipients: '',
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const { data: reports = [] } = useQuery({
    queryKey: ['scheduled-reports', academicYear],
    queryFn: () => base44.entities.ScheduledReport.filter({ academic_year: academicYear }),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', formData.class_name, formData.section, academicYear],
    queryFn: () =>
      formData.class_name
        ? base44.entities.Student.filter({
            class_name: formData.class_name,
            section: formData.section,
            academic_year: academicYear,
            status: 'Published',
            is_deleted: false
          })
        : [],
    enabled: !!formData.class_name && !!academicYear
  });

  const createMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.ScheduledReport.create({
        ...data,
        academic_year: academicYear,
        created_by: user?.email,
        delivery_recipients: data.delivery_recipients
          .split(',')
          .map((e) => e.trim())
          .filter((e) => e),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setShowForm(false);
      setFormData({
        report_type: 'Monthly Attendance',
        class_name: '',
        section: 'A',
        start_date: '',
        end_date: '',
        scheduled_date: '',
        include_in_email: true,
        delivery_recipients: '',
      });
      toast.success('Report scheduled successfully');
    },
    onError: () => toast.error('Failed to schedule report'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success('Report deleted');
    },
  });

  const generateMutation = useMutation({
    mutationFn: (id) =>
      base44.functions.invoke('generateScheduledReport', { report_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success('Report generated and scheduled for delivery');
    },
    onError: () => toast.error('Failed to generate report'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.class_name || !formData.start_date || !formData.end_date) {
      toast.error('Please fill all required fields');
      return;
    }
    createMutation.mutate(formData);
  };

  const statusColor = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Generated: 'bg-blue-100 text-blue-800',
    Sent: 'bg-green-100 text-green-800',
    Failed: 'bg-red-100 text-red-800',
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Reports">
      <div className="min-h-screen bg-gray-100 p-4">
        <PageHeader
          title="Report Management"
          subtitle="Schedule monthly attendance and term-end progress reports"
        />

        <div className="max-w-5xl mx-auto space-y-6">
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Schedule New Report
            </Button>
          )}

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Schedule Report</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Report Type *</label>
                      <Select
                        value={formData.report_type}
                        onValueChange={(val) =>
                          setFormData({ ...formData, report_type: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly Attendance">Monthly Attendance</SelectItem>
                          <SelectItem value="Term-End Progress">Term-End Progress</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Class *</label>
                      <Select
                        value={formData.class_name}
                        onValueChange={(val) =>
                          setFormData({ ...formData, class_name: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent>
                          {CLASSES.map((c) => (
                            <SelectItem key={c} value={c}>
                              Class {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Section</label>
                      <Select
                        value={formData.section}
                        onValueChange={(val) => setFormData({ ...formData, section: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Start Date *</label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({ ...formData, start_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">End Date *</label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, end_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Schedule Date</label>
                      <Input
                        type="date"
                        value={formData.scheduled_date}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduled_date: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Email Recipients (comma-separated)
                    </label>
                    <Input
                      placeholder="parent@email.com, teacher@email.com"
                      value={formData.delivery_recipients}
                      onChange={(e) =>
                        setFormData({ ...formData, delivery_recipients: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="email"
                      checked={formData.include_in_email}
                      onChange={(e) =>
                        setFormData({ ...formData, include_in_email: e.target.checked })
                      }
                    />
                    <label htmlFor="email" className="text-sm font-medium">
                      Send as Email Attachment
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      Schedule Report
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No reports scheduled yet</p>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold">{report.report_type}</span>
                          <Badge
                            className={statusColor[report.status]}
                            variant="outline"
                          >
                            {report.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          Class {report.class_name}-{report.section} • {format(new Date(report.start_date), 'MMM d')} to {format(new Date(report.end_date), 'MMM d, yyyy')}
                        </p>
                        {report.delivery_recipients?.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            <Mail className="h-3 w-3 inline mr-1" />
                            {report.delivery_recipients.length} recipients
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {report.status === 'Pending' && (
                          <Button
                            size="sm"
                            onClick={() => generateMutation.mutate(report.id)}
                            disabled={generateMutation.isPending}
                          >
                            Generate
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Delete this report?')) {
                              deleteMutation.mutate(report.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </LoginRequired>
  );
}