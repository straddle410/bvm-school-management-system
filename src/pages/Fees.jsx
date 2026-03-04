import React, { useState, useEffect } from 'react';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle, Bus } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import FeeHeadsManager from '@/components/fees/FeeHeadsManager';
import AnnualFeePlanTab from '@/components/fees/AnnualFeePlanTab';
import StudentLedger from '@/components/fees/StudentLedger';
import PaymentsList from '@/components/fees/PaymentsList';
import ReceiptSettings from '@/components/fees/ReceiptSettings';
import DiscountManager from '@/components/fees/DiscountManager';
import AdditionalChargesTab from '@/components/fees/AdditionalChargesTab';
import FamilyManager from '@/components/fees/FamilyManager';
import RecalculateTransportModal from '@/components/fees/RecalculateTransportModal';
import FeesBackupTab from '@/components/fees/FeesBackupTab';
import { useQuery } from '@tanstack/react-query';

export default function Fees() {
  const { academicYear, academicYears } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [showTransportModal, setShowTransportModal] = useState(false);

  useEffect(() => { setUser(getStaffSession()); }, []);

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'principal';
  const permissions = user?.permissions || {};
  const canVoidReceipt = isAdmin || !!permissions.fees_reverse_receipt;
  const canViewLedger = isAdmin || !!permissions.fees_view_ledger || !!permissions.fees_view_module;
  const canViewPayments = isAdmin || !!permissions.fees_record_payment || !!permissions.fees_view_module;
  const canApplyDiscount = isAdmin || !!permissions.fees_apply_discount;
  const canApplyCharge = isAdmin || role === 'accountant' || !!permissions.fees_apply_charge;
  const canManageFamilies = isAdmin || !!permissions.fees_manage_families;

  const selectedYearObj = academicYears?.find(y => y.year === academicYear);
  const isArchivedYear = selectedYearObj?.status === 'Archived';

  const handleTabChange = (tab) => {
    if (!isAdmin && ['fee-heads', 'plans', 'receipt-settings'].includes(tab)) return;
    setActiveTab(tab);
  };

  const isAccountant = role === 'accountant';

  const { data: schoolProfiles = [] } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list()
  });

  // Accountant tab list (only their relevant tabs)
  const accountantTabs = [
    canViewLedger    && { value: 'ledger',    label: 'Ledger' },
    canViewPayments  && { value: 'payments',  label: 'Receipts' },
    canApplyDiscount && { value: 'discounts', label: 'Discount' },
    canApplyCharge   && { value: 'adhoc',     label: 'Add Fee' },
    canManageFamilies&& { value: 'families',  label: 'Families' },
    { value: 'backup', label: '🗄 Backup' },
  ].filter(Boolean);

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff', 'accountant']} pageName="Fees">
      <div className="min-h-screen bg-slate-50">
        <PageHeader
          title="Fees"
          subtitle={`Annual fee management — ${academicYear}`}
          actions={isAdmin ? (
            <button
              onClick={() => setShowTransportModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition"
            >
              <Bus className="h-4 w-4" />
              Recalculate Transport
            </button>
          ) : null}
        />

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

        <div className={`px-3 sm:px-4 lg:px-8 py-4 ${isAccountant ? 'accountant-fees-view' : ''}`}>
          <Tabs value={activeTab} onValueChange={handleTabChange}>

            {/* ── ACCOUNTANT: big scrollable tabs ── */}
            {isAccountant ? (
              <div className="overflow-x-auto mb-4 -mx-3 px-3">
                <div className="flex gap-2 min-w-max">
                  {accountantTabs.map(tab => (
                    <button
                      key={tab.value}
                      onClick={() => handleTabChange(tab.value)}
                      className={`flex-shrink-0 px-5 py-3 rounded-xl text-base font-semibold border transition-all min-h-[52px] ${
                        activeTab === tab.value
                          ? 'bg-[#1a237e] text-white border-[#1a237e] shadow'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── OTHER ROLES: existing compact tabs ── */
              <TabsList className="flex flex-wrap gap-1 h-auto mb-6">
                {canViewLedger && <TabsTrigger value="ledger">Student Ledger</TabsTrigger>}
                {canViewPayments && <TabsTrigger value="payments">Payments / Receipts</TabsTrigger>}
                {isAdmin && <TabsTrigger value="plans">Fee Plans</TabsTrigger>}
                {(isAdmin || canApplyDiscount) && <TabsTrigger value="discounts">Discounts</TabsTrigger>}
                {(isAdmin || canManageFamilies) && <TabsTrigger value="families">Families</TabsTrigger>}
                {isAdmin && <TabsTrigger value="fee-heads">Fee Heads</TabsTrigger>}
                {(isAdmin || canApplyCharge) && <TabsTrigger value="adhoc">Additional Charges</TabsTrigger>}
                {isAdmin && <TabsTrigger value="receipt-settings">Receipt Settings</TabsTrigger>}
              </TabsList>
            )}

            {canViewLedger && (
              <TabsContent value="ledger">
                <StudentLedger academicYear={academicYear} isArchivedYear={isArchivedYear} />
              </TabsContent>
            )}

            {canViewPayments && (
              <TabsContent value="payments">
                <PaymentsList academicYear={academicYear} isAdmin={isAdmin} canVoidReceipt={canVoidReceipt} />
              </TabsContent>
            )}

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

            {(isAdmin || canApplyDiscount) && (
              <TabsContent value="discounts">
                <DiscountManager academicYear={academicYear} isArchived={isArchivedYear} />
              </TabsContent>
            )}

            {(isAdmin || canManageFamilies) && (
              <TabsContent value="families">
                <FamilyManager academicYear={academicYear} isArchived={isArchivedYear} />
              </TabsContent>
            )}

            {(isAdmin || canApplyCharge) && (
              <TabsContent value="adhoc">
                <AdditionalChargesTab academicYear={academicYear} isArchived={isArchivedYear} />
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

        {isAdmin && (
          <RecalculateTransportModal
            open={showTransportModal}
            onClose={() => setShowTransportModal(false)}
            academicYear={academicYear}
            academicYears={academicYears}
          />
        )}
      </div>
    </LoginRequired>
  );
}