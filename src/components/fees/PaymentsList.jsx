import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Receipt, RotateCcw, Printer } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import VoidModal from './ReversalModal';
import ReceiptPreviewModal from './ReceiptPreviewModal';

const CLASSES = ['All', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const today = () => format(new Date(), 'yyyy-MM-dd');
const yesterday = () => format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
const weekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const monthStart = () => format(startOfMonth(new Date()), 'yyyy-MM-dd');

const PRESETS = [
  { label: 'Today', from: today, to: today },
  { label: 'Yesterday', from: yesterday, to: yesterday },
  { label: 'This Week', from: weekStart, to: today },
  { label: 'This Month', from: monthStart, to: today },
];

const modeColor = {
  Cash: 'bg-green-100 text-green-800',
  Cheque: 'bg-blue-100 text-blue-800',
  Online: 'bg-purple-100 text-purple-800',
  UPI: 'bg-indigo-100 text-indigo-800',
  DD: 'bg-orange-100 text-orange-800'
};

export default function PaymentsList({ academicYear, isAdmin, canVoidReceipt }) {
  const [classFilter, setClassFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [activePreset, setActivePreset] = useState('Today');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [reversingPayment, setReversingPayment] = useState(null);
  const [voidingPaymentId, setVoidingPaymentId] = useState(null);
  const [printingPaymentId, setPrintingPaymentId] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [recordingNewPayment, setRecordingNewPayment] = useState(false);
  const queryClient = useQueryClient();

  const { data: receiptData, isLoading: isLoadingReceipt } = useQuery({
    queryKey: ['receipt-print', printingPaymentId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getReceiptForPrint', {
        payment_id: printingPaymentId
      });
      return res.data;
    },
    enabled: !!printingPaymentId,
    retry: 1
  });

  React.useEffect(() => {
    if (receiptData && !isLoadingReceipt) {
      setReceiptPreview(receiptData);
    }
  }, [receiptData, isLoadingReceipt]);

  const applyPreset = (preset) => {
    setActivePreset(preset.label);
    setFromDate(preset.from());
    setToDate(preset.to());
  };

  const handleFromChange = (val) => { setFromDate(val); setActivePreset(null); };
  const handleToChange = (val) => { setToDate(val); setActivePreset(null); };

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['fee-payments-all', academicYear, classFilter, fromDate, toDate],
    queryFn: () => {
      const filter = { academic_year: academicYear };
      if (classFilter !== 'All') filter.class_name = classFilter;
      return base44.entities.FeePayment.filter(filter, '-created_date', 500);
    },
    enabled: !!academicYear && !!fromDate && !!toDate
  });
  
  // Note: Payments are filtered by academic_year, which ensures only current-year student data

  const filtered = payments.filter(p => {
    const inRange = (!fromDate || p.payment_date >= fromDate) && (!toDate || p.payment_date <= toDate);
    const matchSearch = !search ||
      p.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.receipt_no?.toLowerCase().includes(search.toLowerCase()) ||
      p.student_id?.toLowerCase().includes(search.toLowerCase());
    return inRange && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));

  // Only count active (non-voided) payments in totals
  const activePayments = sorted.filter(p => p.status !== 'VOID');
  const totalCollected = activePayments.reduce((s, p) => s + (p.amount_paid || 0), 0);
  const voidCount = sorted.length - activePayments.length;

  return (
    <div className="space-y-6">
      {/* RECORD RECEIPT BUTTON - TOP OF PAGE */}
      <Button
        size="lg"
        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-lg font-bold py-4 px-8 min-h-[60px] shadow-lg"
        onClick={() => setRecordingNewPayment(true)}
      >
        <Receipt className="h-6 w-6 mr-2" />
        Record New Receipt
      </Button>

      {/* Date Range + Presets */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            {PRESETS.map(preset => (
              <Button
                key={preset.label}
                size="lg"
                variant={activePreset === preset.label ? 'default' : 'outline'}
                className={`text-base font-semibold min-h-[48px] px-5 ${activePreset === preset.label ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-3">
              <label className="text-base text-slate-600 font-semibold whitespace-nowrap">From</label>
              <Input type="date" className="w-44 text-base min-h-[48px]" value={fromDate} onChange={e => handleFromChange(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-base text-slate-600 font-semibold whitespace-nowrap">To</label>
              <Input type="date" className="w-44 text-base min-h-[48px]" value={toDate} onChange={e => handleToChange(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-52 text-base min-h-[48px]"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            {CLASSES.map(c => (
              <SelectItem key={c} value={c} className="text-base py-3">{c === 'All' ? 'All Classes' : `Class ${c}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="Search by student, receipt…" 
            className="pl-12 pr-12 text-base min-h-[48px]" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>
        <div className="text-base font-bold text-slate-700 ml-auto whitespace-nowrap text-right">
          <span className="text-2xl text-emerald-700 font-bold">₹{totalCollected.toLocaleString()}</span>
          <span className="text-slate-500 font-semibold ml-3 text-base">({activePayments.length} receipt{activePayments.length !== 1 ? 's' : ''})</span>
          {voidCount > 0 && (
            <span className="text-red-500 font-semibold ml-3 text-base">· {voidCount} voided</span>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-xl font-semibold text-slate-500">Loading...</div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Receipt className="h-14 w-14 mx-auto mb-4 opacity-30 text-slate-400" />
          <p className="text-lg text-slate-500 font-semibold">No receipts found for this period</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {sorted.map(p => {
            const isVoid = p.status === 'VOID';
            const highlightStudent = search && p.student_name?.toLowerCase().includes(search.toLowerCase());
            const highlightReceipt = search && p.receipt_no?.toLowerCase().includes(search.toLowerCase());
            return (
              <Card key={p.id} className={`border-2 shadow-md ${isVoid ? 'opacity-60 border-slate-200' : 'border-slate-300'}`}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0 ${isVoid ? 'bg-red-100' : 'bg-emerald-100'}`}>
                    <Receipt className={`h-7 w-7 ${isVoid ? 'text-red-500' : 'text-emerald-700'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className={`font-semibold text-xl ${isVoid ? 'line-through text-slate-400' : highlightStudent ? 'text-indigo-700 bg-yellow-100 px-2 rounded' : 'text-slate-900'}`}>
                        {p.student_name}
                      </p>
                      <span className="text-base text-slate-500 font-medium">{p.student_id}</span>
                      {isVoid ? (
                        <Badge variant="destructive" className="text-sm py-1 px-3 font-bold">VOID</Badge>
                      ) : (
                        <span className={`text-sm px-3 py-1 rounded-full font-bold ${modeColor[p.payment_mode] || 'bg-slate-200'}`}>{p.payment_mode}</span>
                      )}
                    </div>
                    <p className={`text-base mt-1 ${isVoid ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                      {p.installment_name} · {p.payment_date} · <span className={highlightReceipt ? 'bg-yellow-100 px-1 rounded font-bold text-indigo-700' : ''}>#{p.receipt_no}</span>
                    </p>
                    {p.reference_no && <p className="text-base text-slate-500 mt-1">Ref: {p.reference_no}</p>}
                    {isVoid && p.void_reason && (
                      <p className="text-base text-red-600 font-semibold mt-1">↩ {p.void_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className={`font-bold text-2xl ${isVoid ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                      ₹{(p.amount_paid || 0).toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="lg"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 min-h-[44px] px-4 text-base font-semibold gap-2"
                        onClick={() => setPrintingPaymentId(p.id)}
                      >
                        <Printer className="h-5 w-5" />
                        Print
                      </Button>
                      {!isVoid && canVoidReceipt && (
                         <Button
                           size="lg"
                           variant="ghost"
                           className="text-red-600 hover:text-red-800 hover:bg-red-50 min-h-[44px] px-4 text-base font-semibold gap-2"
                           disabled={voidingPaymentId === p.id}
                           onClick={() => setReversingPayment(p)}
                         >
                           {voidingPaymentId === p.id ? (
                             <>
                               <div className="h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                               Voiding...
                             </>
                           ) : (
                             <>
                               <RotateCcw className="h-5 w-5" />
                               Void
                             </>
                           )}
                         </Button>
                       )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {reversingPayment && (
        <VoidModal
          payment={reversingPayment}
          onClose={() => {
            setReversingPayment(null);
            setVoidingPaymentId(null);
          }}
          onVoidingStart={() => setVoidingPaymentId(reversingPayment.id)}
          onSuccess={() => {
            setReversingPayment(null);
            setVoidingPaymentId(null);
            // VoidModal now handles all query invalidations
            queryClient.invalidateQueries({ queryKey: ['fee-payments-all'] });
          }}
        />
      )}

      <ReceiptPreviewModal
        isOpen={!!printingPaymentId && !!receiptPreview}
        onClose={() => {
          setPrintingPaymentId(null);
          setReceiptPreview(null);
        }}
        receiptData={receiptPreview}
        isLoading={isLoadingReceipt}
      />
    </div>
  );
}