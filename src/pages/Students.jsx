import React, { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Users, Upload } from 'lucide-react';
import { toast } from 'sonner';

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

  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStaffSession();
    if (session) setUser(session);
    else base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'Admin' || user?.role === 'admin' ||
                  user?.role === 'Principal' || user?.role === 'principal';

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', academicYear],
    queryFn: () => base44.entities.Student.filter({ academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear
  });

  const generateStudentId = async () => {
    const all = await base44.entities.Student.list('-created_date', 1000);
    const ids = all.map(s => s.student_id).filter(id => id && /^S\d+$/.test(id)).map(id => parseInt(id.slice(1)));
    const max = ids.length > 0 ? Math.max(...ids) : 0;
    return `S${String(max + 1).padStart(4, '0')}`;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      let photo_url = data.photo_url;
      if (photoFile) {
        const r = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = r.file_url;
      }
      if (id) return base44.entities.Student.update(id, { ...data, photo_url });
      return base44.entities.Student.create({ ...data, photo_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowForm(false);
      setPhotoFile(null);
      toast.success(isEdit ? 'Student updated' : 'Student added');
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
    saveMutation.mutate({ id: isEdit ? selectedStudent.id : null, data: formData });
  };

  const openAdd = async () => {
    const newId = await generateStudentId();
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

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.student_id?.toLowerCase().includes(q) || s.parent_name?.toLowerCase().includes(q);
    const matchClass = filterClass === 'all' || s.class_name === filterClass;
    const matchSection = filterSection === 'all' || s.section === filterSection;
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchClass && matchSection && matchStatus;
  });

  // Stats
  const totalActive = students.filter(s => s.status === 'Published').length;
  const totalPending = students.filter(s => s.status === 'Pending').length;
  const totalArchived = students.filter(s => s.status === 'Passed Out' || s.status === 'Transferred').length;

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Students">
      <div className="min-h-screen bg-[#f0f4ff]">
        <PageHeader
          title={`Students — ${academicYear}`}
          subtitle={`${filtered.length} of ${students.length} students`}
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
            search={search} onSearch={setSearch}
            filterClass={filterClass} onFilterClass={setFilterClass}
            filterSection={filterSection} onFilterSection={setFilterSection}
            filterStatus={filterStatus} onFilterStatus={setFilterStatus}
          />

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
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
              {filtered.map(student => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onView={() => openProfile(student)}
                  onEdit={() => openEdit(student)}
                  onArchive={() => handleArchive(student)}
                  isAdmin={isAdmin}
                />
              ))}
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
      </div>
    </LoginRequired>
  );
}