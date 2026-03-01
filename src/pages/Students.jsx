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
import { Plus, Users, Upload, CheckCircle, ChevronLeft, ChevronRight, Hash, Archive, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { normalizeStudentData, namesMatch } from '@/components/normalizeStudentData';
import { isLocked, isValidTransition, ACTIVE_STATUSES } from '@/components/students/studentStatusUtils';

const EMPTY_FORM = {
  student_id: '', username: '', password: 'BVM123',
  name: '', class_name: '', section: 'A', roll_no: '',
  parent_name: '', parent_phone: '', parent_email: '',
  dob: '', gender: 'Male', address: '', blood_group: '',
  admission_date: '', academic_year: '', status: 'Pending', photo_url: ''
};

export default function Students() {
  const { academicYear, setAcademicYear } = useAcademicYear();
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
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

      const res = await base44.functions.invoke('getStudentsPaginated', {
        page,
        limit: LIMIT,
        search: debouncedSearch,
        class_name: filterClass === 'all' ? '' : filterClass,
        section: filterSection === 'all' ? '' : filterSection,
        status: effectiveStatus,
        exclude_archived: restrictToActive,
        show_deleted: showDeleted && isAdmin,
        academic_year: academicYear
      });
      return res.data;
    },
    enabled: !!academicYear,
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

  const generateStudentId = async (academicYear) => {
    if (!academicYear) throw new Error('Academic year required to generate student ID');
    const res = await base44.functions.invoke('generateStudentId', { academic_year: academicYear });
    return res.data.student_id;
  };

  const generateRollNo = async (class_name, section, academic_year) => {
    if (!class_name || !section || !academic_year) return null;
    const res = await base44.functions.invoke('getNextRollNo', {
      action: 'next',
      class_name,
      section,
      academic_year
    });
    return res.data.next_roll_no;
  };

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
        const updateRes = await base44.functions.invoke('updateStudentWithAudit', {
          student_db_id: id,
          updates: normalized
        });
        if (updateRes.data?.error) throw new Error(updateRes.data.error);
        return updateRes.data?.student;
      }

      // CREATE: auto-assign roll_no if not set
      if (!normalized.roll_no && normalized.class_name && normalized.section && normalized.academic_year) {
        const nextRoll = await generateRollNo(normalized.class_name, normalized.section, normalized.academic_year);
        if (nextRoll) normalized.roll_no = nextRoll;
      }

      await validateStudentIdUnique(normalized.student_id);
      await validateRollNoUnique(normalized);
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
      const res = await base44.functions.invoke('softDeleteStudent', { student_id: id, action });
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
    const newId = await generateStudentId(academicYear);
    setFormData({ ...EMPTY_FORM, student_id: newId, username: newId, academic_year: academicYear });
    setIsEdit(false);
    setPhotoFile(null);
    setShowForm(true);
  };

  const handlePastYearConfirm = async () => {
    setShowPastYearWarning(false);
    const newId = await generateStudentId(academicYear);
    setFormData({ ...EMPTY_FORM, student_id: newId, username: newId, academic_year: academicYear });
    setIsEdit(false);
    setPhotoFile(null);
    setShowForm(true);
  };

  // When class/section/year changes in form for a NEW student → auto-assign roll
  const handleFormChange = async (newData) => {
    setFormData(newData);
    // Only auto-assign roll for new students when class+section+year are all set
    if (!isEdit && newData.class_name && newData.section && newData.academic_year) {
      // Only re-fetch if these 3 fields changed
      const prev = formData;
      if (newData.class_name !== prev.class_name ||
          newData.section !== prev.section ||
          newData.academic_year !== prev.academic_year) {
        const roll = await generateRollNo(newData.class_name, newData.section, newData.academic_year);
        if (roll) setFormData(f => ({ ...f, ...newData, roll_no: roll }));
      }
    }
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
        updates: { status: 'Published' }
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
        updates: { status: 'Passed Out' }
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
    for (const id of ids) {
      const student = students.find(s => s.id === id);
      if (!student) continue;
      if (!isValidTransition(student.status, toStatus)) continue;

      const updates = { status: toStatus };
      if (toStatus === 'Verified')  updates.verified_by  = user.email;
      if (toStatus === 'Approved')  updates.approved_by  = user.email;

      await base44.functions.invoke('updateStudentWithAudit', {
        student_db_id: id,
        updates
      });
      processed++;
    }

    queryClient.invalidateQueries(['students']);
    setSelectedIds(new Set());
    setBulkAction('');
    toast.success(`${processed} student(s) updated to ${toStatus}`);
  };

  // Stats from current page (server already filtered)
  const totalActive = students.filter(s => s.status === 'Published').length;
  const totalPending = students.filter(s => s.status === 'Pending').length;
  const totalArchived = students.filter(s => s.status === 'Passed Out' || s.status === 'Transferred').length;

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Students">
      <div className="min-h-screen bg-[#f0f4ff]">
        <PageHeader
          title={`Students — ${academicYear}`}
          subtitle={`${totalCount} students`}
          backTo="Dashboard"
          actions={
            <div className="flex gap-2">
              {isAdmin && (
                <PromoteStudents
                  academicYear={academicYear}
                  onPromoted={nextYear => { setAcademicYear(nextYear); queryClient.invalidateQueries(['students']); }}
                />
              )}
              {isAdmin && <StudentExport students={students} academicYear={academicYear} />}
              {isAdmin && (
                <Button onClick={() => setShowManageRolls(true)} variant="outline" className="rounded-xl">
                  <Hash className="h-4 w-4 mr-1" /> Roll Nos
                </Button>
              )}
              {isAdmin && (
                <Button onClick={() => setShowBulkUpload(true)} variant="outline" className="rounded-xl">
                  <Upload className="h-4 w-4 mr-1" /> Import
                </Button>
              )}
              {isAdmin && (
                <Button onClick={openAdd} className="bg-[#1a237e] hover:bg-[#283593] rounded-xl">
                  <Plus className="h-4 w-4 mr-1" /> Add Student
                </Button>
              )}
            </div>
          }
        />

        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active', value: totalActive, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Pending', value: totalPending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Archived', value: totalArchived, color: 'text-gray-500', bg: 'bg-gray-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl shadow-sm p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
           <StudentFilters
             search={search} onSearch={handleSearchChange}
             filterClass={filterClass} onFilterClass={setFilterClass}
             filterSection={filterSection} onFilterSection={setFilterSection}
             filterStatus={filterStatus} onFilterStatus={setFilterStatus}
             showArchived={showArchived} onToggleArchived={() => { setShowArchived(v => !v); setShowDeleted(false); setPage(1); }}
             showDeleted={showDeleted} onToggleDeleted={isAdmin ? () => { setShowDeleted(v => !v); setShowArchived(false); setPage(1); } : null}
           />

          {/* Bulk Actions — Admin only, hide when showing archived */}
          {isAdmin && totalPending > 0 && !showArchived && (
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={selectedIds.size === students.filter(s => s.status === 'Pending').length && selectedIds.size > 0}
                  onChange={handleSelectAll}
                  className="w-5 h-5 rounded cursor-pointer"
                />
                <span className="text-sm font-semibold text-gray-700">
                  Select Pending ({selectedIds.size}/{students.filter(s => s.status === 'Pending').length})
                </span>
              </label>
              {selectedIds.size > 0 && (
                <Button onClick={handleVerifySelected} className="bg-green-600 hover:bg-green-700 rounded-xl">
                  <CheckCircle className="h-4 w-4 mr-1" /> Verify ({selectedIds.size})
                </Button>
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
            <div className="space-y-2">
               {students.map(student => (
                 <div key={student.id} className="flex gap-2 items-start">
                   {isAdmin && student.status === 'Pending' && (
                     <input
                       type="checkbox"
                       checked={selectedIds.has(student.id)}
                       onChange={() => handleToggleSelect(student.id)}
                       className="w-5 h-5 rounded mt-3 cursor-pointer flex-shrink-0"
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