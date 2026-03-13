import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, AlertCircle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function StaffApprovalPanel() {
  const [pendingStaff, setPendingStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);

  useEffect(() => {
    loadPendingStaff();
  }, []);

  const loadPendingStaff = async () => {
    try {
      setLoading(true);
      const records = await base44.entities.StaffAccount.filter({ status: 'pending' }, '-created_date');
      setPendingStaff(records || []);
    } catch (error) {
      console.error('Failed to load pending staff:', error);
      toast.error('Failed to load pending staff applications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (record) => {
    try {
      setActionLoading(record.id);

      // Call createStaffWithAutoId to generate staff_code
      const response = await base44.functions.invoke('createStaffWithAutoId', {
        staff_data: {
          name: record.name,
          role: record.role,
          designation: record.designation,
          mobile: record.mobile,
          email: record.email,
          qualification: record.qualification,
          username: record.username,
          password_hash: record.password_hash,
          is_active: true,
          status: 'active',
        }
      });

      if (response.data?.success && response.data?.staff_code) {
        // Update the existing record with generated staff_code and active status
        await base44.entities.StaffAccount.update(record.id, {
          staff_code: response.data.staff_code,
          status: 'active',
        });

        toast.success(`Staff approved! Staff ID: ${response.data.staff_code}`);
        loadPendingStaff();
      } else {
        toast.error('Failed to generate Staff ID');
      }
    } catch (error) {
      console.error('Approval failed:', error);
      toast.error(error.response?.data?.error || 'Failed to approve staff');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;

    try {
      setActionLoading(rejectDialog.id);
      await base44.entities.StaffAccount.update(rejectDialog.id, {
        status: 'rejected',
      });
      toast.success('Staff application rejected');
      setRejectDialog(null);
      loadPendingStaff();
    } catch (error) {
      console.error('Rejection failed:', error);
      toast.error('Failed to reject application');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (pendingStaff.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Staff Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No pending staff applications</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Staff Approvals
            <Badge variant="destructive" className="ml-2">{pendingStaff.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Designation</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Applied</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingStaff.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-2 text-sm">{record.name}</td>
                    <td className="py-3 px-2 text-sm">
                      <Badge variant="outline">{record.role || 'N/A'}</Badge>
                    </td>
                    <td className="py-3 px-2 text-sm">{record.designation || '-'}</td>
                    <td className="py-3 px-2 text-sm">{record.mobile || '-'}</td>
                    <td className="py-3 px-2 text-sm text-gray-500">
                      {new Date(record.created_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(record)}
                          disabled={actionLoading === record.id}
                        >
                          {actionLoading === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejectDialog(record)}
                          disabled={actionLoading === record.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Reject Staff Application
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to reject the application from <strong>{rejectDialog?.name}</strong>?
            This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <AlertDialogCancel onClick={() => setRejectDialog(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}