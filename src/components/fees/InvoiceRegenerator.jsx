import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStaffSession } from '@/components/useStaffSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function InvoiceRegenerator({ academicYear }) {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // Diagnostic data
  const { data: diagnostic, isFetching: diagLoading } = useQuery({
    queryKey: ['diagnostic-invoices', selectedClass, academicYear],
    queryFn: () => base44.functions.invoke('diagnosticFeeInvoices', { className: selectedClass, academicYear }).then(r => r.data),
    enabled: !!selectedClass && !!academicYear && showDiagnostic
  });

  const regenerateMutation = useMutation({
    mutationFn: ({ className, studentIds }) =>
      base44.functions.invoke('regenerateFeeInvoices', { className, academicYear, studentIds }),
    onSuccess: (res) => {
      const msg = res.data?.message || `Regenerated invoices`;
      toast.success(msg);
      if (res.data?.blocked && res.data.blocked.length > 0) {
        const blockedNames = res.data.blocked.map(b => b.student_name).join(', ');
        toast.error(`Blocked (payments exist): ${blockedNames}. Contact admin to handle payment adjustments.`, { duration: 5000 });
      }
      queryClient.invalidateQueries({ queryKey: ['diagnostic-invoices'] });
      setShowDiagnostic(false);
    },
    onError: (e) => toast.error(e?.message || 'Regeneration failed')
  });

  const restoreMutation = useMutation({
    mutationFn: (studentId) =>
      base44.functions.invoke('restorePaymentInvoiceLink', { studentId, academicYear }),
    onSuccess: (res) => {
      toast.success(`Restored: ${res.data?.message}`);
      queryClient.invalidateQueries({ queryKey: ['diagnostic-invoices'] });
    },
    onError: (e) => toast.error(e?.message || 'Restore failed')
  });

  const handleRegenerate = (studentIds = []) => {
    regenerateMutation.mutate({ className: selectedClass, studentIds });
  };

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50">
        <RefreshCw className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          If invoices show incorrect amounts, you can regenerate them from the current fee plan. Old invoices will be archived.
        </AlertDescription>
      </Alert>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
              </SelectContent>
            </Select>

            {selectedClass && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowDiagnostic(!showDiagnostic)} className="gap-2">
                  <Eye className="h-4 w-4" />
                  {showDiagnostic ? 'Hide' : 'View'} Invoice Details
                </Button>

                <Button
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 gap-2"
                  onClick={() => handleRegenerate()}
                  disabled={regenerateMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4" />
                  {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate All'}
                </Button>
              </>
            )}
          </div>

          {/* Diagnostic Details */}
          {showDiagnostic && selectedClass && (
            <div className="border-t pt-4 space-y-3">
              {diagLoading ? (
                <p className="text-sm text-slate-400">Loading invoice details…</p>
              ) : diagnostic?.current_plan ? (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-emerald-900">Current Fee Plan for Class {selectedClass}</p>
                    <p className="text-sm text-emerald-700 mt-1">
                      Total: <span className="font-bold">₹{diagnostic.current_plan.total_amount?.toLocaleString()}</span>
                    </p>
                    {diagnostic.current_plan.fee_items && (
                      <div className="text-xs text-emerald-600 mt-2 space-y-1">
                        {diagnostic.current_plan.fee_items.map((item, idx) => (
                          <div key={idx}>{item.fee_head_name}: ₹{(item.amount || 0).toLocaleString()}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  {diagnostic.invoices && diagnostic.invoices.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Existing Invoices ({diagnostic.invoices.length})</p>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {diagnostic.invoices.map((inv, idx) => {
                          const mismatch = inv.gross_total !== diagnostic.current_plan.total_amount;
                          return (
                            <div key={idx} className={`border rounded-lg p-3 text-sm ${mismatch ? 'bg-red-50 border-red-200' : 'bg-slate-50'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className={`font-medium ${mismatch ? 'text-red-800' : 'text-slate-800'}`}>
                                    {inv.student_name} ({inv.student_id})
                                  </p>
                                  <p className={`text-xs mt-1 ${mismatch ? 'text-red-700' : 'text-slate-600'}`}>
                                    Gross: ₹{inv.gross_total?.toLocaleString()} | Discount: ₹{inv.discount_total?.toLocaleString()} | Net: ₹{inv.net_total?.toLocaleString()}
                                  </p>
                                  {inv.tuition_gross !== null && (
                                    <p className={`text-xs mt-0.5 ${mismatch ? 'text-red-700' : 'text-slate-500'}`}>
                                      Tuition: ₹{inv.tuition_gross?.toLocaleString()} → ₹{inv.tuition_net?.toLocaleString()} (net)
                                    </p>
                                  )}
                                </div>
                                {mismatch && (
                                  <div className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded flex-shrink-0">
                                    OUT OF SYNC
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {diagnostic.invoices && (
                        <div className="space-y-2 pt-2">
                          {diagnostic.invoices.some(inv => inv.gross_total !== diagnostic.current_plan.total_amount) && (
                            <Button
                              className="w-full bg-red-600 hover:bg-red-700"
                              onClick={() => handleRegenerate()}
                              disabled={regenerateMutation.isPending}
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              {regenerateMutation.isPending ? 'Regenerating…' : 'Fix Mismatched Invoices'}
                            </Button>
                          )}
                          {diagnostic.invoices.some(inv => inv.gross_total !== diagnostic.current_plan.total_amount && inv.tuition_net > 0) && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 space-y-1">
                              <p className="font-semibold">⚠ Students with payments cannot be regenerated:</p>
                              {diagnostic.invoices
                                .filter(inv => inv.gross_total !== diagnostic.current_plan.total_amount && inv.tuition_net > 0)
                                .map((inv, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-2">
                                    <span>{inv.student_name} (paid: ₹{inv.tuition_net?.toLocaleString()})</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => restoreMutation.mutate(inv.student_id)}
                                      disabled={restoreMutation.isPending}
                                    >
                                      {restoreMutation.isPending ? 'Restoring…' : 'Restore'}
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">No current fee plan found. Create a fee plan first.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}