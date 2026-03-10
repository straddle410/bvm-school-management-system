import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStaffSession } from '@/components/useStaffSession';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import PromoteStudents from '@/components/PromoteStudents';
import StudentFilters from '@/components/students/StudentFilters';
import StudentCard from '@/components/students/StudentCard';
import StudentForm from '@/components/students/StudentForm';
import StudentProfileSheet from '@/components/students/StudentProfileSheet';
import StudentBulkUpload from '@/components/students/StudentBulkUpload';
import StudentExport from '@/components/students/StudentExport';
import ManageRollNumbers from '@/components/students/ManageRollNumbers';
import PastYearWarning, { isPastAcademicYear } from '@/components/PastYearWarning';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Users, Upload, CheckCircle, ChevronLeft, ChevronRight, Hash, Archive, ChevronDown, Bus, MoreVertical, Download, TrendingUp, ArrowLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { normalizeStudentData, namesMatch } from '@/components/normalizeStudentData';
import { isLocked, isValidTransition, ACTIVE_STATUSES } from '@/components/students/studentStatusUtils';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

const EMPTY_FORM = {
  student_id: '', username: '',
  name: '', class_name: '', section: '', roll_no: '',
  parent_name: '', parent_phone: '', parent_email: '',
  dob: '', gender: 'Male', address: '', blood_group: '',
  admission_date: '', academic_year: '', status: 'Pending', photo_url: ''
};

// Password reset dialog state
const [showResetDialog, setShowResetDialog] = React.useState(false);
const [resetStudent, setResetStudent] = React.useState(null);
const [resetLoading, setResetLoading] = React.useState(false);
const [resetResult, setResetResult] = React.useState(null);

// Student ID is NEVER generated at create time.
// It is generated only when status transitions to Approved (via approveStudentAndGenerateId).

