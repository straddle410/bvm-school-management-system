import React, { useState, useEffect, Suspense, lazy } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { can, getEffectivePermissions } from '@/components/permissionHelper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle, Bus, Menu, X } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import FeeHeadsManager from '@/components/fees/FeeHeadsManager';
import AnnualFeePlanTab from '@/components/fees/AnnualFeePlanTab';
import StudentLedger from '@/components/fees/StudentLedger';
import StudentLedgerArchivedYear from '@/components/fees/StudentLedgerArchivedYear';
import PaymentsList from '@/components/fees/PaymentsList';
import ReceiptSettings from '@/components/fees/ReceiptSettings';
import DiscountManager from '@/components/fees/DiscountManager';
import AdditionalChargesTab from '@/components/fees/AdditionalChargesTab';
import FamilyManager from '@/components/fees/FamilyManager';
import RecalculateTransportModal from '@/components/fees/RecalculateTransportModal';
import FeesBackupTab from '@/components/fees/FeesBackupTab';
import { useQuery } from '@tanstack/react-query';

// Lazy load heavy fee tab components
const StudentLedgerLazy = lazy(() => import('@/components/fees/StudentLedger'));
const StudentLedgerArchivedYearLazy = lazy(() => import('@/components/fees/StudentLedgerArchivedYear'));
const PaymentsListLazy = lazy(() => import('@/components/fees/PaymentsList'));
const AnnualFeePlanTabLazy = lazy(() => import('@/components/fees/AnnualFeePlanTab'));
const DiscountManagerLazy = lazy(() => import('@/components/fees/DiscountManager'));
const FamilyManagerLazy = lazy(() => import('@/components/fees/FamilyManager'));
const AdditionalChargesTabLazy = lazy(() => import('@/components/fees/AdditionalChargesTab'));

const TabLoadingSpinner = () => (
  <Card className="border-0 shadow-sm">
    <CardContent className="py-16 flex justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
    </CardContent>
  </Card>
);

