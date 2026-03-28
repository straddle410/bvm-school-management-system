import React, { useRef } from 'react';
import { appParams } from '@/lib/app-params';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function PublicReceipt() {
  const receiptRef = useRef();

  const urlParams = new URLSearchParams(window.location.search);
  const receiptNo = urlParams.get('receipt_no') || '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-receipt', receiptNo],
    enabled: !!receiptNo,
    retry: 1,
    queryFn: async () => {
      const appId = appParams.appId;
      // Use window.location.origin so it's always same-origin (no CORS)
      const origin = window.location.origin;
      const res = await fetch(
        `${origin}/api/apps/${appId}/functions/getPublicReceipt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipt_no: receiptNo }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Not found');
      return json;
    }
  });

  const handleDownload = async () => {
    const element = receiptRef.current;
    if (!element) return;
    const canvas = await html2canvas(element, {
      scale: 2, useCORS: true, logging: false,
      backgroundColor: '#ffffff', allowTaint: true,
      scrollX: 0, scrollY: 0, windowWidth: 560
    });
    const imgData = canvas.toDataURL('image/jpeg', 1);
    const pdf = new jsPDF('p', 'mm', 'a5');
    const pdfWidth = 128;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 10, 15, pdfWidth, Math.min(imgHeight, 180));
    pdf.save(`Receipt_${receiptNo.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`);
  };

  if (!receiptNo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-gray-700">Invalid Receipt Link</h2>
          <p className="text-gray-500 mt-2">No receipt number found in the URL.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 mt-3">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-gray-700">Receipt Not Found</h2>
          <p className="text-gray-500 mt-2">No receipt found for: {receiptNo}</p>
        </div>
      </div>
    );
  }

  const { payment, student, school, invoice } = data;

  const snapshot = payment?.receipt_snapshot;
  const displayGrossAmount = snapshot?.invoice_gross_total ?? invoice?.gross_total ?? invoice?.total_amount;
  const displayDiscountAmount = snapshot?.invoice_discount_total ?? invoice?.discount_total ?? 0;
  const displayNetAmount = snapshot?.invoice_net_total ?? invoice?.total_amount;
  const totalPaidTillDate = snapshot?.total_paid_before != null
    ? snapshot.total_paid_before + payment.amount_paid
    : invoice?.paid_amount;
  const balanceAfterPayment = displayNetAmount != null ? displayNetAmount - (totalPaidTillDate ?? 0) : null;

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-lg mx-auto mb-4 flex justify-end">
        <Button onClick={handleDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <div ref={receiptRef} className="bg-white w-full max-w-lg mx-auto rounded-lg shadow-md" style={{ padding: '24px' }}>

        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-5 flex items-center gap-3">
          {school?.logo_url && (
            <img src={school.logo_url} alt="School Logo"
              style={{ width: '60px', height: '60px', objectFit: 'contain', flexShrink: 0 }}
              crossOrigin="anonymous" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{school?.school_name || 'School Name'}</h1>
            {school?.address && <p className="text-sm text-gray-600 mt-0.5">{school.address}</p>}
            {school?.phone && <p className="text-sm text-gray-600">Phone: {school.phone}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-gray-900">FEE RECEIPT - PARENT COPY</h2>
          <p className="text-base text-gray-600 mt-2">Academic Year: {payment.academic_year}</p>
        </div>

        {/* Student Details */}
        <div className="grid grid-cols-2 gap-3 mb-5 bg-gray-50 p-4 rounded">
          <div>
            <p className="text-sm text-gray-500 font-medium">Student Name</p>
            <p className="text-base font-bold text-gray-900 mt-1 break-words">{payment.student_name || student?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Student ID</p>
            <p className="text-base font-bold text-gray-900 mt-1">{payment.student_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Class</p>
            <p className="text-base font-bold text-gray-900 mt-1">
              {payment.class_name}{student?.section ? `-${student.section}` : ''}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Receipt Number</p>
            <p className="text-base font-bold text-gray-900 break-all mt-1">{payment.receipt_no}</p>
          </div>
        </div>

        {/* Fee Details */}
        <div className="mb-5">
          <h3 className="text-base font-bold text-gray-700 mb-3 border-b pb-2">Fee Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1">
              <span className="text-base text-gray-600">Fee Type</span>
              <span className="text-base font-semibold text-gray-900 text-right">{payment.installment_name}</span>
            </div>
            {displayGrossAmount != null && (
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600">Gross Amount</span>
                <span className="text-base font-semibold text-gray-900">
                  ₹{displayGrossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {displayDiscountAmount > 0 && (
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600">Discount</span>
                <span className="text-base font-semibold text-green-600">
                  -₹{displayDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {displayNetAmount != null && (
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600">Net Fee</span>
                <span className="text-base font-semibold text-gray-900">
                  ₹{displayNetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-1 pt-2 border-t">
              <span className="text-base text-gray-600">This Payment</span>
              <span className="text-base font-semibold text-blue-600">
                ₹{payment.amount_paid?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {totalPaidTillDate != null && (
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600">Total Paid Till Date</span>
                <span className="text-base font-semibold text-green-600">
                  ₹{totalPaidTillDate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-1">
              <span className="text-base text-gray-600">Payment Date</span>
              <span className="text-base font-semibold text-gray-900">{payment.payment_date}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-base text-gray-600">Payment Mode</span>
              <span className="text-base font-semibold text-gray-900">{payment.payment_mode}</span>
            </div>
            {payment.collected_by_name && (
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600">Collected By</span>
                <span className="text-base font-semibold text-gray-900">{payment.collected_by_name}</span>
              </div>
            )}
            {balanceAfterPayment != null && balanceAfterPayment > 0.01 && (
              <div className="flex justify-between items-center py-1 pt-2 border-t">
                <span className="text-lg font-bold text-gray-700">Balance Due</span>
                <span className="text-lg font-bold text-red-600">
                  ₹{balanceAfterPayment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {payment.status === 'VOID' && (
          <div className="text-center py-3 mb-4 bg-red-50 border border-red-300 rounded">
            <span className="text-2xl font-bold text-red-600 tracking-widest">VOID</span>
            {payment.void_reason && <p className="text-sm text-red-500 mt-1">{payment.void_reason}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-300">
          <p className="text-sm text-gray-500 text-center italic">
            This is a computer generated receipt. No signature required.
          </p>
          <p className="text-sm text-gray-400 text-center mt-2">
            Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}