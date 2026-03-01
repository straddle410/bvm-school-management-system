import React, { useState, useEffect } from 'react';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import FeeHeadsManager from '@/components/fees/FeeHeadsManager';
import FeePlanManager from '@/components/fees/FeePlanManager';
import GenerateInvoices from '@/components/fees/GenerateInvoices';
import StudentLedger from '@/components/fees/StudentLedger';
import PaymentsList from '@/components/fees/PaymentsList';

export default function Fees() {
  const { academicYear, academicYears } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');

  useEffect(() => { setUser(getStaffSession()); }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin' || user?.role === 'principal' || user?.role === 'Principal';

  // Check if selected year is archived
  const selectedYearObj = academicYears?.find(y => y.year === academicYear);
  const isArchivedYear = selectedYearObj?.status === 'Archived';

  const handleTabChange = (tab) => {
    // Only admin can access setup tabs
    if (!isAdmin && ['fee-heads', 'plans', 'generate'].includes(tab)) return;
    setActiveTab(tab);
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Fees">
      <div className="min-h-screen bg-slate-50">
        <PageHeader title="Fees" subtitle={`Fee management — ${academicYear}`} />

        {isArchivedYear && (
          <div className="px-4 lg:px-8 pt-4">
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex gap-2 items-center text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>You are viewing an <strong>archived year ({academicYear})</strong>. Payments and edits are disabled for archived years.</span>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="px-3 sm:px-4 lg:px-8 py-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex flex-wrap gap-1 h-auto mb-6">
              <TabsTrigger value="ledger">Student Ledger</TabsTrigger>
              <TabsTrigger value="payments">Payments / Receipts</TabsTrigger>
              {isAdmin && <TabsTrigger value="generate">Generate Invoices</TabsTrigger>}
              {isAdmin && <TabsTrigger value="plans">Fee Plans</TabsTrigger>}
              {isAdmin && <TabsTrigger value="fee-heads">Fee Heads</TabsTrigger>}
            </TabsList>

            <TabsContent value="ledger">
              <StudentLedger academicYear={academicYear} isArchivedYear={isArchivedYear} />
            </TabsContent>

            <TabsContent value="payments">
              <PaymentsList academicYear={academicYear} />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="generate">
                {isArchivedYear ? (
                  <Card className="border-red-200 bg-red-50"><CardContent className="p-6 text-center">
                    <Lock className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-800 font-medium">Invoice generation is disabled for archived years.</p>
                  </CardContent></Card>
                ) : <GenerateInvoices academicYear={academicYear} />}
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="plans">
                {isArchivedYear ? (
                  <Card className="border-red-200 bg-red-50"><CardContent className="p-6 text-center">
                    <Lock className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-800 font-medium">Plan editing is disabled for archived years.</p>
                  </CardContent></Card>
                ) : <FeePlanManager academicYear={academicYear} />}
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="fee-heads">
                <FeeHeadsManager />
              </TabsContent>
            )}

            {/* Block non-admin from setup tabs via URL state */}
            {!isAdmin && ['fee-heads', 'plans', 'generate'].includes(activeTab) && (
              <TabsContent value={activeTab}>
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6 text-center">
                    <Lock className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="font-semibold text-red-800">Not Authorized</p>
                    <p className="text-sm text-red-600 mt-1">Only admins and principals can access fee setup.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </LoginRequired>
  );
}