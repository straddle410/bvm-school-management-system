import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Edit, Power, Copy, Mail, Search, Users, KeyRound, Send } from 'lucide-react';
import { toast } from "sonner";

const ROLES = ['Principal', 'Teacher', 'Staff', 'Librarian', 'Accountant', 'Admin'];

const roleColors = {
  Principal: 'bg-purple-100 text-purple-700',
  Teacher: 'bg-blue-100 text-blue-700',
  Staff: 'bg-gray-100 text-gray-700',
  Librarian: 'bg-amber-100 text-amber-700',
  Accountant: 'bg-green-100 text-green-700',
  Admin: 'bg-red-100 text-red-700',
};

const generateUsername = (name) => {
  return name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '') + Math.floor(Math.random() * 99 + 1);
};

const DEFAULT_PERMISSIONS = {
  attendance: false,
  attendance_needs_approval: true,
  marks: false,
  marks_needs_approval: true,
  post_notices: false,
  notices_needs_approval: true,
  gallery: false,
  gallery_needs_approval: true,
  quiz: false,
};

const emptyForm = {
  full_name: '',
  username: '',
  email: '',
  phone: '',
  role: 'Teacher',
  temp_password: 'BVM@123',
  must_change_password: true,
  is_active: true,
  joining_date: new Date().toISOString().split('T')[0],
  notes: '',
  platform_invite_sent: false,
  permissions: { ...DEFAULT_PERMISSIONS },
};

