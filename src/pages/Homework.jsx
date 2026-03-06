import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getStaffSession } from '@/components/useStaffSession';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getSubjectsForClass } from '@/components/subjectHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, BookMarked, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import LoginRequired from '@/components/LoginRequired';
import { format } from 'date-fns';

export default function Homework() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    class_name: '',
    section: 'A',
    subject_id: '',
    subject_name: '',
    due_date: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();

  useEffect(() => {
    const staffData = getStaffSession();
    setUser(staffData);
  }, []);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', academicYear, form.class_name],
    queryFn: async () => {
      console.log('[SUBJECT_CALLSITE] pages/Homework:39');
      if (!form.class_name || !academicYear) return [];
      const result = await getSubjectsForClass(academicYear, form.class_name);
      return result.subjects.map(name => ({ id: name, name }));
    },
    enabled: !!form.class_name && !!academicYear,
  });

  const { data: homeworkList = [], isLoading } = useQuery({
    queryKey: ['homework', academicYear],
    queryFn: () => base44.entities.Homework.filter({ academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Homework.create({ ...data, assigned_by: user?.name, status: 'Draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setShowForm(false);
      resetForm();
      toast.success('Homework saved as Draft');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Homework.update(editingItem.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setShowForm(false);
      setEditingItem(null);
      resetForm();
      toast.success('Homework updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Homework.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      toast.success('Homework deleted');
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ homework_ids, status }) => base44.functions.invoke('bulkUpdateHomeworkStatus', { homework_ids, status }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setSelected(new Set());
      const action = res.data.status === 'Published' ? 'Published' : 'Moved to Draft';
      toast.success(`${action} ${res.data.updated_count} homework items`);
    },
  });

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      class_name: '',
      section: 'A',
      subject_id: '',
      subject_name: '',
      due_date: '',
    });
    setFormErrors({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.subject_id) errors.subject = 'Please select a subject';
    if (!form.title) errors.title = 'Title is required';
    if (!form.description) errors.description = 'Description is required';
    if (!form.class_name) errors.class = 'Class is required';
    if (!form.due_date) errors.due_date = 'Due date is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      title: form.title,
      description: form.description,
      class_name: form.class_name,
      section: form.section,
      subject: form.subject_name,
      due_date: form.due_date,
      academic_year: academicYear,
    };
    console.log('HOMEWORK_PAYLOAD', payload);
    
    if (editingItem) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description,
      class_name: item.class_name,
      section: item.section || 'A',
      subject_id: item.subject_id || '',
      subject_name: item.subject_name || '',
      due_date: item.due_date,
    });
    setShowForm(true);
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === homeworkList.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(homeworkList.map(hw => hw.id)));
    }
  };

  const handleBulkPublish = () => {
    setBulkActionLoading(true);
    bulkStatusMutation.mutate({ homework_ids: Array.from(selected), status: 'Published' });
    setBulkActionLoading(false);
  };

  const handleBulkUnpublish = () => {
    setBulkActionLoading(true);
    bulkStatusMutation.mutate({ homework_ids: Array.from(selected), status: 'Draft' });
    setBulkActionLoading(false);
  };

  const handleQuickPublish = (id) => {
    bulkStatusMutation.mutate({ homework_ids: [id], status: 'Published' });
  };

  const handleQuickUnpublish = (id) => {
    bulkStatusMutation.mutate({ homework_ids: [id], status: 'Draft' });
  };

  const classes = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher']} pageName="Homework">
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <BookMarked className="h-8 w-8 text-purple-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Homework</h1>
                <p className="text-gray-600 text-sm">Manage and assign homework</p>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingItem(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Homework
            </Button>
          </div>

          {/* Bulk Action Bar */}
          {selected.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-900">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkPublish}
                  size="sm"
                  className="text-xs bg-green-600 hover:bg-green-700"
                  disabled={bulkActionLoading}
                >
                  Publish Selected
                </Button>
                <Button
                  onClick={handleBulkUnpublish}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={bulkActionLoading}
                >
                  Move to Draft
                </Button>
                <Button
                  onClick={() => setSelected(new Set())}
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : homeworkList.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <BookMarked className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No homework assigned yet</p>
              <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" /> Create First Homework
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {homeworkList.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          Class {item.class_name}-{item.section}
                        </span>
                        {item.subject_name && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{item.subject_name}</span>
                        )}
                        {item.due_date && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                            Due: {format(new Date(item.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEdit(item)}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => {
                          if (confirm('Delete this homework?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        size="sm"
                        variant="destructive"
                        className="text-xs"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  ))}
                  </div>
                  </>
                  )}

          {/* Form Dialog */}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Homework' : 'Add Homework'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Chapter 5 Exercises"
                    required
                  />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Assignment details"
                    rows={3}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Class *</Label>
                    <Select value={form.class_name} onValueChange={(v) => setForm({ ...form, class_name: v })} required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls} value={cls}>
                            Class {cls}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Section</Label>
                    <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Subject *</Label>
                  {!form.class_name ? (
                    <div className="text-xs text-gray-500 py-2 px-3 bg-gray-100 rounded-lg">
                      Select class first
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="text-xs text-red-600 py-2 px-3 bg-red-50 rounded-lg">
                      No subjects configured. Contact admin.
                    </div>
                  ) : (
                    <Select
                      value={form.subject_id}
                      onValueChange={(v) => {
                        const selected = subjects.find((s) => s.id === v);
                        setForm({ ...form, subject_id: v, subject_name: selected?.name || '' });
                        setFormErrors({ ...formErrors, subject: '' });
                      }}
                    >
                      <SelectTrigger className={formErrors.subject ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {subj.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {formErrors.subject && <p className="text-xs text-red-600 mt-1">{formErrors.subject}</p>}
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingItem(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingItem ? 'Update' : 'Add'} Homework
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </LoginRequired>
  );
}