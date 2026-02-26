import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function ExamTypeManager({ isAdmin = false, showAddButton = true }) {
  const { academicYear } = useAcademicYear();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [useCustomName, setUseCustomName] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    category: 'Summative',
    max_marks: 100,
    min_marks_to_pass: 40,
    attendance_range_start: '',
    attendance_range_end: ''
  });
  const queryClient = useQueryClient();

  const getDefaultMarks = (category) => {
    return category === 'Formative' 
      ? { max_marks: 20, min_marks_to_pass: 10 }
      : { max_marks: 100, min_marks_to_pass: 40 };
  };

  // Check user role if isAdmin not explicitly passed
  const [user, setUser] = useState(null);
  React.useEffect(() => {
    // Check staff session first (custom login)
    try {
      const session = localStorage.getItem('staff_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed?.role === 'Admin' || parsed?.role === 'admin' || parsed?.role === 'Principal') {
          setUser({ role: 'admin' });
          return;
        }
      }
    } catch {}
    // Fallback: check base44 auth
    base44.auth.me().then(u => {
      setUser(u);
    }).catch(() => {
      setUser(null);
    });
  }, []);
  
  const hasPermission = isAdmin || (user?.role === 'admin');

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ExamType.create({ ...data, academic_year: academicYear, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examTypes'] });
      setShowForm(false);
      const defaults = getDefaultMarks('Summative');
      setFormData({ name: '', description: '', category: 'Summative', ...defaults, attendance_range_start: '', attendance_range_end: '' });
      toast.success('Exam type created');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ExamType.update(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examTypes'] });
      setEditingId(null);
      const defaults = getDefaultMarks('Summative');
      setFormData({ name: '', description: '', category: 'Summative', ...defaults, attendance_range_start: '', attendance_range_end: '' });
      toast.success('Exam type updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ExamType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examTypes'] });
      toast.success('Exam type deleted');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Manage Exam Types</CardTitle>
          {hasPermission && showAddButton && (
            <Button onClick={() => { setShowForm(!showForm); setEditingId(null); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Type
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showForm && hasPermission && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg space-y-3">
              {!useCustomName ? (
                <div>
                  <select
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select Exam Type</option>
                    {['Formative Assessment 1', 'Formative Assessment 2', 'Formative Assessment 3', 'Formative Assessment 4', 'Summative Assessment 1', 'Summative Assessment 2', 'Summative Assessment 3', 'Annual Exam', 'Pre Final Exam 1', 'Pre Final Exam 2'].map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setUseCustomName(true); setFormData({ ...formData, name: '' }); }}
                    className="text-sm text-blue-600 mt-2 hover:underline"
                  >
                    + Add Custom Exam Type
                  </button>
                </div>
              ) : (
                <div>
                  <Input
                    placeholder="Enter custom exam type name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setUseCustomName(false); setFormData({ ...formData, name: '' }); }}
                    className="text-sm text-blue-600 mt-2 hover:underline"
                  >
                    ← Use Predefined Type
                  </button>
                </div>
              )}

              <select
                value={formData.category}
                onChange={(e) => {
                  const category = e.target.value;
                  const defaults = getDefaultMarks(category);
                  setFormData({ ...formData, category, ...defaults });
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Summative">Summative (SA)</option>
                <option value="Formative">Formative (FA)</option>
              </select>

              <Input
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Max Marks</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.max_marks}
                    onChange={(e) => setFormData({ ...formData, max_marks: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Min Marks to Pass</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.min_marks_to_pass}
                    onChange={(e) => setFormData({ ...formData, min_marks_to_pass: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600">Save</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setUseCustomName(false); }}>Cancel</Button>
              </div>
            </form>
          )}

          <div className="grid gap-2">
            {examTypes.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No exam types created yet</p>
            ) : (
              examTypes.map(type => (
                <div key={type.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-semibold">{type.name}</p>
                    <p className="text-sm text-slate-500">{type.category} Assessment</p>
                    <div className="flex gap-4 mt-2 text-xs text-slate-600">
                      <span>Max Marks: <span className="font-semibold text-slate-900">{type.max_marks}</span></span>
                      <span>Pass: <span className="font-semibold text-slate-900">{type.min_marks_to_pass}</span></span>
                    </div>
                    {type.description && <p className="text-xs text-slate-400 mt-1">{type.description}</p>}
                  </div>
                  {hasPermission && (
                    <div className="flex gap-2 ml-4">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditingId(type.id);
                        setFormData({ 
                          name: type.name, 
                          description: type.description, 
                          category: type.category,
                          max_marks: type.max_marks,
                          min_marks_to_pass: type.min_marks_to_pass
                        });
                        setShowForm(true);
                      }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(type.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}