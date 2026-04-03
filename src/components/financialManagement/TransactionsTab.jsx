import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, TrendingUp, TrendingDown, ArrowRightLeft, Pencil, Trash2, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import TransactionForm from './TransactionForm';

const TYPE_COLORS = {
  Income: 'bg-green-100 text-green-700 border-green-200',
  Expense: 'bg-red-100 text-red-700 border-red-200',
  'Bank Transfer': 'bg-blue-100 text-blue-700 border-blue-200',
};

const TYPE_ICONS = {
  Income: TrendingUp,
  Expense: TrendingDown,
  'Bank Transfer': ArrowRightLeft,
};

function getFinancialYear(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = m >= 3 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export default function TransactionsTab({ dateRange, selectedPeriod }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');

  useEffect(() => {
    if (dateRange) loadTransactions();
  }, [dateRange]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Transaction.list('-transaction_date', 500);
      const filtered = all.filter(t =>
        t.transaction_date >= dateRange.start && t.transaction_date <= dateRange.end
      );
      setTransactions(filtered);
    } catch (e) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      const staffRaw = localStorage.getItem('staff_session');
      const staff = staffRaw ? JSON.parse(staffRaw) : null;
      const fy = getFinancialYear(data.transaction_date);

      // Determine academic_year from date
      const txDate = new Date(data.transaction_date);
      const year = txDate.getFullYear();
      const month = txDate.getMonth();
      const ayStart = month >= 3 ? year : year - 1;
      const academic_year = `${ayStart}-${String(ayStart + 1).slice(2)}`;

      const payload = { ...data, financial_year: fy, academic_year, recorded_by: staff?.email || '' };

      if (editingTx) {
        await base44.entities.Transaction.update(editingTx.id, payload);
        toast.success('Transaction updated');
      } else {
        await base44.entities.Transaction.create(payload);
        toast.success('Transaction recorded');
      }
      setShowForm(false);
      setEditingTx(null);
      loadTransactions();
    } catch (e) {
      toast.error('Failed to save transaction');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    await base44.entities.Transaction.delete(id);
    toast.success('Deleted');
    loadTransactions();
  };

  const displayed = transactions.filter(t => {
    const matchType = filterType === 'All' || t.type === filterType;
    const matchSearch = !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalIncome = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.amount || 0), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800 text-center">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">Total Income</p>
          <p className="text-base font-bold text-green-700 dark:text-green-300">₹{totalIncome.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800 text-center">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">Total Expense</p>
          <p className="text-base font-bold text-red-700 dark:text-red-300">₹{totalExpense.toLocaleString('en-IN')}</p>
        </div>
        <div className={`rounded-xl p-3 border text-center ${net >= 0 ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'}`}>
          <p className={`text-xs font-medium ${net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>Net</p>
          <p className={`text-base font-bold ${net >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>₹{net.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm"
        >
          <option value="All">All Types</option>
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
        <Button size="sm" onClick={() => { setEditingTx(null); setShowForm(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : displayed.length === 0 ? (
        <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-slate-500 dark:text-gray-400">No transactions found for this period.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {displayed.map(tx => {
            const Icon = TYPE_ICONS[tx.type] || TrendingUp;
            return (
              <Card key={tx.id} className="border-0 shadow-sm dark:bg-gray-800">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tx.type === 'Income' ? 'bg-green-100' : tx.type === 'Expense' ? 'bg-red-100' : 'bg-blue-100'}`}>
                      <Icon className={`h-4 w-4 ${tx.type === 'Income' ? 'text-green-600' : tx.type === 'Expense' ? 'text-red-600' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{tx.description || tx.category}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">{tx.category} · {tx.payment_method}</p>
                          <p className="text-xs text-slate-400 dark:text-gray-500">{tx.transaction_date}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold text-sm ${tx.type === 'Income' ? 'text-green-600' : tx.type === 'Expense' ? 'text-red-600' : 'text-blue-600'}`}>
                            {tx.type === 'Expense' ? '-' : '+'}₹{(tx.amount || 0).toLocaleString('en-IN')}
                          </p>
                          <Badge variant="outline" className={`text-xs mt-1 ${TYPE_COLORS[tx.type]}`}>{tx.type}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTx(tx); setShowForm(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(tx.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditingTx(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTx ? 'Edit Transaction' : 'New Transaction'}</DialogTitle>
          </DialogHeader>
          <TransactionForm
            initial={editingTx}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingTx(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}