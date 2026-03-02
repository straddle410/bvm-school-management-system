import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Users, Percent, Tag, CheckCircle2, RotateCcw, Edit2, X } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const EMPTY_FAMILY = {
  family_name: '',
  parent_phone: '',
  notes: '',
  sibling_discount_type: 'PERCENT',
  sibling_discount_value: '',
  sibling_discount_scope: 'TOTAL',
  sibling_discount_fee_head_id: '',
  sibling_discount_fee_head_name: '',
};

export default function FamilyManager({ academicYear, isArchived }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingFamily, setEditingFamily] = useState(null);
  const [form, setForm] = useState(EMPTY_FAMILY);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Fetch all families
  const { data: families = [] } = useQuery({
    queryKey: ['fee-families', academicYear],
    queryFn: () => base44.entities.FeeFamily.filter({ academic_year: academicYear }),
    enabled: !!academicYear
  });

  // Fetch published students for adding to family
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students-published-all', academicYear],
    queryFn: () => base44.entities.Student.filter({ academic_year: academicYear, status: 'Published' }),
    enabled: !!academicYear && showDialog
  });

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.filter({ is_active: true })
  });

  // Auto-suggest siblings when phone matches
  const suggestedStudents = phoneSearch.length >= 8
    ? allStudents.filter(s => s.parent_phone?.includes(phoneSearch))
    : [];

  const filteredStudents = allStudents.filter(s => {
    const matchClass = !classFilter || s.class_name === classFilter;
    const matchSearch = !studentSearch || s.name?.toLowerCase().includes(studentSearch.toLowerCase()) || s.student_id?.includes(studentSearch);
    return matchClass && matchSearch;
  });

  const saveFamilyMutation = useMutation({
    mutationFn: async () => {
      if (!form.family_name.trim()) throw new Error('Family name is required');
      if (selectedStudentIds.length < 1) throw new Error('Add at least one student');

      const studentData = allStudents.filter(s => selectedStudentIds.includes(s.student_id));
      const payload = {
        ...form,
        academic_year: academicYear,
        student_ids: selectedStudentIds,
        student_names: studentData.map(s => s.name),
        sibling_discount_value: form.sibling_discount_value ? parseFloat(form.sibling_discount_value) : undefined,
        created_by: ''
      };

      if (editingFamily) {
        await base44.entities.FeeFamily.update(editingFamily.id, payload);
      } else {
        await base44.entities.FeeFamily.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
      toast.success(editingFamily ? 'Family updated' : 'Family created');
      closeDialog();
    },
    onError: (e) => toast.error(e.message)
  });

  const applyDiscountMutation = useMutation({
    mutationFn: async ({ family_id, action }) => {
      const res = await base44.functions.invoke('applySiblingDiscount', { family_id, action });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-discounts', academicYear] });
      queryClient.invalidateQueries({ queryKey: ['fee-discounts-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoice'] });
      const skipped = data.results?.filter(r => r.status !== 'applied').length || 0;
      const applied = data.results?.filter(r => r.status === 'applied').length || 0;
      if (action === 'apply') {
        toast.success(`Sibling discount applied to ${applied} student(s)${skipped ? ` · ${skipped} skipped (paid/capped)` : ''}`);
      } else {
        toast.success('Sibling discount removed');
      }
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: (id) => base44.entities.FeeFamily.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
      toast.success('Family deleted');
    }
  });

  const openAdd = () => {
    setEditingFamily(null);
    setForm(EMPTY_FAMILY);
    setSelectedStudentIds([]);
    setPhoneSearch('');
    setClassFilter('');
    setStudentSearch('');
    setShowDialog(true);
  };

  const openEdit = (family) => {
    setEditingFamily(family);
    setForm({
      family_name: family.family_name,
      parent_phone: family.parent_phone || '',
      notes: family.notes || '',
      sibling_discount_type: family.sibling_discount_type || 'PERCENT',
      sibling_discount_value: family.sibling_discount_value != null ? String(family.sibling_discount_value) : '',
      sibling_discount_scope: family.sibling_discount_scope || 'TOTAL',
      sibling_discount_fee_head_id: family.sibling_discount_fee_head_id || '',
      sibling_discount_fee_head_name: family.sibling_discount_fee_head_name || '',
    });
    setSelectedStudentIds(family.student_ids || []);
    setPhoneSearch(family.parent_phone || '');
    setClassFilter('');
    setStudentSearch('');
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingFamily(null);
    setForm(EMPTY_FAMILY);
    setSelectedStudentIds([]);
    setPhoneSearch('');
    setStudentSearch('');
    setClassFilter('');
  };

  const toggleStudent = (student_id) => {
    setSelectedStudentIds(prev =>
      prev.includes(student_id) ? prev.filter(id => id !== student_id) : [...prev, student_id]
    );
  };

  const addSuggestedAll = () => {
    const ids = suggestedStudents.map(s => s.student_id);
    setSelectedStudentIds(prev => [...new Set([...prev, ...ids])]);
  };

  return (
    <div className="space-y-4">
      {isArchived && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          This academic year is archived. Editing is disabled.
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{families.length} family group{families.length !== 1 ? 's' : ''}</p>
        {!isArchived && (
          <Button onClick={openAdd} className="bg-[#1a237e] hover:bg-[#283593]">
            <Plus className="h-4 w-4 mr-1" /> New Family
          </Button>
        )}
      </div>

      {families.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No family groups yet. Create one to apply sibling discounts.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {families.map(family => (
            <Card key={family.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{family.family_name}</span>
                      {family.parent_phone && <span className="text-xs text-slate-400">📞 {family.parent_phone}</span>}
                      {family.sibling_discount_applied && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Discount Applied
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(family.student_names || []).map((name, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-normal">{name}</Badge>
                      ))}
                    </div>
                    {family.sibling_discount_value && (
                      <p className="text-sm text-emerald-700 mt-2 flex items-center gap-1">
                        {family.sibling_discount_type === 'PERCENT' ? <Percent className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                        Sibling discount: {family.sibling_discount_type === 'PERCENT' ? `${family.sibling_discount_value}%` : `₹${family.sibling_discount_value}`}
                        {family.sibling_discount_scope === 'FEE_HEAD' ? ` on ${family.sibling_discount_fee_head_name}` : ' on total'}
                      </p>
                    )}
                    {family.notes && <p className="text-xs text-slate-400 mt-1">{family.notes}</p>}
                  </div>

                  {!isArchived && (
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {family.sibling_discount_value && !family.sibling_discount_applied && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          disabled={applyDiscountMutation.isPending}
                          onClick={() => applyDiscountMutation.mutate({ family_id: family.id, action: 'apply' })}
                        >
                          Apply Discount
                        </Button>
                      )}
                      {family.sibling_discount_applied && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-200 text-xs"
                          disabled={applyDiscountMutation.isPending}
                          onClick={() => applyDiscountMutation.mutate({ family_id: family.id, action: 'remove' })}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Remove Discount
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEdit(family)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-slate-400 hover:text-red-500"
                        onClick={() => { if (confirm('Delete this family group?')) deleteFamilyMutation.mutate(family.id); }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFamily ? 'Edit Family Group' : 'New Family Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Family Name *</Label>
              <Input className="mt-1" value={form.family_name} onChange={e => setForm({ ...form, family_name: e.target.value })} placeholder="e.g. Sharma Family" />
            </div>

            <div>
              <Label>Parent Phone (for auto-suggestion)</Label>
              <Input
                className="mt-1" value={phoneSearch}
                onChange={e => { setPhoneSearch(e.target.value); setForm({ ...form, parent_phone: e.target.value }); }}
                placeholder="Enter parent mobile to find siblings"
              />
              {suggestedStudents.length > 0 && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-blue-800">Suggested siblings ({suggestedStudents.length}):</p>
                    <Button size="sm" variant="ghost" className="text-blue-700 h-6 text-xs" onClick={addSuggestedAll}>Add All</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedStudents.map(s => (
                      <button
                        key={s.student_id}
                        onClick={() => toggleStudent(s.student_id)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedStudentIds.includes(s.student_id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-300'}`}
                      >
                        {s.name} ({s.class_name})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Manual student selection */}
            <div>
              <Label>Add Students Manually</Label>
              <div className="flex gap-2 mt-1">
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Class" /></SelectTrigger>
                  <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="flex-1" placeholder="Search by name/ID" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>
              {(classFilter || studentSearch) && filteredStudents.length > 0 && (
                <div className="mt-2 max-h-36 overflow-y-auto border rounded-lg divide-y">
                  {filteredStudents.slice(0, 20).map(s => (
                    <label key={s.student_id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 ${selectedStudentIds.includes(s.student_id) ? 'bg-emerald-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(s.student_id)}
                        onChange={() => toggleStudent(s.student_id)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm text-slate-800">{s.name}</span>
                      <span className="text-xs text-slate-400">{s.student_id} · Cl.{s.class_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Selected students summary */}
            {selectedStudentIds.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-600 mb-2">Selected ({selectedStudentIds.length}):</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudentIds.map(id => {
                    const s = allStudents.find(st => st.student_id === id);
                    return s ? (
                      <span key={id} className="flex items-center gap-1 text-xs bg-white border rounded-full px-2 py-0.5">
                        {s.name}
                        <button onClick={() => toggleStudent(id)} className="text-slate-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Sibling Discount */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Sibling Discount (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.sibling_discount_type} onValueChange={v => setForm({ ...form, sibling_discount_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                      <SelectItem value="AMOUNT">Fixed Amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value</Label>
                  <Input
                    className="mt-1" type="number" min="0"
                    max={form.sibling_discount_type === 'PERCENT' ? 100 : undefined}
                    value={form.sibling_discount_value}
                    onChange={e => setForm({ ...form, sibling_discount_value: e.target.value })}
                    placeholder={form.sibling_discount_type === 'PERCENT' ? 'e.g. 10' : 'e.g. 500'}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label>Apply On</Label>
                <Select value={form.sibling_discount_scope} onValueChange={v => setForm({ ...form, sibling_discount_scope: v, sibling_discount_fee_head_id: '', sibling_discount_fee_head_name: '' })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOTAL">Total Invoice</SelectItem>
                    <SelectItem value="FEE_HEAD">Specific Fee Head</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.sibling_discount_scope === 'FEE_HEAD' && (
                <div className="mt-3">
                  <Label>Fee Head</Label>
                  <Select
                    value={form.sibling_discount_fee_head_id}
                    onValueChange={id => {
                      const fh = feeHeads.find(f => f.id === id);
                      setForm({ ...form, sibling_discount_fee_head_id: id, sibling_discount_fee_head_name: fh?.name || '' });
                    }}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select fee head" /></SelectTrigger>
                    <SelectContent>{feeHeads.map(fh => <SelectItem key={fh.id} value={fh.id}>{fh.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.sibling_discount_value && (
                <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-xs text-emerald-700">
                  Each sibling gets {form.sibling_discount_type === 'PERCENT' ? `${form.sibling_discount_value}%` : `₹${form.sibling_discount_value}`} off {form.sibling_discount_scope === 'TOTAL' ? 'their total invoice' : form.sibling_discount_fee_head_name || 'selected fee head'}. Apply from the family card after saving.
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Input className="mt-1" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => saveFamilyMutation.mutate()} disabled={saveFamilyMutation.isPending}>
                {saveFamilyMutation.isPending ? 'Saving…' : editingFamily ? 'Update Family' : 'Create Family'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}