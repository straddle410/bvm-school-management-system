import React, { useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function StudentFeeReceipt({ isOpen, onClose, invoice, payment, payments, schoolProfile, studentSession }) {
  const receiptRef = useRef();

  const handleDownload = async () => {
    const element = receiptRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 560
      });

      const imgData = canvas.toDataURL('image/jpeg', 1);
      const pdf = new jsPDF('p', 'mm', 'a5');
      
      // A5 dimensions: 148mm x 210mm with margins [top, left, bottom, right]
      const pdfWidth = 148 - 20; // 128mm usable width
      const pdfHeight = 210 - 30; // Account for top margin
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 10, 15, imgWidth, Math.min(imgHeight, pdfHeight));
      
      const receiptNo = receiptNumber?.replace(/[^a-zA-Z0-9-]/g, '') || 'Receipt';
      const studentName = studentSession?.name?.replace(/\s+/g, '_') || 'Student';
      const fileName = `Receipt_${receiptNo}_${studentName}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (!invoice) return null;

   // If specific payment is selected, use only that payment's data
   const invoicePayments = payment ? [payment] : (payments || []).filter(p => p.invoice_id === invoice.id && p.status === 'Active');
   const thisPaymentAmount = payment ? payment.amount_paid : invoice.paid_amount;
   const displayDate = payment ? payment.payment_date : (invoicePayments[0]?.payment_date || invoice.due_date);
   const receiptNumber = payment ? payment.receipt_no : invoicePayments[0]?.receipt_no;

   // Use receipt snapshot if available (frozen at payment time), else fall back to live invoice data
    const snapshot = payment?.receipt_snapshot;
    const displayGrossAmount = snapshot?.invoice_gross_total ?? (invoice.gross_total || invoice.total_amount);
    const displayDiscountAmount = snapshot?.invoice_discount_total ?? (invoice.discount_total || 0);
    const displayNetAmount = snapshot?.invoice_net_total ?? invoice.total_amount;
    const displayBalanceBefore = snapshot?.balance_before;
    const isSnapshotReceipt = !!snapshot;

   // Total Paid Till Date = frozen from snapshot at payment time (locked, never changes)
   // If snapshot exists, use it; otherwise, use balance calculation (no snapshot for old payments)
   const totalPaidTillDate = snapshot?.invoice_net_total - (snapshot?.balance_before || 0) ?? invoice.paid_amount;

  // Calculate balance after cumulative payments
  const balanceAfterPayment = invoice.total_amount - totalPaidTillDate;
  


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-0">
        <div className="sticky top-0 bg-white border-b px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 z-10">
          <h2 className="text-base sm:text-lg font-bold">Fee Receipt</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 sm:flex-initial">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-3 sm:px-6 pb-4">
        <div ref={receiptRef} className="bg-white w-full mx-auto" style={{ maxWidth: '560px', paddingTop: '20px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '24px' }}>
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-4 mb-5 w-full" style={{ minHeight: '80px', display: 'flex', alignItems: 'center', overflow: 'visible' }}>
            <div className="flex items-center gap-3 w-full">
              {schoolProfile?.logo_url && (
                <img src={schoolProfile.logo_url} alt="School Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', flexShrink: 0 }} crossOrigin="anonymous" />
              )}
              <div className="min-w-0 flex-1" style={{ overflow: 'visible' }}>
                <h1 className="text-xl font-bold text-gray-900">{schoolProfile?.school_name || 'School Name'}</h1>
                {schoolProfile?.address && <p className="text-sm text-gray-600 mt-1">{schoolProfile.address}</p>}
                {schoolProfile?.phone && <p className="text-sm text-gray-600">Phone: {schoolProfile.phone}</p>}
              </div>
            </div>
          </div>

          {/* Receipt Title */}
          <div className="text-center mb-5 w-full">
            <h2 className="text-xl font-bold text-gray-900">FEE RECEIPT - PARENT COPY</h2>
            <p className="text-base text-gray-600 mt-2">Academic Year: {invoice.academic_year}</p>
          </div>

          {/* Student Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 bg-gray-50 p-4 rounded w-full">
            <div>
              <p className="text-sm text-gray-500 font-medium">Student Name</p>
              <p className="text-base font-bold text-gray-900 break-words mt-1">{studentSession?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Student ID</p>
              <p className="text-base font-bold text-gray-900 mt-1">{studentSession?.student_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Class</p>
              <p className="text-base font-bold text-gray-900 mt-1">{studentSession?.class_name}-{studentSession?.section}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Receipt Number</p>
              <p className="text-base font-bold text-gray-900 break-all mt-1">{receiptNumber || invoice.id?.slice(-8).toUpperCase() || 'N/A'}</p>
            </div>
          </div>

          {/* Fee Details */}
          <div className="mb-5 w-full">
            <h3 className="text-base font-bold text-gray-700 mb-3 border-b pb-2">Fee Details</h3>
            {isSnapshotReceipt && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3 text-xs text-blue-700 flex items-start gap-2">
                <span className="font-semibold flex-shrink-0">📋 Frozen Receipt:</span>
                <span>Amounts locked at payment time. Future discount changes do not affect this receipt.</span>
              </div>
            )}
            <div className="space-y-2 w-full">
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600 flex-shrink-0 mr-2">Fee Type</span>
                <span className="text-base font-semibold text-gray-900 text-right break-words">{invoice.title || invoice.installment_name}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600 flex-shrink-0">Gross Amount</span>
                <span className="text-base font-semibold text-gray-900">₹{displayGrossAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {displayDiscountAmount > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-base text-gray-600 flex-shrink-0">Discount</span>
                  <span className="text-base font-semibold text-green-600">-₹{displayDiscountAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600 flex-shrink-0">Net Fee</span>
                <span className="text-base font-semibold text-gray-900">₹{displayNetAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1 pt-2 border-t">
                <span className="text-base text-gray-600 flex-shrink-0">This Payment</span>
                <span className="text-base font-semibold text-blue-600">₹{thisPaymentAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600 flex-shrink-0 mr-2">Total Paid Till Date</span>
                <span className="text-base font-semibold text-green-600">₹{totalPaidTillDate?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base text-gray-600 flex-shrink-0">Payment Date</span>
                <span className="text-base font-semibold text-gray-900">{displayDate}</span>
              </div>
              {balanceAfterPayment > 0 && (
                <div className="flex justify-between items-center py-1 pt-2 border-t">
                  <span className="text-lg font-bold text-gray-700 flex-shrink-0">Balance Due</span>
                  <span className="text-lg font-bold text-red-600">₹{balanceAfterPayment?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-300 w-full">
            <p className="text-sm text-gray-500 text-center italic">
              This is a computer generated receipt. No signature required.
            </p>
            <p className="text-sm text-gray-400 text-center mt-2">
              Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}