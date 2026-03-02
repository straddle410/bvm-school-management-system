import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Plus, Users, Percent, Tag, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const EMPTY_FORM = {
  family_name: '',
  parent_phone: '',
  sibling_discount_type: 'PERCENT',
  sibling_discount_value: '',
  sibling_discount_scope: 'TOTAL',
  sibling_discount_fee_head_id: '',
  sibling_discount_fee_head_name: '',
  notes: ''
};

export default function FamilyManager({ academicYear, isArchived }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingFamily, setEditingFamily] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [applyingFamily, setApplyingFamily] = useState(null);

  // ─── AUTHORITATIVE SELECTION STATE ───────────────────────────────────────────
  // This is the ONLY source of truth for selected student IDs.
  // Only the three helpers below (addStudent, removeStudent, clearStudents) may modify it.
  const [selectedIds, setSelectedIds] = useState([]);

  const addStudent = (student_id) => {
    const sid = String(student_id).trim();
    console.trace('[FamilyManager] addStudent called with:', sid);
    setSelectedIds(prev => prev.includes(sid) ? prev : [...prev, sid]);
  };

  const removeStudent = (student_id) => {
    const sid = String(student_id).trim();
    console.trace('[FamilyManager] removeStudent called with:', sid);
    setSelectedIds(prev => prev.filter(id => id !== sid));
  };

  const clearStudents = () => setSelectedIds([]);
  // ─────────────────────────────────────────────────────────────────────────────

  // Fetch all families for this AY
  const { data: families = [] } = useQuery({
    queryKey: ['fee-families', academicYear],
    queryFn: () => base44.entities.FeeFamily.filter({ academic_year: academicYear }),
    enabled: !!academicYear
  });

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.filter({ is_active: true })
  });

  // Fetch all published, non-deleted students
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students-all-published', academicYear],
    queryFn: () => base44.entities.Student.filter({ academic_year: academicYear, status: 'Published', is_deleted: false }),
    enabled: !!academicYear
  });

  // Auto-suggest: read-only derived list, NEVER writes to selectedIds
  const suggestedByPhone = phoneSearch.length >= 6
    ? allStudents.filter(s => s.parent_phone?.replace(/\s/g, '').includes(phoneSearch.replace(/\s/g, '')))
    : [];

  // Students currently selected (derived from selectedIds)
  const selectedStudents = allStudents.filter(s => selectedIds.includes(String(s.student_id).trim()));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.family_name.trim()) throw new Error('Family name is required');
      if (selectedIds.length < 2) throw new Error('Select at least 2 students');

      const studentNames = allStudents
        .filter(s => selectedIds.includes(s.student_id))
        .map(s => s.name);

      const payload = {
        ...form,
        academic_year: academicYear,
        student_ids: selectedIds,
        student_names: studentNames,
        sibling_discount_value: form.sibling_discount_value ? parseFloat(form.sibling_discount_value) : null,
        sibling_discount_applied: editingFamily ? (editingFamily.sibling_discount_applied ?? false) : false
      };

      if (editingFamily) {
        return base44.entities.FeeFamily.update(editingFamily.id, payload);
      } else {
        return base44.entities.FeeFamily.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
      toast.success(editingFamily ? 'Family updated' : 'Family created');
      closeDialog();
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FeeFamily.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
      toast.success('Family deleted');
    }
  });

  const applyMutation = useMutation({
    mutationFn: ({ family_id, action }) =>
      base44.functions.invoke('applySiblingDiscount', { family_id, action }),
    onSuccess: (res, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-discounts', academicYear] });
      queryClient.invalidateQueries({ queryKey: ['fee-discounts-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoice'] });
      const results = res.data?.results || [];
      const applied = results.filter(r => r.status === 'applied').length;
      const skippedPaid = results.filter(r => r.status === 'skipped_paid').length;
      const skippedCap = results.filter(r => r.status === 'skipped_exceeds_gross').length;
      if (action === 'apply') {
        toast.success(`Sibling discount applied to ${applied} student(s).${skippedPaid ? ` ${skippedPaid} skipped (fully paid).` : ''}${skippedCap ? ` ${skippedCap} skipped (discount > gross).` : ''}`);
      } else {
        toast.success('Sibling discount removed from family.');
      }
      setApplyingFamily(null);
    },
    onError: (e) => { toast.error(e.message || e.data?.error || 'Failed'); setApplyingFamily(null); }
  });

  const openAdd = () => {
    setEditingFamily(null);
    setForm(EMPTY_FORM);
    setPhoneSearch('');
    clearStudents();
    setShowDialog(true);
  };

  const openEdit = (family) => {
    setEditingFamily(family);
    setForm({
      family_name: family.family_name,
      parent_phone: family.parent_phone || '',
      sibling_discount_type: family.sibling_discount_type || 'PERCENT',
      sibling_discount_value: family.sibling_discount_value != null ? String(family.sibling_discount_value) : '',
      sibling_discount_scope: family.sibling_discount_scope || 'TOTAL',
      sibling_discount_fee_head_id: family.sibling_discount_fee_head_id || '',
      sibling_discount_fee_head_name: family.sibling_discount_fee_head_name || '',
      notes: family.notes || ''
    });
    setPhoneSearch(family.parent_phone || '');
    // Load existing student selection — this is the only place setSelectedIds is called outside the helpers
    setSelectedIds(family.student_ids || []);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingFamily(null);
    setForm(EMPTY_FORM);
    setPhoneSearch('');
    clearStudents();
  };

  const discountLabel = (f) => {
    if (!f.sibling_discount_value) return 'No discount set';
    const val = f.sibling_discount_type === 'PERCENT'
      ? `${f.sibling_discount_value}% off`
      : `₹${f.sibling_discount_value} off`;
    const scope = f.sibling_discount_scope === 'TOTAL' ? 'total' : f.sibling_discount_fee_head_name || 'fee head';
    return `${val} on ${scope}`;
  };

  return (
    <div className="space-y-4">
      {isArchived && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          This academic year is archived. Family discount editing is disabled.
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{families.length} family group{families.length !== 1 ? 's' : ''} · Sibling discounts applied per family</p>
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
            <Card key={family.id} className="border-0 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold text-slate-800">{family.family_name}</span>
                  {family.parent_phone && <span className="text-xs text-slate-500">📞 {family.parent_phone}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {family.sibling_discount_applied ? (
                    <Badge className="bg-emerald-100 text-emerald-800 text-xs">✓ Discount Applied</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-slate-500">Not Applied</Badge>
                  )}
                  {!isArchived && (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(family)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!isArchived && (
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(family.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(family.student_ids || []).map((sid, i) => (
                    <span key={sid} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                      {family.student_names?.[i] || sid}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-emerald-700 font-medium flex items-center gap-1">
                    {family.sibling_discount_type === 'PERCENT'
                      ? <Percent className="h-3.5 w-3.5" />
                      : <Tag className="h-3.5 w-3.5" />}
                    {discountLabel(family)}
                  </p>
                  {!isArchived && family.sibling_discount_value && (
                    <div className="flex gap-2">
                      {family.sibling_discount_applied ? (
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                          onClick={() => setApplyingFamily({ family, action: 'remove' })}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Remove Discount
                        </Button>
                      ) : (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={() => setApplyingFamily({ family, action: 'apply' })}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Apply Discount
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {family.notes && <p className="text-xs text-slate-400">{family.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Apply/Remove Dialog */}
      {applyingFamily && (
        <Dialog open onOpenChange={() => setApplyingFamily(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {applyingFamily.action === 'apply' ? 'Apply Sibling Discount?' : 'Remove Sibling Discount?'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {applyingFamily.action === 'apply'
                  ? `This will create individual discount records for all ${applyingFamily.family.student_ids.length} students in "${applyingFamily.family.family_name}" with ${discountLabel(applyingFamily.family)}. Fully-paid invoices will be skipped.`
                  : `This will archive the sibling discount for all students in "${applyingFamily.family.family_name}". Fully-paid invoices will be skipped.`}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setApplyingFamily(null)}>Cancel</Button>
                <Button
                  className={applyingFamily.action === 'apply' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
                  disabled={applyMutation.isPending}
                  onClick={() => applyMutation.mutate({ family_id: applyingFamily.family.id, action: applyingFamily.action })}
                >
                  {applyMutation.isPending ? 'Processing…' : applyingFamily.action === 'apply' ? 'Yes, Apply' : 'Yes, Remove'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFamily ? 'Edit Family Group' : 'New Family Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            <div>
              <Label>Family Name *</Label>
              <Input className="mt-1" placeholder="e.g. Sharma Family"
                value={form.family_name}
                onChange={e => setForm(f => ({ ...f, family_name: e.target.value }))} />
            </div>

            <div>
              <Label>Parent Phone (for auto-suggest)</Label>
              {/* NOTE: phone input ONLY updates form.parent_phone and phoneSearch.
                  It does NOT touch selectedIds. */}
              <Input className="mt-1" placeholder="Enter phone to find siblings"
                value={phoneSearch}
                onChange={e => {
                  setPhoneSearch(e.target.value);
                  setForm(f => ({ ...f, parent_phone: e.target.value }));
                }} />
            </div>

            {/* Auto-suggest panel — display only, no checkboxes, explicit Add buttons only */}
            {suggestedByPhone.length > 0 && (
              <div className="bg-indigo-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-indigo-700">Students with matching phone (suggestions):</p>
                  <Button size="sm" variant="outline"
                    className="text-xs h-6 px-2 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                    onClick={() => suggestedByPhone.forEach(s => addStudent(s.student_id))}>
                    Add All
                  </Button>
                </div>
                {suggestedByPhone.map(s => (
                  <div key={s.student_id} className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm text-slate-700">{s.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{s.student_id} · Class {s.class_name}</span>
                    </div>
                    {selectedIds.includes(s.student_id) ? (
                      <span className="text-xs text-emerald-600 font-medium">✓ Added</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-6 px-2"
                        onClick={() => addStudent(s.student_id)}>
                        Add
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Manual class-based checkboxes — bound to selectedIds via addStudent/removeStudent */}
            <div>
              <Label>Add Students Manually</Label>
              <div className="mt-1 flex flex-wrap gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                {allStudents.length === 0 ? (
                  <p className="text-xs text-slate-400">Loading students…</p>
                ) : (
                  CLASSES.map(cls => {
                    const classStudents = allStudents.filter(s => s.class_name === cls);
                    if (classStudents.length === 0) return null;
                    return (
                      <div key={cls} className="w-full">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Class {cls}</p>
                        {classStudents.map(s => {
                          const sid = String(s.student_id).trim();
                          return (
                            <div key={sid} className="flex items-center gap-2 py-0.5">
                              <input
                                type="checkbox"
                                id={`student-cb-${sid}`}
                                checked={selectedIds.includes(sid)}
                                onChange={e => {
                                  console.log('[FamilyManager] checkbox onChange', sid, e.target.checked);
                                  e.target.checked ? addStudent(sid) : removeStudent(sid);
                                }}
                                className="h-3.5 w-3.5 rounded accent-indigo-600 cursor-pointer"
                              />
                              <label
                                htmlFor={`student-cb-${sid}`}
                                className="text-xs text-slate-700 cursor-pointer select-none"
                              >
                                {s.name} <span className="text-slate-400">({sid})</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected summary chips */}
            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedStudents.map(s => (
                  <span key={s.student_id} className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    {s.name}
                    <button onClick={() => removeStudent(s.student_id)} className="ml-0.5 text-indigo-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
            {selectedIds.length < 2 && (
              <p className="text-xs text-amber-600">Select at least 2 students to form a family.</p>
            )}

            {/* Discount */}
            <div className="border-t pt-3">
              <p className="text-sm font-semibold text-slate-700 mb-2">Sibling Discount</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.sibling_discount_type}
                    onValueChange={v => setForm(f => ({ ...f, sibling_discount_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                      <SelectItem value="AMOUNT">Fixed Amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value {form.sibling_discount_type === 'PERCENT' ? '(%)' : '(₹)'}</Label>
                  <Input className="mt-1" type="number" min="0"
                    max={form.sibling_discount_type === 'PERCENT' ? 100 : undefined}
                    value={form.sibling_discount_value}
                    onChange={e => setForm(f => ({ ...f, sibling_discount_value: e.target.value }))}
                    placeholder={form.sibling_discount_type === 'PERCENT' ? 'e.g. 10' : 'e.g. 500'}
                  />
                </div>
              </div>

              <div className="mt-3">
                <Label>Apply On</Label>
                <Select value={form.sibling_discount_scope}
                  onValueChange={v => setForm(f => ({ ...f, sibling_discount_scope: v, sibling_discount_fee_head_id: '', sibling_discount_fee_head_name: '' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOTAL">Total Invoice Amount</SelectItem>
                    <SelectItem value="FEE_HEAD">Specific Fee Head</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.sibling_discount_scope === 'FEE_HEAD' && (
                <div className="mt-3">
                  <Label>Fee Head</Label>
                  <Select value={form.sibling_discount_fee_head_id}
                    onValueChange={id => {
                      const fh = feeHeads.find(f => f.id === id);
                      setForm(f => ({ ...f, sibling_discount_fee_head_id: id, sibling_discount_fee_head_name: fh?.name || '' }));
                    }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select fee head" /></SelectTrigger>
                    <SelectContent>
                      {feeHeads.map(fh => <SelectItem key={fh.id} value={fh.id}>{fh.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input className="mt-1" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Sharma family — 3 siblings" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editingFamily ? 'Update Family' : 'Create Family'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}