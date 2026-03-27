import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export default function PublicReceipt() {

  const search = window.location.search || "";
  const params = new URLSearchParams(search);
  const receiptNo = decodeURIComponent(params.get("receipt_no") || "");

  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-receipt', receiptNo],
    enabled: !!receiptNo,
    retry: 0,
    queryFn: async () => {

      const allPayments = await base44.asServiceRole.entities.FeePayment.list();
     console.log("ALL RECEIPTS DATA:", allPayments);
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

      if (!payment) {
        return null;
      }

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

  const { payment, student, school } = data;

  return (
    <div className="p-6">
      <h2>Receipt Loaded ✅</h2>
      <p><b>Receipt:</b> {payment.receipt_no}</p>
      <p><b>Student:</b> {student.name}</p>
      <p><b>Amount:</b> ₹{payment.amount_paid}</p>
    </div>
  );
}