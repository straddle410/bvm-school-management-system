import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Landmark, FileText, Calendar } from 'lucide-react';
import TransactionsTab from '@/components/financialManagement/TransactionsTab';
import BankDepositsTab from '@/components/financialManagement/BankDepositsTab';
import TaxStatementTab from '@/components/financialManagement/TaxStatementTab';

function getCurrentFinancialYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function getPreviousFinancialYear() {
  const [startStr] = getCurrentFinancialYear().split('-');
  const start = parseInt(startStr) - 1;
  return `${start}-${start + 1}`;
}

export default function FinancialManagement() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [periodOptions, setPeriodOptions] = useState([]);
  const [allAcademicYears, setAllAcademicYears] = useState([]);

  const currentFY = getCurrentFinancialYear();
  const previousFY = getPreviousFinancialYear();

  useEffect(() => {
    loadAcademicYears();
  }, []);

  const loadAcademicYears = async () => {
    try {
      const years = await base44.entities.AcademicYear.list('-start_date');
      setAllAcademicYears(years);

      // Build options
      const options = [
        { value: `FY_${currentFY}`, label: `Current Financial Year (${currentFY})`, type: 'FY' },
        { value: `FY_${previousFY}`, label: `Previous Financial Year (${previousFY})`, type: 'FY' },
      ];

      const currentAY = years.find(y => y.is_current);
      if (currentAY) {
        options.push({ value: `AY_${currentAY.year}`, label: `Current Academic Year (${currentAY.year})`, type: 'AY', record: currentAY });
        // Find previous AY
        const sorted = [...years].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
        const idx = sorted.findIndex(y => y.year === currentAY.year);
        if (idx !== -1 && idx + 1 < sorted.length) {
          const prevAY = sorted[idx + 1];
          options.push({ value: `AY_${prevAY.year}`, label: `Previous Academic Year (${prevAY.year})`, type: 'AY', record: prevAY });
        }
      }

      setPeriodOptions(options);
      setSelectedPeriod(`FY_${currentFY}`);
    } catch (e) {
      console.error(e);
    }
  };

  const getDateRange = () => {
    if (!selectedPeriod) return null;
    const option = periodOptions.find(o => o.value === selectedPeriod);
    if (!option) return null;

    if (option.type === 'FY') {
      const [startYear] = option.value.replace('FY_', '').split('-');
      return {
        start: `${startYear}-04-01`,
        end: `${parseInt(startYear) + 1}-03-31`,
        label: option.label,
      };
    } else {
      // AY — use dates from AcademicYear record
      const record = option.record;
      return {
        start: record.start_date,
        end: record.end_date,
        label: option.label,
        academicYear: record.year,
      };
    }
  };

  const dateRange = getDateRange();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4">
        <div className="flex items-center gap-3 mb-1">
          <DollarSign className="h-6 w-6" />
          <h1 className="text-xl font-bold">Financial Management</h1>
        </div>
        <p className="text-white/70 text-sm">Track income, expenses and generate tax reports</p>
      </div>

      <div className="px-3 sm:px-4 py-4 space-y-4">
        {/* Period Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-3 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-1 font-medium">Reporting Period</p>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="border-0 p-0 h-auto shadow-none font-semibold text-slate-800 dark:text-white focus:ring-0 text-sm">
                <SelectValue placeholder="Select period..." />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {dateRange && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-400">{dateRange.start}</p>
              <p className="text-xs text-slate-400">to {dateRange.end}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="transactions" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="bank-deposits" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Landmark className="h-4 w-4" /> Bank Deposits
            </TabsTrigger>
            <TabsTrigger value="tax-statement" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <FileText className="h-4 w-4" /> Tax Statement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <TransactionsTab dateRange={dateRange} selectedPeriod={selectedPeriod} />
          </TabsContent>
          <TabsContent value="bank-deposits">
            <BankDepositsTab dateRange={dateRange} selectedPeriod={selectedPeriod} />
          </TabsContent>
          <TabsContent value="tax-statement">
            <TaxStatementTab dateRange={dateRange} selectedPeriod={selectedPeriod} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}