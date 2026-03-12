import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';
import LoginRequired from '@/components/LoginRequired';

export default function DailyClosingReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showVoided, setShowVoided] = useState(false);
  const printRef = useRef(null);

  // Fetch daily closing summary
  const { data, isLoading, error } = useQuery({
    queryKey: ['daily-closing', selectedDate, showVoided],
    queryFn: async () => {
      const staffSession = localStorage.getItem('staff_session');
      const payload = {
        date: selectedDate,
        includeVoided: showVoided.toString()
      };
      
      // Add staffInfo if on mobile
      if (staffSession) {
        try {
          payload.staffInfo = JSON.parse(staffSession);
        } catch {}
      }
      
      const res = await base44.functions.invoke('getDailyClosingSummary', payload);
      return res.data;
    }
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printRef.current.innerHTML);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportCSV = () => {
    if (!data) return;

    const rows = [];
    rows.push(['DAILY CLOSING SUMMARY - ' + selectedDate]);
    rows.push([]);

    // Summary
    rows.push(['SUMMARY']);
    rows.push(['Total Collected', data.totals.totalCollected.toFixed(2)]);
    rows.push(['Total Receipts', data.totals.totalReceipts]);
    if (data.totals.totalVoidedCount > 0) {
      rows.push(['Voided Count', data.totals.totalVoidedCount]);
      rows.push(['Voided Amount', data.totals.totalVoidedAmount.toFixed(2)]);
    }
    rows.push([]);

    // Mode breakdown
    rows.push(['MODE BREAKDOWN']);
    rows.push(['Mode', 'Amount', 'Receipt Count']);
    data.byMode.forEach(m => {
      rows.push([m.mode, m.collected.toFixed(2), m.receiptCount]);
    });
    rows.push([]);

    // Receipts
    rows.push(['RECEIPTS']);
    rows.push(['Receipt No', 'Student', 'Class', 'Mode', 'Amount', 'Status']);
    data.receipts.forEach(r => {
      rows.push([r.receiptNo, r.studentName, r.className, r.mode, r.amount.toFixed(2), r.status]);
    });

    // Generate CSV
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily_closing_${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    toast.success('Daily closing report exported');
  };

  if (isLoading) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Daily Closing">
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </LoginRequired>
    );
  }

  const totals = data?.totals || {};
  const byMode = data?.byMode || [];
  const receipts = data?.receipts || [];

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Daily Closing">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
       <div className="max-w-5xl mx-auto">
         {/* Header */}
         <div className="mb-6">
           <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Daily Closing Report</h1>
           <p className="text-gray-600 dark:text-gray-400">End-of-day collection summary</p>
          </div>

          {/* Controls */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Select Date</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-40"
                  />
                </div>

                <div className="flex items-center gap-3 pt-7">
                  <input
                    type="checkbox"
                    id="showVoided"
                    checked={showVoided}
                    onChange={(e) => setShowVoided(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="showVoided" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    Show Voided (Audit)
                  </label>
                </div>

                <div className="flex gap-2 pt-7 ml-auto">
                  <Button onClick={handlePrint} variant="outline">
                    <Printer className="h-4 w-4 mr-2" /> Print
                  </Button>
                  <Button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">₹{(totals.totalCollected || 0).toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Receipts</CardTitle>
                </CardHeader>
                <CardContent>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.totalReceipts || 0}</p>
              </CardContent>
            </Card>

            {totals.totalVoidedCount > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Voided Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{totals.totalVoidedCount}</p>
                </CardContent>
              </Card>
            )}

            {totals.totalVoidedCount > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Voided Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">₹{(totals.totalVoidedAmount || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Mode Breakdown */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Collection by Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                   <tr>
                     <th className="px-4 py-3 text-left font-semibold dark:text-gray-300">Mode</th>
                     <th className="px-4 py-3 text-right font-semibold dark:text-gray-300">Amount</th>
                     <th className="px-4 py-3 text-right font-semibold dark:text-gray-300">Receipt Count</th>
                   </tr>
                  </thead>
                  <tbody>
                   {byMode.length === 0 ? (
                     <tr>
                       <td colSpan="3" className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                          No collections recorded
                        </td>
                      </tr>
                    ) : (
                      byMode.map((mode, idx) => (
                        <tr key={idx} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 font-medium dark:text-gray-200">{mode.mode}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">₹{(mode.collected || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right dark:text-gray-300">{mode.receiptCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Receipts Table */}
          <Card>
            <CardHeader>
              <CardTitle>Receipts ({receipts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                   <tr>
                     <th className="px-4 py-3 text-left font-semibold dark:text-gray-300">Receipt No</th>
                      <th className="px-4 py-3 text-left font-semibold dark:text-gray-300">Student</th>
                      <th className="px-4 py-3 text-left font-semibold dark:text-gray-300">Class</th>
                      <th className="px-4 py-3 text-left font-semibold dark:text-gray-300">Mode</th>
                      <th className="px-4 py-3 text-right font-semibold dark:text-gray-300">Amount</th>
                      <th className="px-4 py-3 text-center font-semibold dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                          No receipts recorded
                        </td>
                      </tr>
                    ) : (
                      receipts.map((r, idx) => (
                        <tr key={idx} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${r.status === 'VOID' ? 'opacity-60 bg-red-50 dark:bg-red-900/20' : ''}`}>
                         <td className="px-4 py-3 font-mono text-sm dark:text-gray-300">{r.receiptNo}</td>
                         <td className="px-4 py-3 dark:text-gray-300">{r.studentName}</td>
                         <td className="px-4 py-3 dark:text-gray-300">{r.className}</td>
                         <td className="px-4 py-3 dark:text-gray-300">{r.mode}</td>
                          <td className="px-4 py-3 text-right font-bold">₹{(r.amount || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            {r.status === 'VOID' ? (
                              <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">VOID</span>
                            ) : (
                              <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Active</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Hidden Print Template */}
          <div ref={printRef} style={{ display: 'none' }}>
            <DailyClosingPrintTemplate date={selectedDate} data={data} />
          </div>
        </div>
      </div>
    </LoginRequired>
  );
}

// Print template component
function DailyClosingPrintTemplate({ date, data }) {
  const totals = data?.totals || {};
  const byMode = data?.byMode || [];
  const receipts = data?.receipts || [];

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <style>{`
        body { font-family: Arial, sans-serif; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0; font-size: 14px; color: #666; }
        .summary { margin: 20px 0; }
        .summary-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
        .summary-label { font-weight: bold; }
        .summary-value { text-align: right; }
        .section-title { font-weight: bold; font-size: 14px; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; padding: 8px; border-bottom: 2px solid #000; font-weight: bold; font-size: 12px; }
        td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        @media print {
          body { margin: 0; padding: 0; }
        }
      `}</style>

      <div className="header">
        <h1>School Fee Collection</h1>
        <p>Daily Closing Summary</p>
        <p>Date: {date}</p>
      </div>

      <div className="summary">
        <div className="summary-item">
          <span className="summary-label">Total Collected:</span>
          <span className="summary-value">₹{(totals.totalCollected || 0).toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Receipts:</span>
          <span className="summary-value">{totals.totalReceipts || 0}</span>
        </div>
        {totals.totalVoidedCount > 0 && (
          <>
            <div className="summary-item">
              <span className="summary-label">Voided Count:</span>
              <span className="summary-value">{totals.totalVoidedCount}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Voided Amount:</span>
              <span className="summary-value">₹{(totals.totalVoidedAmount || 0).toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      <div className="section-title">Collection by Mode</div>
      <table>
        <thead>
          <tr>
            <th>Mode</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Count</th>
          </tr>
        </thead>
        <tbody>
          {byMode.map((m, idx) => (
            <tr key={idx}>
              <td>{m.mode}</td>
              <td className="text-right">₹{(m.collected || 0).toLocaleString()}</td>
              <td className="text-right">{m.receiptCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">Receipt Details</div>
      <table>
        <thead>
          <tr>
            <th>Receipt No</th>
            <th>Student</th>
            <th>Class</th>
            <th>Mode</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipts.filter(r => r.status !== 'VOID').map((r, idx) => (
            <tr key={idx}>
              <td>{r.receiptNo}</td>
              <td>{r.studentName}</td>
              <td>{r.className}</td>
              <td>{r.mode}</td>
              <td className="text-right">₹{(r.amount || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}