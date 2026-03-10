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
      setTimeout(() => {
        window.print();
        window.addEventListener('afterprint', () => {
          window.close();
        }, { once: true });
      }, 300);
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
          size: A5 landscape;
          margin: 4mm;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white;
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.18;
        }

        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .copiesRow {
          display: flex;
          gap: 4mm;
        }

        .copy {
          flex: 1;
          border: 1px solid #111;
          border-radius: 4px;
          padding: 3.5mm;
          box-sizing: border-box;
          overflow: hidden;
          background: white;
        }

        .copy.void {
          background: rgba(255, 0, 0, 0.03);
        }

        .void-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 48px;
          font-weight: bold;
          color: rgba(255, 0, 0, 0.1);
          pointer-events: none;
          z-index: 0;
        }

        .header {
          text-align: center;
          border-bottom: 1px solid #333;
          padding-bottom: 1.5mm;
          margin-bottom: 1.5mm;
        }

        .logo {
          width: 70px;
          height: auto;
          margin: 0 auto 2px;
          display: block;
        }

        .school-name {
          font-size: 15px;
          font-weight: 800;
          margin: 1mm 0 0;
        }

        .school-info {
          font-size: 11px;
          color: #333;
          margin: 0.5mm 0 0;
        }

        .receipt-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 13px;
          margin: 1.5mm 0 1mm;
          padding-bottom: 0.5mm;
          border-bottom: 1px solid #999;
        }

        .copy-badge {
          font-size: 10px;
          font-weight: bold;
          background: #f0f0f0;
          padding: 1px 4px;
          border-radius: 2px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1mm;
          font-size: 11px;
          margin-bottom: 1.5mm;
          padding-bottom: 1mm;
          border-bottom: 1px solid #ddd;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
        }

        .label {
          font-weight: bold;
          color: #333;
        }

        .box {
          border: 1px solid #ccc;
          padding: 2mm;
          margin: 1.5mm 0;
          font-size: 11px;
        }

        .box-title {
          font-weight: bold;
          font-size: 11px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 0.5mm;
          margin-bottom: 0.5mm;
        }

        .box-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5mm 0;
          font-size: 11px;
        }

        .amount-box {
          font-weight: bold;
          font-size: 12px;
          color: #000;
          text-align: center;
          padding: 1mm;
          margin: 1mm 0;
          border: 1px solid #333;
          background: #fafafa;
        }

        .summary {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin: 1mm 0;
        }

        .summary td {
          border-bottom: 1px solid #ddd;
          padding: 0.5mm 1mm;
        }

        .summary .label {
          text-align: left;
          font-weight: bold;
        }

        .summary .value {
          text-align: right;
          font-weight: bold;
        }

        .footer {
          font-size: 10px;
          text-align: center;
          color: #666;
          margin-top: 1.5mm;
          padding-top: 0.5mm;
          border-top: 1px solid #ddd;
        }

        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2mm;
          font-size: 10px;
          margin-top: 1.5mm;
        }

        .sig-line {
          text-align: center;
          border-top: 1px solid #333;
          padding-top: 3mm;
          height: 10mm;
        }

        .void-note {
          font-size: 11px;
          color: #d32f2f;
          font-weight: bold;
          margin-top: 1mm;
          padding: 1mm;
          background: #ffebee;
        }

        @media print {
          .no-print, nav, header, footer {
            display: none !important;
          }

          body {
            margin: 0;
            padding: 0;
            max-height: 100%;
            overflow: hidden;
          }

          * {
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="copiesRow">
        {/* School Copy */}
        <div className={`copy ${isVoid ? 'void' : ''}`}>
          <ReceiptContent school={school} receipt={receipt} copyLabel="SCHOOL COPY" />
        </div>

        {/* Parent Copy */}
        <div className={`copy ${isVoid ? 'void' : ''}`}>
          <ReceiptContent school={school} receipt={receipt} copyLabel="PARENT COPY" />
        </div>
      </div>
    </LoginRequired>
  );
}

