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
import { Plus, Edit, Power, Copy, Search, Users, KeyRound, Send, Lock, Unlock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const generateUsername = (name) => {
  return name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '') + Math.floor(Math.random() * 99 + 1);
};

const generateTempPassword = () => {
  return 'BVM@' + Math.floor(1000 + Math.random() * 9000);
};

const roleColors = {
  Teacher: 'bg-blue-100 text-blue-700',
  Accountant: 'bg-green-100 text-green-700',
  Librarian: 'bg-amber-100 text-amber-700',
  Staff: 'bg-gray-100 text-gray-700',
  Principal: 'bg-purple-100 text-purple-700',
  Admin: 'bg-red-100 text-red-700',
};

const PERMISSION_MODULES = [
  'attendance',
  'marks',
  'post_notices',
  'gallery',
  'quiz',
  'student_admission_permission',
  'fees_view_module',
  'fee_reports_view',
];

export default function Staff() {
  const [activeTab, setActiveTab] = useState('add');
  const [showDialog, setShowDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [search, setSearch] = useState('');
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
  });
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
    mutationFn: async (member) => {
      return await base44.functions.invoke('resetStaffPassword', {
        staff_id: member.id,
        temp_password: generateTempPassword(),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts-rbac'] });
      toast.success(`Password reset: ${res.data.temp_password}`);
    },
  });

  const unlockAccountMutation = useMutation({
    mutationFn: async (member) => {
      return await base44.functions.invoke('unlockStaffAccount', {
        staff_id: member.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts-rbac'] });
      toast.success('Account unlocked');
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
    setForm({
      name: '',
      username: '',
      password_hash: tempPass,
      designation: '',
      mobile: '',
      email: '',
      role_template_id: '',
      force_password_change: true,
      is_active: true,
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

  const handleSave = () => {
   if (!form.name || !form.username) {
     toast.error('Name and username are required');
     return;
   }

   // Normalize username to lowercase before saving (case-insensitive)
   const dataToSave = { 
     ...form,
     username: form.username.trim().toLowerCase()
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

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Staff Module">
      <div className="min-h-screen bg-slate-50">
        <PageHeader
          title="Staff Management"
          subtitle="Manage staff accounts and roles with RBAC"
        />

        <div className="p-4 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white border-b">
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
                            value={form.password_hash}
                            readOnly
                            className="bg-slate-100"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const newPass = generateTempPassword();
                              setForm(f => ({ ...f, password_hash: newPass }));
                            }}
                          >
                            Generate
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Share with staff member to login</p>
                      </div>
                    </div>

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
                              onClick={() => resetPasswordMutation.mutate(member)}
                              disabled={resetPasswordMutation.isPending}
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
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-600 mb-4">
                    Manage role templates and assign them to staff members. System roles cannot be deleted.
                  </p>
                  <div className="space-y-3">
                    {roleTemplates.map(role => (
                      <div key={role.id} className="border rounded-lg p-3 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{role.name}</p>
                            <p className="text-xs text-slate-500">{role.description}</p>
                          </div>
                          {role.is_system && (
                            <Badge className="bg-blue-100 text-blue-700">System</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </LoginRequired>
  );
}