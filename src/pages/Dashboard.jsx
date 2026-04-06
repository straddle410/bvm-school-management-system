import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useApprovalsCount } from '@/components/ApprovalsCountBadge';
import { getEffectivePermissions } from '@/components/permissionHelper';
import { DASHBOARD_TILES } from '@/components/permissionRegistry';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StaffAttendanceOverview from '@/components/staff/StaffAttendanceOverview';
import StaffSalaryOverview from '@/components/staff/StaffSalaryOverview';
import {
  ClipboardCheck, CheckSquare, BookOpen, BookMarked, Bell, Image, NotebookPen,
  ListChecks, Calendar, MessageSquare, AlertCircle, Wallet, BarChart3,
  TrendingUp, Receipt, Users, Settings, FileText, DollarSign, BookUser, BellRing,
  UserCheck, QrCode, Smartphone, LayoutDashboard, CalendarDays, IndianRupee,
} from 'lucide-react';

// ── Icon name → lucide component map ─────────────────────────────────────────
// Dashboard tiles store iconName as a string; resolved here at render time.
const ICON_MAP = {
  Users, CheckSquare, BookOpen, BookMarked, Calendar, NotebookPen,
  FileText, Bell, Image, ListChecks, MessageSquare, Wallet, BarChart3,
  TrendingUp, Receipt, AlertCircle, DollarSign, BookUser, Settings, ClipboardCheck,
};

