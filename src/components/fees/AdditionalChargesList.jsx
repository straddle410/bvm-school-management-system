import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Send, XCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import AdditionalChargeForm from './AdditionalChargeForm';

const statusColors = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-500'
};

export default function AdditionalChargesList({ academicYear, isArchived }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ['additional-charges', academicYear],
    queryFn: () => base44.entities.AdditionalCharge.filter({ academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear
  });

  const publishMutation = useMutation({
    mutationFn: async (chargeId) => {
      const res = await base44.functions.invoke('publishAdditionalCharge', { chargeId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['additional-charges', academicYear] });
      toast.success(`Published! ${data.created} invoices created, ${data.skipped} skipped.`);
    },
    onError: (e) => toast.error(e.message)
  });

  const cancelMutation = useMutation({
    mutationFn: async (chargeId) => {
      const res = await base44.functions.invoke('cancelAdditionalCharge', { chargeId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['additional-charges', academicYear] });
      toast.success('Charge cancelled');
    },
    onError: (e) => toast.error(e.message)
  });

  if (showForm) {
    return <AdditionalChargeForm academicYear={academicYear} onSaved={() => setShowForm(false)} onCancel={() => setShowForm(false)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Additional Charges</h3>
          <p className="text-xs text-slate-500 mt-0.5">One-off fees like outings, events, trips, etc.</p>
        </div>
        {!isArchived && (
          <Button className="bg-[#1a237e] hover:bg-[#283593]" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Charge
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-slate-400">Loading…</CardContent></Card>
      ) : charges.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-400 text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          No additional charges yet for {academicYear}.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {charges.map(charge => (
            <Card key={charge.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{charge.title}</span>
                      <Badge className={`text-xs ${statusColors[charge.status]}`}>{charge.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                      <span>Class {charge.class_name}</span>
                      <span>₹{(charge.amount || 0).toLocaleString()} per student</span>
                      <span>{charge.applies_to === 'CLASS' ? 'Whole class' : `${(charge.student_ids || []).length} students`}</span>
                      {charge.status === 'PUBLISHED' && charge.invoices_created != null && (
                        <span className="text-emerald-700">{charge.invoices_created} invoices generated</span>
                      )}
                      {charge.created_date && <span>{new Date(charge.created_date).toLocaleDateString('en-IN')}</span>}
                    </div>
                  </div>
                  {!isArchived && (
                    <div className="flex gap-2 flex-shrink-0">
                      {charge.status === 'DRAFT' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => publishMutation.mutate(charge.id)} disabled={publishMutation.isPending}>
                            <Send className="h-3.5 w-3.5 mr-1" /> Publish
                          </Button>
                          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500" onClick={() => cancelMutation.mutate(charge.id)} disabled={cancelMutation.isPending}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {charge.status === 'PUBLISHED' && (
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500" onClick={() => {
                          if (confirm('Cancel this charge? This will only work if no payments have been collected.')) {
                            cancelMutation.mutate(charge.id);
                          }
                        }} disabled={cancelMutation.isPending}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}