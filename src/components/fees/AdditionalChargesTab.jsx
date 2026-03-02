import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Send, X, AlertCircle, Loader2 } from 'lucide-react';
import { getStaffSession } from '@/components/useStaffSession';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const STATUS_COLORS = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-500'
};

const EMPTY_FORM = {
  title: '',
  class_name: '',
  fee_head_id: '',
  fee_head_name: '',
  amount: '',
  applies_to: 'CLASS',
  student_ids: []
};

export default function AdditionalChargesTab({ academicYear, isArchived }) {
  const qc = useQueryClient();
  const user = getStaffSession();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmPublish, setConfirmPublish] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ['additional-charges', academicYear],
    queryFn: () => base44.entities.AdditionalCharge.filter({ academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear
  });

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads-active'],
    queryFn: () => base44.entities.FeeHead.filter({ is_active: true }, 'sort_order')
  });

  // Students in selected class for SELECTED mode
  const { data: classStudents = [] } = useQuery({
    queryKey: ['students-for-charge', form.class_name, academicYear],
    queryFn: () => base44.entities.Student.filter({ class_name: form.class_name, academic_year: academicYear, status: 'Published' }),
    enabled: !!form.class_name && !!academicYear
  });

  const saveMutation = useMutation({
    mutationFn: (status) => base44.entities.AdditionalCharge.create({
      ...form,
      amount: parseFloat(form.amount),
      academic_year: academicYear,
      status,
      created_by: user?.email
    }),
    onSuccess: () => {
      toast.success('Charge saved');
      qc.invalidateQueries({ queryKey: ['additional-charges', academicYear] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: e => toast.error(e.message)
  });

  const publishMutation = useMutation({
    mutationFn: (chargeId) => base44.functions.invoke('publishAdditionalCharge', { chargeId }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(`Published! ${data.created} invoices created, ${data.skipped} skipped.`);
      qc.invalidateQueries({ queryKey: ['additional-charges', academicYear] });
      setConfirmPublish(null);
    },
    onError: e => {
      toast.error(e.response?.data?.error || e.message);
      setConfirmPublish(null);
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (chargeId) => base44.functions.invoke('cancelAdditionalCharge', { chargeId }).then(r => r.data),
    onSuccess: () => {
      toast.success('Charge cancelled');
      qc.invalidateQueries({ queryKey: ['additional-charges', academicYear] });
      setConfirmCancel(null);
    },
    onError: e => {
      toast.error(e.response?.data?.error || e.message);
      setConfirmCancel(null);
    }
  });

  const toggleStudent = (sid) => {
    setForm(f => ({
      ...f,
      student_ids: f.student_ids.includes(sid)
        ? f.student_ids.filter(id => id !== sid)
        : [...f.student_ids, sid]
    }));
  };

  const isFormValid = form.title && form.class_name && form.fee_head_id && parseFloat(form.amount) > 0
    && (form.applies_to === 'CLASS' || form.student_ids.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Additional Charges</h3>
          <p className="text-xs text-slate-500">One-off fees (outing, trip, exam, etc.) — separate from annual fee plan</p>
        </div>
        {!isArchived && (
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-1" /> New Charge
          </Button>
        )}
      </div>

      {/* Charge Form */}
      {showForm && (
        <Card className="border-indigo-200">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-slate-700">Create Additional Charge</p>

            <div>
              <label className="text-xs font-medium text-slate-600">Title *</label>
              <Input placeholder="e.g. Outing Fee – July 2025" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Class *</label>
                <Select value={form.class_name} onValueChange={v => setForm({ ...form, class_name: v, student_ids: [] })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select Class" /></SelectTrigger>
                  <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Amount (₹) *</label>
                <Input type="number" min="1" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Fee Head *</label>
              <Select value={form.fee_head_id} onValueChange={v => {
                const fh = feeHeads.find(h => h.id === v);
                setForm({ ...form, fee_head_id: v, fee_head_name: fh?.name || '' });
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select Fee Head" /></SelectTrigger>
                <SelectContent>{feeHeads.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Applies To *</label>
              <div className="flex gap-2 mt-1">
                {['CLASS', 'SELECTED'].map(opt => (
                  <button key={opt}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${form.applies_to === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                    onClick={() => setForm({ ...form, applies_to: opt, student_ids: [] })}>
                    {opt === 'CLASS' ? 'Whole Class' : 'Selected Students'}
                  </button>
                ))}
              </div>
            </div>

            {form.applies_to === 'SELECTED' && form.class_name && (
              <div>
                <label className="text-xs font-medium text-slate-600">Select Students ({form.student_ids.length} selected)</label>
                <div className="mt-1 max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {classStudents.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-4">No published students in this class</p>
                    : classStudents.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={form.student_ids.includes(s.student_id)} onChange={() => toggleStudent(s.student_id)} />
                        <span className="text-sm">{s.name}</span>
                        <span className="text-xs text-slate-400 ml-auto">{s.student_id}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}

            {form.applies_to === 'SELECTED' && !form.class_name && (
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Select a class first to choose students</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={!isFormValid || saveMutation.isPending}
                onClick={() => saveMutation.mutate('DRAFT')}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save as Draft'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : charges.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-400 text-sm">No additional charges yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {charges.map(charge => (
            <Card key={charge.id} className={`border-0 shadow-sm ${charge.status === 'CANCELLED' ? 'opacity-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800">{charge.title}</span>
                      <Badge className={`text-xs px-2 py-0 ${STATUS_COLORS[charge.status]}`}>{charge.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      <span>Class {charge.class_name}</span>
                      <span>·</span>
                      <span>₹{charge.amount?.toLocaleString()}</span>
                      <span>·</span>
                      <span>{charge.fee_head_name}</span>
                      <span>·</span>
                      <span>{charge.applies_to === 'CLASS' ? 'Whole class' : `${charge.student_ids?.length || 0} students`}</span>
                      {charge.status === 'PUBLISHED' && (
                        <>
                          <span>·</span>
                          <span className="text-green-600">{charge.invoices_created} invoices created</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{charge.created_date?.slice(0, 10)}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {charge.status === 'DRAFT' && !isArchived && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => setConfirmPublish(charge)}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Publish
                        </Button>
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500"
                          onClick={() => setConfirmCancel(charge)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {charge.status === 'PUBLISHED' && !isArchived && (
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500 text-xs"
                        onClick={() => setConfirmCancel(charge)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Publish confirm */}
      {confirmPublish && (
        <Dialog open onOpenChange={() => setConfirmPublish(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Publish Charge</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-600">
              This will generate invoices for <strong>{confirmPublish.applies_to === 'CLASS' ? `all active students in Class ${confirmPublish.class_name}` : `${confirmPublish.student_ids?.length} selected students`}</strong> for "<strong>{confirmPublish.title}</strong>" (₹{confirmPublish.amount?.toLocaleString()} each).
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-start gap-1">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              Published charges cannot be edited. Cancel + recreate if needed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmPublish(null)}>Cancel</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700"
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate(confirmPublish.id)}>
                {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish & Generate'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel confirm */}
      {confirmCancel && (
        <Dialog open onOpenChange={() => setConfirmCancel(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Cancel Charge</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-600">
              Cancel "<strong>{confirmCancel.title}</strong>"? All unpaid invoices will also be cancelled.
            </p>
            <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">Charges with recorded payments cannot be cancelled.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmCancel(null)}>Back</Button>
              <Button size="sm" variant="destructive"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(confirmCancel.id)}>
                {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel Charge'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}