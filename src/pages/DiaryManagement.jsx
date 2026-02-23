import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getStaffSession } from '@/components/useStaffSession';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import DiaryForm from '@/components/diary/DiaryForm';
import DiaryList from '@/components/diary/DiaryList';

export default function DiaryManagement() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const { data: diaries = [] } = useQuery({
    queryKey: ['diaries', academicYear],
    queryFn: () => base44.entities.Diary.filter({ academic_year: academicYear }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Diary.create({
      ...data,
      posted_by: user?.email,
      posted_by_name: user?.full_name
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      setShowForm(false);
      toast.success('Diary entry posted successfully');
    },
    onError: () => toast.error('Failed to post diary entry')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Diary.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      setShowForm(false);
      setEditingEntry(null);
      toast.success('Diary entry updated successfully');
    },
    onError: () => toast.error('Failed to update diary entry')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Diary.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      toast.success('Diary entry deleted successfully');
    },
    onError: () => toast.error('Failed to delete diary entry')
  });

  const handleSubmit = (formData) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this diary entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  const userDiaries = diaries.filter(d => d.posted_by === user?.email);

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Diary Management">
      <div className="min-h-screen bg-gray-100 p-4">
        <PageHeader
          title="Class Diary"
          subtitle="Post daily class activities and assignments"
        />

        <div className="max-w-4xl mx-auto space-y-6">
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" /> New Diary Entry
            </Button>
          )}

          {showForm && (
            <DiaryForm
              entry={editingEntry}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              academicYear={academicYear}
            />
          )}

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Your Diary Entries</h3>
              <DiaryList
                entries={userDiaries.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))}
                canEdit={true}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </LoginRequired>
  );
}