export default function StaffManagement() {
  const [showDialog, setShowDialog] = useState(false);
  const [showTeacherSelector, setShowTeacherSelector] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff-accounts'],
    queryFn: () => base44.entities.StaffAccount.list('-created_date'),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingStaff) {
        return base44.entities.StaffAccount.update(editingStaff.id, data);
      }
      return base44.entities.StaffAccount.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['staff-accounts']);
      setShowDialog(false);
      setEditingStaff(null);
      setForm(emptyForm);
      toast.success(editingStaff ? 'Staff updated' : 'Staff account created');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.StaffAccount.update(id, { is_active }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries(['staff-accounts']);
      toast.success(vars.is_active ? 'Account activated' : 'Account deactivated');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, pass }) => base44.entities.StaffAccount.update(id, { temp_password: pass, must_change_password: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['staff-accounts']);
      toast.success('Password reset successfully');
    }
  });

  const inviteMutation = useMutation({
    mutationFn: async (member) => {
      await base44.users.inviteUser(member.email, member.role === 'Admin' ? 'admin' : 'user');
      return base44.entities.StaffAccount.update(member.id, { platform_invite_sent: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['staff-accounts']);
      toast.success('Invitation sent! Staff will receive an email to set their password.');
    },
    onError: () => toast.error('Failed to send invite')
  });

  const openCreate = () => {
    setShowTeacherSelector(true);
  };

  const createFromTeacher = (teacher) => {
    setEditingStaff(null);
    setForm({
      ...emptyForm,
      full_name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || '',
      role: 'Teacher',
      username: generateUsername(teacher.name),
    });
    setShowTeacherSelector(false);
    setShowDialog(true);
  };

  const openEdit = (member) => {
    setEditingStaff(member);
    const mergedPermissions = { ...DEFAULT_PERMISSIONS, ...(member.permissions || {}) };
    setForm({ ...member, permissions: mergedPermissions });
    setShowDialog(true);
  };

  const handleNameChange = (name) => {
    setForm(f => ({
      ...f,
      full_name: name,
      username: editingStaff ? f.username : generateUsername(name)
    }));
  };

  const handleResetPassword = (member) => {
    const newPass = 'BVM@' + Math.floor(1000 + Math.random() * 9000);
    resetPasswordMutation.mutate({ id: member.id, pass: newPass });
    toast.info(`New password: ${newPass} — Please note it down!`, { duration: 8000 });
  };

  const filtered = staff.filter(s => {
    const matchSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.username?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'All' || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = ROLES.reduce((acc, r) => {
    acc[r] = staff.filter(s => s.role === r).length;
    return acc;
  }, {});

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Staff Management">
      <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Staff Management"
        subtitle="Create and manage staff accounts"
        actions={
          <Button onClick={openCreate} className="bg-[#1a237e] hover:bg-[#283593]">
            <Plus className="h-4 w-4 mr-2" /> Add Staff
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          {ROLES.map(r => (
            <div key={r} className="bg-white rounded-xl p-3 text-center shadow-sm">
              <p className="text-xl font-bold text-slate-800">{stats[r] || 0}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{r}s</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Roles</SelectItem>
              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Staff List */}
        <div className="space-y-2">
          {isLoading && <p className="text-center py-8 text-slate-400">Loading...</p>}
          {!isLoading && filtered.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <Users className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500">No staff accounts yet</p>
              <Button onClick={openCreate} className="mt-4 bg-[#1a237e]">
                <Plus className="h-4 w-4 mr-2" /> Add First Staff
              </Button>
            </div>
          )}
          {filtered.map(member => (
            <Card key={member.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 flex-shrink-0">
                    <AvatarFallback className="bg-[#e8eaf6] text-[#1a237e] font-bold text-sm">
                      {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{member.full_name}</p>
                      <Badge className={`text-[10px] px-2 py-0 ${roleColors[member.role]}`}>{member.role}</Badge>
                      {!member.is_active && <Badge className="text-[10px] px-2 py-0 bg-red-100 text-red-600">Inactive</Badge>}
                      {member.platform_invite_sent && <Badge className="text-[10px] px-2 py-0 bg-green-100 text-green-600">Invited</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">@{member.username} · {member.email}</p>
                    {member.permissions && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.permissions.attendance && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">Attendance{member.permissions.attendance_needs_approval ? '*' : ''}</span>}
                        {member.permissions.marks && <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">Marks{member.permissions.marks_needs_approval ? '*' : ''}</span>}
                        {member.permissions.post_notices && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">Notices{member.permissions.notices_needs_approval ? '*' : ''}</span>}
                        {member.permissions.gallery && <span className="text-[9px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded-full">Gallery{member.permissions.gallery_needs_approval ? '*' : ''}</span>}
                        {member.permissions.quiz && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">Quiz</span>}
                      </div>
                    )}
                    {member.temp_password && (
                      <div className="flex items-center gap-1 mt-1">
                        <KeyRound className="h-3 w-3 text-amber-500" />
                        <span className="text-xs text-amber-600 font-mono">{member.temp_password}</span>
                        <button onClick={() => { navigator.clipboard.writeText(member.temp_password); toast.success('Password copied'); }}>
                          <Copy className="h-3 w-3 text-slate-400 hover:text-slate-600 ml-1" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!member.platform_invite_sent && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 border-green-200 text-green-700 hover:bg-green-50"
                        onClick={() => inviteMutation.mutate(member)}
                        disabled={inviteMutation.isPending}
                      >
                        <Send className="h-3 w-3 mr-1" /> Invite
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(member)}>
                      <Edit className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 ${member.is_active ? 'text-green-500' : 'text-slate-400'}`}
                      onClick={() => toggleActiveMutation.mutate({ id: member.id, is_active: !member.is_active })}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-500" onClick={() => handleResetPassword(member)}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Teacher Selector Dialog */}
      <Dialog open={showTeacherSelector} onOpenChange={setShowTeacherSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Teacher to Add as Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {teachers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No teachers found. Please add teachers first.</p>
              </div>
            ) : (
              teachers.map(teacher => (
                <button
                  key={teacher.id}
                  onClick={() => createFromTeacher(teacher)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-[#1a237e] transition-all"
                >
                  <p className="font-semibold text-slate-900">{teacher.name}</p>
                  <p className="text-sm text-slate-500">{teacher.email}</p>
                  {teacher.phone && <p className="text-sm text-slate-500">{teacher.phone}</p>}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Account' : 'Create Staff Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., Ravi Kumar"
                  required
                />
              </div>
              <div>
                <Label>Username</Label>
                <Input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="ravi.kumar01"
                />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="teacher@school.com"
                  required
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={form.joining_date}
                  onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label>Temporary Password</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.temp_password}
                    onChange={e => setForm(f => ({ ...f, temp_password: e.target.value }))}
                    placeholder="Set a temp password"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPassword(p => !p)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Share this with the staff member to login</p>
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes"
                />
              </div>
              {/* Permissions */}
              <div className="col-span-2">
                <p className="text-sm font-semibold text-slate-700 mb-2">Feature Permissions</p>
                <div className="space-y-2">
                  {[
                     { key: 'attendance', label: 'Attendance', approvalKey: 'attendance_needs_approval' },
                     { key: 'marks', label: 'Marks Entry', approvalKey: 'marks_needs_approval' },
                     { key: 'post_notices', label: 'Post Notices', approvalKey: 'notices_needs_approval' },
                     { key: 'gallery', label: 'Gallery Upload', approvalKey: 'gallery_needs_approval' },
                     { key: 'quiz', label: 'Quiz Upload', approvalKey: null },
                   ].map(({ key, label, approvalKey }) => (
                    <div key={key} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        <Switch
                           checked={!!form.permissions?.[key]}
                           onCheckedChange={v => setForm(f => ({
                             ...f,
                             permissions: { ...f.permissions, [key]: v }
                           }))}
                         />
                        </div>
                        {form.permissions?.[key] && approvalKey && (
                         <div className="flex items-center justify-between mt-2 pl-2 border-l-2 border-blue-200">
                           <p className="text-xs text-slate-500">Needs admin approval</p>
                           <Switch
                             checked={!!form.permissions?.[approvalKey]}
                             onCheckedChange={v => setForm(f => ({
                               ...f,
                               permissions: { ...f.permissions, [approvalKey]: v }
                             }))}
                           />
                         </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2 flex items-center justify-between bg-slate-50 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium">Account Active</p>
                  <p className="text-xs text-slate-500">Disable to temporarily block access</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-[#1a237e] hover:bg-[#283593]">
                {saveMutation.isPending ? 'Saving...' : editingStaff ? 'Update' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </LoginRequired>
  );
}