export default function Students() {
  const { academicYear, setAcademicYear, roleLoaded } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [photoFile, setPhotoFile] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showManageRolls, setShowManageRolls] = useState(false);
  const [showPastYearWarning, setShowPastYearWarning] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [transportAction, setTransportAction] = useState('');
  const [showTransportConfirm, setShowTransportConfirm] = useState(false);
  const [transportLoading, setTransportLoading] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sfAvailableClasses, setSfAvailableClasses] = useState([]);
  const [sfAvailableSections, setSfAvailableSections] = useState([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetStudent, setResetStudent] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const LIMIT = 25;
  const debounceRef = useRef(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStaffSession();
    if (session) setUser(session);
    else base44.auth.me().then(setUser).catch(() => {});
    
    base44.entities.SchoolProfile.list().then(profiles => {
      if (profiles.length > 0) setSchoolProfile(profiles[0]);
    }).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'Admin' || user?.role === 'admin' ||
                  user?.role === 'Principal' || user?.role === 'principal';

  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear).then(result => {
      setSfAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
    });
  }, [academicYear]);

  useEffect(() => {
    if (filterClass === 'all' || !filterClass || !academicYear) { setSfAvailableSections([]); return; }
    getSectionsForClass(academicYear, filterClass).then(result => {
      setSfAvailableSections(Array.isArray(result) ? result : (result?.sections ?? []));
    });
  }, [filterClass, academicYear]);
  const isTeacher = !isAdmin && (user?.role === 'teacher' || user?.role === 'Teacher' || user?.role === 'staff' || user?.role === 'Staff');

  // Debounced search trigger
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const handleSearchChange = useCallback((val) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', academicYear, page, LIMIT, debouncedSearch, filterClass, filterSection, filterStatus, showArchived, showDeleted],
    queryFn: async () => {
      let effectiveStatus = filterStatus === 'all' ? '' : filterStatus;
      const restrictToActive = !showArchived && !showDeleted && filterStatus === 'all';

      const session = getStaffSession();
      const res = await base44.functions.invoke('getStudentsPaginated', {
        page,
        limit: LIMIT,
        search: debouncedSearch,
        class_name: filterClass === 'all' ? '' : filterClass,
        section: filterSection === 'all' ? '' : filterSection,
        status: effectiveStatus,
        exclude_archived: restrictToActive,
        show_deleted: showDeleted && isAdmin,
        academic_year: academicYear,
        staff_session_token: session?.staff_session_token || null,
      });
      return res.data;
    },
    enabled: !!academicYear && roleLoaded,
    keepPreviousData: true
  });

  const students = studentsData?.data || [];

  useEffect(() => {
    if (studentsData) {
      setTotalPages(studentsData.total_pages || 1);
      setTotalCount(studentsData.total_count || 0);
    }
  }, [studentsData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterClass, filterSection, filterStatus, academicYear]);



  // ── Validation helpers ──────────────────────────────────────────────────
  const validateStudentIdUnique = async (studentId, excludeId = null) => {
    if (!studentId) return;
    const dupes = await base44.entities.Student.filter({ student_id: studentId });
    const conflict = excludeId ? dupes.find(s => s.id !== excludeId) : dupes[0];
    if (conflict) throw new Error('Student ID already exists. Please regenerate.');
  };

  const validateRollNoUnique = async ({ roll_no, class_name, section, academic_year }, excludeId = null) => {
    if (!roll_no || !class_name || !section || !academic_year) return;
    const dupes = await base44.entities.Student.filter({ roll_no: parseInt(roll_no), class_name, section, academic_year });
    const conflict = excludeId ? dupes.find(s => s.id !== excludeId) : dupes[0];
    if (conflict) throw new Error('Roll number already assigned in this class for this academic year.');
  };

  const validateNoDuplicateStudent = async ({ name, dob, class_name, academic_year }) => {
    if (!name || !dob || !class_name || !academic_year) return;
    const all = await base44.entities.Student.filter({ class_name, academic_year });
    const conflict = all.find(s => namesMatch(s.name, name) && s.dob === dob);
    if (conflict) throw new Error('Possible duplicate student already exists.');
  };
  // ────────────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async ({ id, data, originalStudentId, originalStatus }) => {
      // ── SOFT-DELETE GUARD: block all edits/status changes on deleted students ──
      if (id) {
        const currentRecords = await base44.entities.Student.filter({ id });
        const current = currentRecords[0];
        if (current && current.is_deleted === true) {
          throw new Error('Operation not allowed for deleted student.');
        }
      }

      // Block edits on locked students (Passed Out / Transferred)
      if (id && isLocked({ status: originalStatus || data.status })) {
        throw new Error('This student record is locked (Passed Out / Transferred) and cannot be edited.');
      }

      // Role check — only admin can change status
      if (!isAdmin && data.status !== originalStatus) {
        throw new Error('Only Admin/Principal can change student status.');
      }

      // Validate status transition
      if (id && originalStatus && data.status !== originalStatus) {
        if (!isValidTransition(originalStatus, data.status)) {
          throw new Error(`Invalid status transition: ${originalStatus} → ${data.status}`);
        }
      }

      let photo_url = data.photo_url;
      if (photoFile) {
        const r = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = r.file_url;
      }

      // Validate student_id format
      if (data.student_id && !/^S\d+$/.test(data.student_id)) {
        throw new Error('Invalid Student ID format. Expected format: S25001');
      }

      const normalized = normalizeStudentData({ ...data, photo_url });

      if (id) {
        // EDIT: if class/section/year changed → auto-assign new roll_no
        const orig = selectedStudent?.id === id ? selectedStudent : null;
        const classChanged = orig && (
          normalized.class_name !== orig.class_name ||
          normalized.section !== orig.section ||
          normalized.academic_year !== orig.academic_year
        );
        if (classChanged) {
          const nextRoll = await generateRollNo(normalized.class_name, normalized.section, normalized.academic_year);
          if (nextRoll) normalized.roll_no = nextRoll;
        }

        const rollChanged = orig && String(normalized.roll_no) !== String(orig.roll_no);
        if (rollChanged && !classChanged) await validateRollNoUnique(normalized, id);

        // Audit log + uniqueness check if student_id changed
        if (originalStudentId && normalized.student_id !== originalStudentId.toUpperCase().trim()) {
          await validateStudentIdUnique(normalized.student_id, id);
          await base44.entities.AuditLog.create({
            action: 'student_id_changed',
            module: 'Student',
            performed_by: user?.email || 'unknown',
            details: `Student ID changed from ${originalStudentId} to ${normalized.student_id} for student: ${normalized.name}`,
            date: new Date().toISOString().split('T')[0],
            academic_year: normalized.academic_year
          });
        }

        // Route through backend function for field-level audit + enforcement
        const session = getStaffSession();
        const updateRes = await base44.functions.invoke('updateStudentWithAudit', {
          student_db_id: id,
          updates: normalized,
          staff_session_token: session?.staff_session_token || null
        });
        if (updateRes.data?.error) throw new Error(updateRes.data.error);
        return updateRes.data?.student;
      }

      // CREATE: student_id, username, and roll_no are intentionally NULL at create time.
       // They are assigned only when status transitions to Approved (via approveStudentAndGenerateId).
       normalized.student_id = null;
       normalized.student_id_norm = null;
       normalized.username = null;
       normalized.roll_no = null; // Roll number NEVER assigned at create time

       await validateNoDuplicateStudent(normalized);

      // Block creation if academic_year is missing
      if (!normalized.academic_year || !normalized.academic_year.trim()) {
        throw new Error('Academic year is required to create a student.');
      }

      return base44.entities.Student.create(normalized);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowForm(false);
      setPhotoFile(null);
      toast.success(isEdit ? 'Student updated' : 'Student added');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save student');
    }
  });

  const softDeleteMutation = useMutation({
    mutationFn: async ({ id, action }) => {
      const res = await base44.functions.invoke('softDeleteStudent', { student_id: id, action, staff_session_token: getStaffSession()?.staff_session_token || null });
      if (res.data?.blocked) throw new Error(res.data.error);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries(['students']);
      setShowProfile(false);
      toast.success(action === 'delete' ? 'Student soft-deleted' : 'Student restored');
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = e => {
    e.preventDefault();
    saveMutation.mutate({
      id: isEdit ? selectedStudent.id : null,
      data: formData,
      originalStudentId: isEdit ? selectedStudent.student_id : null,
      originalStatus: isEdit ? selectedStudent.status : null
    });
  };

  const openAdd = async () => {
    if (isPastAcademicYear(academicYear) && schoolProfile?.academic_year !== academicYear) {
      setShowPastYearWarning(true);
      return;
    }
    // student_id is NOT pre-filled — it is assigned only on Approved
    setFormData({ ...EMPTY_FORM, academic_year: academicYear });
    setIsEdit(false);
    setPhotoFile(null);
    setShowForm(true);
  };

  const handlePastYearConfirm = async () => {
    setShowPastYearWarning(false);
    // student_id is NOT pre-filled — it is assigned only on Approved
    setFormData({ ...EMPTY_FORM, academic_year: academicYear });
    setIsEdit(false);
    setPhotoFile(null);
    setShowForm(true);
  };

  // Form data changes — no roll number generation here
  // Roll number is assigned ONLY at approval time, never during create
  const handleFormChange = (newData) => {
    setFormData(newData);
  };

  const openEdit = student => {
    // Teachers cannot edit
    if (!isAdmin) {
      toast.error('Only Admin/Principal can edit student records.');
      return;
    }
    setFormData({ ...student });
    setSelectedStudent(student);
    setIsEdit(true);
    setPhotoFile(null);
    setShowProfile(false);
    setShowForm(true);
  };

  const openProfile = student => {
    setSelectedStudent(student);
    setShowProfile(true);
  };

  const handleArchive = async student => {
    if (!isAdmin) {
      toast.error('Only Admin/Principal can archive/reactivate students.');
      return;
    }
    // ── SOFT-DELETE GUARD ──
    if (student.is_deleted) {
      toast.error('Operation not allowed for deleted student.');
      return;
    }
    const isArchived = isLocked(student);
    if (isArchived) {
      // Admin-only revert from Passed Out/Transferred → Published
      if (!window.confirm(`Reactivate ${student.name}? This will set their status back to Published.`)) return;
      const revertRes = await base44.functions.invoke('updateStudentWithAudit', {
        student_db_id: student.id,
        updates: { status: 'Published' },
        staff_session_token: getStaffSession()?.staff_session_token || null
      });
      if (revertRes.data?.error) { toast.error(revertRes.data.error); return; }
      queryClient.invalidateQueries(['students']);
      setShowProfile(false);
      toast.success('Student reactivated');
    } else {
      // Forward: Published → Passed Out
      if (!isValidTransition(student.status, 'Passed Out')) {
        toast.error(`Cannot archive student with status: ${student.status}. Student must be Published first.`);
        return;
      }
      if (!window.confirm(`Archive ${student.name} as "Passed Out"? The record will become read-only.`)) return;
      const archiveRes = await base44.functions.invoke('updateStudentWithAudit', {
        student_db_id: student.id,
        updates: { status: 'Passed Out' },
        staff_session_token: getStaffSession()?.staff_session_token || null
      });
      if (archiveRes.data?.error) { toast.error(archiveRes.data.error); return; }
      queryClient.invalidateQueries(['students']);
      setShowProfile(false);
      toast.success('Student archived as Passed Out');
    }
  };

  const handleDelete = student => {
    if (!window.confirm(`Soft-delete ${student.name}? They will be hidden from all views but not permanently removed.`)) return;
    softDeleteMutation.mutate({ id: student.id, action: 'delete' });
  };

  const handleRestore = student => {
    if (!window.confirm(`Restore ${student.name}? They will become visible again.`)) return;
    softDeleteMutation.mutate({ id: student.id, action: 'restore' });
  };

  // Selectable students = those on the current page that are not locked and not deleted
  const selectableStudents = students.filter(s => !isLocked(s) && !s.is_deleted);

  const handleSelectAll = () => {
    if (selectedIds.size === selectableStudents.length && selectableStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableStudents.map(s => s.id)));
    }
  };

  const handleToggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  // Status transitions available as bulk actions
  const BULK_ACTIONS = [
    { value: 'Verified',   label: 'Mark as Verified',   fromStatuses: ['Pending'] },
    { value: 'Approved',   label: 'Mark as Approved',   fromStatuses: ['Verified'] },
    { value: 'Published',  label: 'Mark as Active',     fromStatuses: ['Approved'] },
  ];

  // Available actions for currently-selected students
  const availableBulkActions = BULK_ACTIONS.filter(action =>
    Array.from(selectedIds).some(id => {
      const s = students.find(st => st.id === id);
      return s && action.fromStatuses.includes(s.status);
    })
  );

  const handleBulkStatusChange = async (toStatus) => {
    if (!isAdmin) { toast.error('Only Admin/Principal can change student status.'); return; }
    if (selectedIds.size === 0 || !toStatus) return;

    const ids = Array.from(selectedIds);
    let processed = 0;
    let failed = 0;
    const failedNames = [];

    for (const id of ids) {
      const student = students.find(s => s.id === id);
      if (!student) continue;
      if (!isValidTransition(student.status, toStatus)) continue;

      // SPECIAL CASE: Approving student → call dedicated approval function
       // This generates student_id AND roll_no in SAME transaction, no automation dependency
       if (toStatus === 'Approved' && !student.student_id) {
         const approveRes = await base44.functions.invoke('approveStudentAndGenerateRollNo', {
           student_db_id: id
         });
         if (approveRes.data?.error) {
           failed++;
           failedNames.push(student.name);
           continue;
         }
         processed++;
       } else {
         // Standard status updates (Pending→Verified, Approved→Published, etc)
         const updates = { status: toStatus };
         if (toStatus === 'Verified')  updates.verified_by  = user.email;

         const updateRes = await base44.functions.invoke('updateStudentWithAudit', {
           student_db_id: id,
           updates,
           staff_session_token: getStaffSession()?.staff_session_token || null
         });

         // Check for errors in response
         if (updateRes.data?.error) {
           failed++;
           failedNames.push(student.name);
           continue;
         }
         processed++;
       }
     }

    // Refresh list after processing completes
    queryClient.invalidateQueries(['students']);

    // Show appropriate feedback based on results
    if (processed === 0 && failed > 0) {
      // All failed
      toast.error(`Failed to update: ${failedNames.join(', ')}`);
      // Keep selection for retry
      return;
    }

    if (processed > 0 && failed === 0) {
      // All succeeded
      toast.success(`${processed} student(s) updated to ${toStatus}`);
      setSelectedIds(new Set());
      setBulkAction('');
    }

    if (processed > 0 && failed > 0) {
      // Partial success
      toast.error(`${processed} updated, ${failed} failed: ${failedNames.join(', ')}`);
      // Keep selection for retry on failed students only
      const newSelection = new Set(ids.filter(id => {
        const s = students.find(st => st.id === id);
        return s && !isValidTransition(s.status, toStatus);
      }));
      setSelectedIds(newSelection);
      setBulkAction('');
    }
  };

  const handleBulkTransport = async () => {
    if (!isAdmin || selectedIds.size === 0 || transportAction === '') return;
    setTransportLoading(true);
    const session = getStaffSession();
    const transport_enabled = transportAction === 'on';
    const res = await base44.functions.invoke('bulkUpdateStudentTransport', {
      staff_session_token: session?.staff_session_token || null,
      student_ids: Array.from(selectedIds),
      transport_enabled,
    });
    setTransportLoading(false);
    setShowTransportConfirm(false);
    if (res.data?.success) {
      queryClient.invalidateQueries(['students']);
      setSelectedIds(new Set());
      setTransportAction('');
      toast.success(`Transport ${transport_enabled ? 'ON' : 'OFF'} applied to ${res.data.updatedCount} student(s)`);
    } else {
      toast.error(res.data?.error || 'Failed to update transport');
    }
  };

  // Stats from current page (server already filtered)
  const totalActive = students.filter(s => s.status === 'Published').length;
  const totalPending = students.filter(s => s.status === 'Pending').length;
  const totalArchived = students.filter(s => s.status === 'Passed Out' || s.status === 'Transferred').length;

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Students">
      <div className="min-h-screen bg-[#f0f4ff]">
        {/* Compact Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            {/* Left: back + title */}
            <div className="flex items-center gap-2 min-w-0">
              <Link to={createPageUrl('Dashboard')} className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition">
                <ArrowLeft className="h-4 w-4 text-slate-600" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-slate-900 truncate leading-tight">Students <span className="text-[#1a237e]">— {academicYear}</span></h1>
                <p className="text-xs text-slate-400 leading-tight">{totalCount} students</p>
              </div>
            </div>

            {/* Right: actions */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Add Student — always visible */}
                <Button size="sm" onClick={openAdd} className="bg-[#1a237e] hover:bg-[#283593] rounded-lg h-8 px-3 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Student
                </Button>

                {/* More dropdown for less-used actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-lg h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setShowBulkUpload(true)}>
                      <Upload className="h-4 w-4 mr-2 text-gray-500" /> Import Students
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { if (students.length === 0) { toast.error('No students to export'); return; } const headers = ['student_id','name','class_name','section','roll_no','parent_name','parent_phone','parent_email','dob','gender','address','blood_group','admission_date','status']; const rows = students.map(s => headers.map(h => `"${(s[h]||'').toString().replace(/"/g,'""')}"`).join(',')); const csv = [headers.join(','),...rows].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `students-${academicYear}-${new Date().toISOString().split('T')[0]}.csv`; a.click(); toast.success('Exported'); }} title="Security: password fields excluded from export">
                      <Download className="h-4 w-4 mr-2 text-gray-500" /> Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowManageRolls(true)}>
                      <Hash className="h-4 w-4 mr-2 text-gray-500" /> Roll Numbers
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPromote(true)}>
                      <TrendingUp className="h-4 w-4 mr-2 text-gray-500" /> Promote Students
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
          {/* Compact stats strip */}
          <div className="bg-white rounded-xl shadow-sm px-4 py-2 flex items-center gap-4 text-sm">
            <span className="font-semibold text-green-600">{totalActive} <span className="font-normal text-gray-400">Active</span></span>
            <span className="text-gray-200">|</span>
            <span className="font-semibold text-yellow-600">{totalPending} <span className="font-normal text-gray-400">Pending</span></span>
            <span className="text-gray-200">|</span>
            <span className="font-semibold text-gray-500">{totalArchived} <span className="font-normal text-gray-400">Archived</span></span>
            <span className="text-gray-200 hidden sm:inline">|</span>
            <span className="hidden sm:inline font-semibold text-[#1a237e]">{totalCount} <span className="font-normal text-gray-400">Total</span></span>
          </div>

          {/* Filters */}
           <StudentFilters
             search={search} onSearch={handleSearchChange}
             filterClass={filterClass} onFilterClass={(v) => { setFilterClass(v); setFilterSection('all'); setPage(1); }}
             filterSection={filterSection} onFilterSection={(v) => { setFilterSection(v); setPage(1); }}
             filterStatus={filterStatus} onFilterStatus={setFilterStatus}
             showArchived={showArchived} onToggleArchived={() => { setShowArchived(v => !v); setShowDeleted(false); setPage(1); }}
             showDeleted={showDeleted} onToggleDeleted={isAdmin ? () => { setShowDeleted(v => !v); setShowArchived(false); setPage(1); } : null}
             availableClasses={sfAvailableClasses}
             availableSections={sfAvailableSections}
           />

          {/* Bulk Actions — Admin only */}
          {isAdmin && selectableStudents.length > 0 && !showArchived && !showDeleted && (
            <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectableStudents.length > 0 && selectedIds.size === selectableStudents.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded cursor-pointer accent-[#1a237e]"
                />
                <span className="text-sm font-medium text-gray-700">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </span>
              </label>

              {selectedIds.size > 0 && (
                <>
                  <div className="h-5 w-px bg-gray-200" />
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status bulk action */}
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="h-8 text-xs w-44 rounded-xl">
                        <SelectValue placeholder="Change status to…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBulkActions.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 rounded-xl bg-[#1a237e] hover:bg-[#283593] text-xs"
                      disabled={!bulkAction}
                      onClick={() => handleBulkStatusChange(bulkAction)}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Apply
                    </Button>

                    <div className="h-5 w-px bg-gray-200" />

                    {/* Transport bulk action */}
                    <Select value={transportAction} onValueChange={setTransportAction}>
                      <SelectTrigger className="h-8 text-xs w-40 rounded-xl">
                        <SelectValue placeholder="Transport…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">Transport ON</SelectItem>
                        <SelectItem value="off">Transport OFF</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs"
                      disabled={!transportAction}
                      onClick={() => setShowTransportConfirm(true)}
                    >
                      <Bus className="h-3.5 w-3.5 mr-1" /> Apply
                    </Button>

                    <button
                      onClick={() => { setSelectedIds(new Set()); setBulkAction(''); setTransportAction(''); }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Clear
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No students found.</p>
              {isAdmin && (
                <button onClick={openAdd} className="mt-4 text-[#1a237e] font-semibold text-sm hover:underline">
                  + Add first student
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Desktop column headers */}
              <div className="hidden sm:flex items-center gap-4 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <div className="w-4 flex-shrink-0" /> {/* checkbox spacer */}
                <div className="w-9 flex-shrink-0" /> {/* avatar spacer */}
                <div className="w-48 flex-shrink-0">Name / ID</div>
                <div className="w-20 flex-shrink-0">Class</div>
                <div className="w-16 flex-shrink-0">Sec</div>
                <div className="w-16 flex-shrink-0">Roll</div>
                <div className="w-24 flex-shrink-0">Status</div>
                <div className="flex-1">Transport</div>
                <div className="w-8 flex-shrink-0" /> {/* action menu spacer */}
              </div>
               {students.map(student => (
                 <div key={student.id} className="flex gap-2 items-start">
                   {isAdmin && !isLocked(student) && !student.is_deleted && !showArchived && !showDeleted && (
                     <input
                       type="checkbox"
                       checked={selectedIds.has(student.id)}
                       onChange={() => handleToggleSelect(student.id)}
                       className="w-4 h-4 rounded mt-3.5 cursor-pointer flex-shrink-0 accent-[#1a237e]"
                     />
                   )}
                   <StudentCard
                     student={student}
                     onView={() => openProfile(student)}
                     onEdit={() => openEdit(student)}
                     onArchive={() => handleArchive(student)}
                     onDelete={() => handleDelete(student)}
                     onRestore={() => handleRestore(student)}
                     isAdmin={isAdmin}
                   />
                 </div>
               ))}
             </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 bg-white rounded-2xl shadow-sm p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Add / Edit Form Dialog */}
        <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setPhotoFile(null); } }}>
          <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>{isEdit ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            </DialogHeader>
            <StudentForm
              formData={formData}
              onChange={handleFormChange}
              onPhotoChange={setPhotoFile}
              photoFile={photoFile}
              isEdit={isEdit}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
              loading={saveMutation.isPending}
              isAdmin={isAdmin}
            />
          </DialogContent>
        </Dialog>

        {/* Profile Sheet */}
        <StudentProfileSheet
          student={selectedStudent}
          open={showProfile}
          onClose={() => setShowProfile(false)}
          onEdit={() => openEdit(selectedStudent)}
          onArchive={() => handleArchive(selectedStudent)}
          onDelete={() => handleDelete(selectedStudent)}
          onRestore={() => handleRestore(selectedStudent)}
          isAdmin={isAdmin}
        />

        {/* Bulk Upload Dialog */}
        <StudentBulkUpload
          open={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          academicYear={academicYear}
          onSuccess={() => queryClient.invalidateQueries(['students'])}
        />

        {/* Manage Roll Numbers */}
        <ManageRollNumbers
          open={showManageRolls}
          onClose={() => { setShowManageRolls(false); queryClient.invalidateQueries(['students']); }}
          academicYear={academicYear}
        />

        {/* Transport Bulk Confirm */}
        <AlertDialog open={showTransportConfirm} onOpenChange={setShowTransportConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply Transport {transportAction === 'on' ? 'ON' : 'OFF'}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will set Transport <strong>{transportAction === 'on' ? 'ON' : 'OFF'}</strong> for{' '}
                <strong>{selectedIds.size}</strong> student(s). This action can be reversed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={transportLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={transportLoading}
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleBulkTransport}
              >
                {transportLoading ? 'Updating…' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Promote — rendered hidden, triggered via triggerOpen state */}
        <PromoteStudents
          academicYear={academicYear}
          onPromoted={nextYear => { setAcademicYear(nextYear); queryClient.invalidateQueries(['students']); }}
          triggerOpen={showPromote}
          onTriggerHandled={() => setShowPromote(false)}
        />

        {/* Past Year Warning */}
        <PastYearWarning
          open={showPastYearWarning}
          academicYear={academicYear}
          onConfirm={handlePastYearConfirm}
          onCancel={() => setShowPastYearWarning(false)}
        />
      </div>
    </LoginRequired>
  );
}