function ReceiptContent({ school, receipt, copyLabel }) {
  const isVoid = receipt.payment.status === 'VOID';
  const amountInWords = numberToWords(receipt.payment.amount);

  // Determine Fee Type
  const feeType = receipt.invoice.type === 'ANNUAL' 
    ? 'Annual Fee'
    : receipt.invoice.type === 'ADDITIONAL'
    ? 'Additional Fee'
    : receipt.invoice.chargeName || 'Additional Fee';

  return (
    <div style={{ position: 'relative' }}>
      {isVoid && <div className="void-watermark">VOID</div>}
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className="header">
          {school.logoUrl && <img src={school.logoUrl} alt="Logo" className="logo" />}
          <div className="school-name">{school.name}</div>
          {school.addressLine1 && <div className="school-info">{school.addressLine1}</div>}
          {school.phone && <div className="school-info">Ph: {school.phone}</div>}
        </div>

        {/* Title Row */}
        <div className="receipt-title">
          <span>FEE RECEIPT</span>
          <span className="copy-badge">{copyLabel}</span>
        </div>

        {/* Receipt Info Grid */}
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Receipt No:</span>
            <span>{receipt.receiptNo}</span>
          </div>
          <div className="info-row">
            <span className="label">Date:</span>
            <span>{formatDate(receipt.dateTime)}</span>
          </div>
          <div className="info-row">
            <span className="label">Year:</span>
            <span>{receipt.academicYear}</span>
          </div>
          <div className="info-row">
            <span className="label">Fee Type:</span>
            <span>{feeType}</span>
          </div>
        </div>

        {/* Student Details Box */}
        <div className="box">
          <div className="box-title">STUDENT DETAILS</div>
          <div className="box-row">
            <span className="label">Name:</span>
            <span>{receipt.student.name}</span>
          </div>
          <div className="box-row">
            <span className="label">ID:</span>
            <span>{receipt.student.admissionNo}</span>
          </div>
          <div className="box-row">
            <span className="label">Class:</span>
            <span>{receipt.student.className}-{receipt.student.sectionName}</span>
          </div>
        </div>

        {/* Payment Details Box */}
        <div className="box">
          <div className="box-title">PAYMENT DETAILS</div>
          <div className="box-row">
            <span className="label">Payment Mode:</span>
            <span>{receipt.payment.mode}</span>
          </div>
          {receipt.payment.referenceNo && (
            <div className="box-row">
              <span className="label">Ref No:</span>
              <span>{receipt.payment.referenceNo}</span>
            </div>
          )}
          <div className="amount-box">
            Amount Paid: ₹{receipt.payment.amount.toLocaleString('en-IN')}
          </div>
          {amountInWords && (
            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '1mm' }}>
              ({amountInWords})
            </div>
          )}
          
          {receipt.payment.collectedByName && (
            <div className="box-row" style={{ marginTop: '1mm', paddingTop: '1mm', borderTop: '1px solid #ddd' }}>
              <span className="label">Received By:</span>
              <span>{receipt.payment.collectedByName}</span>
            </div>
          )}
          
          {isVoid && receipt.voidInfo && (
            <div className="void-note">
              VOIDED - {receipt.voidInfo.void_reason || 'No reason'}
              {receipt.voidInfo.voided_by_name && <div style={{ marginTop: '1mm' }}>By: {receipt.voidInfo.voided_by_name}</div>}
            </div>
          )}
        </div>

        {/* Fee Summary */}
        <table className="summary">
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
        <div className="footer">
          This is a computer generated receipt
        </div>

        {/* Signature Section */}
        <div className="signatures">
          <div className="sig-line">
            <div style={{ fontSize: '10px' }}>Accountant</div>
          </div>
          <div className="sig-line">
            <div style={{ fontSize: '10px' }}>Authorized By</div>
          </div>
        </div>
      </div>
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