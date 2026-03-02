import React, { useState, useEffect } from 'react';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import FeeHeadsManager from '@/components/fees/FeeHeadsManager';
import AnnualFeePlanTab from '@/components/fees/AnnualFeePlanTab';
import StudentLedger from '@/components/fees/StudentLedger';
import PaymentsList from '@/components/fees/PaymentsList';
import ReceiptSettings from '@/components/fees/ReceiptSettings';
import DiscountManager from '@/components/fees/DiscountManager';
import AdditionalChargesList from '@/components/fees/AdditionalChargesList';

export default function Fees() {
  const { academicYear, academicYears } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');

  useEffect(() => { setUser(getStaffSession()); }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin' || user?.role === 'principal' || user?.role === 'Principal';

  const selectedYearObj = academicYears?.find(y => y.year === academicYear);
  const isArchivedYear = selectedYearObj?.status === 'Archived';

  const handleTabChange = (tab) => {
    if (!isAdmin && ['fee-heads', 'plans', 'discounts', 'receipt-settings'].includes(tab)) return;
    setActiveTab(tab);
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Fees">
      <div className="min-h-screen bg-slate-50">
        <PageHeader title="Fees" subtitle={`Annual fee management — ${academicYear}`} />

        {isArchivedYear && (
          <div className="px-4 lg:px-8 pt-4">
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex gap-2 items-center text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>You are viewing an <strong>archived year ({academicYear})</strong>. Payments and edits are disabled.</span>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="px-3 sm:px-4 lg:px-8 py-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex flex-wrap gap-1 h-auto mb-6">
              <TabsTrigger value="ledger">Student Ledger</TabsTrigger>
              <TabsTrigger value="payments">Payments / Receipts</TabsTrigger>
              {isAdmin && <TabsTrigger value="plans">Fee Plans</TabsTrigger>}
              {isAdmin && <TabsTrigger value="discounts">Discounts</TabsTrigger>}
              {isAdmin && <TabsTrigger value="fee-heads">Fee Heads</TabsTrigger>}
              {isAdmin && <TabsTrigger value="receipt-settings">Receipt Settings</TabsTrigger>}
            </TabsList>

            <TabsContent value="ledger">
              <StudentLedger academicYear={academicYear} isArchivedYear={isArchivedYear} />
            </TabsContent>

            <TabsContent value="payments">
              <PaymentsList academicYear={academicYear} />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="plans">
                {isArchivedYear ? (
                  <Card className="border-red-200 bg-red-50"><CardContent className="p-6 text-center">
                    <Lock className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-800 font-medium">Plan editing is disabled for archived years.</p>
                  </CardContent></Card>
                ) : <AnnualFeePlanTab academicYear={academicYear} />}
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="discounts">
                <DiscountManager academicYear={academicYear} isArchived={isArchivedYear} />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="fee-heads">
                <FeeHeadsManager />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="receipt-settings">
                <ReceiptSettings />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </LoginRequired>
  );
}