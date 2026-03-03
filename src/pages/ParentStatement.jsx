import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import LoginRequired from '@/components/LoginRequired';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function ParentStatement() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();
  const [showVoided, setShowVoided] = useState(false);
  const printRef = useRef(null);

  // Fetch parent statement
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-statement', studentId, academicYear, showVoided],
    queryFn: async () => {
      const res = await base44.functions.invoke('getParentStatement', {
        student_id: studentId,
        academic_year: academicYear,
        includeVoided: showVoided
      });
      return res.data;
    },
    enabled: !!studentId && !!academicYear
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printRef.current.innerHTML);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Parent Statement">
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </LoginRequired>
    );
  }

  if (error || !data) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Parent Statement">
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
          <div className="max-w-3xl mx-auto">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800">
                  {error?.message || 'Failed to load parent statement. Student may not have an annual invoice.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </LoginRequired>
    );
  }

  const student = data.student;
  const summary = data.summary;
  const payments = data.payments;

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Parent Statement">
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showVoided"
                  checked={showVoided}
                  onChange={(e) => setShowVoided(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="showVoided" className="text-sm text-gray-600 cursor-pointer">
                  Show Voided
                </label>
              </div>

              <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div ref={printRef} className="print:p-0">
            <ParentStatementContent student={student} summary={summary} payments={payments} academicYear={data.academicYear} />
          </div>
        </div>
      </div>
    </LoginRequired>
  );
}

function ParentStatementContent({ student, summary, payments, academicYear }) {
  return (
    <div className="space-y-6">
      {/* Statement Header */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <CardTitle className="text-lg">Fee Statement</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 text-xs uppercase tracking-wide">Student Name</p>
              <p className="font-semibold text-gray-900">{student.name}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs uppercase tracking-wide">Admission No</p>
              <p className="font-semibold text-gray-900">{student.admissionNo}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs uppercase tracking-wide">Class</p>
              <p className="font-semibold text-gray-900">{student.class} {student.section}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs uppercase tracking-wide">Academic Year</p>
              <p className="font-semibold text-gray-900">{academicYear}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Gross Amount</span>
              <span className="font-semibold">₹{(summary.gross || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Discount</span>
              <span className="font-semibold text-green-600">-₹{(summary.discount || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b pb-2 bg-gray-50 p-2 rounded">
              <span className="text-gray-700 font-medium">Net Fee Amount</span>
              <span className="text-lg font-bold text-gray-900">₹{(summary.net || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Total Paid</span>
              <span className="font-semibold text-green-600">₹{(summary.totalPaid || 0).toLocaleString()}</span>
            </div>
            <div className={`flex justify-between p-3 rounded-lg ${summary.balanceDue > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <span className={`font-semibold ${summary.balanceDue > 0 ? 'text-red-700' : 'text-green-700'}`}>
                Balance Due
              </span>
              <span className={`text-lg font-bold ${summary.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{(summary.balanceDue || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Receipt No</th>
                  <th className="px-4 py-3 text-left font-semibold">Mode</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
                      No payments recorded
                    </td>
                  </tr>
                ) : (
                  payments.map((p, idx) => (
                    <tr key={idx} className={`border-b hover:bg-gray-50 ${p.status === 'VOID' ? 'opacity-60 bg-red-50' : ''}`}>
                      <td className="px-4 py-3">{p.date}</td>
                      <td className="px-4 py-3 font-mono">{p.receiptNo}</td>
                      <td className="px-4 py-3">{p.mode}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{(p.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {p.status === 'VOID' ? (
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">VOID</span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Active</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Print Footer */}
      <div className="text-center text-xs text-gray-500 py-4 print:block hidden">
        <p>Generated on {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  );
}