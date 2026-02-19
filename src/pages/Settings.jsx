import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  School, Save, Upload, Image as ImageIcon, Calendar, 
  Users, Shield, Database, Clock, Plus, Trash2
} from 'lucide-react';
import { toast } from "sonner";

export default function Settings() {
  const [activeTab, setActiveTab] = useState('school');
  const [logoFile, setLogoFile] = useState(null);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [schoolForm, setSchoolForm] = useState({
    school_name: 'BVM School of Excellence',
    address: '',
    phone: '',
    email: '',
    website: '',
    principal_name: '',
    academic_year: '2024-25',
    tagline: ''
  });
  const [yearForm, setYearForm] = useState({
    year: '',
    start_date: '',
    end_date: ''
  });
  
  const queryClient = useQueryClient();

  const { data: schoolProfiles = [] } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list()
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => base44.entities.AcademicYear.list()
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list()
  });

  useEffect(() => {
    if (schoolProfiles.length > 0) {
      setSchoolForm(schoolProfiles[0]);
    }
  }, [schoolProfiles]);

  const saveSchoolMutation = useMutation({
    mutationFn: async () => {
      let logo_url = schoolForm.logo_url;
      if (logoFile) {
        const result = await base44.integrations.Core.UploadFile({ file: logoFile });
        logo_url = result.file_url;
      }
      
      if (schoolProfiles.length > 0) {
        return base44.entities.SchoolProfile.update(schoolProfiles[0].id, { ...schoolForm, logo_url });
      }
      return base44.entities.SchoolProfile.create({ ...schoolForm, logo_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['school-profile']);
      toast.success('School profile saved');
      setLogoFile(null);
    }
  });

  const createYearMutation = useMutation({
    mutationFn: (data) => base44.entities.AcademicYear.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['academic-years']);
      setShowYearDialog(false);
      setYearForm({ year: '', start_date: '', end_date: '' });
      toast.success('Academic year created');
    }
  });

  const setCurrentYearMutation = useMutation({
    mutationFn: async (yearId) => {
      // Unset all other years
      await Promise.all(academicYears.map(y => 
        base44.entities.AcademicYear.update(y.id, { is_current: y.id === yearId })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['academic-years']);
      toast.success('Current year updated');
    }
  });

  const createSubjectMutation = useMutation({
    mutationFn: (name) => base44.entities.Subject.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      toast.success('Subject added');
    }
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      toast.success('Subject deleted');
    }
  });

  const [newSubject, setNewSubject] = useState('');

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Settings"
        subtitle="Manage school configuration"
      />

      <div className="p-4 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="school">
              <School className="h-4 w-4 mr-2" /> School Profile
            </TabsTrigger>
            <TabsTrigger value="academic">
              <Calendar className="h-4 w-4 mr-2" /> Academic Years
            </TabsTrigger>
            <TabsTrigger value="subjects">
              <Database className="h-4 w-4 mr-2" /> Subjects
            </TabsTrigger>
          </TabsList>

          <TabsContent value="school" className="mt-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>School Profile</CardTitle>
                <CardDescription>
                  Update your school's basic information and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-xl bg-blue-50 flex items-center justify-center overflow-hidden">
                      {(logoFile || schoolForm.logo_url) ? (
                        <img 
                          src={logoFile ? URL.createObjectURL(logoFile) : schoolForm.logo_url}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <School className="h-10 w-10 text-blue-600" />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors">
                      <ImageIcon className="h-4 w-4 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setLogoFile(e.target.files[0])}
                      />
                    </label>
                  </div>
                  <div>
                    <h3 className="font-medium">School Logo</h3>
                    <p className="text-sm text-slate-500">Upload your school's logo (recommended: 200x200px)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>School Name</Label>
                    <Input
                      value={schoolForm.school_name}
                      onChange={(e) => setSchoolForm({...schoolForm, school_name: e.target.value})}
                      placeholder="Enter school name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Tagline / Motto</Label>
                    <Input
                      value={schoolForm.tagline}
                      onChange={(e) => setSchoolForm({...schoolForm, tagline: e.target.value})}
                      placeholder="e.g., Excellence in Education"
                    />
                  </div>
                  <div>
                    <Label>Principal Name</Label>
                    <Input
                      value={schoolForm.principal_name}
                      onChange={(e) => setSchoolForm({...schoolForm, principal_name: e.target.value})}
                      placeholder="Enter principal name"
                    />
                  </div>
                  <div>
                    <Label>Current Academic Year</Label>
                    <Select
                      value={schoolForm.academic_year}
                      onValueChange={(v) => setSchoolForm({...schoolForm, academic_year: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {academicYears.map(y => (
                          <SelectItem key={y.id} value={y.year}>{y.year}</SelectItem>
                        ))}
                        <SelectItem value="2024-25">2024-25</SelectItem>
                        <SelectItem value="2025-26">2025-26</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      value={schoolForm.phone}
                      onChange={(e) => setSchoolForm({...schoolForm, phone: e.target.value})}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={schoolForm.email}
                      onChange={(e) => setSchoolForm({...schoolForm, email: e.target.value})}
                      placeholder="school@email.com"
                    />
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={schoolForm.website}
                      onChange={(e) => setSchoolForm({...schoolForm, website: e.target.value})}
                      placeholder="https://www.school.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    <Textarea
                      value={schoolForm.address}
                      onChange={(e) => setSchoolForm({...schoolForm, address: e.target.value})}
                      placeholder="Enter complete school address"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => saveSchoolMutation.mutate()}
                    disabled={saveSchoolMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saveSchoolMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="academic" className="mt-6 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Academic Years</CardTitle>
                  <CardDescription>Manage academic year settings</CardDescription>
                </div>
                <Button onClick={() => setShowYearDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Year
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {academicYears.map(year => (
                    <div 
                      key={year.id}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        year.is_current ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{year.year}</p>
                          <p className="text-sm text-slate-500">
                            {year.start_date} to {year.end_date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={year.status} />
                        {year.is_current ? (
                          <span className="text-sm font-medium text-blue-600">Current Year</span>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setCurrentYearMutation.mutate(year.id)}
                          >
                            Set as Current
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {academicYears.length === 0 && (
                    <div className="py-12 text-center">
                      <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">No academic years configured</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects" className="mt-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Subjects</CardTitle>
                <CardDescription>Manage subjects available in the school</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Enter subject name"
                    className="max-w-xs"
                  />
                  <Button 
                    onClick={() => {
                      if (newSubject.trim()) {
                        createSubjectMutation.mutate(newSubject.trim());
                        setNewSubject('');
                      }
                    }}
                    disabled={!newSubject.trim()}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Subject
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {subjects.map(subject => (
                    <div 
                      key={subject.id}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg"
                    >
                      <span>{subject.name}</span>
                      <button
                        onClick={() => deleteSubjectMutation.mutate(subject.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {subjects.length === 0 && (
                  <p className="text-slate-500 text-center py-8">
                    No subjects added yet. Default subjects will be used.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Year Dialog */}
      <Dialog open={showYearDialog} onOpenChange={setShowYearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Academic Year</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            createYearMutation.mutate({...yearForm, status: 'Active', is_current: false, is_locked: false});
          }} className="space-y-4">
            <div>
              <Label>Year</Label>
              <Input
                value={yearForm.year}
                onChange={(e) => setYearForm({...yearForm, year: e.target.value})}
                placeholder="e.g., 2025-26"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={yearForm.start_date}
                  onChange={(e) => setYearForm({...yearForm, start_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={yearForm.end_date}
                  onChange={(e) => setYearForm({...yearForm, end_date: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowYearDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createYearMutation.isPending}>
                {createYearMutation.isPending ? 'Creating...' : 'Create Year'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}