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
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ExamType.create({ ...data, academic_year: academicYear }),
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
        <CardHeader>
          <CardTitle>Exam Types</CardTitle>
        </CardHeader>
        <CardContent>

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