import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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

export default function Admissions() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
    // Clear pending applications badge when page opens
    queryClient.invalidateQueries(['pending-admissions-count']);
  }, [queryClient]);

  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['admissions'],
    queryFn: () => base44.entities.AdmissionApplication.list('-created_date')
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

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids) => {
      const now = new Date().toISOString();
      const updatePromises = Array.from(ids).map(id => 
        base44.entities.AdmissionApplication.update(id, { 
          status: 'Approved',
          approved_by: user?.email,
          approved_at: now
        })
      );
      await Promise.all(updatePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admissions']);
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} application(s) approved`);
    }
  });

  const convertToStudentMutation = useMutation({
    mutationFn: async (admission) => {
      // Create student record
      await base44.entities.Student.create({
        name: admission.student_name,
        class_name: admission.applying_for_class,
        section: 'A',
        photo_url: admission.photo_url,
        parent_name: admission.parent_name,
        parent_phone: admission.parent_phone,
        parent_email: admission.parent_email,
        dob: admission.dob,
        gender: admission.gender,
        address: admission.address,
        academic_year: admission.academic_year || '2024-25',
        admission_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pending'
      });
      // Update admission status
      await base44.entities.AdmissionApplication.update(admission.id, { status: 'Converted' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admissions']);
      queryClient.invalidateQueries(['students']);
      setShowDetailsSheet(false);
      toast.success('Admission converted to student record');
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
    if (showDetailsSheet) setShowDetailsSheet(false);
  };

  const viewDetails = (admission) => {
    setSelectedAdmission(admission);
    setRemarks(admission.remarks || '');
    setShowDetailsSheet(true);
  };

  const filteredAdmissions = admissions.filter(a => {
    const matchesSearch = a.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         a.application_no?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: (
        <input 
          type="checkbox" 
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(new Set(filteredAdmissions.map(a => a.id)));
            } else {
              setSelectedIds(new Set());
            }
          }}
          checked={selectedIds.size === filteredAdmissions.length && filteredAdmissions.length > 0}
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
            {row.status && !['Approved', 'Rejected', 'Converted'].includes(row.status) && (
              <DropdownMenuItem onClick={() => handleStatusChange(row, 'Approved')}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Approve
              </DropdownMenuItem>
            )}
            {row.status === 'Approved' && (
              <DropdownMenuItem onClick={() => convertToStudentMutation.mutate(row)}>
                <UserPlus className="mr-2 h-4 w-4 text-indigo-600" /> Convert to Student
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

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Admissions"
        subtitle={`${filteredAdmissions.length} applications`}
        actions={
          <Link to={createPageUrl('PublicAdmission')} target="_blank">
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" /> View Public Form
            </Button>
          </Link>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {['Submitted', 'Under Review', 'Verified', 'Approved', 'Converted'].map(status => (
            <Card 
              key={status} 
              className={`border-0 shadow-sm p-4 cursor-pointer transition-all ${
                filterStatus === status ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            >
              <p className="text-sm text-slate-500">{status}</p>
              <p className="text-2xl font-bold mt-1">
                {admissions.filter(a => a.status === status).length}
              </p>
            </Card>
          ))}
        </div>

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
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Verified">Verified</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Converted">Converted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">{selectedIds.size} selected</span>
                  <Button
                    size="sm"
                    onClick={() => bulkApproveMutation.mutate(selectedIds)}
                    disabled={bulkApproveMutation.isPending}
                    className="ml-auto"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {bulkApproveMutation.isPending ? 'Approving...' : 'Bulk Approve'}
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
          data={filteredAdmissions}
          loading={isLoading}
          emptyMessage="No admission applications yet"
        />
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
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500">Date of Birth</p>
                  <p className="font-semibold">{selectedAdmission.dob || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500">Gender</p>
                  <p className="font-semibold">{selectedAdmission.gender}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl col-span-2">
                  <p className="text-sm text-slate-500">Parent/Guardian</p>
                  <p className="font-semibold">{selectedAdmission.parent_name}</p>
                  <p className="text-sm text-slate-600">{selectedAdmission.parent_phone}</p>
                  <p className="text-sm text-slate-600">{selectedAdmission.parent_email}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl col-span-2">
                  <p className="text-sm text-slate-500">Address</p>
                  <p className="font-semibold">{selectedAdmission.address || '-'}</p>
                </div>
                {selectedAdmission.previous_school && (
                  <div className="p-4 bg-slate-50 rounded-xl col-span-2">
                    <p className="text-sm text-slate-500">Previous School</p>
                    <p className="font-semibold">{selectedAdmission.previous_school}</p>
                  </div>
                )}
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
                {['Submitted', 'Under Review'].includes(selectedAdmission.status) && (
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
                {selectedAdmission.status === 'Approved' && (
                  <Button 
                    className="flex-1"
                    onClick={() => convertToStudentMutation.mutate(selectedAdmission)}
                    disabled={convertToStudentMutation.isPending}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {convertToStudentMutation.isPending ? 'Converting...' : 'Convert to Student'}
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