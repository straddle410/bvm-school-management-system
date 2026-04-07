import { Toaster } from "sonner"
import { AnimatePresence } from "framer-motion"
import PageTransition from "@/components/PageTransition"
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import PublicReceipt from './pages/PublicReceipt'
import PrivacyPolicy from './pages/PrivacyPolicy'

// Lazy load heavy pages
const NotificationAnalytics = lazy(() => import('./pages/NotificationAnalytics'))
const PostingDashboard = lazy(() => import('./pages/PostingDashboard'))
const StudentQuiz = lazy(() => import('./pages/StudentQuiz'))
const StudentChangePassword = lazy(() => import('./pages/StudentChangePassword'))
const DeleteAccount = lazy(() => import('./pages/DeleteAccount'))
const FinancialManagement = lazy(() => import('./pages/FinancialManagement'))
const StaffAttendanceSalary = lazy(() => import('./pages/StaffAttendanceSalary'))
const CleanerDashboard = lazy(() => import('./pages/CleanerDashboard'))
const KioskCheckin = lazy(() => import('./pages/KioskCheckin'))
const StaffQRPrint = lazy(() => import('./pages/StaffQRPrint'))

import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];

const LazyPageFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  const MainPageComponent = mainPageKey ? Pages[mainPageKey] : null;

  return (
    <AnimatePresence mode="wait">
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <PageTransition>{MainPageComponent && <MainPageComponent />}</PageTransition>
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <PageTransition><Page /></PageTransition>
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/NotificationAnalytics" element={<LayoutWrapper currentPageName="NotificationAnalytics"><PageTransition><Suspense fallback={<LazyPageFallback />}><NotificationAnalytics /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/PostingDashboard" element={<LayoutWrapper currentPageName="PostingDashboard"><PageTransition><Suspense fallback={<LazyPageFallback />}><PostingDashboard /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/pages/PostingDashboard" element={<LayoutWrapper currentPageName="PostingDashboard"><PageTransition><Suspense fallback={<LazyPageFallback />}><PostingDashboard /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/StudentQuiz" element={<LayoutWrapper currentPageName="StudentQuiz"><PageTransition><Suspense fallback={<LazyPageFallback />}><StudentQuiz /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/StudentChangePassword" element={<LayoutWrapper currentPageName="StudentChangePassword"><PageTransition><Suspense fallback={<LazyPageFallback />}><StudentChangePassword /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/FinancialManagement" element={<LayoutWrapper currentPageName="FinancialManagement"><PageTransition><Suspense fallback={<LazyPageFallback />}><FinancialManagement /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/StaffAttendanceSalary" element={<LayoutWrapper currentPageName="StaffAttendanceSalary"><PageTransition><Suspense fallback={<LazyPageFallback />}><StaffAttendanceSalary /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/CleanerDashboard" element={<PageTransition><Suspense fallback={<LazyPageFallback />}><CleanerDashboard /></Suspense></PageTransition>} />
      <Route path="/KioskCheckin" element={<PageTransition><Suspense fallback={<LazyPageFallback />}><KioskCheckin /></Suspense></PageTransition>} />
      <Route path="/StaffQRPrint" element={<LayoutWrapper currentPageName="StaffQRPrint"><PageTransition><Suspense fallback={<LazyPageFallback />}><StaffQRPrint /></Suspense></PageTransition></LayoutWrapper>} />
      <Route path="/DeleteAccount" element={<PageTransition><Suspense fallback={<LazyPageFallback />}><DeleteAccount /></Suspense></PageTransition>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </AnimatePresence>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <Routes>
            {/* Public routes — no auth check */}
            <Route path="/receipt" element={<PublicReceipt />} />
            <Route path="/receipt/:receipt_no" element={<PublicReceipt />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            {/* All other routes go through auth */}
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App