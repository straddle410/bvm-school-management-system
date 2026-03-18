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
  const studentId = searchParams.get('studentId') || '';
  const className = searchParams.get('className') || '';

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
    retry: 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5
  });

  // Don't auto-print — let user choose to print or cancel

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

  const handleCancel = () => {
    if (studentId && className) {
      navigate(`/Fees?tab=ledger&className=${encodeURIComponent(className)}&studentId=${encodeURIComponent(studentId)}`);
    } else {
      navigate('/Fees');
    }
  };

  const getReceiptHTML = () => {
    const feeType = receipt.invoice.type === 'ANNUAL'
      ? 'TUITION FEE'
      : receipt.invoice.type === 'ADDITIONAL'
      ? (receipt.invoice.chargeName || 'ADDITIONAL FEE')
      : 'TUITION FEE';
    const amountInWords = numberToWords(receipt.payment.amount);

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A5 landscape; margin: 2.2mm; }
    html, body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .copiesRow { display: flex; gap: 4mm; }
    .copy { flex: 1; border: 1px solid #111; border-radius: 4px; padding: 2.2mm; box-sizing: border-box; background: white; }
    .copy.void { background: rgba(255, 0, 0, 0.03); }
    .void-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 48px; font-weight: bold; color: rgba(255, 0, 0, 0.1); pointer-events: none; }
    .header { text-align: center; border-bottom: 2px solid #1a237e; padding-bottom: 0.4mm; margin-bottom: 0.6mm; }
    .header-top { display: flex; align-items: center; justify-content: center; gap: 2.5mm; margin-bottom: 0; }
    .logo { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .school-name { font-size: 16px; font-weight: 900; margin: 0; color: #1a237e; letter-spacing: 0.2px; line-height: 1.1; }
    .school-info { font-size: 11px; color: #555; margin: 0; font-weight: 500; line-height: 1.1; }
    .receipt-title { display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 14px; margin: 0.7mm 0; padding: 0.6mm 0; border-bottom: 2px solid #1a237e; color: #1a237e; }
    .copy-badge { font-size: 9px; font-weight: bold; background: #1a237e; color: white; padding: 2px 5px; border-radius: 2px; text-transform: uppercase; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9mm; font-size: 12px; margin-bottom: 0.7mm; padding: 0.6mm 0; border-top: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0; }
    .info-row { display: flex; justify-content: space-between; gap: 1mm; }
    .label { font-weight: 700; color: #1a237e; min-width: 60px; font-size: 12px; }
    .box { border: 1px solid #d0d0d0; padding: 2.2mm; margin: 0.9mm 0; font-size: 12px; background: #fafafa; border-radius: 2px; }
    .box-title { font-weight: 800; font-size: 11px; border-bottom: 2px solid #1a237e; padding-bottom: 0.5mm; margin-bottom: 0.5mm; color: #1a237e; text-transform: uppercase; }
    .box-row { display: flex; justify-content: space-between; padding: 0.5mm 0; font-size: 12px; gap: 0.9mm; }
    .amount-box { font-weight: 900; font-size: 13px; color: #1a237e; text-align: center; padding: 1.2mm 0.9mm; margin: 0.6mm 0; border: 2px solid #1a237e; background: #f3f7ff; border-radius: 2px; }
    .summary { width: 100%; border-collapse: collapse; font-size: 12px; margin: 0.7mm 0; border: 1px solid #d0d0d0; }
    .summary td { border-bottom: 1px solid #e0e0e0; padding: 0.6mm 1.2mm; }
    .summary .label { text-align: left; font-weight: 700; color: #1a237e; }
    .summary .value { text-align: right; font-weight: 700; color: #000; }
    .footer { font-size: 8px; text-align: center; color: #888; margin-top: 0.3mm; padding: 0.3mm 0; border-top: 1px solid #e0e0e0; font-style: italic; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm; font-size: 10px; margin-top: 0.5mm; }
    .sig-line { text-align: center; height: 16mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-space { border-top: 1.5px solid #333; height: 8mm; margin-bottom: 0.6mm; }
    .sig-label { font-weight: 700; color: #1a237e; letter-spacing: 0.1px; font-size: 11px; }
    .void-note { font-size: 10px; color: #d32f2f; font-weight: bold; margin-top: 0.6mm; padding: 0.8mm; background: #ffebee; }
  </style>
</head>
<body>
  <div class="copiesRow">
    <div class="copy ${isVoid ? 'void' : ''}">${getReceiptContent(school, receipt, feeType, amountInWords, 'SCHOOL COPY')}</div>
    <div class="copy ${isVoid ? 'void' : ''}">${getReceiptContent(school, receipt, feeType, amountInWords, 'PARENT COPY')}</div>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (printWindow) {
      printWindow.document.write(getReceiptHTML());
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Print Receipt">
      {/* Controls */}
      <div className="no-print min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-white border-b shadow-sm p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700">Receipt #{receipt?.receiptNo}</h2>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
              Print Receipt
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 p-6 flex flex-col items-center">
          <div className="text-xs text-gray-500 mb-3">A5 Landscape Preview (School Copy + Parent Copy)</div>
          <div style={{
            background: 'white',
            width: '100%',
            maxWidth: '760px',
            aspectRatio: '297/210',
            border: '1px solid #ccc',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            <iframe
              srcDoc={getReceiptHTML()}
              className="w-full h-full border-none"
              title="Receipt Preview"
            />
          </div>
        </div>
      </div>
    </LoginRequired>
  );
}

function getReceiptContent(school, receipt, feeType, amountInWords, copyLabel) {
  const isVoid = receipt.payment.status === 'VOID';
  return `
    <div style="position: relative;">
      ${isVoid ? '<div class="void-watermark">VOID</div>' : ''}
      <div style="position: relative; z-index: 1; transform: scale(0.98); transform-origin: top left;">
        <div class="header">
          <div class="header-top">
            ${school.logoUrl ? `<img src="${school.logoUrl}" alt="Logo" class="logo" />` : ''}
            <div style="display: flex; flex-direction: column; gap: 0;">
              <div class="school-name">${school.name}</div>
              ${school.addressLine1 ? `<div class="school-info">${school.addressLine1}</div>` : ''}
              ${school.phone ? `<div class="school-info">Ph: ${school.phone}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="receipt-title">
          <span>FEE RECEIPT</span>
          <span class="copy-badge">${copyLabel}</span>
        </div>
        <div class="info-grid">
          <div class="info-row"><span class="label">Receipt #:</span><span style="font-weight: bold; color: #1a237e; font-size: 12px;">${receipt.receiptNo}</span></div>
          <div class="info-row"><span class="label">Date:</span><span>${formatDate(receipt.dateTime)}</span></div>
          <div class="info-row"><span class="label">Year:</span><span>${receipt.academicYear}</span></div>
          <div class="info-row"><span class="label">Fee Type:</span><span style="font-weight: bold;">${feeType}</span></div>
        </div>
        <div class="box">
          <div class="box-title">STUDENT DETAILS</div>
          <div class="box-row"><span class="label">Name:</span><span>${receipt.student.name}</span></div>
          <div class="box-row"><span class="label">ID:</span><span>${receipt.student.admissionNo}</span></div>
          <div class="box-row"><span class="label">Class:</span><span>${receipt.student.className}-${receipt.student.sectionName}</span></div>
        </div>
        <div class="box">
          <div class="box-title">PAYMENT DETAILS</div>
          <div class="box-row"><span class="label">Payment Mode:</span><span>${receipt.payment.mode}</span></div>
          ${receipt.payment.referenceNo ? `<div class="box-row"><span class="label">Ref No:</span><span>${receipt.payment.referenceNo}</span></div>` : ''}
          <div class="amount-box">Amount Paid: ₹${receipt.payment.amount.toLocaleString('en-IN')}</div>
          ${amountInWords ? `<div style="text-align: center; font-size: 10px; margin-top: 0.5mm;">(${amountInWords})</div>` : ''}
          ${receipt.payment.collectedByName ? `<div class="box-row" style="margin-top: 0.6mm; padding-top: 0.6mm; border-top: 1px solid #ddd;"><span class="label">Received By:</span><span>${receipt.payment.collectedByName}</span></div>` : ''}
          ${isVoid && receipt.voidInfo ? `<div class="void-note">VOIDED - ${receipt.voidInfo.void_reason || 'No reason'}${receipt.voidInfo.voided_by_name ? `<div style="margin-top: 1mm;">By: ${receipt.voidInfo.voided_by_name}</div>` : ''}</div>` : ''}
        </div>
        <table class="summary">
          <tr><td class="label">Gross Amount:</td><td class="value">₹${receipt.invoice.gross.toLocaleString('en-IN')}</td></tr>
          <tr><td class="label">Discount:</td><td class="value">-₹${receipt.invoice.discount.toLocaleString('en-IN')}</td></tr>
          <tr style="font-weight: bold; background-color: #f0f0f0;"><td class="label">Net Fee:</td><td class="value">₹${receipt.invoice.net.toLocaleString('en-IN')}</td></tr>
          <tr><td class="label">Total Paid:</td><td class="value">₹${receipt.invoice.totalPaidAfterThis.toLocaleString('en-IN')}</td></tr>
          <tr style="background-color: #fff3e0;"><td class="label">Balance Due:</td><td class="value">₹${receipt.invoice.balanceDueAfterThis.toLocaleString('en-IN')}</td></tr>
        </table>
        <div class="footer">This is a computer generated receipt</div>
        <div class="signatures">
          <div class="sig-line"><div class="sig-space"></div><div class="sig-label">Accountant</div></div>
          <div class="sig-line"><div class="sig-space"></div><div class="sig-label">Authorized By</div></div>
        </div>
      </div>
    </div>
  `;
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