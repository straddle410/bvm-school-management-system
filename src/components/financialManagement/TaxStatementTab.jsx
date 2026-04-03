import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';

const INCOME_CATEGORIES = ['Fees Collected', 'Other Income'];

const EXPENSE_GROUPS = {
  'Staff Costs': ['Salaries & Wages'],
  'Premises & Utilities': ['Rent', 'Utilities', 'Maintenance'],
  'Finance Costs': ['Loan EMI', 'Bank Charges'],
  'Operational': ['Stationery & Supplies', 'Diesel & Fuel', 'Curriculum & Books', 'Transport Costs', 'Hostel Costs', 'IT & Software'],
  'Other Expenses': ['Marketing & Advertising', 'Insurance', 'Gifts & Donations', 'Tax Payments', 'Events & Activities', 'Other Expenses'],
};

export default function TaxStatementTab({ dateRange, selectedPeriod }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dateRange) load();
  }, [dateRange]);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Transaction.list('-transaction_date', 1000);
      const filtered = all.filter(t =>
        t.transaction_date >= dateRange.start &&
        t.transaction_date <= dateRange.end &&
        t.type !== 'Bank Transfer'
      );
      setTransactions(filtered);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const sumByCategories = (cats) =>
    transactions.filter(t => cats.includes(t.category)).reduce((s, t) => s + (t.amount || 0), 0);

  const totalIncome = INCOME_CATEGORIES.reduce((s, c) => s + sumByCategories([c]), 0);

  const expenseGroupTotals = Object.entries(EXPENSE_GROUPS).map(([group, cats]) => ({
    group,
    total: sumByCategories(cats),
    breakdown: cats.map(c => ({ category: c, amount: sumByCategories([c]) })).filter(x => x.amount > 0),
  }));

  const totalExpenses = expenseGroupTotals.reduce((s, g) => s + g.total, 0);
  const surplus = totalIncome - totalExpenses;

  const fmt = (n) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-indigo-600" />
            <p className="font-bold text-slate-800 dark:text-white text-sm">Income & Expenditure Statement (ITR-7)</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400">{dateRange?.label}</p>
          <p className="text-xs text-slate-400 dark:text-gray-500">Period: {dateRange?.start} to {dateRange?.end}</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Income Section */}
          <Card className="border-0 shadow-sm dark:bg-gray-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Income
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1">
              {INCOME_CATEGORIES.map(cat => {
                const amt = sumByCategories([cat]);
                return (
                  <div key={cat} className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-gray-700 last:border-0">
                    <span className="text-slate-600 dark:text-gray-300">{cat}</span>
                    <span className="font-medium text-slate-800 dark:text-white">{fmt(amt)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm font-bold pt-2 text-green-700 dark:text-green-400 border-t-2 border-green-200 dark:border-green-700 mt-2">
                <span>Total Income</span>
                <span>{fmt(totalIncome)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Expenditure Section */}
          <Card className="border-0 shadow-sm dark:bg-gray-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" /> Expenditure
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {expenseGroupTotals.map(g => (
                <div key={g.group}>
                  <div className="flex justify-between text-sm font-semibold text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-700 rounded-lg px-2 py-1.5">
                    <span>{g.group}</span>
                    <span>{fmt(g.total)}</span>
                  </div>
                  {g.breakdown.length > 0 && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {g.breakdown.map(item => (
                        <div key={item.category} className="flex justify-between text-xs py-0.5 text-slate-500 dark:text-gray-400">
                          <span>{item.category}</span>
                          <span>{fmt(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 text-red-700 dark:text-red-400 border-t-2 border-red-200 dark:border-red-700 mt-2">
                <span>Total Expenditure</span>
                <span>{fmt(totalExpenses)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Surplus / Deficit */}
          <Card className={`border-0 shadow-sm ${surplus >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className={`h-5 w-5 ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  <p className={`font-bold text-sm ${surplus >= 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {surplus >= 0 ? 'Surplus for the Period' : 'Deficit for the Period'}
                  </p>
                </div>
                <p className={`text-xl font-bold ${surplus >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {surplus >= 0 ? '' : '- '}{fmt(surplus)}
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                For ITR-7 filing, report this under Schedule I — Income & Expenditure Account
              </p>
            </CardContent>
          </Card>

          {/* Category-wise chart placeholder */}
          <Card className="border-0 shadow-sm dark:bg-gray-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-slate-700 dark:text-gray-200">Transactions Count by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {expenseGroupTotals.filter(g => g.total > 0).map(g => {
                  const pct = totalExpenses > 0 ? Math.round((g.total / totalExpenses) * 100) : 0;
                  return (
                    <div key={g.group}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-gray-300">{g.group}</span>
                        <span className="text-slate-500">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-2 bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}