import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import LoginRequired from '@/components/LoginRequired';

export default function PrintReceiptA5() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = searchParams.get('paymentId');

  // Store current URL in sessionStorage for post-login redirect
  useEffect(() => {
    if (paymentId) {
      sessionStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
    }
  }, [paymentId]);

  console.log('[PrintReceiptA5] paymentId from query:', paymentId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['receipt-print', paymentId],
    queryFn: async () => {
      console.log('[PrintReceiptA5] Calling getReceiptForPrint with paymentId:', paymentId);
      const res = await base44.functions.invoke('getReceiptForPrint', {
        payment_id: paymentId
      });
      console.log('[PrintReceiptA5] Response:', res.data);
      return res.data;
    },
    enabled: !!paymentId,
    retry: 1
  });

  // Auto print after data loads
  useEffect(() => {
    if (data && !isLoading) {
      setTimeout(() => window.print(), 500);
    }
  }, [data, isLoading]);

  if (!paymentId) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Print Receipt">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
            <h2 className="text-lg font-bold text-red-700 mb-3">Missing Payment ID</h2>
            <p className="text-sm text-red-600 mb-4">
              No payment ID provided in the URL. Please return to the payments list and click Print again.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Payments
            </Button>
          </div>
        </div>
      </LoginRequired>
    );
  }

  if (isLoading) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Print Receipt">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">Loading receipt {paymentId}...</p>
        </div>
      </LoginRequired>
    );
  }

  if (error) {
    const status = error?.response?.status;
    const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
    const errorStack = error?.response?.data?.stack || '';
    const errorContext = error?.response?.data?.context || {};

    let title = 'Error Loading Receipt';
    let userMsg = errorMsg;

    if (status === 401) {
      title = 'Not Authenticated';
      userMsg = 'Your session has expired. Please log in again.';
    } else if (status === 403) {
      title = 'Not Authorized';
      userMsg = 'You do not have permission to print receipts.';
    } else if (status === 404) {
      title = 'Receipt Not Found';
      userMsg = `Payment with ID ${paymentId} does not exist.`;
    }
    
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Print Receipt">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-bold text-red-700 mb-2">{title}</h2>
            <p className="text-sm text-red-600 mb-3">{userMsg}</p>
            <p className="text-xs text-red-500 mb-3">
              <strong>Payment ID:</strong> {paymentId}
            </p>
            {errorContext.step && (
              <p className="text-xs text-red-500 mb-3">
                <strong>Failed at:</strong> {errorContext.step}
              </p>
            )}
            {errorStack && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-red-700 font-semibold">Details</summary>
                <pre className="bg-red-100 p-2 rounded mt-1 overflow-auto text-red-700 max-h-48">{errorStack}</pre>
              </details>
            )}
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="w-full mt-4 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Payments
            </Button>
          </div>
        </div>
      </LoginRequired>
    );
  }

  if (!data) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Print Receipt">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-red-600">No data received from server</div>
        </div>
      </LoginRequired>
    );
  }

  const { school, receipt } = data;
  const isVoid = receipt.payment.status === 'VOID';

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Print Receipt">
      <style>{`
        @page {
          size: A5 portrait;
          margin: 6mm;
        }
        
        body {
          margin: 0;
          padding: 0;
          background: white;
          font-family: Arial, sans-serif;
          font-size: 9px;
          line-height: 1.3;
        }
        
        .a5-page {
          width: 100%;
          height: 100vh;
          padding: 0;
          margin: 0;
          overflow: hidden;
          page-break-after: always;
        }
        
        .receipt-copy {
          width: 100%;
          height: 48%;
          page-break-inside: avoid;
          break-inside: avoid;
          padding: 8px;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
          border: 1px solid #f0f0f0;
        }
        
        .receipt-copy.first {
          border-bottom: 2px dashed #ccc;
        }
        
        .receipt-copy.void-copy {
          background: rgba(255, 0, 0, 0.02);
        }
        
        .void-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 48px;
          font-weight: bold;
          color: rgba(255, 0, 0, 0.15);
          pointer-events: none;
          white-space: nowrap;
          z-index: 0;
        }
        
        .receipt-content {
          position: relative;
          z-index: 1;
        }
        
        .receipt-header {
          text-align: center;
          border-bottom: 1px solid #333;
          padding-bottom: 4px;
          margin-bottom: 4px;
        }
        
        .school-logo {
          width: 24px;
          height: 24px;
          margin: 0 auto 2px;
          display: block;
        }
        
        .school-name {
          font-weight: bold;
          font-size: 11px;
          margin: 2px 0 1px;
        }
        
        .school-details {
          font-size: 8px;
          color: #333;
          margin: 1px 0;
        }
        
        .receipt-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 10px;
          margin: 3px 0 2px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 2px;
        }
        
        .receipt-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          font-size: 8px;
          margin-bottom: 3px;
          padding-bottom: 2px;
          border-bottom: 1px solid #ddd;
        }
        
        .receipt-info-item {
          display: flex;
          justify-content: space-between;
        }
        
        .label {
          font-weight: bold;
          color: #333;
        }
        
        .box-section {
          border: 1px solid #ccc;
          padding: 3px;
          margin: 3px 0;
          font-size: 8px;
        }
        
        .box-title {
          font-weight: bold;
          font-size: 9px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 1px;
          margin-bottom: 2px;
        }
        
        .box-row {
          display: flex;
          justify-content: space-between;
          padding: 1px 0;
        }
        
        .amount-highlight {
          font-weight: bold;
          font-size: 11px;
          color: #000;
          text-align: center;
          padding: 2px;
          margin: 2px 0;
          border: 1px solid #333;
        }
        
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
          margin: 2px 0;
        }
        
        .summary-table td {
          border-bottom: 1px solid #ddd;
          padding: 1px 2px;
        }
        
        .summary-table .label {
          text-align: left;
          font-weight: bold;
        }
        
        .summary-table .value {
          text-align: right;
          font-weight: bold;
        }
        
        .receipt-footer {
          font-size: 7px;
          text-align: center;
          color: #666;
          margin-top: 3px;
          padding-top: 2px;
          border-top: 1px solid #ddd;
        }
        
        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          font-size: 8px;
          margin-top: 2px;
        }
        
        .signature-line {
          text-align: center;
          border-top: 1px solid #333;
          padding-top: 8px;
          height: 20px;
        }
        
        .stamp-area {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 30px;
          height: 30px;
          border: 1px dashed #999;
          font-size: 7px;
          text-align: center;
          padding-top: 10px;
          color: #999;
        }
        
        .void-note {
          font-size: 8px;
          color: #d32f2f;
          font-weight: bold;
          margin-top: 2px;
          padding: 2px;
          background: #ffebee;
        }
        
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          
          .a5-page {
            height: auto;
            page-break-after: always;
          }
        }
      `}</style>

      <div className="a5-page">
        {/* School Copy */}
        <div className={`receipt-copy first ${isVoid ? 'void-copy' : ''}`}>
          {isVoid && <div className="void-watermark">VOID</div>}
          
          <div className="receipt-content">
            <ReceiptContent school={school} receipt={receipt} copyLabel="SCHOOL COPY" />
          </div>
        </div>

        {/* Parent Copy */}
        <div className={`receipt-copy ${isVoid ? 'void-copy' : ''}`}>
          {isVoid && <div className="void-watermark">VOID</div>}
          
          <div className="receipt-content">
            <ReceiptContent school={school} receipt={receipt} copyLabel="PARENT COPY" />
          </div>
        </div>
      </div>
    </LoginRequired>
  );
}

