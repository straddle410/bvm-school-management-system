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
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const feeTypeName = invoice?.title || invoice?.installment_name || 'Fee';
      const fileName = `Receipt_${feeTypeName.replace(/\s+/g, '_')}_${studentSession?.name?.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (!invoice) return null;

  // If specific payment is selected, use only that payment's data
  const invoicePayments = payment ? [payment] : (payments || []).filter(p => p.invoice_id === invoice.id && p.status === 'Active');
  const displayAmount = payment ? payment.amount_paid : invoice.paid_amount;
  const displayDate = payment ? payment.payment_date : (invoicePayments[0]?.payment_date || invoice.due_date);
  const receiptNumber = payment ? payment.receipt_no : invoicePayments[0]?.receipt_no;
  
  // Calculate balance after this specific payment
  const balanceAfterPayment = payment 
    ? invoice.total_amount - payment.amount_paid
    : invoice.balance;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">Fee Receipt</h2>
          <div className="flex items-center gap-2">
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div ref={receiptRef} className="bg-white p-8">
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {schoolProfile?.logo_url && (
                  <img src={schoolProfile.logo_url} alt="School Logo" className="h-16 w-16 object-contain" />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{schoolProfile?.school_name || 'School Name'}</h1>
                  {schoolProfile?.address && <p className="text-sm text-gray-600 mt-1">{schoolProfile.address}</p>}
                  {schoolProfile?.phone && <p className="text-sm text-gray-600">Phone: {schoolProfile.phone}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Receipt Title */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">FEE RECEIPT - PARENT COPY</h2>
            <p className="text-sm text-gray-600 mt-1">Academic Year: {invoice.academic_year}</p>
          </div>

          {/* Student Details */}
          <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded">
            <div>
              <p className="text-xs text-gray-500 font-medium">Student Name</p>
              <p className="text-sm font-semibold text-gray-900">{studentSession?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Student ID</p>
              <p className="text-sm font-semibold text-gray-900">{studentSession?.student_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Class</p>
              <p className="text-sm font-semibold text-gray-900">{studentSession?.class_name}-{studentSession?.section}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Receipt Number</p>
              <p className="text-sm font-semibold text-gray-900">{receiptNumber || invoice.id?.slice(-8).toUpperCase() || 'N/A'}</p>
            </div>
          </div>

          {/* Fee Details */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Fee Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Fee Type</span>
                <span className="text-sm font-semibold text-gray-900">{invoice.title || invoice.installment_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Amount</span>
                <span className="text-sm font-semibold text-gray-900">₹{invoice.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Paid Amount</span>
                <span className="text-sm font-semibold text-green-600">₹{displayAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payment Date</span>
                <span className="text-sm font-semibold text-gray-900">{displayDate}</span>
              </div>
              {balanceAfterPayment > 0 && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold text-gray-700">Balance</span>
                  <span className="text-sm font-bold text-red-600">₹{balanceAfterPayment?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-300">
            <p className="text-xs text-gray-500 text-center italic">
              This is a computer generated receipt. No signature required.
            </p>
            <p className="text-xs text-gray-400 text-center mt-2">
              Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}