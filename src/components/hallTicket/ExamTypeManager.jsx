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
        const role = (parsed?.role || '').trim().toLowerCase();
        if (role === 'admin' || role === 'principal') {
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

  // Parse academic year date boundaries (e.g. "2024-25" → Apr 1 2024 to Mar 31 2025)
  const getAcademicYearBounds = (year) => {
    if (!year) return null;
    const [startYearStr] = year.split('-');
    const startYear = parseInt(startYearStr);
    if (isNaN(startYear)) return null;
    return {
      start: new Date(`${startYear}-04-01`),
      end: new Date(`${startYear + 1}-03-31`)
    };
  };

  const validateDateRange = () => {
    const errors = [];
    const warnings = [];
    
    if (formData.attendance_range_start && formData.attendance_range_end) {
      const start = new Date(formData.attendance_range_start);
      const end = new Date(formData.attendance_range_end);
      
      if (start > end) {
        errors.push('Start date cannot be after end date');
      }

      // Check if dates are within the selected academic year
      const bounds = getAcademicYearBounds(academicYear);
      if (bounds) {
        const startOk = start >= bounds.start && start <= bounds.end;
        const endOk = end >= bounds.start && end <= bounds.end;
        if (!startOk || !endOk) {
          warnings.push(`⚠️ Attendance range must be within ${academicYear} (${bounds.start.toLocaleDateString('en-IN')} – ${bounds.end.toLocaleDateString('en-IN')}). Dates outside this range will be blocked by the server.`);
        }
      }
    }

    return { errors, warnings };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { errors } = validateDateRange();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

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

               <div className="border-t pt-4">
                 <p className="text-sm font-semibold text-slate-700 mb-3">Attendance Report Range</p>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-sm font-medium text-slate-700">Start Date</label>
                     <Input
                       type="date"
                       value={formData.attendance_range_start}
                       onChange={(e) => setFormData({ ...formData, attendance_range_start: e.target.value })}
                       className="mt-1"
                     />
                   </div>
                   <div>
                     <label className="text-sm font-medium text-slate-700">End Date</label>
                     <Input
                       type="date"
                       value={formData.attendance_range_end}
                       onChange={(e) => setFormData({ ...formData, attendance_range_end: e.target.value })}
                       className="mt-1"
                     />
                   </div>
                   </div>
                   {validateDateRange().errors.length > 0 && (
                   <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                     <strong>❌ Error:</strong> {validateDateRange().errors[0]}
                   </div>
                   )}
                   {validateDateRange().warnings.length > 0 && (
                   <div className="mt-3 p-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-900">
                     {validateDateRange().warnings[0]}
                   </div>
                   )}
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
                    {type.attendance_range_start && type.attendance_range_end && (() => {
                      const bounds = getAcademicYearBounds(academicYear);
                      const start = new Date(type.attendance_range_start);
                      const end = new Date(type.attendance_range_end);
                      const outOfBounds = bounds && (start < bounds.start || end > bounds.end);
                      return (
                        <p className={`text-xs mt-1 ${outOfBounds ? 'text-amber-600 font-medium' : 'text-blue-600'}`}>
                          {outOfBounds ? '⚠️ ' : ''}Attendance Range: {type.attendance_range_start} to {type.attendance_range_end}
                          {outOfBounds && <span className="block text-amber-700">Range exceeds academic year {academicYear}</span>}
                        </p>
                      );
                    })()}
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
                          min_marks_to_pass: type.min_marks_to_pass,
                          attendance_range_start: type.attendance_range_start || '',
                          attendance_range_end: type.attendance_range_end || ''
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