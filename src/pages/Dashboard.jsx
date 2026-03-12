import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useApprovalsCount } from '@/components/ApprovalsCountBadge';
import { getEffectivePermissions } from '@/components/permissionHelper';
import { DASHBOARD_TILES } from '@/components/permissionRegistry';
import {
  ClipboardCheck, CheckSquare, BookOpen, BookMarked, Bell, Image, NotebookPen,
  ListChecks, Calendar, MessageSquare, AlertCircle, Wallet, BarChart3,
  TrendingUp, Receipt, Users, Settings, FileText, DollarSign, BookUser,
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
  exams_view:                   ['marks_enter', 'marks_view_module'],
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
function canSeeTile(tile, isAdmin, effectivePermissions) {
  if (tile.adminOnly) return isAdmin;
  if (isAdmin) return true;
  if (tile.staffOnly) return true;
  if (!tile.requiredPerm) return false;

  // Direct canonical key check (Phase 2+ sessions)
  if (effectivePermissions[tile.requiredPerm] === true) return true;

  // Legacy key fallback (pre-Phase-2 sessions or server-unreachable fallback)
  const altKeys = TILE_LEGACY_MAP[tile.requiredPerm] || [];
  return altKeys.some(k => effectivePermissions[k] === true);
}

/** Returns all DASHBOARD_TILES visible to the current user. */
function getVisibleTiles(isAdmin, effectivePermissions) {
  return DASHBOARD_TILES.filter(tile => canSeeTile(tile, isAdmin, effectivePermissions));
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
  const [isLoading, setIsLoading] = useState(true);
  const [latestDiaries, setLatestDiaries] = useState([]);
  const [recentNotices, setRecentNotices] = useState([]);

  const isAdmin = staffRole === 'admin' || staffRole === 'principal';
  const isTeacher = staffRole === 'teacher';
  const isAccountant = staffRole === 'accountant';
  const isExamStaff = staffRole === 'exam_staff';

  const approvalsCount = useApprovalsCount(academicYear, isAdmin);

  // Load staff profile only once — role doesn't change mid-session
  useEffect(() => { loadStaffProfile(); }, []);

  // Load notices/diaries only on first mount, not on academicYear change
  useEffect(() => { loadContentData(); }, []);

  const loadStaffProfile = async () => {
    try {
      const session = getStaffSession();
      let resolvedRole = '';

      if (session) {
        const token = session.staff_session_token;
        if (token) {
          try {
            const res = await base44.functions.invoke('getMyStaffProfile', {
              staff_session_token: token,
            });
            if (res.data?.role) {
              resolvedRole = normaliseRole(res.data.role);
              setStaffRole(resolvedRole);
              setStaffName(res.data.name || session.name || '');
              const resolvedPerms = res.data.effective_permissions ?? res.data.permissions ?? {};
              setEffectivePermissions(resolvedPerms);
              setPermissionsCount(Object.values(resolvedPerms).filter(Boolean).length);
              setRoleSource('staff_session_token (verified)');

              if (normaliseRole(session.role) !== resolvedRole) {
                const updated = { ...session, role: resolvedRole };
                localStorage.setItem('staff_session', JSON.stringify(updated));
              }
            } else {
              resolvedRole = normaliseRole(session.role);
              setStaffRole(resolvedRole);
              setStaffName(session.name || '');
              setPermissionsCount(0);
              setRoleSource('staff_session (localStorage fallback)');
            }
          } catch {
            resolvedRole = normaliseRole(session.role);
            setStaffRole(resolvedRole);
            setStaffName(session.name || '');
            setPermissionsCount(0);
            setRoleSource('staff_session (fallback — server unreachable)');
          }
        } else {
          resolvedRole = normaliseRole(session.role);
          setStaffRole(resolvedRole);
          setStaffName(session.name || '');
          setPermissionsCount(0);
          setRoleSource('staff_session (no token — localStorage only)');
        }
      } else {
        const currentUser = await base44.auth.me().catch(() => null);
        if (currentUser) {
          resolvedRole = normaliseRole(currentUser.role);
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

  const loadContentData = async () => {
    try {
      const session = getStaffSession();
      const resolvedRole = normaliseRole(session?.role || '');
      
      if (resolvedRole !== 'accountant') {
        try {
          const diaries = await base44.entities.Diary.list('-created_date', 3);
          setLatestDiaries(diaries || []);
        } catch {}
        try {
          const notices = await base44.entities.Notice.list('-publish_date', 5);
          setRecentNotices(notices || []);
        } catch {}
      }
    } catch (e) {
      console.error('Dashboard content load error:', e);
    }
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

  // Compute once — all tiles visible to this user given role + effectivePermissions
  const visibleTiles = getVisibleTiles(isAdmin, effectivePermissions);

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
          <section>
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Fees &amp; Accounts</h2>
            {feeTiles.length > 0 ? <TileGrid tiles={feeTiles} /> : <EmptyTilesMessage />}
          </section>
        </div>
      </div>
    );
  }

  // ─── TEACHER DASHBOARD ──────────────────────────────────────────────────────
  if (isTeacher) {
    const teacherTiles = visibleTiles; // adminOnly tiles already excluded by canSeeTile

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'Teacher'}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Quick Actions</h2>
            {teacherTiles.length > 0 ? <TileGrid tiles={teacherTiles} /> : <EmptyTilesMessage />}
          </section>

          {recentNotices.length > 0 && (
            <section>
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
        </div>
      </div>
    );
  }

  // ─── EXAM STAFF DASHBOARD ───────────────────────────────────────────────────
  if (isExamStaff) {
    const examTiles = visibleTiles; // adminOnly tiles already excluded by canSeeTile

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'Exam Staff'}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>
          <section>
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Exam &amp; Attendance</h2>
            {examTiles.length > 0 ? <TileGrid tiles={examTiles} /> : <EmptyTilesMessage />}
          </section>
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

          {latestDiaries.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Latest Diary Entries</h2>
              <div className="space-y-3">
                {latestDiaries.map(diary => (
                  <div key={diary.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border-l-4 border-pink-500">
                    <p className="font-semibold text-gray-900 dark:text-white">{diary.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Class {diary.class_name} • {diary.subject}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">{diary.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ─── GENERIC DASHBOARD (staff, librarian, custom role templates) ─────────────
  // Role is used only to select this shell. Tiles shown are entirely permission-driven.
  const genericTiles = visibleTiles; // adminOnly tiles already excluded by canSeeTile
  const genericSections = groupBySection(genericTiles);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {staffName || 'Staff'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
        </div>

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
      </div>
    </div>
  );
}