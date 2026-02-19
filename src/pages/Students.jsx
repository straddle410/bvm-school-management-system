import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import DataTable from '@/components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Search, Filter, Upload, Download, 
  MoreVertical, Eye, Pencil, Trash2, CheckCircle, XCircle,
  FileSpreadsheet, Image as ImageIcon, FileDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function Students() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
    // Check URL params for action=add
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add') {
      setShowAddDialog(true);
    }
  }, []);

  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    class_name: '',
    section: 'A',
    roll_no: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    dob: '',
    gender: 'Male',
    address: '',
    blood_group: '',
    admission_date: '',
    academic_year: '2024-25',
    status: 'Pending'
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      let photo_url = data.photo_url;
      if (photoFile) {
        const result = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = result.file_url;
      }
      return base44.entities.Student.create({ ...data, photo_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowAddDialog(false);
      resetForm();
      toast.success('Student added successfully');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      let photo_url = data.photo_url;
      if (photoFile) {
        const result = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = result.file_url;
      }
      return base44.entities.Student.update(id, { ...data, photo_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowDetailsSheet(false);
      setEditMode(false);
      resetForm();
      toast.success('Student updated successfully');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Student.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowDetailsSheet(false);
      toast.success('Student deleted successfully');
    }
  });

  const resetForm = () => {
    setFormData({
      student_id: '',
      name: '',
      class_name: '',
      section: 'A',
      roll_no: '',
      parent_name: '',
      parent_phone: '',
      parent_email: '',
      dob: '',
      gender: 'Male',
      address: '',
      blood_group: '',
      admission_date: '',
      academic_year: '2024-25',
      status: 'Pending'
    });
    setPhotoFile(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editMode && selectedStudent) {
      updateMutation.mutate({ id: selectedStudent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleStatusChange = async (student, newStatus) => {
    await base44.entities.Student.update(student.id, { 
      status: newStatus,
      [`${newStatus.toLowerCase()}_by`]: user?.email 
    });
    queryClient.invalidateQueries(['students']);
    toast.success(`Student ${newStatus.toLowerCase()}`);
  };

  const openEditMode = (student) => {
    setFormData(student);
    setSelectedStudent(student);
    setEditMode(true);
    setShowDetailsSheet(true);
  };

  const viewDetails = (student) => {
    setSelectedStudent(student);
    setEditMode(false);
    setShowDetailsSheet(true);
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.student_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'all' || student.class_name === filterClass;
    const matchesSection = filterSection === 'all' || student.section === filterSection;
    const matchesStatus = filterStatus === 'all' || student.status === filterStatus;
    return matchesSearch && matchesClass && matchesSection && matchesStatus;
  });

  const columns = [
    {
      header: 'Student',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={row.photo_url} />
            <AvatarFallback className="bg-blue-100 text-blue-700">
              {row.name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-sm text-slate-500">{row.student_id}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Class',
      cell: (row) => (
        <span className="font-medium">{row.class_name}-{row.section}</span>
      )
    },
    {
      header: 'Roll No',
      accessor: 'roll_no'
    },
    {
      header: 'Parent Contact',
      cell: (row) => (
        <div>
          <p className="text-sm text-slate-900">{row.parent_name}</p>
          <p className="text-sm text-slate-500">{row.parent_phone}</p>
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
            <DropdownMenuItem onClick={() => viewDetails(row)}>
              <Eye className="mr-2 h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEditMode(row)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            {row.status === 'Pending' && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, 'Verified')}>
                <CheckCircle className="mr-2 h-4 w-4 text-blue-600" /> Verify
              </DropdownMenuItem>
            )}
            {row.status === 'Verified' && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, 'Approved')}>
                <CheckCircle className="mr-2 h-4 w-4 text-indigo-600" /> Approve
              </DropdownMenuItem>
            )}
            {row.status === 'Approved' && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, 'Published')}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Publish
              </DropdownMenuItem>
            )}
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

  const StudentForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-center">
        <div className="relative">
          <Avatar className="h-24 w-24">
            <AvatarImage src={photoFile ? URL.createObjectURL(photoFile) : formData.photo_url} />
            <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl">
              {formData.name?.[0] || 'S'}
            </AvatarFallback>
          </Avatar>
          <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Student ID</Label>
          <Input
            value={formData.student_id}
            onChange={(e) => setFormData({...formData, student_id: e.target.value})}
            placeholder="STU001"
          />
        </div>
        <div>
          <Label>Full Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Enter full name"
            required
          />
        </div>
        <div>
          <Label>Class *</Label>
          <Select
            value={formData.class_name}
            onValueChange={(v) => setFormData({...formData, class_name: v})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {CLASSES.map(c => (
                <SelectItem key={c} value={c}>Class {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Section *</Label>
          <Select
            value={formData.section}
            onValueChange={(v) => setFormData({...formData, section: v})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map(s => (
                <SelectItem key={s} value={s}>Section {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Roll No</Label>
          <Input
            type="number"
            value={formData.roll_no}
            onChange={(e) => setFormData({...formData, roll_no: parseInt(e.target.value)})}
            placeholder="1"
          />
        </div>
        <div>
          <Label>Date of Birth</Label>
          <Input
            type="date"
            value={formData.dob}
            onChange={(e) => setFormData({...formData, dob: e.target.value})}
          />
        </div>
        <div>
          <Label>Gender</Label>
          <Select
            value={formData.gender}
            onValueChange={(v) => setFormData({...formData, gender: v})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Blood Group</Label>
          <Select
            value={formData.blood_group}
            onValueChange={(v) => setFormData({...formData, blood_group: v})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select blood group" />
            </SelectTrigger>
            <SelectContent>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Parent/Guardian Name</Label>
          <Input
            value={formData.parent_name}
            onChange={(e) => setFormData({...formData, parent_name: e.target.value})}
            placeholder="Enter parent name"
          />
        </div>
        <div>
          <Label>Parent Phone</Label>
          <Input
            value={formData.parent_phone}
            onChange={(e) => setFormData({...formData, parent_phone: e.target.value})}
            placeholder="+91 9876543210"
          />
        </div>
        <div>
          <Label>Parent Email</Label>
          <Input
            type="email"
            value={formData.parent_email}
            onChange={(e) => setFormData({...formData, parent_email: e.target.value})}
            placeholder="parent@email.com"
          />
        </div>
        <div>
          <Label>Admission Date</Label>
          <Input
            type="date"
            value={formData.admission_date}
            onChange={(e) => setFormData({...formData, admission_date: e.target.value})}
          />
        </div>
      </div>

      <div>
        <Label>Address</Label>
        <Textarea
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
          placeholder="Enter complete address"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button 
          type="button" 
          variant="outline"
          onClick={() => {
            setShowAddDialog(false);
            setShowDetailsSheet(false);
            setEditMode(false);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editMode ? 'Update Student' : 'Add Student')}
        </Button>
      </div>
    </form>
  );

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Students">
      <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Students"
        subtitle={`${filteredStudents.length} students`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="hidden sm:flex">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </div>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {CLASSES.map(c => (
                    <SelectItem key={c} value={c}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSection} onValueChange={setFilterSection}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {SECTIONS.map(s => (
                    <SelectItem key={s} value={s}>Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredStudents}
          loading={isLoading}
          emptyMessage="No students found. Add your first student to get started."
        />
      </div>

      {/* Add Student Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <StudentForm />
        </DialogContent>
      </Dialog>

      {/* Student Details Sheet */}
      <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editMode ? 'Edit Student' : 'Student Details'}</SheetTitle>
          </SheetHeader>
          
          {editMode ? (
            <div className="mt-6">
              <StudentForm />
            </div>
          ) : selectedStudent && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedStudent.photo_url} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl">
                    {selectedStudent.name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedStudent.name}</h3>
                  <p className="text-slate-500">{selectedStudent.student_id}</p>
                  <StatusBadge status={selectedStudent.status} className="mt-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500">Class</p>
                  <p className="font-semibold">{selectedStudent.class_name}-{selectedStudent.section}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500">Roll No</p>
                  <p className="font-semibold">{selectedStudent.roll_no || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500">Date of Birth</p>
                  <p className="font-semibold">{selectedStudent.dob || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500">Gender</p>
                  <p className="font-semibold">{selectedStudent.gender}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl col-span-2">
                  <p className="text-sm text-slate-500">Parent/Guardian</p>
                  <p className="font-semibold">{selectedStudent.parent_name}</p>
                  <p className="text-sm text-slate-600">{selectedStudent.parent_phone}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl col-span-2">
                  <p className="text-sm text-slate-500">Address</p>
                  <p className="font-semibold">{selectedStudent.address || '-'}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => openEditMode(selectedStudent)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={() => deleteMutation.mutate(selectedStudent.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
    </LoginRequired>
  );
}