import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from "sonner";

export default function HolidayCalendar() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [formData, setFormData] = useState({ date: '', title: '', reason: '' });
  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', academicYear],
    queryFn: () => base44.entities.Holiday.filter({ academic_year: academicYear, status: 'Active' })
  });

  const { data: staffAccount } = useQuery({
    queryKey: ['staff-account', user?.email],
    queryFn: () => base44.entities.StaffAccount.filter({ email: user?.email }),
    enabled: !!user?.email
  });

  const canManageHolidays = staffAccount?.[0]?.permissions?.manage_holidays || user?.role === 'admin';

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Holiday.create({
      ...data,
      marked_by: user?.email,
      academic_year: academicYear,
      status: 'Active'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      base44.entities.AuditLog.create({
        action: 'holiday_marked',
        module: 'Holiday',
        date: formData.date,
        performed_by: user?.email,
        details: `Marked ${formData.title} as holiday`,
        academic_year: academicYear
      });
      toast.success('Holiday added');
      setShowForm(false);
      setFormData({ date: '', title: '', reason: '' });
    },
    onError: () => toast.error('Failed to add holiday')
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Holiday.update(editingHoliday.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      base44.entities.AuditLog.create({
        action: 'holiday_edited',
        module: 'Holiday',
        date: formData.date,
        performed_by: user?.email,
        details: `Updated ${formData.title}`,
        academic_year: academicYear
      });
      toast.success('Holiday updated');
      setEditingHoliday(null);
      setShowForm(false);
      setFormData({ date: '', title: '', reason: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Holiday.update(id, { status: 'Cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      base44.entities.AuditLog.create({
        action: 'holiday_removed',
        module: 'Holiday',
        performed_by: user?.email,
        details: `Removed holiday`,
        academic_year: academicYear
      });
      toast.success('Holiday removed');
    }
  });

  const handleSubmit = () => {
    if (!formData.date || !formData.title) {
      toast.error('Date and title are required');
      return;
    }
    if (editingHoliday) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({ date: holiday.date, title: holiday.title, reason: holiday.reason || '' });
    setShowForm(true);
  };

  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher']}>
      <div className="min-h-screen bg-slate-50">
        <PageHeader title="Holiday Calendar" subtitle="Manage school holidays" />
        
        {!canManageHolidays && (
          <div className="p-4 lg:p-8">
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">You don't have permission to manage holidays. Contact your admin.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {canManageHolidays && (
          <div className="p-4 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Active Holidays</h2>
              <Button onClick={() => { setEditingHoliday(null); setFormData({ date: '', title: '', reason: '' }); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Holiday
              </Button>
            </div>

            {showForm && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Date</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Holiday Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Diwali"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Reason</label>
                    <input
                      type="text"
                      placeholder="Optional reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm w-full"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSubmit}>{editingHoliday ? 'Update' : 'Add'} Holiday</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {sortedHolidays.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center text-slate-400">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No holidays marked yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {sortedHolidays.map((holiday) => (
                  <Card key={holiday.id} className="border-0 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{holiday.title}</p>
                          <p className="text-sm text-slate-500">{format(parseISO(holiday.date), 'MMM dd, yyyy')} • {holiday.reason || 'No reason'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(holiday)}>
                          <Edit2 className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(holiday.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </LoginRequired>
  );
}