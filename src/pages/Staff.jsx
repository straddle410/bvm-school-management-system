import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Power, Copy, Search, Users, KeyRound, Send, Lock, Unlock, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';

const generateUsername = (name) => {
  return name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '') + Math.floor(Math.random() * 99 + 1);
};

const generateTempPassword = () => {
  return 'BVM@' + Math.floor(1000 + Math.random() * 9000);
};

const hashPassword = (password) => {
  // Must match staffLogin & resetStaffPassword exactly
  if (!password) return '';
  return '$2b$10$' + btoa(password).substring(0, 53);
};

const roleColors = {
  Teacher: 'bg-blue-100 text-blue-700',
  Accountant: 'bg-green-100 text-green-700',
  Librarian: 'bg-amber-100 text-amber-700',
  Staff: 'bg-gray-100 text-gray-700',
  Principal: 'bg-purple-100 text-purple-700',
  Admin: 'bg-red-100 text-red-700',
  'Exam Staff': 'bg-orange-100 text-orange-700',
};

import { PERMISSION_CATEGORIES } from '@/components/permissionHelper';

export default function Staff() {
  const [activeTab, setActiveTab] = useState('add');
  const [showDialog, setShowDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [search, setSearch] = useState('');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordStaff, setResetPasswordStaff] = useState(null);
  const [resetPasswordMode, setResetPasswordMode] = useState('auto'); // 'auto' or 'manual'
  const [manualPassword, setManualPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showResetSuccessModal, setShowResetSuccessModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    password_hash: '',
    designation: '',
    mobile: '',
    email: '',
    role_template_id: '',
    force_password_change: true,
    is_active: true,
    // Profile fields
    staff_code: '',
    gender: '',
    dob: '',
    joining_date: '',
    qualification: '',
    experience_years: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    is_teacher: false,
    subjects: [],
    classes: [],
    sections: [],
    class_teacher_of: '',
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('name'),
  });

  const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const SECTIONS = ['A', 'B', 'C', 'D'];
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: {},
  });
  const queryClient = useQueryClient();

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-accounts-rbac'],
    queryFn: () => base44.entities.StaffAccount.list('-created_date'),
  });

  const { data: roleTemplates = [] } = useQuery({
    queryKey: ['role-templates'],
    queryFn: () => base44.entities.RoleTemplate.list('name'),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingStaff) {
        return base44.entities.StaffAccount.update(editingStaff.id, data);
      }
      return base44.entities.StaffAccount.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts-rbac'] });
      setShowDialog(false);
      setEditingStaff(null);
      setForm({
        name: '',
        username: '',
        password_hash: '',
        designation: '',
        mobile: '',
        email: '',
        role_template_id: '',
        force_password_change: true,
        is_active: true,
      });
      toast.success(editingStaff ? 'Staff updated' : 'Staff account created');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.StaffAccount.update(id, { is_active }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts-rbac'] });
      toast.success(vars.is_active ? 'Account activated' : 'Account deactivated');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ staff_id, temp_password }) => {
      const session = JSON.parse(localStorage.getItem('staff_session') || '{}');
      const res = await base44.functions.invoke('resetStaffPassword', {
        staff_id,
        temp_password,
        staff_session_token: session?.staff_session_token || null,
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Password reset failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts-rbac'] });
      toast.success('Password reset. Staff will be forced to change on next login.');
      setShowResetPasswordModal(false);
      setResetPasswordStaff(null);
      setResetPasswordMode('auto');
      setManualPassword('');
      setGeneratedPassword('');
      setPasswordCopied(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reset password');
    },
  });

  const unlockAccountMutation = useMutation({
    mutationFn: async (member) => {
      const session = JSON.parse(localStorage.getItem('staff_session') || '{}');
      const res = await base44.functions.invoke('unlockStaffAccount', {
        staff_id: member.id,
        staff_session_token: session?.staff_session_token || null,
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Unlock failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts-rbac'] });
      toast.success('Account unlocked');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to unlock account');
    },
  });

  const saveRoleMutation = useMutation({
    mutationFn: async (data) => {
      if (editingRole) {
        return base44.entities.RoleTemplate.update(editingRole.id, data);
      }
      return base44.entities.RoleTemplate.create({ ...data, is_system: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-templates'] });
      setShowRoleDialog(false);
      setEditingRole(null);
      setRoleForm({ name: '', description: '', permissions: {} });
      toast.success(editingRole ? 'Role updated' : 'Role created');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId) => base44.entities.RoleTemplate.delete(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-templates'] });
      toast.success('Role deleted');
    },
  });

  const openCreate = () => {
    setEditingStaff(null);
    const tempPass = generateTempPassword();
    setTempPassword(tempPass);
    setForm({
      name: '',
      username: '',
      password_hash: hashPassword(tempPass),
      designation: '',
      mobile: '',
      email: '',
      role_template_id: '',
      force_password_change: true,
      is_active: true,
      staff_code: '',
      gender: '',
      dob: '',
      joining_date: '',
      qualification: '',
      experience_years: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      is_teacher: false,
      subjects: [],
      classes: [],
      sections: [],
      class_teacher_of: '',
    });
    setShowDialog(true);
  };

  const openEdit = (member) => {
    setEditingStaff(member);
    setForm({
      name: member.name,
      username: member.username,
      password_hash: member.password_hash,
      designation: member.designation || '',
      mobile: member.mobile || '',
      email: member.email || '',
      role_template_id: member.role_template_id || '',
      force_password_change: member.force_password_change,
      is_active: member.is_active,
      staff_code: member.staff_code || '',
      gender: member.gender || '',
      dob: member.dob || '',
      joining_date: member.joining_date || '',
      qualification: member.qualification || '',
      experience_years: member.experience_years || '',
      address_line1: member.address_line1 || '',
      address_line2: member.address_line2 || '',
      city: member.city || '',
      state: member.state || '',
      pincode: member.pincode || '',
      emergency_contact_name: member.emergency_contact_name || '',
      emergency_contact_phone: member.emergency_contact_phone || '',
      is_teacher: member.is_teacher || false,
      subjects: member.subjects || [],
      classes: member.classes || [],
      sections: member.sections || [],
      class_teacher_of: member.class_teacher_of || '',
    });
    setShowDialog(true);
  };

  const handleNameChange = (name) => {
    setForm(f => ({
      ...f,
      name,
      username: editingStaff ? f.username : generateUsername(name),
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.username) {
      toast.error('Name and username are required');
      return;
    }

    // Normalize username
    const normalizedUsername = form.username.trim().toLowerCase();

    // Check for duplicate username if editing
    if (editingStaff) {
      const existingWithUsername = staffList.filter(s => 
        s.id !== editingStaff.id && 
        s.username.toLowerCase() === normalizedUsername
      );
      if (existingWithUsername.length > 0) {
        toast.error('Username already exists');
        return;
      }
    }

    // Derive the `role` field from the selected role template name.
    // Map template name → StaffAccount.role enum value
    const selectedTemplate = roleTemplates.find(r => r.id === form.role_template_id);
    const ROLE_NAME_MAP = {
      'admin': 'admin',
      'principal': 'principal',
      'teacher': 'teacher',
      'accountant': 'accountant',
      'staff': 'staff',
      'librarian': 'librarian',
      'exam staff': 'exam_staff',
      'exam_staff': 'exam_staff',
    };
    const rawRoleName = (selectedTemplate?.name || '').trim().toLowerCase();
    const derivedRole = ROLE_NAME_MAP[rawRoleName] || rawRoleName;

    // Coerce experience_years: empty string → null, otherwise parse as number
    let experienceYears = null;
    if (form.experience_years !== '' && form.experience_years !== null && form.experience_years !== undefined) {
      const parsed = Number(form.experience_years);
      if (isNaN(parsed)) {
        toast.error('Experience years must be a valid number');
        return;
      }
      experienceYears = parsed;
    }

    const dataToSave = { 
      ...form,
      username: normalizedUsername,
      role: derivedRole,
      experience_years: experienceYears,
    };

    saveMutation.mutate(dataToSave);
  };

  const filtered = staffList.filter(s => {
    const searchLower = search.toLowerCase();
    return s.name?.toLowerCase().includes(searchLower) ||
           s.username?.toLowerCase().includes(searchLower) ||
           s.email?.toLowerCase().includes(searchLower);
  });

  const getStatusBadge = (staff) => {
    if (!staff.is_active) {
      return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
    }
    if (staff.account_locked_until && new Date(staff.account_locked_until) > new Date()) {
      return <Badge className="bg-orange-100 text-orange-700">Locked</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700">Active</Badge>;
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: {} });
    setShowRoleDialog(true);
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || {},
    });
    setShowRoleDialog(true);
  };

  const generateStrongPassword = () => {
    const length = 10;
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const all = lower + upper + numbers + special;
    
    let pwd = '';
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += special[Math.floor(Math.random() * special.length)];
    
    for (let i = 4; i < length; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  const openResetPasswordModal = (member) => {
    setResetPasswordStaff(member);
    const genPwd = generateStrongPassword();
    setGeneratedPassword(genPwd);
    setManualPassword('');
    setResetPasswordMode('auto');
    setPasswordCopied(false);
    setShowResetPasswordModal(true);
  };

  const handleResetPasswordSubmit = () => {
    if (resetPasswordMode === 'auto' && !passwordCopied) {
      toast.error('Please confirm you have copied the password');
      return;
    }
    
    if (resetPasswordMode === 'manual') {
      if (!manualPassword || manualPassword.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      resetPasswordMutation.mutate({
        staff_id: resetPasswordStaff.id,
        temp_password: manualPassword,
      });
    } else {
      resetPasswordMutation.mutate({
        staff_id: resetPasswordStaff.id,
        temp_password: generatedPassword,
      });
    }
  };

  const handleSaveRole = () => {
    if (!roleForm.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    saveRoleMutation.mutate({
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      permissions: roleForm.permissions,
    });
  };

  const togglePermission = (perm) => {
    setRoleForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [perm]: !f.permissions[perm],
      },
    }));
  };

  const toggleModuleAll = (category) => {
    const perms = category.permissions.map(p => p.key);
    const allEnabled = perms.every(p => roleForm.permissions[p]);
    
    const newPerms = { ...roleForm.permissions };
    perms.forEach(p => {
      newPerms[p] = !allEnabled;
    });
    if (category.moduleKey) {
      newPerms[category.moduleKey] = !allEnabled;
    }
    setRoleForm(f => ({ ...f, permissions: newPerms }));
  };

  const applyFeePreset = (preset) => {
    const newPerms = { ...roleForm.permissions };
    preset.perms.forEach(p => {
      newPerms[p] = true;
    });
    setRoleForm(f => ({ ...f, permissions: newPerms }));
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Staff Module">
      <div className="min-h-screen bg-slate-50">
        <PageHeader
          title="Staff Management"
          subtitle="Manage staff accounts and roles with RBAC"
        />

        <div className="p-4 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white border shadow-sm w-full justify-start">
              <TabsTrigger value="add">Add Staff</TabsTrigger>
              <TabsTrigger value="manage">Staff Management</TabsTrigger>
              <TabsTrigger value="roles">Role Templates</TabsTrigger>
            </TabsList>

            {/* Add Staff Tab */}
            <TabsContent value="add" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSave();
                    }}
                    className="space-y-4 max-w-2xl"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Full Name *</Label>
                        <Input
                          value={form.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div>
                        <Label>Username *</Label>
                        <Input
                          value={form.username}
                          onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                          placeholder="john.doe01"
                          required
                        />
                      </div>

                      <div>
                        <Label>Designation</Label>
                        <Input
                          value={form.designation}
                          onChange={(e) => setForm(f => ({ ...f, designation: e.target.value }))}
                          placeholder="Teacher"
                        />
                      </div>
                      <div>
                        <Label>Role Template *</Label>
                        <Select
                          value={form.role_template_id}
                          onValueChange={(v) => setForm(f => ({ ...f, role_template_id: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleTemplates.map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Mobile</Label>
                        <Input
                          value={form.mobile}
                          onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))}
                          placeholder="+91 9876543210"
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="john@school.com"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label>Temporary Password</Label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={tempPassword}
                            readOnly
                            className="bg-slate-100"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const newPass = generateTempPassword();
                              setTempPassword(newPass);
                              setForm(f => ({ ...f, password_hash: hashPassword(newPass) }));
                            }}
                          >
                            Generate
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Share with staff member to login (auto-hashed)</p>
                      </div>
                    </div>

                    <Accordion type="single" collapsible className="col-span-2">
                      <AccordionItem value="profile">
                        <AccordionTrigger className="text-sm font-semibold">Profile Details (Optional)</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Staff Code</Label>
                                <Input value={form.staff_code} onChange={(e) => setForm(f => ({ ...f, staff_code: e.target.value }))} placeholder="T001" />
                              </div>
                              <div>
                                <Label>Gender</Label>
                                <Select value={form.gender} onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>DOB</Label>
                                <Input type="date" value={form.dob} onChange={(e) => setForm(f => ({ ...f, dob: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Joining Date</Label>
                                <Input type="date" value={form.joining_date} onChange={(e) => setForm(f => ({ ...f, joining_date: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Qualification</Label>
                                <Input value={form.qualification} onChange={(e) => setForm(f => ({ ...f, qualification: e.target.value }))} placeholder="B.A., M.Sc." />
                              </div>
                              <div>
                                <Label>Experience (years)</Label>
                                <Input type="number" value={form.experience_years} onChange={(e) => setForm(f => ({ ...f, experience_years: e.target.value }))} placeholder="5" />
                              </div>
                            </div>

                            <div>
                              <Label>Address Line 1</Label>
                              <Input value={form.address_line1} onChange={(e) => setForm(f => ({ ...f, address_line1: e.target.value }))} placeholder="Street address" />
                            </div>
                            <div>
                              <Label>Address Line 2</Label>
                              <Input value={form.address_line2} onChange={(e) => setForm(f => ({ ...f, address_line2: e.target.value }))} placeholder="Apt, building, etc." />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label>City</Label>
                                <Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} />
                              </div>
                              <div>
                                <Label>State</Label>
                                <Input value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Pincode</Label>
                                <Input value={form.pincode} onChange={(e) => setForm(f => ({ ...f, pincode: e.target.value }))} />
                              </div>
                            </div>

                            <div className="border-t pt-4">
                              <Label className="flex items-center gap-2 mb-4">
                                <Checkbox checked={form.is_teacher} onCheckedChange={(checked) => setForm(f => ({ ...f, is_teacher: checked }))} />
                                This is a Teacher
                              </Label>

                              {form.is_teacher && (
                                <div className="space-y-4 ml-6">
                                  <div>
                                    <Label>Subjects</Label>
                                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                                      {subjects.map(s => (
                                        <div key={s.id} className="flex items-center gap-2">
                                          <Checkbox
                                            checked={form.subjects.includes(s.name)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setForm(f => ({ ...f, subjects: [...f.subjects, s.name] }));
                                              } else {
                                                setForm(f => ({ ...f, subjects: f.subjects.filter(x => x !== s.name) }));
                                              }
                                            }}
                                          />
                                          <span className="text-sm">{s.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <Label>Classes</Label>
                                    <div className="grid grid-cols-3 gap-2 border rounded p-2">
                                      {CLASSES.map(c => (
                                        <div key={c} className="flex items-center gap-2">
                                          <Checkbox
                                            checked={form.classes.includes(c)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setForm(f => ({ ...f, classes: [...f.classes, c] }));
                                              } else {
                                                setForm(f => ({ ...f, classes: f.classes.filter(x => x !== c) }));
                                              }
                                            }}
                                          />
                                          <span className="text-sm">{c}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <Label>Sections</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                      {SECTIONS.map(s => (
                                        <div key={s} className="flex items-center gap-2">
                                          <Checkbox
                                            checked={form.sections.includes(s)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setForm(f => ({ ...f, sections: [...f.sections, s] }));
                                              } else {
                                                setForm(f => ({ ...f, sections: f.sections.filter(x => x !== s) }));
                                              }
                                            }}
                                          />
                                          <span className="text-sm">{s}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <Label>Class Teacher Of</Label>
                                    <Input value={form.class_teacher_of} onChange={(e) => setForm(f => ({ ...f, class_teacher_of: e.target.value }))} placeholder="e.g., Class 5-A" />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div>
                              <Label>Emergency Contact Name</Label>
                              <Input value={form.emergency_contact_name} onChange={(e) => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                            </div>
                            <div>
                              <Label>Emergency Contact Phone</Label>
                              <Input value={form.emergency_contact_phone} onChange={(e) => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="flex gap-3 justify-end pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={saveMutation.isPending}
                        className="bg-[#1a237e] hover:bg-[#283593]"
                      >
                        {saveMutation.isPending ? 'Creating...' : 'Create Staff Account'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Staff Management Tab */}
            <TabsContent value="manage" className="space-y-4">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search staff..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No staff accounts found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filtered.map(member => (
                    <Card key={member.id} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 flex-shrink-0">
                            <AvatarFallback className="bg-[#e8eaf6] text-[#1a237e] font-bold text-sm">
                              {member.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                              {getStatusBadge(member)}
                            </div>
                            <p className="text-xs text-slate-500">@{member.username}</p>
                            {member.last_login_at && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                Last login: {new Date(member.last_login_at).toLocaleString()}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEdit(member)}
                            >
                              <Edit className="h-4 w-4 text-slate-500" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-amber-500"
                              onClick={() => openResetPasswordModal(member)}
                              disabled={resetPasswordMutation.isPending}
                              title="Reset Password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>

                            {member.account_locked_until && new Date(member.account_locked_until) > new Date() && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500"
                                onClick={() => unlockAccountMutation.mutate(member)}
                                disabled={unlockAccountMutation.isPending}
                              >
                                <Unlock className="h-4 w-4" />
                              </Button>
                            )}

                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-8 w-8 ${member.is_active ? 'text-green-500' : 'text-slate-400'}`}
                              onClick={() => toggleActiveMutation.mutate({ id: member.id, is_active: !member.is_active })}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Manage role templates and assign them to staff members. System roles cannot be deleted.
                </p>
                <Button onClick={openCreateRole} className="bg-[#1a237e] hover:bg-[#283593]">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {roleTemplates.map(role => (
                      <div key={role.id} className="border rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{role.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{role.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {role.is_system && (
                              <Badge className="bg-blue-100 text-blue-700">System</Badge>
                            )}
                            {!role.is_system && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => openEditRole(role)}
                                >
                                  <Edit className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => {
                                    if (confirm(`Delete role "${role.name}"?`)) {
                                      deleteRoleMutation.mutate(role.id);
                                    }
                                  }}
                                  disabled={deleteRoleMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {role.permissions && Object.keys(role.permissions).length > 0 && (
                          <div className="text-xs text-slate-600">
                            <span className="font-medium">Permissions:</span> {Object.entries(role.permissions).filter(([,v]) => v).map(([k]) => k).join(', ') || 'None'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Edit Staff Dialog */}
        <Dialog open={showDialog && editingStaff} onOpenChange={(open) => {
          if (!open) {
            setShowDialog(false);
            setEditingStaff(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Staff: {editingStaff?.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label>Username *</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="john.doe01"
                  />
                </div>

                <div>
                  <Label>Designation</Label>
                  <Input
                    value={form.designation}
                    onChange={(e) => setForm(f => ({ ...f, designation: e.target.value }))}
                    placeholder="Teacher"
                  />
                </div>
                <div>
                  <Label>Role Template *</Label>
                  <Select
                    value={form.role_template_id}
                    onValueChange={(v) => setForm(f => ({ ...f, role_template_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleTemplates.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mobile</Label>
                  <Input
                    value={form.mobile}
                    onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="john@school.com"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={form.is_active}
                      onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
                    />
                    Active Account
                  </Label>
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="profile">
                  <AccordionTrigger className="text-sm font-semibold">Profile Details</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Staff Code</Label>
                          <Input value={form.staff_code} onChange={(e) => setForm(f => ({ ...f, staff_code: e.target.value }))} placeholder="T001" />
                        </div>
                        <div>
                          <Label>Gender</Label>
                          <Select value={form.gender} onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>DOB</Label>
                          <Input type="date" value={form.dob} onChange={(e) => setForm(f => ({ ...f, dob: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Joining Date</Label>
                          <Input type="date" value={form.joining_date} onChange={(e) => setForm(f => ({ ...f, joining_date: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Qualification</Label>
                          <Input value={form.qualification} onChange={(e) => setForm(f => ({ ...f, qualification: e.target.value }))} placeholder="B.A., M.Sc." />
                        </div>
                        <div>
                          <Label>Experience (years)</Label>
                          <Input type="number" value={form.experience_years} onChange={(e) => setForm(f => ({ ...f, experience_years: e.target.value }))} placeholder="5" />
                        </div>
                      </div>

                      <div>
                        <Label>Address Line 1</Label>
                        <Input value={form.address_line1} onChange={(e) => setForm(f => ({ ...f, address_line1: e.target.value }))} placeholder="Street address" />
                      </div>
                      <div>
                        <Label>Address Line 2</Label>
                        <Input value={form.address_line2} onChange={(e) => setForm(f => ({ ...f, address_line2: e.target.value }))} placeholder="Apt, building, etc." />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>City</Label>
                          <Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} />
                        </div>
                        <div>
                          <Label>State</Label>
                          <Input value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Pincode</Label>
                          <Input value={form.pincode} onChange={(e) => setForm(f => ({ ...f, pincode: e.target.value }))} />
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <Label className="flex items-center gap-2 mb-4">
                          <Checkbox checked={form.is_teacher} onCheckedChange={(checked) => setForm(f => ({ ...f, is_teacher: checked }))} />
                          This is a Teacher
                        </Label>

                        {form.is_teacher && (
                          <div className="space-y-4 ml-6">
                            <div>
                              <Label>Subjects</Label>
                              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                                {subjects.map(s => (
                                  <div key={s.id} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={form.subjects.includes(s.name)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setForm(f => ({ ...f, subjects: [...f.subjects, s.name] }));
                                        } else {
                                          setForm(f => ({ ...f, subjects: f.subjects.filter(x => x !== s.name) }));
                                        }
                                      }}
                                    />
                                    <span className="text-sm">{s.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label>Classes</Label>
                              <div className="grid grid-cols-3 gap-2 border rounded p-2">
                                {CLASSES.map(c => (
                                  <div key={c} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={form.classes.includes(c)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setForm(f => ({ ...f, classes: [...f.classes, c] }));
                                        } else {
                                          setForm(f => ({ ...f, classes: f.classes.filter(x => x !== c) }));
                                        }
                                      }}
                                    />
                                    <span className="text-sm">{c}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label>Sections</Label>
                              <div className="grid grid-cols-4 gap-2">
                                {SECTIONS.map(s => (
                                  <div key={s} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={form.sections.includes(s)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setForm(f => ({ ...f, sections: [...f.sections, s] }));
                                        } else {
                                          setForm(f => ({ ...f, sections: f.sections.filter(x => x !== s) }));
                                        }
                                      }}
                                    />
                                    <span className="text-sm">{s}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label>Class Teacher Of</Label>
                              <Input value={form.class_teacher_of} onChange={(e) => setForm(f => ({ ...f, class_teacher_of: e.target.value }))} placeholder="e.g., Class 5-A" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label>Emergency Contact Name</Label>
                        <Input value={form.emergency_contact_name} onChange={(e) => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Emergency Contact Phone</Label>
                        <Input value={form.emergency_contact_phone} onChange={(e) => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex gap-3 justify-end pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDialog(false);
                    setEditingStaff(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="bg-[#1a237e] hover:bg-[#283593]"
                >
                  {saveMutation.isPending ? 'Updating...' : 'Update Staff'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset Password Modal */}
        <Dialog open={showResetPasswordModal} onOpenChange={setShowResetPasswordModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {resetPasswordStaff?.name} will be forced to change password on next login.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50" onClick={() => setResetPasswordMode('auto')}>
                  <Checkbox checked={resetPasswordMode === 'auto'} onCheckedChange={() => setResetPasswordMode('auto')} />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Generate Temporary Password</p>
                    <p className="text-xs text-slate-500">System generates a strong password</p>
                  </div>
                </div>

                {resetPasswordMode === 'auto' && (
                  <div className="ml-7 space-y-2 p-3 bg-slate-50 rounded border">
                    <p className="text-xs font-semibold text-slate-700">Generated Password:</p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={generatedPassword}
                        readOnly
                        className="bg-white font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPassword);
                          setPasswordCopied(true);
                          toast.success('Password copied to clipboard');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Label className="flex items-center gap-2 mt-2">
                      <Checkbox
                        checked={passwordCopied}
                        onCheckedChange={(checked) => setPasswordCopied(checked)}
                      />
                      <span className="text-xs">I have copied the password</span>
                    </Label>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50" onClick={() => setResetPasswordMode('manual')}>
                  <Checkbox checked={resetPasswordMode === 'manual'} onCheckedChange={() => setResetPasswordMode('manual')} />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Set Password Manually</p>
                    <p className="text-xs text-slate-500">Admin enters temporary password</p>
                  </div>
                </div>

                {resetPasswordMode === 'manual' && (
                  <div className="ml-7 p-3 bg-slate-50 rounded border">
                    <Input
                      type="password"
                      placeholder="Min. 8 characters"
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      className="bg-white"
                    />
                    <p className="text-xs text-slate-500 mt-2">Password must be at least 8 characters long</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowResetPasswordModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetPasswordSubmit}
                  disabled={resetPasswordMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Role Dialog */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Role Name *</Label>
                <Input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Exam Coordinator"
                  disabled={editingRole?.is_system}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this role"
                />
              </div>

              <div>
                <Label className="mb-3 block">Permissions</Label>
                <div className="space-y-5">
                  {PERMISSION_CATEGORIES.map(category => {
                    const allPermEnabled = category.permissions.every(p => roleForm.permissions[p.key]);
                    const someEnabled = category.permissions.some(p => roleForm.permissions[p.key]);
                    
                    return (
                      <div key={category.label} className="border rounded-lg p-4 bg-slate-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`module-${category.label}`}
                              checked={allPermEnabled}
                              indeterminate={someEnabled && !allPermEnabled}
                              onCheckedChange={() => toggleModuleAll(category)}
                            />
                            <label htmlFor={`module-${category.label}`} className="font-semibold text-slate-900 cursor-pointer">
                              {category.label}
                            </label>
                          </div>
                          {category.presets && (
                            <div className="flex gap-1">
                              {category.presets.map(preset => (
                                <Button
                                  key={preset.name}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={() => applyFeePreset(preset)}
                                >
                                  {preset.name}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 ml-6">
                          {category.permissions.map(perm => (
                            <div key={perm.key} className="flex items-center gap-2">
                              <Checkbox
                                id={perm.key}
                                checked={roleForm.permissions[perm.key] || false}
                                onCheckedChange={() => togglePermission(perm.key)}
                              />
                              <label htmlFor={perm.key} className="text-sm cursor-pointer">
                                {perm.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveRole}
                  disabled={saveRoleMutation.isPending}
                  className="bg-[#1a237e] hover:bg-[#283593]"
                >
                  {saveRoleMutation.isPending ? 'Saving...' : 'Save Role'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </LoginRequired>
  );
}