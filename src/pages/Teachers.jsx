import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import DataTable from '@/components/ui/DataTable';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Search, MoreVertical, Eye, Pencil, Trash2, 
  Mail, Phone, Image as ImageIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Art', 'Music', 'Physical Education'];
const ROLES = ['Teacher', 'Principal', 'HOD', 'Vice Principal', 'Coordinator', 'Counselor', 'Librarian', 'Admin Staff'];

export default function Teachers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [formData, setFormData] = useState({
    teacher_id: '',
    name: '',
    role: 'Teacher',
    email: '',
    phone: '',
    subjects: [],
    qualification: '',
    joining_date: '',
    status: 'Active'
  });
  
  const queryClient = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => base44.entities.Teacher.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      let photo_url = data.photo_url;
      if (photoFile) {
        const result = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = result.file_url;
      }
      return base44.entities.Teacher.create({ ...data, photo_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
      setShowAddDialog(false);
      resetForm();
      toast.success('Teacher added successfully');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      let photo_url = data.photo_url;
      if (photoFile) {
        const result = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = result.file_url;
      }
      return base44.entities.Teacher.update(id, { ...data, photo_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
      setShowAddDialog(false);
      resetForm();
      toast.success('Teacher updated successfully');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Teacher.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
      toast.success('Teacher deleted successfully');
    }
  });

  const resetForm = () => {
    setFormData({
      teacher_id: '',
      name: '',
      role: 'Teacher',
      email: '',
      phone: '',
      subjects: [],
      qualification: '',
      joining_date: '',
      status: 'Active'
    });
    setPhotoFile(null);
    setSelectedTeacher(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedTeacher) {
      updateMutation.mutate({ id: selectedTeacher.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (teacher) => {
    setFormData(teacher);
    setSelectedTeacher(teacher);
    setShowAddDialog(true);
  };

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = teacher.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         teacher.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || teacher.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'Staff',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={row.photo_url} />
            <AvatarFallback className="bg-purple-100 text-purple-700">
              {row.name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-sm text-slate-500">{row.teacher_id}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Role',
      cell: (row) => (
        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">{row.role || 'Teacher'}</Badge>
      )
    },
    {
      header: 'Contact',
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3 w-3 text-slate-400" />
            <span>{row.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Phone className="h-3 w-3 text-slate-400" />
            <span>{row.phone}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Subjects',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.subjects?.slice(0, 2).map(s => (
            <Badge key={s} variant="secondary" className="bg-blue-50 text-blue-700">
              {s}
            </Badge>
          ))}
          {row.subjects?.length > 2 && (
            <Badge variant="secondary">+{row.subjects.length - 2}</Badge>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      width: '80px',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => deleteMutation.mutate(row.id)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Teachers">
      <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Staff"
        subtitle={`${filteredTeachers.length} staff members`}
        actions={
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Staff
          </Button>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          data={filteredTeachers}
          loading={isLoading}
          emptyMessage="No staff found. Add your first staff member to get started."
        />
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={photoFile ? URL.createObjectURL(photoFile) : formData.photo_url} />
                  <AvatarFallback className="bg-purple-100 text-purple-700 text-xl">
                    {formData.name?.[0] || 'T'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer">
                  <ImageIcon className="h-4 w-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Teacher ID</Label>
                <Input
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                  placeholder="TCH001"
                />
              </div>
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Label>Subjects</Label>
                <Select
                  onValueChange={(v) => {
                    if (!formData.subjects?.includes(v)) {
                      setFormData({...formData, subjects: [...(formData.subjects || []), v]});
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.subjects?.map(s => (
                    <Badge 
                      key={s} 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setFormData({
                        ...formData, 
                        subjects: formData.subjects.filter(x => x !== s)
                      })}
                    >
                      {s} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Qualification</Label>
                <Input
                  value={formData.qualification}
                  onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                  placeholder="M.Sc., B.Ed."
                />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) => setFormData({...formData, joining_date: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({...formData, status: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (selectedTeacher ? 'Update' : 'Add Teacher')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </LoginRequired>
  );
}