export default function Fees() {
  const { academicYear, academicYears } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { setUser(getStaffSession()); }, []);

  // Phase 6: Use only effective_permissions
  const userWithPerms = { ...user, effective_permissions: getEffectivePermissions(user || {}) };
  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'principal';

  const canVoidReceipt = can(userWithPerms, 'fees_void_receipt');
  const canViewLedger = can(userWithPerms, 'fees_view') || can(userWithPerms, 'fees_ledger_view');
  const canViewPayments = can(userWithPerms, 'fees_record_payment') || can(userWithPerms, 'fees_view');
  const canApplyDiscount = can(userWithPerms, 'fees_apply_discount');
  const canApplyCharge = can(userWithPerms, 'fees_manage_adhoc_charges') || role === 'accountant';
  const canManageFamilies = can(userWithPerms, 'fees_manage_families');

  const selectedYearObj = academicYears?.find(y => y.year === academicYear);
  const isArchivedYear = selectedYearObj?.status === 'Archived';

  const handleTabChange = (tab) => {
    if (!isAdmin && ['fee-heads', 'plans', 'receipt-settings'].includes(tab)) return;
    setActiveTab(tab);
  };

  const isAccountant = role === 'accountant';

  // ✅ FIX #1 & #3: Move FeeHead query to parent + add caching
  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.filter({ is_active: true }),
    staleTime: 60 * 60 * 1000 // 1 hour cache (rarely changes)
  });

  const { data: schoolProfiles = [] } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list(),
    staleTime: 60 * 60 * 1000 // 1 hour cache (rarely changes)
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
      <div className="min-h-screen h-full overflow-y-auto bg-slate-50 dark:bg-gray-900">
        <PageHeader
          title="Fees"
          subtitle={`Annual fee management — ${academicYear}`}
          actions={isAdmin ? (
            <button
            onClick={() => setShowTransportModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
            >
              <Bus className="h-4 w-4" />
              Recalculate Transport
            </button>
          ) : null}
        />

        {isArchivedYear && (
          <div className="px-4 lg:px-8 pt-4">
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="p-4 flex gap-2 items-center text-amber-800 dark:text-amber-300 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>You are viewing an <strong>archived year ({academicYear})</strong>. Payments and edits are disabled.</span>
              </CardContent>
            </Card>
          </div>
        )}

        <div className={`px-3 sm:px-4 lg:px-8 py-4 ${isAccountant ? 'accountant-fees-view' : ''}`}>
          <Tabs value={activeTab} onValueChange={(tab) => { handleTabChange(tab); setMobileMenuOpen(false); }}>

            {/* ── MOBILE DRAWER + DESKTOP TABS ── */}
            <div className="mb-6">
              {/* Desktop: Show tabs normally */}
              <div className="hidden md:block">
                {isAccountant ? (
                  <div className="overflow-x-auto -mx-3 px-3">
                    <div className="flex gap-3 min-w-max">
                      {accountantTabs.map(tab => (
                        <button
                          key={tab.value}
                          onClick={() => handleTabChange(tab.value)}
                          className={`flex-shrink-0 px-8 py-4 rounded-xl text-lg font-bold border-2 transition-all min-h-[60px] ${
                            activeTab === tab.value
                              ? 'bg-[#1a237e] text-white border-[#1a237e] shadow-lg'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-[#1a237e]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <TabsList className="flex flex-wrap gap-2 h-auto">
                    {canViewLedger && <TabsTrigger value="ledger" className="text-lg font-bold px-6 py-3 min-h-[60px]">Student Ledger</TabsTrigger>}
                    {canViewPayments && <TabsTrigger value="payments" className="text-lg font-bold px-6 py-3 min-h-[60px]">Payments / Receipts</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="plans" className="text-lg font-bold px-6 py-3 min-h-[60px]">Fee Plans</TabsTrigger>}
                    {(isAdmin || canApplyDiscount) && <TabsTrigger value="discounts" className="text-lg font-bold px-6 py-3 min-h-[60px]">Discounts</TabsTrigger>}
                    {(isAdmin || canManageFamilies) && <TabsTrigger value="families" className="text-lg font-bold px-6 py-3 min-h-[60px]">Families</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="fee-heads" className="text-lg font-bold px-6 py-3 min-h-[60px]">Fee Heads</TabsTrigger>}
                    {(isAdmin || canApplyCharge) && <TabsTrigger value="adhoc" className="text-lg font-bold px-6 py-3 min-h-[60px]">Additional Charges</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="receipt-settings" className="text-lg font-bold px-6 py-3 min-h-[60px]">Receipt Settings</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="backup" className="text-lg font-bold px-6 py-3 min-h-[60px]">🗄 Backup</TabsTrigger>}
                  </TabsList>
                )}
              </div>

              {/* Mobile: Hamburger Menu */}
              <div className="md:hidden flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                 <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {isAccountant
                    ? accountantTabs.find(t => t.value === activeTab)?.label
                    : ['Student Ledger', 'Payments / Receipts', 'Fee Plans', 'Discounts', 'Families', 'Fee Heads', 'Additional Charges', 'Receipt Settings', '🗄 Backup']
                        .find((_, i) => [canViewLedger, canViewPayments, isAdmin, isAdmin || canApplyDiscount, isAdmin || canManageFamilies, isAdmin, isAdmin || canApplyCharge, isAdmin, isAdmin][i])}
                </span>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>

              {/* Mobile Drawer Menu */}
              {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
              )}
              {mobileMenuOpen && (
                <div className="md:hidden fixed right-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-lg z-50 overflow-y-auto pt-16">
                  <div className="p-4 space-y-2">
                    {isAccountant ? (
                      accountantTabs.map(tab => (
                        <button
                          key={tab.value}
                          onClick={() => { handleTabChange(tab.value); setMobileMenuOpen(false); }}
                          className={`w-full text-left px-4 py-3 rounded-lg transition ${
                            activeTab === tab.value
                              ? 'bg-[#1a237e] text-white font-semibold'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))
                    ) : (
                      <>
                        {canViewLedger && (
                          <button onClick={() => { handleTabChange('ledger'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'ledger' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Student Ledger</button>
                          )}
                          {canViewPayments && (
                           <button onClick={() => { handleTabChange('payments'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'payments' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Payments / Receipts</button>
                          )}
                          {isAdmin && (
                           <button onClick={() => { handleTabChange('plans'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'plans' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Fee Plans</button>
                          )}
                          {(isAdmin || canApplyDiscount) && (
                           <button onClick={() => { handleTabChange('discounts'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'discounts' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Discounts</button>
                          )}
                          {(isAdmin || canManageFamilies) && (
                           <button onClick={() => { handleTabChange('families'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'families' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Families</button>
                          )}
                          {isAdmin && (
                           <button onClick={() => { handleTabChange('fee-heads'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'fee-heads' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Fee Heads</button>
                          )}
                          {(isAdmin || canApplyCharge) && (
                           <button onClick={() => { handleTabChange('adhoc'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'adhoc' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Additional Charges</button>
                          )}
                          {isAdmin && (
                           <button onClick={() => { handleTabChange('receipt-settings'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'receipt-settings' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Receipt Settings</button>
                          )}
                          {isAdmin && (
                           <button onClick={() => { handleTabChange('backup'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'backup' ? 'bg-[#1a237e] text-white font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>🗄 Backup</button>
                          )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {canViewLedger && (
              <TabsContent value="ledger">
                <Suspense fallback={<TabLoadingSpinner />}>
                  {isArchivedYear ? (
                    <StudentLedgerArchivedYearLazy academicYear={academicYear} isArchived={true} feeHeads={feeHeads} />
                  ) : (
                    <StudentLedgerLazy academicYear={academicYear} isArchivedYear={isArchivedYear} feeHeads={feeHeads} />
                  )}
                </Suspense>
              </TabsContent>
            )}

            {canViewPayments && (
              <TabsContent value="payments">
                <Suspense fallback={<TabLoadingSpinner />}>
                  <PaymentsListLazy academicYear={academicYear} isAdmin={isAdmin} canVoidReceipt={canVoidReceipt} />
                </Suspense>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="plans">
                <Suspense fallback={<TabLoadingSpinner />}>
                  {isArchivedYear ? (
                    <Card className="border-red-200 bg-red-50"><CardContent className="p-6 text-center">
                      <Lock className="h-8 w-8 text-red-400 mx-auto mb-2" />
                      <p className="text-red-800 font-medium">Plan editing is disabled for archived years.</p>
                    </CardContent></Card>
                  ) : <AnnualFeePlanTabLazy academicYear={academicYear} />}
                </Suspense>
              </TabsContent>
            )}

            {(isAdmin || canApplyDiscount) && (
              <TabsContent value="discounts">
                <Suspense fallback={<TabLoadingSpinner />}>
                  <DiscountManagerLazy academicYear={academicYear} isArchived={isArchivedYear} feeHeads={feeHeads} />
                </Suspense>
              </TabsContent>
            )}

            {(isAdmin || canManageFamilies) && (
              <TabsContent value="families">
                <Suspense fallback={<TabLoadingSpinner />}>
                  <FamilyManagerLazy academicYear={academicYear} isArchived={isArchivedYear} feeHeads={feeHeads} />
                </Suspense>
              </TabsContent>
            )}

            {(isAdmin || canApplyCharge) && (
              <TabsContent value="adhoc">
                <Suspense fallback={<TabLoadingSpinner />}>
                  <AdditionalChargesTabLazy academicYear={academicYear} isArchived={isArchivedYear} />
                </Suspense>
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

            {/* Fees Backup — visible to Admin + Accountant */}
            {(isAdmin || isAccountant) && (
              <TabsContent value="backup">
                <FeesBackupTab isAdmin={isAdmin} schoolProfile={schoolProfiles[0]} />
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