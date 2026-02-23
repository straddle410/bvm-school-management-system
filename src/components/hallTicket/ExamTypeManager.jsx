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
  const [formData, setFormData] = useState({ name: '', description: '', category: 'Summative' });
  const queryClient = useQueryClient();

  // Check user role if isAdmin not explicitly passed
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  React.useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
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

              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600">Save</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
              </div>
            </form>
          )}

          <div className="grid gap-2">
            {examTypes.map(type => (
              <div key={type.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-semibold">{type.name}</p>
                  <p className="text-sm text-slate-500">{type.category} Assessment</p>
                </div>
                {hasPermission && (
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => {
                      setEditingId(type.id);
                      setFormData({ name: type.name, description: type.description, category: type.category });
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}