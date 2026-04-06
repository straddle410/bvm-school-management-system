import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Printer, Monitor } from 'lucide-react';

export default function PublicReceiptThermal() {
  const receiptRef = useRef();

  const urlParams = new URLSearchParams(window.location.search);
  const receiptNo = urlParams.get('receipt_no') || '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-receipt-thermal', receiptNo],
    enabled: !!receiptNo,
    retry: 1,
    queryFn: async () => {
      const res = await base44.functions.invoke('getPublicReceipt', { receipt_no: receiptNo });
      return res.data;
    }
  });

  const handlePrint = () => window.print();

  const switchUrl = `${window.location.pathname.replace('/thermal', '')}?receipt_no=${receiptNo}`;
  // handle case where we're on /receipt/thermal (no trailing slash issues)
  const standardUrl = window.location.href.includes('/thermal')
    ? window.location.href.replace('/thermal', '').replace(/receipt_no=.*/, `receipt_no=${receiptNo}`)
    : `${window.location.origin}/receipt?receipt_no=${receiptNo}`;

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
    ? snapshot.total_paid_before + (payment?.amount_paid || 0)
    : (invoice?.paid_amount || 0) + (payment?.amount_paid || 0);
  const balanceAfterPayment = displayNetAmount != null ? displayNetAmount - (totalPaidTillDate ?? 0) : null;

  const fmt = (n) => n != null ? `Rs.${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          body * { visibility: hidden; }
          #thermal-receipt, #thermal-receipt * { visibility: visible; }
          #thermal-receipt { position: absolute; left: 0; top: 0; width: 80mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Action bar — hidden on print */}
      <div className="no-print flex items-center justify-between gap-2 p-3 bg-gray-100 border-b sticky top-0 z-10">
        <a
          href={standardUrl}
          className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-300 bg-white rounded-lg px-3 py-2 font-medium"
        >
          <Monitor className="h-3.5 w-3.5" />
          Switch to Standard
        </a>
        <span className="text-xs text-gray-500 font-medium">3-inch Thermal Receipt</span>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs text-white bg-gray-900 rounded-lg px-3 py-2 font-medium"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>

      {/* Receipt — this is what gets printed */}
      <div className="flex justify-center bg-gray-200 min-h-screen py-4 px-2">
        <div
          id="thermal-receipt"
          ref={receiptRef}
          style={{
            width: '72mm',
            fontFamily: 'monospace',
            fontSize: '11px',
            backgroundColor: '#fff',
            padding: '4mm 3mm',
            color: '#000',
          }}
        >
          {/* School Header */}
          <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
            {school?.logo_url && (
              <img
                src={school.logo_url}
                alt="Logo"
                crossOrigin="anonymous"
                style={{ width: '14mm', height: '14mm', objectFit: 'contain', margin: '0 auto 2mm' }}
              />
            )}
            <div style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>
              {school?.school_name || 'School Name'}
            </div>
            {school?.address && (
              <div style={{ fontSize: '10px', marginTop: '1mm', lineHeight: '1.4' }}>{school.address}</div>
            )}
            {school?.phone && (
              <div style={{ fontSize: '10px' }}>Ph: {school.phone}</div>
            )}
          </div>

          <Divider />

          {/* Receipt Title */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', margin: '2mm 0 1mm' }}>
            FEE RECEIPT
          </div>
          <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '2mm' }}>
            (Parent Copy) &nbsp;|&nbsp; A.Y: {payment.academic_year}
          </div>

          {payment.status === 'VOID' && (
            <div style={{ textAlign: 'center', border: '2px solid #000', padding: '2mm', marginBottom: '2mm', fontWeight: 'bold', fontSize: '14px', letterSpacing: '3px' }}>
              *** VOID ***
              {payment.void_reason && <div style={{ fontSize: '10px', fontWeight: 'normal' }}>{payment.void_reason}</div>}
            </div>
          )}

          <Divider />

          {/* Receipt & Payment Info */}
          <Row label="Receipt No" value={payment.receipt_no} bold />
          <Row label="Date" value={payment.payment_date} />
          <Row label="Mode" value={payment.payment_mode} />
          {payment.collected_by_name && <Row label="Collected By" value={payment.collected_by_name} />}

          <Divider />

          {/* Student Info */}
          <Row label="Student" value={payment.student_name || student?.name} bold />
          <Row label="ID" value={payment.student_id} />
          <Row label="Class" value={`${payment.class_name}${student?.section ? `-${student.section}` : ''}`} />

          <Divider />

          {/* Fee Details */}
          <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>Fee Details</div>
          <Row label="Fee Type" value={payment.installment_name} />
          {displayGrossAmount != null && <Row label="Gross Amt" value={fmt(displayGrossAmount)} />}
          {displayDiscountAmount > 0 && <Row label="Discount" value={`-${fmt(displayDiscountAmount)}`} />}
          {displayNetAmount != null && <Row label="Net Fee" value={fmt(displayNetAmount)} />}

          <Divider dashed />

          {/* Payment Summary */}
          <Row label="This Payment" value={fmt(payment.amount_paid)} bold />
          {totalPaidTillDate != null && <Row label="Total Paid" value={fmt(totalPaidTillDate)} />}

          {balanceAfterPayment != null && balanceAfterPayment > 0.01 && (
            <>
              <Divider dashed />
              <Row label="Balance Due" value={fmt(balanceAfterPayment)} bold />
            </>
          )}

          <Divider />

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '2mm', lineHeight: '1.6' }}>
            <div>Computer Generated Receipt</div>
            <div>No Signature Required</div>
            <div>
              Printed: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Tear line */}
          <div style={{ borderTop: '1px dashed #000', marginTop: '4mm', textAlign: 'center', paddingTop: '1mm', fontSize: '10px', color: '#555' }}>
            ✂ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
          </div>
        </div>
      </div>
    </>
  );
}

function Divider({ dashed = false }) {
  return (
    <div style={{
      borderTop: dashed ? '1px dashed #000' : '1px solid #000',
      margin: '2mm 0',
    }} />
  );
}

function Row({ label, value, bold = false }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1mm',
      gap: '2mm',
    }}>
      <span style={{ color: '#444', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontWeight: bold ? 'bold' : 'normal',
        textAlign: 'right',
        wordBreak: 'break-word',
        maxWidth: '55%',
      }}>
        {value ?? '—'}
      </span>
    </div>
  );
}