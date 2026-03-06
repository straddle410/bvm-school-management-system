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
import { Plus, Notebook, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import LoginRequired from '@/components/LoginRequired';
import { format } from 'date-fns';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function Diary() {
  const [user, setUser] = useState(null);
  const [studentSession, setStudentSession] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    class_name: '',
    section: 'A',
    subject_id: '',
    subject_name: '',
    diary_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [formErrors, setFormErrors] = useState({});
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();

  useEffect(() => {
    const staffData = getStaffSession();
    setUser(staffData);
    const ss = getStudentSession();
    setStudentSession(ss);
    
    // If student, mark diary as read
    if (ss?.student_id) {
      base44.functions.invoke('markStudentNotificationsRead', {
        student_id: ss.student_id,
        event_types: ['DIARY_PUBLISHED'],
      }).catch(() => {});
    }
  }, []);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', academicYear, form.class_name],
    queryFn: async () => {
      console.log('[SUBJECT_CALLSITE] pages/Diary:57');
      if (!form.class_name || !academicYear) return [];
      const result = await getSubjectsForClass(academicYear, form.class_name);
      return result.subjects.map(name => ({ id: name, name }));
    },
    enabled: !!form.class_name && !!academicYear,
  });

  const { data: diaryList = [], isLoading } = useQuery({
    queryKey: ['diary', academicYear],
    queryFn: () => base44.entities.Diary.filter({ academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Diary.create({ ...data, created_by: user?.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary'] });
      setShowForm(false);
      resetForm();
      toast.success('Diary entry posted');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Diary.update(editingItem.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary'] });
      setShowForm(false);
      setEditingItem(null);
      resetForm();
      toast.success('Diary entry updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Diary.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary'] });
      toast.success('Diary entry deleted');
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
      diary_date: format(new Date(), 'yyyy-MM-dd'),
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
    if (!form.diary_date) errors.diary_date = 'Date is required';
    
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
      diary_date: form.diary_date,
      academic_year: academicYear,
    };
    console.log('DIARY_PAYLOAD', payload);
    
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
      diary_date: item.diary_date,
    });
    setShowForm(true);
  };

  const classes = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher']} pageName="Diary">
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Left: List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Notebook className="h-8 w-8 text-pink-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Class Diary</h1>
                  <p className="text-gray-600 text-sm">Daily class updates and activities</p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  resetForm();
                  setShowForm(true);
                }}
                className="bg-pink-600 hover:bg-pink-700 lg:hidden"
              >
                <Plus className="h-4 w-4 mr-2" /> Post
              </Button>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
              </div>
            ) : diaryList.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <Notebook className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No diary entries yet</p>
                <Button onClick={() => setShowForm(true)} className="bg-pink-600 hover:bg-pink-700">
                  <Plus className="h-4 w-4 mr-2" /> Post First Entry
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {diaryList.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-pink-500">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{item.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded">
                            Class {item.class_name}-{item.section}
                          </span>
                          {item.subject_name && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{item.subject_name}</span>
                          )}
                          {item.diary_date && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {format(new Date(item.diary_date + 'T00:00:00'), 'MMM d, yyyy')}
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
                            if (confirm('Delete this entry?')) {
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Form (desktop) / Dialog (mobile) */}
          <div className="hidden lg:block">
            {showForm && (
              <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-6">
                <h2 className="text-lg font-bold mb-4 text-gray-900">{editingItem ? 'Edit Entry' : 'Post Diary Entry'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g., Today's Lesson on Fractions"
                      required
                    />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="What was taught, activities, homework, etc."
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
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={form.diary_date}
                      onChange={(e) => setForm({ ...form, diary_date: e.target.value })}
                      required
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
                      className="bg-pink-600 hover:bg-pink-700"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingItem ? 'Update' : 'Post'} Entry
                    </Button>
                  </div>
                </form>
              </div>
            )}
            {!showForm && (
              <Button
                onClick={() => {
                  setEditingItem(null);
                  resetForm();
                  setShowForm(true);
                }}
                className="w-full bg-pink-600 hover:bg-pink-700"
              >
                <Plus className="h-4 w-4 mr-2" /> Post Diary
              </Button>
            )}
          </div>

          {/* Mobile Dialog */}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-lg lg:hidden">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Entry' : 'Post Diary Entry'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Today's Lesson on Fractions"
                    required
                  />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What was taught, activities, homework, etc."
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
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.diary_date}
                    onChange={(e) => setForm({ ...form, diary_date: e.target.value })}
                    required
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
                    className="bg-pink-600 hover:bg-pink-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingItem ? 'Update' : 'Post'} Entry
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