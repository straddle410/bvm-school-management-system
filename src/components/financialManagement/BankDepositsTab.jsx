import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Landmark, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function BankDepositsTab({ dateRange }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dateRange) load();
  }, [dateRange]);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Transaction.list('-transaction_date', 500);
      const filtered = all.filter(t =>
        t.transaction_date >= dateRange.start &&
        t.transaction_date <= dateRange.end
      );
      setTransactions(filtered);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const markReconciled = async (id) => {
    await base44.entities.Transaction.update(id, { status: 'Reconciled' });
    toast.success('Marked as Reconciled');
    load();
  };

  const markPendingDeposit = async (id) => {
    await base44.entities.Transaction.update(id, { status: 'Pending Bank Deposit' });
    toast.success('Marked as Pending Deposit');
    load();
  };

  const cash = transactions.filter(t => t.payment_method === 'Cash' && t.type !== 'Bank Transfer');
  const bankDeposits = transactions.filter(t => t.type === 'Bank Transfer');
  const pending = cash.filter(t => t.status === 'Pending Bank Deposit');
  const reconciled = transactions.filter(t => t.status === 'Reconciled');

  const totalCash = cash.reduce((s, t) => s + (t.amount || 0), 0);
  const totalPending = pending.reduce((s, t) => s + (t.amount || 0), 0);
  const totalReconciled = reconciled.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3 border border-slate-200 dark:border-gray-700 text-center">
          <p className="text-xs text-slate-500 font-medium">Total Cash</p>
          <p className="text-base font-bold text-slate-800 dark:text-white">₹{totalCash.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800 text-center">
          <p className="text-xs text-amber-600 font-medium">Pending Deposit</p>
          <p className="text-base font-bold text-amber-700 dark:text-amber-300">₹{totalPending.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800 text-center">
          <p className="text-xs text-green-600 font-medium">Reconciled</p>
          <p className="text-base font-bold text-green-700 dark:text-green-300">₹{totalReconciled.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Pending Deposits */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Pending Bank Deposits ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent className="py-6 text-center text-sm text-slate-500 dark:text-gray-400">No pending deposits.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {pending.map(tx => (
                  <Card key={tx.id} className="border-0 shadow-sm dark:bg-gray-800">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">{tx.description || tx.category}</p>
                        <p className="text-xs text-slate-500">{tx.transaction_date} · {tx.payment_method}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <p className="font-bold text-sm text-green-600">₹{(tx.amount || 0).toLocaleString('en-IN')}</p>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => markReconciled(tx.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Reconcile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Bank Deposits / Transfers */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-blue-500" /> Bank Deposits / Transfers ({bankDeposits.length})
            </h3>
            {bankDeposits.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent className="py-6 text-center text-sm text-slate-500 dark:text-gray-400">No bank transfers recorded.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {bankDeposits.map(tx => (
                  <Card key={tx.id} className="border-0 shadow-sm dark:bg-gray-800">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">{tx.description || tx.category}</p>
                        <p className="text-xs text-slate-500">{tx.transaction_date} · {tx.reference_number || 'No ref'}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <p className="font-bold text-sm text-blue-600">₹{(tx.amount || 0).toLocaleString('en-IN')}</p>
                        <Badge variant="outline" className={tx.status === 'Reconciled' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                          {tx.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}