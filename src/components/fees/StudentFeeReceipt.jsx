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
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a5');
      
      // A5 dimensions: 148mm x 210mm with 10mm margins
      const pdfWidth = 148 - 20; // 128mm usable width
      const pdfHeight = 210 - 20; // 190mm usable height
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pdfHeight));
      
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
  
  // Calculate total paid till this receipt date (cumulative)
  const allInvoicePayments = (payments || []).filter(p => p.invoice_id === invoice.id && p.status === 'Active');
  const totalPaidTillDate = payment 
    ? allInvoicePayments
        .filter(p => new Date(p.payment_date) <= new Date(payment.payment_date))
        .reduce((sum, p) => sum + (p.amount_paid || 0), 0)
    : invoice.paid_amount;
  
  // Calculate balance after cumulative payments
  const balanceAfterPayment = invoice.total_amount - totalPaidTillDate;
  
  // Get gross and discount amounts
  const grossAmount = invoice.gross_total || invoice.total_amount;
  const discountAmount = invoice.discount_total || 0;

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
        <div ref={receiptRef} className="bg-white p-4 sm:p-6 w-full mx-auto" style={{ maxWidth: '560px' }}>
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-3 mb-4 w-full">
            <div className="flex items-center gap-2 sm:gap-3">
              {schoolProfile?.logo_url && (
                <img src={schoolProfile.logo_url} alt="School Logo" className="h-10 w-10 sm:h-12 sm:w-12 object-contain flex-shrink-0" crossOrigin="anonymous" />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">{schoolProfile?.school_name || 'School Name'}</h1>
                {schoolProfile?.address && <p className="text-[9px] sm:text-[10px] text-gray-600 mt-0.5 line-clamp-2">{schoolProfile.address}</p>}
                {schoolProfile?.phone && <p className="text-[9px] sm:text-[10px] text-gray-600">Phone: {schoolProfile.phone}</p>}
              </div>
            </div>
          </div>

          {/* Receipt Title */}
          <div className="text-center mb-4 w-full">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900">FEE RECEIPT - PARENT COPY</h2>
            <p className="text-[9px] sm:text-[10px] text-gray-600 mt-1">Academic Year: {invoice.academic_year}</p>
          </div>

          {/* Student Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 bg-gray-50 p-3 rounded w-full">
            <div>
              <p className="text-[9px] text-gray-500 font-medium">Student Name</p>
              <p className="text-[10px] font-semibold text-gray-900 break-words">{studentSession?.name}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 font-medium">Student ID</p>
              <p className="text-[10px] font-semibold text-gray-900">{studentSession?.student_id}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 font-medium">Class</p>
              <p className="text-[10px] font-semibold text-gray-900">{studentSession?.class_name}-{studentSession?.section}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 font-medium">Receipt Number</p>
              <p className="text-[10px] font-semibold text-gray-900 break-all">{receiptNumber || invoice.id?.slice(-8).toUpperCase() || 'N/A'}</p>
            </div>
          </div>

          {/* Fee Details */}
          <div className="mb-4 w-full">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-700 mb-2 border-b pb-1">Fee Details</h3>
            <div className="space-y-1.5 w-full">
              <div className="flex justify-between items-center py-1">
                <span className="text-[9px] sm:text-[10px] text-gray-600 flex-shrink-0 mr-2">Fee Type</span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-gray-900 text-right break-words">{invoice.title || invoice.installment_name}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[9px] sm:text-[10px] text-gray-600 flex-shrink-0">Gross Amount</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-900">₹{grossAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-[9px] sm:text-[10px] text-gray-600 flex-shrink-0">Discount</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-green-600">-₹{discountAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="text-[9px] sm:text-[10px] text-gray-600 flex-shrink-0">Net Fee</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-900">₹{invoice.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1 pt-1.5 border-t">
                <span className="text-[9px] sm:text-[10px] text-gray-600 flex-shrink-0">This Payment</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-blue-600">₹{thisPaymentAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[9px] sm:text-[10px] text-gray-600 flex-shrink-0 mr-2">Total Paid Till Date</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-green-600">₹{totalPaidTillDate?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[9px] sm:text-[10px] text-gray-600 flex-shrink-0">Payment Date</span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-gray-900">{displayDate}</span>
              </div>
              {balanceAfterPayment > 0 && (
                <div className="flex justify-between items-center py-1 pt-1.5 border-t">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-gray-700 flex-shrink-0">Balance Due</span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-red-600">₹{balanceAfterPayment?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-3 border-t border-gray-300 w-full">
            <p className="text-[8px] sm:text-[9px] text-gray-500 text-center italic">
              This is a computer generated receipt. No signature required.
            </p>
            <p className="text-[8px] sm:text-[9px] text-gray-400 text-center mt-1">
              Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}