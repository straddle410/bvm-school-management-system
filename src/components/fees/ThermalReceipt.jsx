import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ThermalReceipt({ payment, student, school, invoice, receiptNo }) {
  const receiptRef = useRef();

  const handlePrint = () => {
    window.print();
  };

  const handleCancel = () => {
    window.history.back();
  };

  const snapshot = payment?.receipt_snapshot;
  const displayGrossAmount = snapshot?.invoice_gross_total ?? invoice?.gross_total ?? invoice?.total_amount;
  const displayDiscountAmount = snapshot?.invoice_discount_total ?? invoice?.discount_total ?? 0;
  const displayNetAmount = snapshot?.invoice_net_total ?? invoice?.total_amount;
  const totalPaidTillDate = snapshot?.total_paid_before != null
    ? snapshot.total_paid_before + (payment?.amount_paid || 0)
    : (invoice?.paid_amount || 0) + (payment?.amount_paid || 0);
  const balanceAfterPayment = displayNetAmount != null ? displayNetAmount - (totalPaidTillDate ?? 0) : null;

  const handleDownload = async () => {
    const element = receiptRef.current;
    if (!element) return;
    const canvas = await html2canvas(element, {
      scale: 2, useCORS: true, logging: false,
      backgroundColor: '#ffffff', allowTaint: true,
      scrollX: 0, scrollY: 0, windowWidth: 800
    });
    const imgData = canvas.toDataURL('image/jpeg', 1);
    const pdf = new jsPDF('p', 'mm', [80, 200]);
    const imgHeight = (canvas.height * 75) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 2.5, 5, 75, Math.min(imgHeight, 180));
    pdf.save(`Receipt_${receiptNo.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2">
      <style>{`
        @media print {
          .button-container { display: none; }
          body { background: white; }
        }
      `}</style>
      <div className="button-container max-w-xs mx-auto mb-3 flex justify-center gap-2">
        <Button onClick={handleDownload} variant="outline" size="sm" className="text-xs">
          <Download className="h-3 w-3 mr-1" /> Download PDF
        </Button>
        <Button onClick={handlePrint} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
          🖨️ Print
        </Button>
        <Button onClick={handleCancel} variant="outline" size="sm" className="text-xs">
          Cancel
        </Button>
      </div>

      <div ref={receiptRef} className="bg-white mx-auto rounded-lg" style={{ width: '80mm', padding: '8mm', fontSize: '10px', lineHeight: '1.4' }}>
        {/* Header with logo */}
        <div className="text-center border-b border-gray-800 pb-2 mb-2">
          {school?.logo_url && (
            <img src={school.logo_url} alt="Logo" style={{ width: '35mm', height: 'auto', margin: '0 auto 4px' }} crossOrigin="anonymous" />
          )}
          <p className="font-bold text-sm">{school?.school_name || 'School Name'}</p>
          {school?.phone && <p className="text-xs text-gray-600">{school.phone}</p>}
        </div>

        {/* Receipt title */}
        <div className="text-center mb-2 border-b border-gray-300 pb-2">
          <p className="font-bold text-xs">FEE RECEIPT - PARENT COPY</p>
          <p className="text-xs text-gray-600">{payment.academic_year}</p>
        </div>

        {/* Student details */}
        <div className="mb-2 text-xs">
          <p><strong>Student:</strong> {payment.student_name || student?.name}</p>
          <p><strong>ID:</strong> {payment.student_id}</p>
          <p><strong>Class:</strong> {payment.class_name}{student?.section ? `-${student.section}` : ''}</p>
          <p><strong>Receipt #:</strong> {payment.receipt_no}</p>
        </div>

        {/* Fee details */}
        <div className="border-t border-gray-300 pt-2 mb-2 text-xs">
          <div className="flex justify-between mb-1">
            <span>Fee Type:</span>
            <span className="font-semibold">{payment.installment_name}</span>
          </div>
          {displayGrossAmount != null && (
            <div className="flex justify-between mb-1">
              <span>Gross:</span>
              <span>₹{displayGrossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {displayDiscountAmount > 0 && (
            <div className="flex justify-between mb-1 text-green-600">
              <span>Discount:</span>
              <span>−₹{displayDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {displayNetAmount != null && (
            <div className="flex justify-between mb-1 border-t border-gray-300 pt-1">
              <span>Net Fee:</span>
              <span className="font-semibold">₹{displayNetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {/* Payment info */}
        <div className="border-t border-gray-300 pt-2 mb-2 text-xs">
          <div className="flex justify-between mb-1 font-bold text-blue-600">
            <span>This Payment:</span>
            <span>₹{payment.amount_paid?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {totalPaidTillDate != null && (
            <div className="flex justify-between mb-1">
              <span>Total Paid:</span>
              <span>₹{totalPaidTillDate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between mb-1">
            <span>Date:</span>
            <span>{payment.payment_date}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Mode:</span>
            <span>{payment.payment_mode}</span>
          </div>
          {balanceAfterPayment != null && balanceAfterPayment > 0.01 && (
            <div className="flex justify-between border-t border-gray-300 pt-1 mt-1 font-bold text-red-600">
              <span>Balance:</span>
              <span>₹{balanceAfterPayment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {payment.status === 'VOID' && (
          <div className="text-center py-2 border border-red-300 rounded text-red-600 font-bold text-xs">
            VOID
            {payment.void_reason && <p className="text-xs">{payment.void_reason}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-2 border-t border-gray-300 pt-2">
          <p>Computer Generated</p>
          <p className="text-xs">Thank You</p>
        </div>
      </div>
    </div>
  );
}