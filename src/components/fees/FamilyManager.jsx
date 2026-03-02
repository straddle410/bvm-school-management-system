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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [applyingFamily, setApplyingFamily] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // ─── AUTHORITATIVE SELECTION STATE ───────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);

  const addStudent = (student_id) => {
    const sid = String(student_id).trim();
    setSelectedIds(prev => prev.includes(sid) ? prev : [...prev, sid]);
  };

  const removeStudent = (student_id) => {
    const sid = String(student_id).trim();
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

  // Fetch all fee invoices for outstanding balance calculations
  const { data: allInvoices = [] } = useQuery({
    queryKey: ['fee-invoices-all', academicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({ academic_year: academicYear }),
    enabled: !!academicYear
  });

  // Calculate outstanding balance for a student (invoice net - paid)
  const getOutstandingBalance = (student_id) => {
    const studentInvoices = allInvoices.filter(inv => 
      inv.student_id === student_id && (inv.invoice_type || 'ANNUAL') === 'ANNUAL'
    );
    return studentInvoices.reduce((sum, inv) => {
      const net = inv.total_amount ?? 0;
      const paid = inv.paid_amount ?? 0;
      return sum + Math.max(net - paid, 0);
    }, 0);
  };

  // Calculate total outstanding for selected students
  const totalOutstanding = selectedIds.reduce((sum, sid) => sum + getOutstandingBalance(sid), 0);

  // Search & filter students
  const searchLower = searchQuery.toLowerCase();
  const searchResults = selectedClass
    ? allStudents.filter(s => 
        s.class_name === selectedClass &&
        (s.name.toLowerCase().includes(searchLower) || s.student_id.toLowerCase().includes(searchLower))
      )
    : allStudents.filter(s =>
        s.name.toLowerCase().includes(searchLower) || s.student_id.toLowerCase().includes(searchLower)
      );

  // Students currently selected
  const selectedStudents = allStudents.filter(s => selectedIds.includes(String(s.student_id).trim()));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.family_name.trim()) throw new Error('Family name is required');
      if (selectedIds.length < 2) throw new Error('Select at least 2 students');

      // Check single-family rule: each student can only belong to one family per AY
      if (!editingFamily) {
        for (const sid of selectedIds) {
          const inOtherFamily = families.some(f => 
            f.student_ids.includes(sid)
          );
          if (inOtherFamily) {
            throw new Error(`Student already belongs to another family. Remove from that family first.`);
          }
        }
      }

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
    onError: (e) => {
      const errorMsg = e?.message || e?.data?.error || e?.response?.data?.error || 'Failed to save family';
      setSaveError(errorMsg);
      toast.error(errorMsg);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FeeFamily.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
      toast.success('Family deleted');
    }
  });

  const applyMutation = useMutation({
    mutationFn: async ({ family_id, action }) => {
      // Validation
      console.log('applyMutation triggered:', { family_id, action, academicYear });
      if (!family_id) throw new Error('Family ID is missing');
      if (!academicYear) throw new Error('Academic year is missing');
      if (!action) throw new Error('Action is missing');

      const family = families.find(f => f.id === family_id);
      if (!family) throw new Error('Family not found');
      console.log('Found family:', family);
      
      // Family discount cap check: total discount cannot exceed total outstanding balance
      if (action === 'apply' && family) {
        const discountAmt = family.sibling_discount_type === 'PERCENT'
          ? (family.sibling_discount_value / 100) * totalOutstanding
          : family.sibling_discount_value;
        
        if (discountAmt > totalOutstanding) {
          throw new Error(`Maximum allowed discount is ₹${Math.floor(totalOutstanding)}.`);
        }
      }

      console.log('About to invoke API with:', { family_id, action });
      try {
        console.log('Invoking applySiblingDiscount:', { family_id, action });
        const res = await base44.functions.invoke('applySiblingDiscount', { family_id, action });
        console.log('API Response:', res.data);
        return res;
      } catch (err) {
        console.error('API Error caught:', err);
        console.error('Error details:', { msg: err?.message, data: err?.data, status: err?.status });
        throw new Error(err?.data?.error || err?.message || 'Failed to apply discount');
      }
    },
    onSuccess: (res, { action }) => {
      console.log('Mutation onSuccess triggered with:', { res, action });
      try {
        queryClient.invalidateQueries({ queryKey: ['fee-families', academicYear] });
        queryClient.invalidateQueries({ queryKey: ['student-fee-discounts', academicYear] });
        queryClient.invalidateQueries({ queryKey: ['fee-discounts-student'] });
        queryClient.invalidateQueries({ queryKey: ['fee-invoice'] });
      } catch (err) {
        console.warn('Query invalidation warning:', err);
      }
      
      const results = res.data?.results || [];
      const applied = results.filter(r => r.status === 'applied').length;
      const appliedCredit = results.filter(r => r.status === 'applied_credit').length;
      const skippedCap = results.filter(r => r.status === 'skipped_exceeds_gross').length;
      if (action === 'apply') {
        toast.success(`Sibling discount applied to ${applied + appliedCredit} student(s).${skippedCap ? ` ${skippedCap} skipped (exceeds balance).` : ''}`);
      } else {
        toast.success('Sibling discount removed from family.');
      }
      setApplyingFamily(null);
    },
    onError: (e) => {
      console.error('Mutation onError triggered:', e);
      const msg = e?.message || e?.data?.error || 'Failed to apply discount';
      toast.error(msg);
      setApplyingFamily(null);
    }
  });

  const openAdd = () => {
    setEditingFamily(null);
    setForm(EMPTY_FORM);
    setSearchQuery('');
    setSelectedClass('');
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
    setSearchQuery('');
    setSelectedClass('');
    setSelectedIds(family.student_ids || []);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingFamily(null);
    setForm(EMPTY_FORM);
    setSearchQuery('');
    setSelectedClass('');
    setSaveError(null);
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
        <Dialog open={!!applyingFamily} onOpenChange={(open) => { if (!open) setApplyingFamily(null); }}>
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
                  type="button"
                  className={applyingFamily.action === 'apply' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
                  disabled={applyMutation.isPending}
                  onClick={() => {
                    console.log('Confirm button clicked:', applyingFamily);
                    if (applyingFamily?.family?.id && applyingFamily?.action) {
                      console.log('Calling applyMutation with:', { family_id: applyingFamily.family.id, action: applyingFamily.action });
                      applyMutation.mutate({ family_id: applyingFamily.family.id, action: applyingFamily.action });
                    } else {
                      console.error('Missing data:', applyingFamily);
                      toast.error('Missing family or action information');
                    }
                  }}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFamily ? 'Edit Family Group' : 'New Family Group'}</DialogTitle>
          </DialogHeader>
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{saveError}</p>
            </div>
          )}
          <div className="space-y-4">

           <div>
             <Label>Family Name *</Label>
             <Input className="mt-1" placeholder="e.g. Sharma Family"
               value={form.family_name}
               onChange={e => setForm(f => ({ ...f, family_name: e.target.value }))} />
           </div>

           <div>
             <Label>Parent Phone (optional)</Label>
             <Input className="mt-1" placeholder="e.g. 9876543210"
               value={form.parent_phone}
               onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} />
           </div>

           {/* Search-first student selection UI */}
           <div className="border-t pt-3">
             <p className="text-sm font-semibold text-slate-700 mb-3">Add Students</p>

             {/* Search & Filter */}
             <div className="grid grid-cols-2 gap-3 mb-3">
               <div>
                 <Label className="text-xs">Search by name / ID</Label>
                 <Input className="mt-1 text-sm" placeholder="e.g. Amit or S0001"
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)} />
               </div>
               <div>
                 <Label className="text-xs">Filter by class</Label>
                 <Select value={selectedClass} onValueChange={setSelectedClass}>
                   <SelectTrigger className="mt-1"><SelectValue placeholder="All classes" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value={null}>All classes</SelectItem>
                     {CLASSES.map(cls => <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
             </div>

             {/* Search Results */}
             <div className="border rounded-lg max-h-48 overflow-y-auto bg-slate-50 p-2 space-y-1 mb-3">
               {searchResults.length === 0 ? (
                 <p className="text-xs text-slate-400 p-2">No students found</p>
               ) : (
                 searchResults.map(s => {
                   const sid = String(s.student_id).trim();
                   const isSelected = selectedIds.includes(sid);
                   const outstanding = getOutstandingBalance(sid);
                   return (
                     <div key={sid} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-slate-100 text-xs">
                       <div className="flex-1">
                         <div className="text-slate-700 font-medium">{s.name} ({sid})</div>
                         <div className="text-slate-400">Class {s.class_name} · Outstanding: ₹{Math.floor(outstanding)}</div>
                       </div>
                       {isSelected ? (
                         <span className="text-emerald-600 font-medium text-xs">✓</span>
                       ) : (
                         <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                           onClick={() => addStudent(sid)}>
                           Add
                         </Button>
                       )}
                     </div>
                   );
                 })
               )}
             </div>

             {/* Selected Students Panel */}
             <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-3">
               <div className="flex items-center justify-between mb-2">
                 <p className="text-xs font-semibold text-indigo-700">
                   Selected Students ({selectedIds.length})
                 </p>
                 {selectedIds.length > 0 && (
                   <Button size="sm" variant="ghost" className="h-5 px-2 text-xs text-red-600 hover:bg-red-50"
                     onClick={clearStudents}>
                     Clear All
                   </Button>
                 )}
               </div>
               {selectedIds.length === 0 ? (
                 <p className="text-xs text-indigo-600">Add at least 2 students</p>
               ) : (
                 <div className="space-y-1">
                   {selectedStudents.map(s => (
                     <div key={s.student_id} className="flex items-center justify-between gap-2 bg-white p-2 rounded text-xs">
                       <div>
                         <span className="text-slate-700">{s.name}</span>
                         <span className="text-slate-400 ml-2">({s.student_id})</span>
                         <span className="text-emerald-600 ml-2 font-medium">₹{Math.floor(getOutstandingBalance(s.student_id))}</span>
                       </div>
                       <Button size="sm" variant="ghost" className="h-5 px-1 text-slate-400 hover:text-red-600"
                         onClick={() => removeStudent(s.student_id)}>
                         ✕
                       </Button>
                     </div>
                   ))}
                   {totalOutstanding > 0 && (
                     <div className="flex items-center justify-between border-t border-indigo-200 pt-2 mt-2">
                       <span className="text-xs font-semibold text-indigo-700">Total Outstanding Balance:</span>
                       <span className="text-xs font-bold text-indigo-700">₹{Math.floor(totalOutstanding)}</span>
                     </div>
                   )}
                 </div>
               )}
             </div>
           </div>

            {/* Discount */}
             <div className="border-t pt-3">
              <p className="text-sm font-semibold text-slate-700 mb-2">Sibling Discount</p>
              {selectedIds.length > 0 && totalOutstanding > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3 text-xs text-blue-800">
                  Max discount available: ₹{Math.floor(totalOutstanding)}
                </div>
              )}
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