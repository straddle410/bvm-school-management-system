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
import PastYearWarning, { isPastAcademicYear } from '@/components/PastYearWarning';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Users, Upload, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeStudentData, namesMatch } from '@/components/normalizeStudentData';

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
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [photoFile, setPhotoFile] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showPastYearWarning, setShowPastYearWarning] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
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
    queryKey: ['students', academicYear, page, LIMIT, debouncedSearch, filterClass, filterSection, filterStatus],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStudentsPaginated', {
        page,
        limit: LIMIT,
        search: debouncedSearch,
        class_name: filterClass === 'all' ? '' : filterClass,
        section: filterSection === 'all' ? '' : filterSection,
        status: filterStatus === 'all' ? '' : filterStatus,
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
    mutationFn: async ({ id, data, originalStudentId }) => {
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
        // EDIT: re-validate roll_no if relevant fields changed
        const orig = students.find(s => s.id === id);
        const rollChanged = orig && (
          String(normalized.roll_no) !== String(orig.roll_no) ||
          normalized.class_name !== orig.class_name ||
          normalized.section !== orig.section ||
          normalized.academic_year !== orig.academic_year
        );
        if (rollChanged) await validateRollNoUnique(normalized, id);

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
        return base44.entities.Student.update(id, normalized);
      }

      // CREATE: run all three duplicate checks
      await validateStudentIdUnique(normalized.student_id);
      await validateRollNoUnique(normalized);
      await validateNoDuplicateStudent(normalized);

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

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Student.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowProfile(false);
      toast.success('Student deleted');
    }
  });

  const handleSubmit = e => {
    e.preventDefault();
    saveMutation.mutate({
      id: isEdit ? selectedStudent.id : null,
      data: formData,
      originalStudentId: isEdit ? selectedStudent.student_id : null
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

  const openEdit = student => {
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
    const isArchived = student.status === 'Passed Out' || student.status === 'Transferred';
    const newStatus = isArchived ? 'Published' : 'Passed Out';
    await base44.entities.Student.update(student.id, { status: newStatus });
    queryClient.invalidateQueries(['students']);
    setShowProfile(false);
    toast.success(isArchived ? 'Student reactivated' : 'Student archived');
  };

  const handleDelete = student => {
    if (!window.confirm(`Delete ${student.name}? This cannot be undone.`)) return;
    deleteMutation.mutate(student.id);
  };

  const handleSelectAll = () => {
    const pendingIds = students.filter(s => s.status === 'Pending').map(s => s.id);
    if (selectedIds.size === pendingIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const handleToggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleVerifySelected = async () => {
    if (selectedIds.size === 0) return;
    const toVerify = Array.from(selectedIds);
    for (const id of toVerify) {
      await base44.entities.Student.update(id, { status: 'Verified', verified_by: user.email });
    }
    queryClient.invalidateQueries(['students']);
    setSelectedIds(new Set());
    toast.success(`${toVerify.length} student(s) verified`);
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
           />

          {/* Bulk Actions — Admin only */}
          {isAdmin && totalPending > 0 && (
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
              onChange={setFormData}
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
          isAdmin={isAdmin}
        />

        {/* Bulk Upload Dialog */}
        <StudentBulkUpload
          open={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          academicYear={academicYear}
          onSuccess={() => queryClient.invalidateQueries(['students'])}
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