import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
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
  Users, Shield, Database, Clock, Plus, Trash2, Layers, Bell
} from 'lucide-react';
import { toast } from "sonner";
import NotificationSettingsSection from '@/components/NotificationSettingsSection';

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
    queryFn: () => base44.entities.AcademicYear.list('-start_date')
  });

  // Only non-archived years for duplicate detection and active UI
  const activeYears = academicYears.filter(y => (y.status || 'Active').toLowerCase() !== 'archived');

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
    mutationFn: async (data) => {
      // Guard: prevent duplicate year among non-archived
      const existing = activeYears.find(y => y.year.trim() === data.year.trim());
      if (existing) throw new Error(`Academic year "${data.year}" already exists.`);
      return base44.entities.AcademicYear.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['academic-years']);
      setShowYearDialog(false);
      setYearForm({ year: '', start_date: '', end_date: '' });
      toast.success('Academic year created');
    },
    onError: (err) => toast.error(err.message)
  });

  const cleanupDuplicateYearsMutation = useMutation({
    mutationFn: () => base44.functions.invoke('cleanupDuplicateAcademicYears', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['academic-years']);
      const d = res.data;
      const msg = d?.message || 'Cleanup complete';
      const detail = d?.activeYears != null
        ? ` Active: ${d.activeYears}, Archived: ${d.archivedYears}, Remaining dupes: ${d.duplicatesRemainingActive}`
        : '';
      toast.success(msg + detail);
    },
    onError: (err) => toast.error(`Cleanup failed: ${err.message}`)
  });

  const setCurrentYearMutation = useMutation({
    mutationFn: async (yearId) => {
      const year = academicYears.find(y => y.id === yearId);
      if ((year?.status || '').toLowerCase() === 'archived') {
        throw new Error('Cannot modify archived academic year');
      }
      await Promise.all(
        academicYears
          .filter(y => y.is_current && y.id !== yearId)
          .map(y => base44.entities.AcademicYear.update(y.id, { is_current: false }))
      );
      await base44.entities.AcademicYear.update(yearId, { is_current: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['academic-years']);
      toast.success('Current year updated');
    },
    onError: (err) => toast.error(err.message)
  });

  const fixDuplicatesMutation = useMutation({
    mutationFn: () => base44.functions.invoke('enforceCurrentYearUniqueness', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['academic-years']);
      toast.success(res.data?.message || 'Duplicates fixed');
    },
    onError: (err) => toast.error(`Fix failed: ${err.message}`)
  });

  const toggleAdmissionMutation = useMutation({
    mutationFn: ({ id, admission_open }) => {
      const year = academicYears.find(y => y.id === id);
      if ((year?.status || '').toLowerCase() === 'archived') {
        throw new Error('Cannot modify archived academic year');
      }
      return base44.entities.AcademicYear.update(id, { admission_open });
    },
    onSuccess: () => queryClient.invalidateQueries(['academic-years']),
    onError: (err) => toast.error(err.message)
  });

  const updateYearStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const updates = { status };
      if (status === 'Closed' || status === 'Archived') {
        const year = academicYears.find(y => y.id === id);
        if (year?.is_current) {
          updates.is_current = false;
          updates.admission_open = false;
          toast.info(`"${year.year}" is no longer the current year. Please set a new current year.`);
        }
      }
      return base44.entities.AcademicYear.update(id, updates);
    },
    onSuccess: () => queryClient.invalidateQueries(['academic-years'])
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
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerCaption, setBannerCaption] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const { data: bannerSlides = [] } = useQuery({
    queryKey: ['banner-slides'],
    queryFn: () => base44.entities.BannerSlide.list('sort_order')
  });

  const addBannerMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.integrations.Core.UploadFile({ file: bannerFile });
      return base44.entities.BannerSlide.create({
        image_url: result.file_url,
        caption: bannerCaption,
        sort_order: bannerSlides.length,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['banner-slides']);
      setBannerFile(null);
      setBannerCaption('');
      toast.success('Banner slide added');
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: (id) => base44.entities.BannerSlide.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['banner-slides']);
      toast.success('Banner removed');
    }
  });

  const toggleBannerMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.BannerSlide.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries(['banner-slides'])
  });

  const runCleanupMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('cleanupOldNotifications', {});
      return result.data;
    },
    onSuccess: (data) => {
      setCleanupResult(data);
      toast.success(`Cleanup complete: ${data.deleted} notifications deleted`);
    },
    onError: (err) => {
      toast.error(`Cleanup failed: ${err.message}`);
    }
  });

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Settings">
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
            <TabsTrigger value="banners">
              <Layers className="h-4 w-4 mr-2" /> Banners
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" /> Notifications
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
                          {/* Only non-archived, deduplicated */}
                        {[...new Map(activeYears.map(y => [y.year, y])).values()].map(y => (
                          <SelectItem key={y.year} value={y.year}>{y.year}</SelectItem>
                        ))}
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
                  {/* Duplicate year records warning — only among NON-archived years */}
                  {(() => {
                    const yearCounts = {};
                    activeYears.forEach(y => { yearCounts[y.year] = (yearCounts[y.year] || 0) + 1; });
                    const hasDuplicateRecords = Object.values(yearCounts).some(c => c > 1);
                    const hasDuplicateCurrent = activeYears.filter(y => y.is_current).length > 1;
                    return (hasDuplicateRecords || hasDuplicateCurrent) && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3 gap-3">
                        <div>
                          <p className="text-sm text-red-800 font-semibold">⚠️ Duplicate academic year records detected</p>
                          {hasDuplicateRecords && <p className="text-xs text-red-700 mt-0.5">Same year appears multiple times in the database. Run cleanup to keep one per year.</p>}
                          {hasDuplicateCurrent && <p className="text-xs text-red-700 mt-0.5">Multiple years are marked as "Current Year".</p>}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="whitespace-nowrap"
                          onClick={() => cleanupDuplicateYearsMutation.mutate()}
                          disabled={cleanupDuplicateYearsMutation.isPending || fixDuplicatesMutation.isPending}
                        >
                          {cleanupDuplicateYearsMutation.isPending ? 'Cleaning...' : 'Fix Duplicates'}
                        </Button>
                      </div>
                    );
                  })()}

                  {academicYears.map(year => {
                    const isArchived = (year.status || '').toLowerCase() === 'archived';
                    return (

                    <div 
                      key={year.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl gap-3 ${
                        isArchived ? 'bg-slate-100 opacity-60' :
                        year.is_current ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{year.year}</p>
                          <p className="text-sm text-slate-500">
                            {year.start_date} to {year.end_date}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {isArchived ? (
                          <span className="text-xs text-slate-400 italic">Archived — restore via status</span>
                        ) : (
                          <>
                            {/* Admissions Open Toggle */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border">
                              <span className="text-xs font-medium text-slate-600">Admissions Open</span>
                              <Switch
                                checked={!!year.admission_open}
                                onCheckedChange={(v) => toggleAdmissionMutation.mutate({ id: year.id, admission_open: v })}
                              />
                            </div>
                            {year.is_current ? (
                              <span className="text-sm font-medium text-blue-600 whitespace-nowrap">✓ Current Year</span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentYearMutation.mutate(year.id)}
                              >
                                Set as Current
                              </Button>
                            )}
                          </>
                        )}
                        {/* Status selector — always visible so archived can be restored */}
                        <Select
                          value={year.status || 'Active'}
                          onValueChange={(v) => updateYearStatusMutation.mutate({ id: year.id, status: v })}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                            <SelectItem value="Archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      </div>
                      );
                      })}


                  {activeYears.length === 0 && academicYears.length > 0 && (
                    <div className="py-4 text-center text-sm text-slate-400">All years are archived.</div>
                  )}
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
          <TabsContent value="banners" className="mt-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Homepage Banner Slides</CardTitle>
                <CardDescription>Manage the rotating images shown on the home screen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new banner */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Add New Slide</p>
                  <div>
                    <Label>Image</Label>
                    <label className="mt-1 flex items-center gap-3 cursor-pointer">
                      <span className="px-4 py-2 bg-[#1a237e] text-white rounded-lg text-sm font-medium hover:bg-[#283593] transition-colors">
                        {bannerFile ? bannerFile.name : 'Choose Image'}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setBannerFile(e.target.files[0])} />
                      {bannerFile && <span className="text-xs text-green-600 font-medium">✓ Selected</span>}
                    </label>
                  </div>
                  <div>
                    <Label>Caption (optional)</Label>
                    <Input value={bannerCaption} onChange={e => setBannerCaption(e.target.value)} placeholder="e.g., Annual Day 2025" />
                  </div>
                  <Button
                    onClick={() => addBannerMutation.mutate()}
                    disabled={!bannerFile || addBannerMutation.isPending}
                    className="bg-[#1a237e] hover:bg-[#283593]"
                  >
                    {addBannerMutation.isPending ? 'Uploading...' : <><Plus className="mr-2 h-4 w-4" /> Add Slide</>}
                  </Button>
                </div>

                {/* Existing banners */}
                <div className="space-y-2">
                  {bannerSlides.map((slide, idx) => (
                    <div key={slide.id} className="flex items-center gap-3 bg-white border rounded-xl p-3">
                      <img src={slide.image_url} alt="" className="h-14 w-20 object-cover rounded-lg flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{slide.caption || 'No caption'}</p>
                        <p className="text-xs text-slate-400">Slide {idx + 1}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={slide.is_active}
                          onCheckedChange={(v) => toggleBannerMutation.mutate({ id: slide.id, is_active: v })}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteBannerMutation.mutate(slide.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {bannerSlides.length === 0 && (
                    <p className="text-center text-slate-400 py-6 text-sm">No custom banners yet — default images are shown</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6 space-y-6">
            <NotificationSettingsSection />

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Notification Cleanup</CardTitle>
                <CardDescription>Manually trigger cleanup of old read notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>What this does:</strong> Deletes read notifications older than 90 days (excluding current academic year). Runs automatically every Sunday at 2:00 AM.
                  </p>
                </div>

                <Button
                  onClick={() => runCleanupMutation.mutate()}
                  disabled={runCleanupMutation.isPending}
                  variant="outline"
                >
                  {runCleanupMutation.isPending ? 'Running cleanup...' : 'Run Cleanup Now'}
                </Button>

                {cleanupResult && (
                  <div className={`rounded-lg p-4 ${cleanupResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`font-medium ${cleanupResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {cleanupResult.success ? '✓ Cleanup Success' : '⚠ Cleanup Aborted'}
                    </p>
                    <ul className={`text-sm mt-2 space-y-1 ${cleanupResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      <li><strong>Deleted:</strong> {cleanupResult.deleted} notifications</li>
                      <li><strong>Candidates:</strong> {cleanupResult.candidateCount}</li>
                      {cleanupResult.threshold && <li><strong>Safety Threshold:</strong> {cleanupResult.threshold}</li>}
                      {cleanupResult.currentAcademicYear && <li><strong>Current Academic Year:</strong> {cleanupResult.currentAcademicYear}</li>}
                      {cleanupResult.cutoffDate && <li><strong>Cutoff Date:</strong> {new Date(cleanupResult.cutoffDate).toLocaleDateString()}</li>}
                      {cleanupResult.errors && <li className="text-red-600"><strong>Errors:</strong> {cleanupResult.errors.length} deletion errors</li>}
                    </ul>
                  </div>
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
              {yearForm.year && activeYears.some(y => y.year.trim() === yearForm.year.trim()) && (
                <p className="text-xs text-red-600 mt-1">⚠️ This academic year already exists.</p>
              )}
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
              <Button
                type="submit"
                disabled={createYearMutation.isPending || (!!yearForm.year && activeYears.some(y => y.year.trim() === yearForm.year.trim()))}
              >
                {createYearMutation.isPending ? 'Creating...' : 'Create Year'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </LoginRequired>
  );
}