// ── Session helpers ───────────────────────────────────────────────────────────
function getStaffSession() {
  try {
    const raw = localStorage.getItem('staff_session');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function normaliseRole(r) {
  return (r || '').trim().toLowerCase();
}

// ── Tile filtering helpers ────────────────────────────────────────────────────

/**
 * Extended legacy key fallback for tile visibility.
 * Handles old pre-Phase-2 session permission keys (e.g. `attendance: true`)
 * mapping to canonical DASHBOARD_TILES requiredPerm keys.
 * Only invoked when the direct canonical key check fails.
 */
const TILE_LEGACY_MAP = {
  attendance_view:              ['attendance', 'attendance_mark', 'attendance_view_module'],
  marks_view:                   ['marks', 'marks_enter', 'marks_view_module'],
  exams_view:                   ['marks_view_module'],
  notices_view:                 ['post_notices', 'notices_create', 'notices_view_module'],
  gallery_view:                 ['gallery', 'gallery_upload', 'gallery_view_module'],
  quiz_view:                    ['quiz', 'quiz_create', 'quiz_create_edit', 'quiz_view_module'],
  homework_view:                ['homework_manage'],
  diary_view:                   ['diary_manage'],
  timetable_view:               ['timetable_manage'],
  admissions_view:              ['admissions_view_module', 'student_admission_permission'],
  fees_view:                    ['fees_view_module'],
  fees_ledger_view:             ['fees_view_ledger'],
  fee_reports_collection:       ['fee_reports_collection', 'fee_reports_view'],
  fee_reports_outstanding:      ['fee_reports_outstanding', 'fee_reports_view'],
  fee_reports_ledger:           ['fee_reports_student_ledger', 'fees_view_ledger', 'fee_reports_view'],
  fee_reports_parent_statement: ['fees_view_parent_statement'],
  messages_view:                ['messages_send'],
};

/**
 * Determines whether a single tile should be visible.
 *
 * Priority:
 *   1. adminOnly tiles → only admins
 *   2. admin role → sees everything
 *   3. staffOnly tiles → any authenticated staff
 *   4. canonical permission key check
 *   5. legacy key fallback (for pre-Phase-2 sessions)
 */
function canSeeTile(tile, isAdmin, effectivePermissions, isCeo = false) {
  if (tile.adminOnly) return isAdmin;
  if (isAdmin) return true;
  // CEO must have explicit permission — don't grant access via staffOnly alone
  if (tile.staffOnly && !isCeo) return true;
  if (!tile.requiredPerm) return isCeo ? false : false;

  // Direct canonical key check (Phase 2+ sessions)
  if (effectivePermissions[tile.requiredPerm] === true) return true;

  // Legacy key fallback (pre-Phase-2 sessions or server-unreachable fallback)
  const altKeys = TILE_LEGACY_MAP[tile.requiredPerm] || [];
  return altKeys.some(k => effectivePermissions[k] === true);
}

/** Returns all DASHBOARD_TILES visible to the current user. */
function getVisibleTiles(isAdmin, effectivePermissions, isCeo = false) {
  return DASHBOARD_TILES.filter(tile => canSeeTile(tile, isAdmin, effectivePermissions, isCeo));
}

/** Groups a flat tile array by section, preserving DASHBOARD_TILES order. */
function groupBySection(tiles) {
  const order = [];
  const sectionMap = {};
  tiles.forEach(tile => {
    if (!sectionMap[tile.section]) {
      sectionMap[tile.section] = [];
      order.push(tile.section);
    }
    sectionMap[tile.section].push(tile);
  });
  return order.map(s => ({ title: s, tiles: sectionMap[s] }));
}

/** Converts a DASHBOARD_TILES entry to ActionCard props. */
function tileToAction(tile) {
  return {
    label: tile.label,
    icon: ICON_MAP[tile.iconName] || FileText,
    page: tile.page,
    gradient: tile.gradient,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { academicYear } = useAcademicYear();
  const [staffRole, setStaffRole] = useState('');
  const [staffName, setStaffName] = useState('');
  const [roleSource, setRoleSource] = useState('');
  const [permissionsCount, setPermissionsCount] = useState(0);
  // Initialised from session so first render has permissions before profile call resolves
  const [effectivePermissions, setEffectivePermissions] = useState(() => {
    try {
      const raw = localStorage.getItem('staff_session');
      if (raw) return getEffectivePermissions(JSON.parse(raw));
    } catch {}
    return {};
  });
  const [staffId, setStaffId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentNotices, setRecentNotices] = useState([]);

  const isCleaner = staffRole === 'cleaner';
  const isAdmin = staffRole === 'admin' || staffRole === 'principal';
  const isCeo = staffRole === 'ceo';
  const isTeacher = staffRole === 'teacher';
  const isAccountant = staffRole === 'accountant';
  const isExamStaff = staffRole === 'exam_staff';

  const approvalsCount = useApprovalsCount(academicYear, isAdmin);

  // Load staff profile only once — role doesn't change mid-session
  useEffect(() => { loadStaffProfile(); }, []);

  // Load notices lazily after dashboard renders (async, non-blocking)
  useEffect(() => { loadNotices(); }, []);

  const loadStaffProfile = async () => {
    try {
      const session = getStaffSession();
      
      // Use session data directly — avoid expensive getMyStaffProfile call
      if (session) {
        const resolvedRole = normaliseRole(session.role);
        setStaffRole(resolvedRole);
        setStaffName(session.name || session.full_name || '');
        setStaffId(session.id || null);
        setRoleSource('staff_session (localStorage — optimized)');
      } else {
        const currentUser = await base44.auth.me().catch(() => null);
        if (currentUser) {
          const resolvedRole = normaliseRole(currentUser.role);
          setStaffRole(resolvedRole);
          setStaffName(currentUser.full_name || currentUser.email || '');
          setRoleSource('platform auth.me()');
        }
      }
      setIsLoading(false);
    } catch (e) {
      console.error('Dashboard profile load error:', e);
      setIsLoading(false);
    }
  };

  const loadNotices = async () => {
    try {
      const notices = await base44.entities.Notice.list('-publish_date', 5);
      setRecentNotices(notices || []);
    } catch {}
  };

  // ── Shared sub-components ──────────────────────────────────────────────────
  const GradientIcon = ({ gradient, icon: Icon }) => (
    <div className={`bg-gradient-to-br ${gradient} p-3 rounded-2xl text-white`}>
      <Icon className="h-6 w-6" />
    </div>
  );

  const ActionCard = ({ label, icon, page, gradient }) => (
    <Link to={createPageUrl(page)} className="block">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
        <GradientIcon gradient={gradient} icon={icon} />
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">{label}</span>
      </div>
    </Link>
  );

  const EmptyTilesMessage = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm flex flex-col items-center text-center gap-3">
      <AlertCircle className="h-8 w-8 text-gray-300" />
      <p className="font-semibold text-gray-500 dark:text-gray-400">No modules assigned.</p>
      <p className="text-sm text-gray-400 dark:text-gray-500">Contact your admin to get access to modules.</p>
    </div>
  );

  const TileGrid = ({ tiles }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {tiles.map(tile => <ActionCard key={tile.id} {...tileToAction(tile)} />)}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Cleaner role — redirect to dedicated page
  if (isCleaner) {
    window.location.replace('/CleanerDashboard');
    return null;
  }

  // Compute once — all tiles visible to this user given role + effectivePermissions
  const visibleTiles = getVisibleTiles(isAdmin, effectivePermissions, isCeo);

  // ─── CEO DASHBOARD ─────────────────────────────────────────────────────────
  if (isCeo) {
    const CEO_TILES = [
      { label: 'Attendance',    to: '/Attendance',           icon: CheckSquare,   gradient: 'from-teal-400 to-teal-600' },
      { label: 'Marks',         to: '/Marks',                icon: BookOpen,      gradient: 'from-green-400 to-green-600' },
      { label: 'Students',      to: '/Students',             icon: Users,         gradient: 'from-blue-400 to-blue-600' },
      { label: 'Messages',      to: '/Messaging',            icon: MessageSquare, gradient: 'from-sky-400 to-sky-600' },
      { label: 'Notices',       to: '/Notices',              icon: Bell,          gradient: 'from-yellow-400 to-yellow-600' },
      { label: 'Gallery',       to: '/Gallery',              icon: Image,         gradient: 'from-orange-400 to-orange-600' },
      { label: 'Transactions',  to: '/FinancialManagement',  icon: DollarSign,    gradient: 'from-emerald-500 to-teal-600' },
      { label: 'Staff Salary',  to: '/StaffAttendanceSalary',icon: UserCheck,     gradient: 'from-violet-500 to-fuchsia-600' },
    ];
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'CEO'}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {CEO_TILES.map(tile => (
              <Link key={tile.label} to={tile.to} className="block">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                  <div className={`bg-gradient-to-br ${tile.gradient} p-3 rounded-2xl text-white`}>
                    <tile.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">{tile.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── ACCOUNTANT DASHBOARD ───────────────────────────────────────────────────
  if (isAccountant) {
    const feeTiles = visibleTiles.filter(t => t.section === 'Fees & Finance');

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'Accountant'}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-white dark:bg-gray-800 shadow-sm">
              <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="attendance"><CalendarDays className="h-4 w-4 mr-1" />My Attendance</TabsTrigger>
              <TabsTrigger value="salary"><IndianRupee className="h-4 w-4 mr-1" />My Salary</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <section className="mb-8">
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Fees &amp; Accounts</h2>
                {feeTiles.length > 0 ? <TileGrid tiles={feeTiles} /> : <EmptyTilesMessage />}
              </section>
              <section>
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Financial Management</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  <Link to="/FinancialManagement" className="block">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-2xl text-white">
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">Transactions &amp; Tax</span>
                    </div>
                  </Link>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="attendance">
              <StaffAttendanceOverview staffId={staffId} academicYear={academicYear} />
            </TabsContent>

            <TabsContent value="salary">
              <StaffSalaryOverview staffId={staffId} academicYear={academicYear} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // ─── TEACHER DASHBOARD ──────────────────────────────────────────────────────
  if (isTeacher) {
    const teacherTiles = visibleTiles.filter(t => t.page !== 'Students');

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'Teacher'}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-white dark:bg-gray-800 shadow-sm">
              <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="attendance"><CalendarDays className="h-4 w-4 mr-1" />My Attendance</TabsTrigger>
              <TabsTrigger value="salary"><IndianRupee className="h-4 w-4 mr-1" />My Salary</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <section>
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Quick Actions</h2>
                {teacherTiles.length > 0 ? <TileGrid tiles={teacherTiles} /> : <EmptyTilesMessage />}
              </section>
              {recentNotices.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Recent Notices</h2>
                  <div className="space-y-3">
                    {recentNotices.slice(0, 3).map(notice => (
                      <div key={notice.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border-l-4 border-yellow-500">
                        <p className="font-semibold text-gray-900 dark:text-white">{notice.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notice.notice_type}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">{notice.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>

            <TabsContent value="attendance">
              <StaffAttendanceOverview staffId={staffId} academicYear={academicYear} />
            </TabsContent>

            <TabsContent value="salary">
              <StaffSalaryOverview staffId={staffId} academicYear={academicYear} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // ─── EXAM STAFF DASHBOARD ───────────────────────────────────────────────────
  if (isExamStaff) {
    const examTiles = visibleTiles;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'Exam Staff'}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-white dark:bg-gray-800 shadow-sm">
              <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="attendance"><CalendarDays className="h-4 w-4 mr-1" />My Attendance</TabsTrigger>
              <TabsTrigger value="salary"><IndianRupee className="h-4 w-4 mr-1" />My Salary</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <section>
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Exam &amp; Attendance</h2>
                {examTiles.length > 0 ? <TileGrid tiles={examTiles} /> : <EmptyTilesMessage />}
              </section>
            </TabsContent>
            <TabsContent value="attendance">
              <StaffAttendanceOverview staffId={staffId} academicYear={academicYear} />
            </TabsContent>
            <TabsContent value="salary">
              <StaffSalaryOverview staffId={staffId} academicYear={academicYear} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // ─── ADMIN / PRINCIPAL DASHBOARD ────────────────────────────────────────────
  if (isAdmin) {
    const adminSections = groupBySection(visibleTiles);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || staffRole}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>

          {approvalsCount > 0 && (
            <section className="mb-6">
              <Link to={createPageUrl('Approvals')}>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 shadow-sm border border-red-200 dark:border-red-800 hover:shadow-md transition-shadow flex items-center gap-3">
                  <div className="bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    {approvalsCount > 9 ? '9+' : approvalsCount}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Pending Approvals</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Review and approve pending submissions</p>
                  </div>
                  <ClipboardCheck className="h-5 w-5 text-red-400 dark:text-red-500 ml-auto" />
                </div>
              </Link>
            </section>
          )}

          {adminSections.map(section => (
            <section key={section.title} className="mb-8">
              <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">{section.title}</h2>
              <TileGrid tiles={section.tiles} />
            </section>
          ))}

          {/* Kiosk & QR Cards — admin only */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">🖨️ Kiosk Attendance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <Link to="/StaffQRPrint" className="block">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-2xl text-white">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">Print QR ID Cards</span>
                </div>
              </Link>
              <Link to="/KioskCheckin" className="block">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-2xl text-white">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">Kiosk Check-in</span>
                </div>
              </Link>
            </div>
          </section>

          {/* Notification Analytics + Financial Management + Staff — admin only */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Analytics &amp; Finance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <Link to="/NotificationAnalytics" className="block">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl text-white">
                    <BellRing className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">Notification Analytics</span>
                </div>
              </Link>
              <Link to="/FinancialManagement" className="block">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-2xl text-white">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">Transactions &amp; Tax</span>
                </div>
              </Link>
              <Link to="/StaffAttendanceSalary" className="block">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                  <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-3 rounded-2xl text-white">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">Staff Attendance &amp; Salary</span>
                </div>
              </Link>
            </div>
          </section>


        </div>
      </div>
    );
  }

  // ─── GENERIC DASHBOARD (staff, librarian, custom role templates) ─────────────
  const genericTiles = visibleTiles;
  const genericSections = groupBySection(genericTiles);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'Staff'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-white dark:bg-gray-800 shadow-sm">
            <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="attendance"><CalendarDays className="h-4 w-4 mr-1" />My Attendance</TabsTrigger>
            <TabsTrigger value="salary"><IndianRupee className="h-4 w-4 mr-1" />My Salary</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {genericTiles.length === 0 ? (
              <EmptyTilesMessage />
            ) : (
              genericSections.map(section => (
                <section key={section.title} className="mb-8">
                  {genericSections.length > 1 && (
                    <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">{section.title}</h2>
                  )}
                  <TileGrid tiles={section.tiles} />
                </section>
              ))
            )}
          </TabsContent>

          <TabsContent value="attendance">
            <StaffAttendanceOverview staffId={staffId} academicYear={academicYear} />
          </TabsContent>

          <TabsContent value="salary">
            <StaffSalaryOverview staffId={staffId} academicYear={academicYear} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}