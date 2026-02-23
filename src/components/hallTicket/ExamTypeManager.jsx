import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import ExamTypeDetailedConfig from './ExamTypeDetailedConfig';

export default function ExamTypeManager({ isAdmin = false, showAddButton = true }) {
  const { academicYear } = useAcademicYear();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    category: 'Summative',
    weight: 0,
    grading_scale: [],
    subject_max_marks: {}
  });
  const queryClient = useQueryClient();

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
      setFormData({ name: '', description: '', category: 'Summative' });
      toast.success('Exam type created');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ExamType.update(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examTypes'] });
      setEditingId(null);
      setFormData({ name: '', description: '', category: 'Summative' });
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

  const handleEdit = (type) => {
    setEditingId(type.id);
    setFormData({
      name: type.name,
      description: type.description,
      category: type.category,
      weight: type.weight || 0,
      grading_scale: type.grading_scale || [],
      subject_max_marks: type.subject_max_marks || {}
    });
    setShowForm(true);
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

              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Advanced Configuration</p>
                <ExamTypeDetailedConfig examType={formData} onChange={setFormData} />
              </div>

              <div className="flex gap-2 mt-4 border-t pt-4">
                <Button type="submit" className="bg-blue-600">Save</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
              </div>
            </form>
          )}

          <div className="grid gap-2">
            {examTypes.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No exam types created yet</p>
            ) : (
              examTypes.map(type => (
                <div key={type.id} className="bg-slate-50 rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === type.id ? null : type.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedId === type.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <div>
                          <p className="font-semibold">{type.name}</p>
                          <p className="text-sm text-slate-500">{type.category} Assessment</p>
                          {type.description && <p className="text-xs text-slate-400 mt-1">{type.description}</p>}
                        </div>
                      </div>
                    </div>
                    {hasPermission && (
                      <div className="flex gap-2 ml-4">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(type)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(type.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {expandedId === type.id && (
                    <div className="border-t bg-white p-4 space-y-3">
                      {type.weight > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Weight:</span>
                          <span className="font-semibold">{type.weight}%</span>
                        </div>
                      )}
                      
                      {type.grading_scale && type.grading_scale.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-2">Grading Scale:</p>
                          <div className="space-y-1">
                            {type.grading_scale.map((g, idx) => (
                              <div key={idx} className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                <span className="font-semibold">{g.grade}</span> ({g.min_percentage}-{g.max_percentage}%)
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {type.subject_max_marks && Object.keys(type.subject_max_marks).length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-2">Subject Max Marks:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(type.subject_max_marks).map(([subject, marks], idx) => (
                              <div key={idx} className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                <span className="font-medium">{subject}:</span> {marks}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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