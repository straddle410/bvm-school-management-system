import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function AdditionalChargeForm({ academicYear, onSaved, onCancel }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    class_name: '',
    fee_head_id: '',
    fee_head_name: '',
    amount: '',
    applies_to: 'CLASS',
    student_ids: []
  });

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.filter({ is_active: true })
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', form.class_name, academicYear],
    queryFn: () => base44.entities.Student.filter({ class_name: form.class_name, academic_year: academicYear, status: 'Published' }),
    enabled: !!form.class_name && !!academicYear
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      validate();
      const me = await base44.auth.me();
      return base44.entities.AdditionalCharge.create({
        academic_year: academicYear,
        title: form.title.trim(),
        fee_head_id: form.fee_head_id,
        fee_head_name: form.fee_head_name,
        class_name: form.class_name,
        amount: parseFloat(form.amount),
        applies_to: form.applies_to,
        student_ids: form.applies_to === 'SELECTED' ? form.student_ids : [],
        status: 'DRAFT',
        created_by: me.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['additional-charges', academicYear] });
      toast.success('Draft saved');
      onSaved();
    },
    onError: (e) => toast.error(e.message)
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      validate();
      const me = await base44.auth.me();
      // Create draft first, then publish
      const charge = await base44.entities.AdditionalCharge.create({
        academic_year: academicYear,
        title: form.title.trim(),
        fee_head_id: form.fee_head_id,
        fee_head_name: form.fee_head_name,
        class_name: form.class_name,
        amount: parseFloat(form.amount),
        applies_to: form.applies_to,
        student_ids: form.applies_to === 'SELECTED' ? form.student_ids : [],
        status: 'DRAFT',
        created_by: me.email
      });
      const res = await base44.functions.invoke('publishAdditionalCharge', { chargeId: charge.id });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['additional-charges', academicYear] });
      toast.success(`Published! ${data.created} invoices created, ${data.skipped} skipped.`);
      onSaved();
    },
    onError: (e) => toast.error(e.message)
  });

  const validate = () => {
    if (!form.title.trim()) throw new Error('Title is required');
    if (!form.class_name) throw new Error('Class is required');
    if (!form.fee_head_id) throw new Error('Fee Head is required');
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) throw new Error('Enter a valid amount');
    if (form.applies_to === 'SELECTED' && form.student_ids.length === 0) throw new Error('Select at least one student');
  };

  const toggleStudent = (id) => {
    setForm(f => ({
      ...f,
      student_ids: f.student_ids.includes(id) ? f.student_ids.filter(s => s !== id) : [...f.student_ids, id]
    }));
  };

  const isPending = saveDraft.isPending || publishMutation.isPending;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">New Additional Charge</h3>

        <div>
          <Label>Title *</Label>
          <Input className="mt-1" placeholder="e.g. Outing Fee – July 2025" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Class *</Label>
            <Select value={form.class_name} onValueChange={v => setForm({ ...form, class_name: v, student_ids: [] })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (₹) *</Label>
            <Input className="mt-1" type="number" min="1" placeholder="e.g. 500" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
        </div>

        <div>
          <Label>Fee Head *</Label>
          <Select value={form.fee_head_id} onValueChange={id => {
            const fh = feeHeads.find(f => f.id === id);
            setForm({ ...form, fee_head_id: id, fee_head_name: fh?.name || '' });
          }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select fee head" /></SelectTrigger>
            <SelectContent>{feeHeads.map(fh => <SelectItem key={fh.id} value={fh.id}>{fh.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <Label>Applies To *</Label>
          <Select value={form.applies_to} onValueChange={v => setForm({ ...form, applies_to: v, student_ids: [] })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CLASS">Whole Class</SelectItem>
              <SelectItem value="SELECTED">Selected Students</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.applies_to === 'SELECTED' && form.class_name && (
          <div>
            <Label>Select Students ({form.student_ids.length} selected)</Label>
            <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto divide-y">
              {students.length === 0 ? (
                <p className="p-3 text-sm text-slate-400">No published students in this class.</p>
              ) : students.map(s => (
                <label key={s.student_id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                  <Checkbox
                    checked={form.student_ids.includes(s.student_id)}
                    onCheckedChange={() => toggleStudent(s.student_id)}
                  />
                  <span className="text-sm text-slate-700">{s.name} <span className="text-slate-400">({s.student_id})</span></span>
                </label>
              ))}
            </div>
            {form.student_ids.length > 0 && (
              <button className="text-xs text-slate-400 mt-1 hover:text-red-500" onClick={() => setForm({ ...form, student_ids: [] })}>Clear selection</button>
            )}
          </div>
        )}

        {form.applies_to === 'SELECTED' && !form.class_name && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Select a class first to choose students.
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={isPending}>
            {saveDraft.isPending ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button className="bg-[#1a237e] hover:bg-[#283593]" onClick={() => publishMutation.mutate()} disabled={isPending}>
            {publishMutation.isPending ? 'Publishing…' : 'Publish & Generate Invoices'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}