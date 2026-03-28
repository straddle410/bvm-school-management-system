import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function PublicReceipt() {

  // 🔥 FIXED QUERY PARAM EXTRACTION
  const search = window.location.href.split('?')[1] || "";
  const params = new URLSearchParams(search);
  const receiptNo = decodeURIComponent(params.get("receipt_no") || "");

  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['public-receipt', receiptNo],
    enabled: true,
    retry: 0,
    queryFn: async () => {

      // 🔥 FORCE LARGE FETCH (IMPORTANT)
      const allPayments = await base44.asServiceRole.entities.FeePayment.filter(
        {},
        '-created_date',
        1000
      );

      console.log("ALL RECEIPTS:", allPayments.map(p => p.receipt_no));
      console.log("URL RECEIPT:", receiptNo);

      // 🔥 STRONG CLEAN FUNCTION
      const clean = (val) =>
        (val || '')
          .toString()
          .trim()
          .replace(/%2F/g, '/')
          .replace(/\s/g, '')
          .toLowerCase();

      const payment = allPayments.find(p =>
        clean(p.receipt_no) === clean(receiptNo)
      );

      console.log("MATCHED PAYMENT:", payment);

      if (!payment) return null;

      const students = await base44.asServiceRole.entities.Student.filter({
        student_id: payment.student_id
      });

      const student = students[0] || {};

      const schoolProfiles = await base44.asServiceRole.entities.SchoolProfile.list();
      const school = schoolProfiles[0] || {};

      return { payment, student, school };
    }
  });

  // ❌ INVALID LINK
  if (!receiptNo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h2>Invalid Receipt Link</h2>
      </div>
    );
  }

  // ⏳ LOADING
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading receipt...</p>
      </div>
    );
  }

  // ❌ NOT FOUND
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h2>Receipt Not Found</h2>
        <p>{receiptNo}</p>
      </div>
    );
  }

  const { payment, student } = data;

  return (
    <div className="p-6">
      <h2>Receipt Loaded ✅</h2>
      <p><b>Receipt:</b> {payment.receipt_no}</p>
      <p><b>Student:</b> {student.name}</p>
      <p><b>Amount:</b> ₹{payment.amount_paid}</p>
    </div>
  );
}