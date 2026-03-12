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
import { Percent, Tag, Edit2, Archive, Plus, Search, AlertCircle, Users, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const EMPTY_FORM = {
  discount_type: 'AMOUNT',
  discount_value: '',
  scope: 'TOTAL',
  fee_head_id: '',
  fee_head_name: '',
  notes: ''
};

export default function DiscountManager({ academicYear, isArchived }) {
  const queryClient = useQueryClient();
  const [filterClass, setFilterClass] = useState('');
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [discountPage, setDiscountPage] = useState(0);
  const DISCOUNTS_LIMIT = 100;

  const { data: allDiscounts = [] } = useQuery({
    queryKey: ['student-fee-discounts-all', academicYear],
    queryFn: () => base44.entities.StudentFeeDiscount.filter({ academic_year: academicYear }),
    enabled: !!academicYear,
    staleTime: 5 * 60 * 1000
  });

  // Apply pagination after fetching all (for filtering/search)
  const discounts = useMemo(() => {
    const start = discountPage * DISCOUNTS_LIMIT;
    return allDiscounts.slice(start, start + DISCOUNTS_LIMIT);
  }, [allDiscounts, discountPage]);

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.filter({ is_active: true })
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', filterClass, academicYear],
    queryFn: () => base44.entities.Student.filter({ 
      class_name: filterClass, 
      academic_year: academicYear, 
      status: 'Published',
      is_deleted: false,
      is_active: true
    }),
    enabled: !!filterClass && !!academicYear
  });

  // Fetch invoice + existing discount for selected student to compute settled status
  const { data: studentInvoice } = useQuery({
    queryKey: ['fee-invoice-discount-check', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({ student_id: selectedStudent.student_id, academic_year: academicYear })
      .then(r => r[0] || null),
    enabled: !!selectedStudent && !!academicYear
  });

  // Compute settled: invoice is fully paid when paid_amount >= total_amount (net after all discounts)
  const isSettled = (() => {
    if (!studentInvoice) return false;
    if (studentInvoice.status === 'Paid') return true;
    const net = studentInvoice.total_amount ?? 0;
    const paid = studentInvoice.paid_amount ?? 0;
    return paid >= net && net > 0;
  })();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) throw new Error('Select a student first');
      if (!form.discount_value || isNaN(parseFloat(form.discount_value))) throw new Error('Enter a valid discount value');
      if (form.discount_type === 'PERCENT' && parseFloat(form.discount_value) > 100) throw new Error('Percentage cannot exceed 100');
      if (form.scope === 'FEE_HEAD' && !form.fee_head_id) throw new Error('Select a fee head for fee-head scoped discount');

      // Frontend fast-fail using correct net-based check
      if (isSettled) {
        throw new Error('Cannot set discount: invoice is fully settled (paid ≥ net). No refund mechanism exists.');
      }

      // Delegate to backend which enforces the same net-based guardrail
      const res = await base44.functions.invoke('setStudentDiscount', {
        student_id: selectedStudent.student_id,
        academic_year: academicYear,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        scope: form.scope,
        fee_head_id: form.scope === 'FEE_HEAD' ? form.fee_head_id : '',
        fee_head_name: form.scope === 'FEE_HEAD' ? form.fee_head_name : '',
        notes: form.notes
      });

      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: async (data) => {
      // Trigger dynamic invoice recalculation
      try {
        await base44.functions.invoke('recalculateStudentInvoiceTotals', {
          student_id: selectedStudent.student_id,
          academic_year: academicYear
        });
      } catch (e) {
        console.error('Invoice recalculation failed:', e.message);
      }
      queryClient.invalidateQueries({ queryKey: ['student-fee-discounts', academicYear] });
      queryClient.invalidateQueries({ queryKey: ['fee-discounts-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoice'] });
      queryClient.invalidateQueries({ queryKey: ['fee-outstanding'] });
      toast.success(data?.action === 'updated' ? 'Discount updated' : 'Discount set');
      closeDialog();
    },
    onError: (e) => toast.error(e.message)
  });

  const archiveMutation = useMutation({
    mutationFn: async (id) => {
      const discount = discounts.find(d => d.id === id);
      await base44.entities.StudentFeeDiscount.update(id, { status: 'Archived' });
      // Trigger dynamic invoice recalculation for this student
      if (discount) {
        try {
          await base44.functions.invoke('recalculateStudentInvoiceTotals', {
            student_id: discount.student_id,
            academic_year: academicYear
          });
        } catch (e) {
          console.error('Invoice recalculation failed:', e.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fee-discounts', academicYear] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoice'] });
      queryClient.invalidateQueries({ queryKey: ['fee-outstanding'] });
      toast.success('Discount archived');
    }
  });

  const reverseMutation = useMutation({
    mutationFn: (discount_application_id) => 
      base44.functions.invoke('reverseSiblingDiscount', { discount_application_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fee-discounts', academicYear] });
      queryClient.invalidateQueries({ queryKey: ['fee-payments', academicYear] });
      toast.success('Sibling discount reversed');
    },
    onError: (e) => toast.error(e?.message || 'Failed to reverse discount')
  });

  const openAdd = () => {
    setEditingDiscount(null);
    setSelectedStudent(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (d) => {
    setEditingDiscount(d);
    setSelectedStudent({ student_id: d.student_id, name: d.student_name, class_name: d.class_name });
    setForm({
      discount_type: d.discount_type,
      discount_value: String(d.discount_value),
      scope: d.scope,
      fee_head_id: d.fee_head_id || '',
      fee_head_name: d.fee_head_name || '',
      notes: d.notes || ''
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingDiscount(null);
    setSelectedStudent(null);
    setForm(EMPTY_FORM);
  };

  const filteredDiscounts = discounts.filter(d => {
    const matchClass = !filterClass || d.class_name === filterClass;
    const matchSearch = !search || d.student_name?.toLowerCase().includes(search.toLowerCase()) || d.student_id?.includes(search);
    return matchClass && matchSearch;
  });

  const activeDiscounts = filteredDiscounts.filter(d => d.status === 'Active');
  const reversedDiscounts = filteredDiscounts.filter(d => d.status === 'Reversed');
  const archivedDiscounts = filteredDiscounts.filter(d => d.status === 'Archived');

  const discountPreview = (d) => {
    const val = d.discount_type === 'PERCENT' ? `${d.discount_value}%` : `₹${d.discount_value}`;
    const scopeLabel = d.scope === 'TOTAL' ? 'on total' : `on ${d.fee_head_name || 'fee head'}`;
    return `${val} off ${scopeLabel}`;
  };

  const filteredStudents = students.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.includes(search)
  );

  // Add useMemo to avoid importing issues
  const useMemo = React.useMemo;

  return (
    <div className="space-y-4">
      {isArchived && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          This academic year is archived. Discount editing is disabled.
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Classes</SelectItem>
              {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-9 w-48" placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {!isArchived && (
          <Button onClick={openAdd} className="bg-[#1a237e] hover:bg-[#283593]">
            <Plus className="h-4 w-4 mr-1" /> Add Discount
          </Button>
        )}
      </div>

      {/* Active discounts */}
      {activeDiscounts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-400 text-sm">No active discounts for this year.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {activeDiscounts.map(d => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 truncate">{d.student_name}</span>
                  <span className="text-xs text-slate-400">{d.student_id}</span>
                  <Badge variant="outline" className="text-xs">{d.class_name}</Badge>
                </div>
                <p className="text-sm text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                  {d.discount_type === 'PERCENT' ? <Percent className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                  {discountPreview(d)}
                </p>
                {d.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{d.notes}</p>}
              </div>
              {!isArchived && !d.notes?.startsWith('[SIBLING]') && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500" onClick={() => archiveMutation.mutate(d.id)}>
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {d.notes?.startsWith('[SIBLING]') && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isArchived && (
                    <Button size="sm" variant="outline" className="text-xs text-orange-600 hover:bg-orange-50 border-orange-200"
                      onClick={() => reverseMutation.mutate(d.id)}
                      disabled={reverseMutation.isPending}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {reverseMutation.isPending ? 'Reversing…' : 'Reverse'}
                    </Button>
                  )}
                  <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                    <Users className="h-3 w-3 mr-1" /> Sibling
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reversed (collapsed) */}
      {reversedDiscounts.length > 0 && (
        <details className="bg-orange-50 rounded-xl p-3">
          <summary className="text-sm text-orange-700 cursor-pointer font-medium">Reversed discounts ({reversedDiscounts.length})</summary>
          <div className="mt-2 space-y-1">
            {reversedDiscounts.map(d => (
              <div key={d.id} className="text-sm text-orange-600 px-2 py-1 flex gap-2">
                <span>{d.student_name}</span>
                <span>·</span>
                <span>{discountPreview(d)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Archived (collapsed) */}
      {archivedDiscounts.length > 0 && (
        <details className="bg-slate-50 rounded-xl p-3">
          <summary className="text-sm text-slate-500 cursor-pointer">Archived discounts ({archivedDiscounts.length})</summary>
          <div className="mt-2 space-y-1">
            {archivedDiscounts.map(d => (
              <div key={d.id} className="text-sm text-slate-400 px-2 py-1 flex gap-2">
                <span>{d.student_name}</span>
                <span>·</span>
                <span>{discountPreview(d)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Pagination for discounts view */}
      {allDiscounts.length > DISCOUNTS_LIMIT && (
        <div className="flex justify-center gap-2 pt-2">
          <button onClick={() => setDiscountPage(p => Math.max(0, p - 1))} disabled={discountPage === 0} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-slate-500">Page {discountPage + 1}</span>
          <button onClick={() => setDiscountPage(p => p + 1)} className="px-3 py-1 text-sm border rounded">Next</button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDiscount ? 'Edit Discount' : 'Set Student Discount'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Student selection (only when adding new) */}
            {!editingDiscount && (
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={filterClass} onValueChange={(v) => { setFilterClass(v); setSelectedStudent(null); }}>
                  <SelectTrigger><SelectValue placeholder="Select class first" /></SelectTrigger>
                  <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
                </Select>

                {filterClass && (
                  <>
                    <Label>Student</Label>
                    <Select
                      value={selectedStudent?.student_id || ''}
                      onValueChange={id => {
                        const s = students.find(st => st.student_id === id) || null;
                        setSelectedStudent(s);
                        // Auto-load existing active discount so save will update not duplicate
                        if (s) {
                          const existing = discounts.find(d =>
                            d.student_id === s.student_id &&
                            d.academic_year === academicYear &&
                            d.status === 'Active'
                          );
                          if (existing && !editingDiscount) {
                            setEditingDiscount(existing);
                            setForm({
                              discount_type: existing.discount_type,
                              discount_value: String(existing.discount_value),
                              scope: existing.scope,
                              fee_head_id: existing.fee_head_id || '',
                              fee_head_name: existing.fee_head_name || '',
                              notes: existing.notes || ''
                            });
                          } else if (!existing) {
                            setEditingDiscount(null);
                            setForm(EMPTY_FORM);
                          }
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {students.map(s => (
                          <SelectItem key={s.student_id} value={s.student_id}>{s.name} ({s.student_id})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            )}

            {editingDiscount && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
                Student: <strong>{editingDiscount.student_name}</strong> ({editingDiscount.student_id})
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                    <SelectItem value="AMOUNT">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value {form.discount_type === 'PERCENT' ? '(%)' : '(₹)'}</Label>
                <Input
                  className="mt-1" type="number" min="0"
                  max={form.discount_type === 'PERCENT' ? 100 : undefined}
                  value={form.discount_value}
                  onChange={e => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === 'PERCENT' ? 'e.g. 10' : 'e.g. 500'}
                />
              </div>
            </div>

            <div>
              <Label>Apply On</Label>
              <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v, fee_head_id: '', fee_head_name: '' })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOTAL">Total Invoice Amount</SelectItem>
                  <SelectItem value="FEE_HEAD">Specific Fee Head</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.scope === 'FEE_HEAD' && (
              <div>
                <Label>Fee Head</Label>
                <Select
                  value={form.fee_head_id}
                  onValueChange={id => {
                    const fh = feeHeads.find(f => f.id === id);
                    setForm({ ...form, fee_head_id: id, fee_head_name: fh?.name || '' });
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select fee head" /></SelectTrigger>
                  <SelectContent>
                    {feeHeads.map(fh => <SelectItem key={fh.id} value={fh.id}>{fh.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Input className="mt-1" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Scholarship, Staff ward" />
            </div>

            {/* Settled invoice warning — uses NET not gross */}
            {selectedStudent && isSettled && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Invoice is fully settled (paid ≥ net) — discount cannot be modified. No refund mechanism exists.</span>
              </div>
            )}

            {/* Existing discount notice */}
            {editingDiscount && !editingDiscount.id?.startsWith('_') && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>This student already has an active discount. Saving will <strong>replace</strong> it.</span>
              </div>
            )}

            {/* Preview */}
            {form.discount_value && selectedStudent && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                <strong>Preview:</strong> {selectedStudent.name} gets{' '}
                {form.discount_type === 'PERCENT' ? `${form.discount_value}% off` : `₹${form.discount_value} off`}{' '}
                {form.scope === 'TOTAL' ? 'each invoice total' : `${form.fee_head_name || 'selected fee head'} per invoice`}.
                <br />
                <span className="text-xs text-emerald-600">This applies to all future invoice generations for {academicYear}.</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || isSettled}
              >
                {saveMutation.isPending ? 'Saving…' : editingDiscount ? 'Update Discount' : 'Save Discount'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}