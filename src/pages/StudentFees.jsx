import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wallet, AlertCircle, CheckCircle2, Clock, ArrowLeft, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import StudentFeeReceipt from '@/components/fees/StudentFeeReceipt';

export default function StudentFees() {
  const [session, setSession] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('student_session') || sessionStorage.getItem('student_session');
    try {
      if (raw) setSession(JSON.parse(raw));
    } catch {}

    base44.entities.SchoolProfile.list()
      .then(p => p.length && setSchoolProfile(p[0]))
      .catch(() => {});
  }, []);

  const [currentAcademicYear, setCurrentAcademicYear] = useState(null);

  useEffect(() => {
    // Fetch current active academic year
    base44.entities.AcademicYear.filter({ status: 'Active' })
      .then(years => {
        if (years.length > 0) setCurrentAcademicYear(years[0].year);
      })
      .catch(() => {});
  }, []);

  const { data: invoices = [] } = useQuery({
    queryKey: ['student-fees', session?.student_id, currentAcademicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({ student_id: session?.student_id, academic_year: currentAcademicYear }),
    enabled: !!session?.student_id && !!currentAcademicYear,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['student-payments', selectedInvoice?.id],
    queryFn: () => base44.entities.FeePayment.filter({ invoice_id: selectedInvoice?.id, status: 'Active' }, '-payment_date', 50),
    enabled: !!selectedInvoice?.id && receiptModalOpen,
  });

  const handleViewReceipt = (invoice) => {
    setSelectedInvoice(invoice);
    setReceiptModalOpen(true);
  };

  if (!session) return null;

  const statusColors = {
    Pending: 'bg-yellow-100 text-yellow-700',
    Partial: 'bg-blue-100 text-blue-700',
    Paid: 'bg-green-100 text-green-700',
    Overdue: 'bg-red-100 text-red-700',
    Waived: 'bg-gray-100 text-gray-700',
    Cancelled: 'bg-slate-100 text-slate-700',
  };

  const statusIcons = {
    Pending: Clock,
    Partial: AlertCircle,
    Paid: CheckCircle2,
    Overdue: AlertCircle,
    Waived: CheckCircle2,
    Cancelled: AlertCircle,
  };

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const paidAmount = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const balance = totalAmount - paidAmount;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('StudentDashboard')} className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Fees
            </h1>
            <p className="text-sm text-blue-100">View your fee details</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 font-medium">Total</p>
              <p className="text-lg font-bold text-gray-900">₹{totalAmount}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 font-medium">Paid</p>
              <p className="text-lg font-bold text-green-600">₹{paidAmount}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 font-medium">Balance</p>
              <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{balance}</p>
            </CardContent>
          </Card>
        </div>

        {/* Invoices List */}
        {invoices.length > 0 ? (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const StatusIcon = statusIcons[invoice.status] || Clock;
              return (
                <Card key={invoice.id} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold text-sm text-gray-900">{invoice.installment_name}</p>
                          <Badge className={`text-xs ${statusColors[invoice.status]}`}>
                            {invoice.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Due: {invoice.due_date}</p>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-gray-600">Amount: ₹{invoice.total_amount}</span>
                          <span className="font-semibold text-gray-800">Paid: ₹{invoice.paid_amount}</span>
                        </div>
                        {(invoice.status === 'Paid' || invoice.status === 'Partial') && (
                          <Button
                            onClick={() => handleViewReceipt(invoice)}
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs h-7"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            View Receipt
                          </Button>
                        )}
                      </div>
                      <StatusIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No fee invoices found</p>
            </CardContent>
          </Card>
        )}
      </div>

      <StudentFeeReceipt
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        invoice={selectedInvoice}
        payments={payments}
        schoolProfile={schoolProfile}
        studentSession={session}
      />
    </div>
  );
}