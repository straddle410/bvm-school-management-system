import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, User, Mail, Phone, Shield, Calendar, Lock, Save, Eye, EyeOff, Pencil, BookOpen, GraduationCap, MapPin, Droplets, School } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import NotificationSettingsSection from '@/components/NotificationSettingsSection';
import StudentNotificationSettings from '@/components/StudentNotificationSettings';

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 font-medium w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-semibold text-right flex-1">{value}</span>
    </div>
  );
}

export default function UserProfile() {
  const [session, setSession] = useState(null);
  const [sessionType, setSessionType] = useState(null); // 'staff' | 'student'
  const [staffData, setStaffData] = useState(null);
  const [studentData, setStudentData] = useState(null);

  // Edit mode (admin only for staff)
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const staff = localStorage.getItem('staff_session');
    const student = localStorage.getItem('student_session');
    if (staff) {
      const s = JSON.parse(staff);
      setSession(s);
      setSessionType('staff');
    } else if (student) {
      const s = JSON.parse(student);
      setSession(s);
      setSessionType('student');
    }
  }, []);

  const queryClient = useQueryClient();

  const { data: staffRecord, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-profile', session?.id],
    queryFn: () => base44.entities.StaffAccount.filter({ id: session.id }),
    enabled: sessionType === 'staff' && !!session?.id,
    select: (data) => data[0] || null,
  });

  const { data: studentRecord, isLoading: studentLoading } = useQuery({
    queryKey: ['student-profile', session?.student_id],
    queryFn: async () => session || null,
    enabled: sessionType === 'student' && !!session?.student_id,
  });

  const record = sessionType === 'staff' ? staffRecord : studentRecord;
  const isAdmin = session?.role === 'Admin' || session?.role === 'admin' || session?.role === 'Principal' || session?.role === 'principal';
  const isLoading = staffLoading || studentLoading;

  useEffect(() => {
    if (record && sessionType === 'staff') {
      setEditForm({
        full_name: record.full_name || '',
        phone: record.phone || '',
        email: record.email || '',
        role: record.role || '',
        qualification: record.qualification || '',
        subjects: (record.subjects || []).join(', '),
        classes_assigned: (record.classes_assigned || []).join(', '),
      });
    }
  }, [record, sessionType]);

  const updateStaffMutation = useMutation({
    mutationFn: async () => {
      const data = {
        full_name: editForm.full_name,
        phone: editForm.phone,
        email: editForm.email,
        role: editForm.role,
        qualification: editForm.qualification,
        subjects: editForm.subjects.split(',').map(s => s.trim()).filter(Boolean),
        classes_assigned: editForm.classes_assigned.split(',').map(s => s.trim()).filter(Boolean),
      };
      return base44.entities.StaffAccount.update(record.id, data);
    },
    onSuccess: () => {
      toast.success('Profile updated');
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['staff-profile'] });
    }
  });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPw !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
    if (pwForm.newPw.length < 4) { setPwError('Password must be at least 4 characters'); return; }
    setPwLoading(true);
    try {
      if (sessionType === 'student') {
        // Verify current password against stored password
        if (!studentRecord) { setPwError('Student record not found'); setPwLoading(false); return; }
        if (studentRecord.password !== pwForm.current && pwForm.current !== 'BVM123') {
          // also allow default
          if (studentRecord.password && studentRecord.password !== pwForm.current) {
            setPwError('Current password is incorrect');
            setPwLoading(false);
            return;
          }
        }
        await base44.entities.Student.update(studentRecord.id, { password: pwForm.newPw });
      } else {
        // Staff - verify against temp_password
        if (!staffRecord) { setPwError('Staff record not found'); setPwLoading(false); return; }
        if (staffRecord.temp_password !== pwForm.current) {
          setPwError('Current password is incorrect');
          setPwLoading(false);
          return;
        }
        await base44.entities.StaffAccount.update(staffRecord.id, { temp_password: pwForm.newPw });
        // Update session
        const updatedSession = { ...session };
        localStorage.setItem('staff_session', JSON.stringify(updatedSession));
      }
      toast.success('Password changed successfully');
      setShowPwForm(false);
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      setPwError('Failed to change password. Try again.');
    }
    setPwLoading(false);
  };

  const initials = (record?.name || record?.full_name || session?.full_name || '?')
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleBack = () => {
    if (sessionType === 'student') {
      window.location.href = createPageUrl('StudentDashboard');
    } else {
      window.history.back();
    }
  };

  const backPage = sessionType === 'student' ? 'StudentDashboard' : 'Dashboard';

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a237e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4ff] max-w-md mx-auto pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] px-4 pt-4 pb-20 relative">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <span className="text-white font-bold text-base">My Profile</span>
          {isAdmin && sessionType === 'staff' && !editMode && (
            <button onClick={() => setEditMode(true)} className="text-white/80 hover:text-white">
              <Pencil className="h-5 w-5" />
            </button>
          )}
          {editMode && (
            <button onClick={() => setEditMode(false)} className="text-white/80 hover:text-white text-sm font-medium">
              Cancel
            </button>
          )}
          {!isAdmin && <div className="w-5" />}
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center shadow-lg">
            {record?.photo_url ? (
              <img src={record.photo_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="text-white font-bold text-2xl">{initials}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Name Card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
          <h2 className="text-xl font-bold text-gray-900">{record?.name || record?.full_name || session?.full_name}</h2>
          {sessionType === 'staff' && (
            <p className="text-sm text-indigo-600 font-semibold mt-1">{record?.role || session?.role}</p>
          )}
          {sessionType === 'student' && (
            <p className="text-sm text-indigo-600 font-semibold mt-1">
              Class {record?.class_name}-{record?.section} · Roll #{record?.roll_no}
            </p>
          )}
          {record?.email && (
            <p className="text-xs text-gray-400 mt-1">{record.email}</p>
          )}
        </div>

        {/* Staff Details */}
        {sessionType === 'staff' && (
          editMode && isAdmin ? (
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h3 className="font-bold text-gray-800 mb-2">Edit Details</h3>
              {[
                { label: 'Full Name', key: 'full_name' },
                { label: 'Phone', key: 'phone' },
                { label: 'Email', key: 'email' },
                { label: 'Qualification', key: 'qualification' },
                { label: 'Subjects (comma separated)', key: 'subjects' },
                { label: 'Classes Assigned (comma separated)', key: 'classes_assigned' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
                  <input
                    value={editForm[key] || ''}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
                >
                  {['Teacher', 'Principal', 'HOD', 'Vice Principal', 'Coordinator', 'Counselor', 'Librarian', 'Admin Staff', 'Admin'].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => updateStaffMutation.mutate()}
                disabled={updateStaffMutation.isPending}
                className="w-full bg-[#1a237e] text-white rounded-xl py-3 font-semibold text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {updateStaffMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-gray-800 mb-1">Staff Details</h3>
              <div className="mt-2">
                <InfoRow label="Staff ID" value={record?.teacher_id || record?.username} />
                <InfoRow label="Phone" value={record?.phone} />
                <InfoRow label="Email" value={record?.email} />
                <InfoRow label="Qualification" value={record?.qualification} />
                <InfoRow label="Joining Date" value={record?.joining_date ? format(new Date(record.joining_date), 'dd MMM yyyy') : null} />
                <InfoRow label="Subjects" value={(record?.subjects || []).join(', ')} />
                <InfoRow label="Classes" value={(record?.classes_assigned || []).join(', ')} />
                <InfoRow label="Status" value={record?.is_active !== false ? 'Active' : 'Inactive'} />
              </div>
            </div>
          )
        )}

        {/* Student Details */}
        {sessionType === 'student' && record && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-1">Student Details</h3>
            <div className="mt-2">
              <InfoRow label="Student ID" value={record.student_id} />
              <InfoRow label="Roll No" value={record.roll_no?.toString()} />
              <InfoRow label="Class" value={`${record.class_name}-${record.section}`} />
              <InfoRow label="Gender" value={record.gender} />
              <InfoRow label="Date of Birth" value={record.dob ? format(new Date(record.dob), 'dd MMM yyyy') : null} />
              <InfoRow label="Blood Group" value={record.blood_group} />
              <InfoRow label="Address" value={record.address} />
              <InfoRow label="Academic Year" value={record.academic_year} />
              <InfoRow label="Admission Date" value={record.admission_date ? format(new Date(record.admission_date), 'dd MMM yyyy') : null} />
            </div>
          </div>
        )}

        {/* Parent Details - student only */}
        {sessionType === 'student' && record && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-1">Parent / Guardian</h3>
            <div className="mt-2">
              <InfoRow label="Name" value={record.parent_name} />
              <InfoRow label="Phone" value={record.parent_phone} />
              <InfoRow label="Email" value={record.parent_email} />
            </div>
          </div>
        )}

        {/* OTP Setting - Admin Only */}
        {sessionType === 'staff' && isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-3">Email OTP Verification</h3>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Require OTP for login verification</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#1a237e] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1a237e]"></div>
              </label>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {sessionType === 'staff' && (
          <NotificationSettingsSection />
        )}

        {sessionType === 'student' && (
          <StudentNotificationSettings studentId={session?.student_id} />
        )}

        {/* Change Password */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-3">Security</h3>
          {!showPwForm ? (
            <button
              onClick={() => setShowPwForm(true)}
              className="w-full border border-gray-200 text-gray-700 rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50"
            >
              <Lock className="h-4 w-4" /> Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {[
                { label: 'Current Password', key: 'current' },
                { label: 'New Password', key: 'newPw' },
                { label: 'Confirm New Password', key: 'confirm' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      value={pwForm[key]}
                      onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={label}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
                    />
                    <button type="button" onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowPwForm(false); setPwError(''); }}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={pwLoading}
                  className="flex-1 bg-[#1a237e] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
                  {pwLoading ? 'Saving...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}