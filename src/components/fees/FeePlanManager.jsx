import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function FeePlanManager({ academicYear }) {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [plan, setPlan] = useState(null);
  const [feeItems, setFeeItems] = useState([]);
  const [dueDate, setDueDate] = useState('');

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.list('sort_order').then(h => h.filter(f => f.is_active))
  });

  const { data: existingPlan, isLoading } = useQuery({
    queryKey: ['fee-plan', academicYear, selectedClass],
    queryFn: () => base44.entities.FeePlan.filter({ academic_year: academicYear, class_name: selectedClass }).then(r => r[0] || null),
    enabled: !!selectedClass && !!academicYear
  });

  // When plan loads or class changes, populate form
  useEffect(() => {
    if (!selectedClass) return;
    if (existingPlan) {
      setPlan(existingPlan);
      setDueDate(existingPlan.due_date || '');
      // Merge with current fee heads (add new ones, keep existing amounts)
      const itemMap = {};
      for (const item of existingPlan.fee_items || []) {
        itemMap[item.fee_head_id] = item;
      }
      setFeeItems(feeHeads.map(fh => itemMap[fh.id] || { fee_head_id: fh.id, fee_head_name: fh.name, amount: 0 }));
    } else {
      setPlan(null);
      setDueDate('');
      setFeeItems(feeHeads.map(fh => ({ fee_head_id: fh.id, fee_head_name: fh.name, amount: 0 })));
    }
  }, [existingPlan, selectedClass, feeHeads.length]);

  const totalAmount = feeItems.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

  const updateAmount = (idx, val) => {
    setFeeItems(feeItems.map((f, i) => i === idx ? { ...f, amount: parseFloat(val) || 0 } : f));
  };

  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        academic_year: academicYear,
        class_name: selectedClass,
        due_date: dueDate,
        fee_items: feeItems,
        total_amount: totalAmount,
        created_by: (await base44.auth.me()).email
      };
      if (plan?.id) return base44.entities.FeePlan.update(plan.id, data);
      return base44.entities.FeePlan.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-plan', academicYear, selectedClass] });
      toast.success('Fee plan saved');
      setSaved(true);
    },
    onError: (e) => toast.error(e.message)
  });

  const markEdited = () => { if (saved) setSaved(false); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
        </Select>
        {selectedClass && !isLoading && (
          <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            {plan ? '✏️ Editing existing plan' : '✨ New plan'}
          </span>
        )}
      </div>

      {!selectedClass && (
        <Card><CardContent className="py-12 text-center text-slate-400">Select a class to view or set its annual fee plan</CardContent></Card>
      )}

      {selectedClass && !isLoading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600">Due Date (optional)</label>
              <Input type="date" className="mt-1 w-48" value={dueDate} onChange={e => { setDueDate(e.target.value); markEdited(); }} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Annual Fee Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 text-slate-500 font-medium">Fee Head</th>
                    <th className="text-right pb-2 text-slate-500 font-medium w-36">Annual Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {feeItems.map((fh, idx) => (
                    <tr key={fh.fee_head_id} className="border-b border-slate-50">
                      <td className="py-2.5 text-slate-700">{fh.fee_head_name}</td>
                      <td className="py-2.5">
                        <Input
                          type="number" min="0"
                          className="w-32 text-right ml-auto"
                          value={fh.amount || ''}
                          onChange={e => { updateAmount(idx, e.target.value); markEdited(); }}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-2.5 px-1 text-slate-800">Total Annual Fee</td>
                    <td className="py-2.5 text-right text-emerald-700 pr-3">₹{totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || totalAmount === 0}
                className={saved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
              >
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? 'Saving...' : saved ? 'Saved ✓' : 'Save Plan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}