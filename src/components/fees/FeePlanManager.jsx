import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const INSTALLMENT_NAMES = ['Q1 (Apr–Jun)', 'Q2 (Jul–Sep)', 'Q3 (Oct–Dec)', 'Q4 (Jan–Mar)', 'Annual'];

export default function FeePlanManager({ academicYear }) {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [expandedInstallment, setExpandedInstallment] = useState(null);
  const [plan, setPlan] = useState(null);
  const [installments, setInstallments] = useState([]);

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.list('sort_order').then(h => h.filter(f => f.is_active))
  });

  const { data: existingPlan, isLoading } = useQuery({
    queryKey: ['fee-plan', academicYear, selectedClass],
    queryFn: () => base44.entities.FeePlan.filter({ academic_year: academicYear, class_name: selectedClass }).then(r => r[0] || null),
    enabled: !!selectedClass && !!academicYear
  });

  useEffect(() => {
    if (existingPlan) {
      setPlan(existingPlan);
      setInstallments(existingPlan.installments || []);
    } else {
      setPlan(null);
      setInstallments([]);
    }
  }, [existingPlan]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { academic_year: academicYear, class_name: selectedClass, installments };
      if (plan?.id) return base44.entities.FeePlan.update(plan.id, data);
      return base44.entities.FeePlan.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-plan', academicYear, selectedClass] });
      toast.success('Fee plan saved');
    },
    onError: (e) => toast.error(e.message)
  });

  const addInstallment = () => {
    const used = new Set(installments.map(i => i.name));
    const next = INSTALLMENT_NAMES.find(n => !used.has(n)) || `Installment ${installments.length + 1}`;
    const newInst = { name: next, due_date: '', fee_heads: feeHeads.map(fh => ({ fee_head_id: fh.id, fee_head_name: fh.name, amount: 0 })), total_amount: 0 };
    setInstallments([...installments, newInst]);
    setExpandedInstallment(next);
  };

  const removeInstallment = (idx) => setInstallments(installments.filter((_, i) => i !== idx));

  const updateInstallmentAmount = (instIdx, fhIdx, amount) => {
    const updated = installments.map((inst, i) => {
      if (i !== instIdx) return inst;
      const newHeads = inst.fee_heads.map((fh, j) => j === fhIdx ? { ...fh, amount: parseFloat(amount) || 0 } : fh);
      const total = newHeads.reduce((s, f) => s + (f.amount || 0), 0);
      return { ...inst, fee_heads: newHeads, total_amount: total };
    });
    setInstallments(updated);
  };

  const updateInstallmentField = (instIdx, field, value) => {
    setInstallments(installments.map((inst, i) => i === instIdx ? { ...inst, [field]: value } : inst));
  };

  const grandTotal = installments.reduce((s, i) => s + (i.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
        </Select>
        {selectedClass && (
          <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            {plan ? '✏️ Edit existing plan' : '✨ New plan'}
          </span>
        )}
      </div>

      {!selectedClass && (
        <Card><CardContent className="py-12 text-center text-slate-400">Select a class to view or create a fee plan</CardContent></Card>
      )}

      {selectedClass && !isLoading && (
        <>
          {installments.length === 0 ? (
            <Card className="border-dashed border-2"><CardContent className="py-10 text-center">
              <p className="text-slate-400 mb-3">No installments defined for Class {selectedClass}</p>
              <Button onClick={addInstallment}><Plus className="h-4 w-4 mr-1" />Add First Installment</Button>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {installments.map((inst, instIdx) => (
                <Card key={instIdx} className="border-0 shadow-sm overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer bg-slate-50 hover:bg-slate-100"
                    onClick={() => setExpandedInstallment(expandedInstallment === inst.name ? null : inst.name)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedInstallment === inst.name ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-semibold text-slate-800">{inst.name}</span>
                      {inst.due_date && <span className="text-xs text-slate-500">Due: {inst.due_date}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-700">₹{(inst.total_amount || 0).toLocaleString()}</span>
                      <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); removeInstallment(instIdx); }}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>

                  {expandedInstallment === inst.name && (
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Installment Name</label>
                          <input className="border rounded-lg px-3 py-1.5 text-sm w-full mt-1" value={inst.name} onChange={e => updateInstallmentField(instIdx, 'name', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Due Date</label>
                          <input type="date" className="border rounded-lg px-3 py-1.5 text-sm mt-1 block" value={inst.due_date || ''} onChange={e => updateInstallmentField(instIdx, 'due_date', e.target.value)} />
                        </div>
                      </div>

                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="text-left pb-2 text-slate-500 font-medium">Fee Head</th><th className="text-right pb-2 text-slate-500 font-medium w-32">Amount (₹)</th></tr></thead>
                        <tbody>
                          {(inst.fee_heads || []).map((fh, fhIdx) => (
                            <tr key={fhIdx} className="border-b border-slate-50">
                              <td className="py-2 text-slate-700">{fh.fee_head_name}</td>
                              <td className="py-2">
                                <input
                                  type="number" min="0"
                                  className="border rounded-lg px-2 py-1 text-sm w-28 text-right ml-auto block"
                                  value={fh.amount || ''}
                                  onChange={e => updateInstallmentAmount(instIdx, fhIdx, e.target.value)}
                                />
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 font-semibold">
                            <td className="py-2 px-1 text-slate-800">Total</td>
                            <td className="py-2 text-right text-emerald-700">₹{(inst.total_amount || 0).toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {selectedClass && (
            <div className="flex items-center justify-between pt-2">
              <div>
                <Button variant="outline" onClick={addInstallment} disabled={installments.length >= 5}>
                  <Plus className="h-4 w-4 mr-1" />Add Installment
                  {installments.length >= 5 && <span className="ml-1 text-xs text-slate-400">(max 5)</span>}
                </Button>
                {installments.length > 0 && (
                  <span className="ml-4 text-sm font-semibold text-slate-700">
                    Annual Total: <span className="text-emerald-700">₹{grandTotal.toLocaleString()}</span>
                  </span>
                )}
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || installments.length === 0}>
                <Save className="h-4 w-4 mr-1" />{saveMutation.isPending ? 'Saving...' : 'Save Plan'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}