function ReceiptContent({ school, receipt, copyLabel }) {
  const isVoid = receipt.payment.status === 'VOID';
  const amountInWords = numberToWords(receipt.payment.amount);

  return (
    <div>
      {/* Header */}
      <div className="receipt-header">
        {school.logoUrl && <img src={school.logoUrl} alt="Logo" className="school-logo" />}
        <div className="school-name">{school.name}</div>
        {school.addressLine1 && <div className="school-details">{school.addressLine1}</div>}
        {school.phone && <div className="school-details">Ph: {school.phone}</div>}
      </div>

      {/* Title Row */}
      <div className="receipt-title-row">
        <span>FEE RECEIPT</span>
        <span>{copyLabel}</span>
      </div>

      {/* Receipt Info */}
      <div className="receipt-info">
        <div className="receipt-info-item">
          <span className="label">Receipt No:</span>
          <span>{receipt.receiptNo}</span>
        </div>
        <div className="receipt-info-item">
          <span className="label">Date:</span>
          <span>{formatDate(receipt.dateTime)}</span>
        </div>
        <div className="receipt-info-item">
          <span className="label">Year:</span>
          <span>{receipt.academicYear}</span>
        </div>
      </div>

      {/* Student Details Box */}
      <div className="box-section">
        <div className="box-title">STUDENT DETAILS</div>
        <div className="box-row">
          <span className="label">Name:</span>
          <span>{receipt.student.name}</span>
        </div>
        <div className="box-row">
          <span className="label">Adm No:</span>
          <span>{receipt.student.admissionNo}</span>
        </div>
        <div className="box-row">
          <span className="label">Class:</span>
          <span>{receipt.student.className}-{receipt.student.sectionName}</span>
        </div>
      </div>

      {/* Payment Details Box */}
      <div className="box-section">
        <div className="box-title">PAYMENT DETAILS</div>
        <div className="box-row">
          <span className="label">Mode:</span>
          <span>{receipt.payment.mode}</span>
        </div>
        {receipt.payment.referenceNo && (
          <div className="box-row">
            <span className="label">Ref No:</span>
            <span>{receipt.payment.referenceNo}</span>
          </div>
        )}
        <div className="amount-highlight">
          Amount Paid: ₹{receipt.payment.amount.toLocaleString('en-IN')}
        </div>
        {amountInWords && <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '2px' }}>({amountInWords})</div>}
        
        {receipt.payment.collectedByName && (
          <div className="box-row" style={{ marginTop: '2px', paddingTop: '2px', borderTop: '1px solid #ddd' }}>
            <span className="label">Received By:</span>
            <span>{receipt.payment.collectedByName}</span>
          </div>
        )}
        
        {isVoid && receipt.voidInfo && (
          <div className="void-note">
            VOIDED - {receipt.voidInfo.void_reason || 'No reason'}
            {receipt.voidInfo.voided_by_name && <div style={{ marginTop: '2px' }}>By: {receipt.voidInfo.voided_by_name}</div>}
          </div>
        )}
      </div>

      {/* Fee Summary */}
      <table className="summary-table">
        <tbody>
          <tr>
            <td className="label">Gross Amount:</td>
            <td className="value">₹{receipt.invoice.gross.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td className="label">Discount:</td>
            <td className="value">-₹{receipt.invoice.discount.toLocaleString('en-IN')}</td>
          </tr>
          <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
            <td className="label">Net Fee:</td>
            <td className="value">₹{receipt.invoice.net.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td className="label">Total Paid:</td>
            <td className="value">₹{receipt.invoice.totalPaidAfterThis.toLocaleString('en-IN')}</td>
          </tr>
          <tr style={{ backgroundColor: '#fff3e0' }}>
            <td className="label">Balance Due:</td>
            <td className="value">₹{receipt.invoice.balanceDueAfterThis.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="receipt-footer">
        This is a computer generated receipt
      </div>

      {/* Signature Section */}
      <div className="signature-section">
        <div className="signature-line" style={{ borderWidth: '1px 0 0 0' }}>
          <div style={{ fontSize: '7px', marginBottom: '2px' }}>Accountant</div>
        </div>
        <div className="signature-line" style={{ borderWidth: '1px 0 0 0' }}>
          <div style={{ fontSize: '7px', marginBottom: '2px' }}>Authorized By</div>
        </div>
      </div>

      {/* Stamp Area */}
      <div className="stamp-area">STAMP</div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function numberToWords(num) {
  if (!num || num < 0) return '';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    return numberToWords(thousands) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  }
  return num.toString();
}