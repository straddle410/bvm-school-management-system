import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import AcademicYearSelector from '@/components/AcademicYearSelector';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, MoreVertical, Eye, CheckCircle, XCircle, 
  UserPlus, FileText, ExternalLink
} from 'lucide-react';
import { getProxiedImageUrl } from '@/components/imageProxy';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { toast } from "sonner";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Admissions() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editData, setEditData] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [analytics, setAnalytics] = useState(null);
  
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user) return;
      const userRole = (user.role || '').toLowerCase();
      const isAdmin = userRole === 'admin' || userRole === 'principal';
      const hasPermission = user.permissions?.student_admission_permission;
      
      console.log('[Admissions] Auth Check:', { userRole, isAdmin, hasPermission });
      
      if (!isAdmin && !hasPermission) {
        console.log('[Admissions] Access Denied - Redirecting to Dashboard');
        window.location.replace(createPageUrl('Dashboard'));
        return;
      }
      setUser(user);
    }).catch((err) => {
      console.error('[Admissions] Auth Error:', err);
      window.location.replace(createPageUrl('Dashboard'));
    });
  }, []);

  const { data: paginatedData = { results: [], total_count: 0, total_pages: 0 }, isLoading } = useQuery({
    queryKey: ['admissions-paginated', academicYear, filterStatus, searchQuery, currentPage],
    queryFn: async () => {
      console.log('[Admissions] Fetching paginated data:', { academicYear, currentPage });
      const response = await base44.functions.invoke('getAdmissionsPaginated', {
        academicYear,
        status: filterStatus === 'all' ? null : filterStatus,
        search: searchQuery || null,
        page: currentPage,
        limit: pageSize
      });
      return response.data;
    },
    enabled: !!user && !!academicYear,
    retry: 1,
    retryDelay: 500
  });

  const { data: yearReport = null } = useQuery({
    queryKey: ['admissions-year-report', academicYear],
    queryFn: async () => {
      console.log('[Admissions] Fetching year report:', { academicYear });
      const response = await base44.functions.invoke('getAdmissionYearReport', {
        academicYear
      });
      return response.data;
    },
    enabled: !!user && !!academicYear,
    staleTime: 5 * 60 * 1000,
    onError: (err) => console.error('[Admissions] Year report error:', err)
  });

  // Calculate SLA for each admission
  const admissionsWithSLA = (paginatedData.results || []).map(app => {
    const createdDate = new Date(app.created_date);
    const now = new Date();
    const daysInStatus = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    const slaThreshold = 5; // 5 days SLA
    const slaBreached = daysInStatus > slaThreshold;
    return { ...app, daysInStatus, slaBreached };
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AdmissionApplication.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admissions']);
      queryClient.invalidateQueries(['approvals-count']);
      queryClient.invalidateQueries(['pending-approvals-count']);
      toast.success('Application updated');
    }
  });

  const bulkVerifyMutation = useMutation({
    mutationFn: async (ids) => {
      const now = new Date().toISOString();
      const selectedAdmissions = admissionsWithSLA.filter(a => ids.has(a.id));
      const updatePromises = Array.from(ids).map(id => 
        base44.entities.AdmissionApplication.update(id, { 
          status: 'Verified',
          verified_by: user?.email,
          verified_at: now
        })
      );
      await Promise.all(updatePromises);
      
      for (const admission of selectedAdmissions) {
        try {
          await base44.functions.invoke('notifyAdminOnApplicationVerified', { 
            applicationId: admission.id,
            studentName: admission.student_name 
          });
        } catch (err) {
          console.error('Failed to send notification:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admissions-paginated']);
      queryClient.invalidateQueries(['admissions-year-report']);
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} application(s) verified`);
    }
  });



  const handleStatusChange = async (admission, newStatus) => {
    updateMutation.mutate({ 
      id: admission.id, 
      data: { 
        status: newStatus,
        remarks: selectedAdmission?.id === admission.id ? remarks : admission.remarks || '',
        approved_by: newStatus === 'Approved' ? user?.email : undefined,
        approved_at: newStatus === 'Approved' ? new Date().toISOString() : undefined,
        verified_by: newStatus === 'Verified' ? user?.email : undefined,
        verified_at: newStatus === 'Verified' ? new Date().toISOString() : undefined
      } 
    });
    
    // Notify admin when application is verified
    if (newStatus === 'Verified') {
      try {
        await base44.functions.invoke('notifyAdminOnApplicationVerified', { 
          applicationId: admission.id,
          studentName: admission.student_name 
        });
      } catch (err) {
        console.error('Failed to send notification:', err);
      }
    }
    
    if (showDetailsSheet) setShowDetailsSheet(false);
  };

  const viewDetails = (admission) => {
    setSelectedAdmission(admission);
    setRemarks(admission.remarks || '');
    setEditData({
      student_name: admission.student_name,
      dob: admission.dob,
      gender: admission.gender,
      parent_name: admission.parent_name,
      parent_phone: admission.parent_phone,
      parent_email: admission.parent_email,
      address: admission.address,
      previous_school: admission.previous_school,
      applying_for_class: admission.applying_for_class
    });
    setShowDetailsSheet(true);
  };

  const saveApplicationEdits = () => {
    updateMutation.mutate({
      id: selectedAdmission.id,
      data: { ...editData, remarks }
    });
    setShowDetailsSheet(false);
  };



  const columns = [
    {
      header: (
        <input 
          type="checkbox" 
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(new Set(admissionsWithSLA.map(a => a.id)));
            } else {
              setSelectedIds(new Set());
            }
          }}
          checked={selectedIds.size === admissionsWithSLA.length && admissionsWithSLA.length > 0}
          className="rounded"
        />
      ),
      width: '40px',
      cell: (row) => (
        <input 
          type="checkbox" 
          checked={selectedIds.has(row.id)}
          onChange={(e) => {
            const newSet = new Set(selectedIds);
            if (e.target.checked) {
              newSet.add(row.id);
            } else {
              newSet.delete(row.id);
            }
            setSelectedIds(newSet);
          }}
          className="rounded"
        />
      )
    },
    {
      header: 'Application',
      cell: (row) => (
         <div className="flex items-center gap-3">
           <Avatar className="h-10 w-10">
             <AvatarImage src={getProxiedImageUrl(row.photo_url)} />
             <AvatarFallback className="bg-purple-100 text-purple-700">
               {row.student_name?.[0]}
             </AvatarFallback>
           </Avatar>
          <div>
            <p className="font-medium text-slate-900">{row.student_name}</p>
            <p className="text-sm text-slate-500">{row.application_no || `APP-${row.id?.slice(0,6)}`}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Applying For',
      cell: (row) => (
        <span className="font-medium">Class {row.applying_for_class}</span>
      )
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
      header: 'Applied On',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy') : '-'}
        </span>
      )
    },
    {
      header: 'Status',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} />
          {row.slaBreached && (
            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-1 rounded w-fit">
              SLA: {row.daysInStatus} days
            </span>
          )}
        </div>
      )
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
            <DropdownMenuSeparator />
            {row.status === 'Submitted' && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, 'Under Review')}>
                <FileText className="mr-2 h-4 w-4" /> Mark Under Review
              </DropdownMenuItem>
            )}
            {['Submitted', 'Under Review'].includes(row.status) && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, 'Verified')}>
                <CheckCircle className="mr-2 h-4 w-4 text-blue-600" /> Verify
              </DropdownMenuItem>
            )}
            {row.status === 'Verified' && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, 'Approved')}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Approve
              </DropdownMenuItem>
            )}

            {!['Rejected', 'Converted'].includes(row.status) && (
              <DropdownMenuItem 
                onClick={() => handleStatusChange(row, 'Rejected')}
                className="text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  if (!user) {
    console.log('[Admissions] Rendering loading state - user not authenticated');
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!academicYear) {
    console.log('[Admissions] Rendering loading state - academicYear undefined');
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Loading academic year...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Admissions"
        subtitle={`${paginatedData.total_count} total applications`}
        actions={
          <div className="flex items-center gap-2">
            <AcademicYearSelector />
            <Link to={createPageUrl('PublicAdmissionForm')} target="_blank">
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" /> View Public Form
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Analytics Summary */}
        {yearReport && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card className="border-0 shadow-sm p-4">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-2xl font-bold mt-1">{yearReport.summary.total_applications}</p>
            </Card>
            <Card className="border-0 shadow-sm p-4">
              <p className="text-sm text-slate-500">Verified</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{yearReport.summary.total_verified}</p>
              <p className="text-xs text-slate-500 mt-1">{yearReport.summary.verification_rate}%</p>
            </Card>
            <Card className="border-0 shadow-sm p-4">
              <p className="text-sm text-slate-500">Approved</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{yearReport.summary.total_approved}</p>
              <p className="text-xs text-slate-500 mt-1">{yearReport.summary.approval_rate}%</p>
            </Card>
            <Card className="border-0 shadow-sm p-4">
              <p className="text-sm text-slate-500">Converted</p>
              <p className="text-2xl font-bold mt-1 text-indigo-600">{yearReport.summary.total_converted}</p>
              <p className="text-xs text-slate-500 mt-1">{yearReport.summary.conversion_rate}%</p>
            </Card>
            <Card className="border-0 shadow-sm p-4">
              <p className="text-sm text-slate-500">Rejected</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{yearReport.summary.total_rejected}</p>
              <p className="text-xs text-slate-500 mt-1">{yearReport.summary.rejection_rate}%</p>
            </Card>
          </div>
        )}

        {/* Filters & Bulk Actions */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or application number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}>
                   <SelectTrigger className="w-full sm:w-44">
                     <SelectValue placeholder="Filter Status" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Status</SelectItem>
                     <SelectItem value="Pending">Pending</SelectItem>
                     <SelectItem value="Verified">Verified</SelectItem>
                     <SelectItem value="Approved">Approved</SelectItem>
                     <SelectItem value="Converted">Converted</SelectItem>
                     <SelectItem value="Rejected">Rejected</SelectItem>
                     <SelectItem value="Submitted">Submitted</SelectItem>
                     <SelectItem value="Under Review">Under Review</SelectItem>
                   </SelectContent>
                 </Select>
              </div>
              
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">{selectedIds.size} selected</span>
                  <Button
                    size="sm"
                    onClick={() => bulkVerifyMutation.mutate(selectedIds)}
                    disabled={bulkVerifyMutation.isPending}
                    className="ml-auto"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {bulkVerifyMutation.isPending ? 'Verifying...' : 'Bulk Verify'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          data={admissionsWithSLA}
          loading={isLoading}
          emptyMessage="No admission applications yet"
        />

        {/* Pagination */}
        {paginatedData.total_pages > 1 && (
          <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-slate-200">
            <span className="text-sm text-slate-600">
              Page {currentPage} of {paginatedData.total_pages} ({paginatedData.total_count} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, paginatedData.total_pages) }).map((_, i) => {
                const page = Math.max(1, currentPage - 2) + i;
                if (page > paginatedData.total_pages) return null;
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === paginatedData.total_pages}
                onClick={() => setCurrentPage(Math.min(paginatedData.total_pages, currentPage + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details Sheet */}
      <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Application Details</SheetTitle>
          </SheetHeader>
          
          {selectedAdmission && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={getProxiedImageUrl(selectedAdmission.photo_url)} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-2xl">
                      {selectedAdmission.student_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedAdmission.student_name}</h3>
                  <p className="text-slate-500">Applying for Class {selectedAdmission.applying_for_class}</p>
                  <StatusBadge status={selectedAdmission.status} className="mt-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date of Birth</Label>
                  <Input 
                    type="date"
                    value={editData.dob || ''} 
                    onChange={(e) => setEditData({...editData, dob: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={editData.gender || ''} onValueChange={(value) => setEditData({...editData, gender: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Parent/Guardian Name</Label>
                  <Input 
                    value={editData.parent_name || ''} 
                    onChange={(e) => setEditData({...editData, parent_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Parent Phone</Label>
                  <Input 
                    value={editData.parent_phone || ''} 
                    onChange={(e) => setEditData({...editData, parent_phone: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Parent Email</Label>
                  <Input 
                    type="email"
                    value={editData.parent_email || ''} 
                    onChange={(e) => setEditData({...editData, parent_email: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <Input 
                    value={editData.address || ''} 
                    onChange={(e) => setEditData({...editData, address: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Previous School</Label>
                  <Input 
                    value={editData.previous_school || ''} 
                    onChange={(e) => setEditData({...editData, previous_school: e.target.value})}
                  />
                </div>
              </div>

              {selectedAdmission.documents?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAdmission.documents.map((doc, i) => (
                      <a 
                        key={i}
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200"
                      >
                        <FileText className="h-4 w-4" />
                        Document {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Admin Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add remarks..."
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => saveApplicationEdits()}
                >
                  Save Changes
                </Button>
                {!['Rejected', 'Converted'].includes(selectedAdmission.status) && (
                  <Button 
                    className="flex-1"
                    onClick={() => handleStatusChange(selectedAdmission, 'Verified')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" /> Verify
                  </Button>
                )}
                {selectedAdmission.status === 'Verified' && (
                    <Button 
                      className="flex-1"
                      onClick={() => handleStatusChange(selectedAdmission, 'Approved')}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Approve
                    </Button>
                  )}

                {!['Rejected', 'Converted'].includes(selectedAdmission.status) && (
                  <Button 
                    variant="destructive"
                    onClick={() => handleStatusChange(selectedAdmission, 'Rejected')}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}