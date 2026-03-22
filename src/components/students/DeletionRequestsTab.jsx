import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { getStaffSession } from '@/components/useStaffSession';

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

export default function DeletionRequestsTab() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => base44.entities.DeletionRequest.list('-created_date'),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, rejection_reason, account_id, account_type }) => {
      const session = getStaffSession();
      const now = new Date().toISOString();

      await base44.entities.DeletionRequest.update(id, {
        status,
        reviewed_by: session?.username || session?.name || 'admin',
        reviewed_at: now,
        rejection_reason: rejection_reason || null,
      });

      // If approved → soft delete the account
      if (status === 'Approved' && account_id) {
        if (account_type === 'student') {
          await base44.functions.invoke('softDeleteStudent', {
            student_id: account_id,
            action: 'delete',
            staff_session_token: session?.staff_session_token || null,
          });
        } else if (account_type === 'staff') {
          await base44.entities.StaffAccount.update(account_id, { is_active: false });
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries(['deletion-requests']);
      queryClient.invalidateQueries(['students']);
      queryClient.invalidateQueries(['staff-accounts-rbac']);
      toast.success(vars.status === 'Approved' ? 'Account deleted successfully' : 'Request rejected');
      setRejectingId(null);
      setRejectionReason('');
    },
    onError: (err) => toast.error(err.message || 'Action failed'),
  });

  const handleApprove = (req) => {
    if (!window.confirm(`Approve deletion of ${req.full_name}'s account? This will deactivate their account.`)) return;
    reviewMutation.mutate({ id: req.id, status: 'Approved', account_id: req.account_id, account_type: req.account_type });
  };

  const handleReject = (req) => {
    if (!rejectionReason.trim()) { toast.error('Please enter a rejection reason'); return; }
    reviewMutation.mutate({ id: req.id, status: 'Rejected', rejection_reason: rejectionReason, account_id: req.account_id, account_type: req.account_type });
  };

  const pending = requests.filter(r => r.status === 'Pending');
  const reviewed = requests.filter(r => r.status !== 'Pending');

  if (isLoading) {
    return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-sm">
        <UserX className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No deletion requests yet.</p>
      </div>
    );
  }

  const RequestCard = ({ req }) => (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{req.full_name}</p>
            <Badge className={statusColors[req.status]}>{req.status}</Badge>
            <Badge variant="outline" className="capitalize text-xs">{req.account_type}</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">@{req.username}</p>
        </div>
        <p className="text-xs text-gray-400 flex-shrink-0">{new Date(req.created_date).toLocaleDateString()}</p>
      </div>

      <div className="text-xs bg-gray-50 rounded-lg p-2">
        <span className="font-medium text-gray-600">Reason: </span>
        <span className="text-gray-700">{req.reason}</span>
        {req.additional_notes && (
          <p className="text-gray-500 mt-1">{req.additional_notes}</p>
        )}
      </div>

      {req.status === 'Rejected' && req.rejection_reason && (
        <div className="text-xs bg-red-50 rounded-lg p-2 text-red-700">
          <span className="font-medium">Rejection reason: </span>{req.rejection_reason}
        </div>
      )}

      {req.status === 'Pending' && (
        <>
          {rejectingId === req.id ? (
            <div className="space-y-2">
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectionReason(''); }} className="flex-1 text-xs h-8">
                  Cancel
                </Button>
                <Button size="sm" onClick={() => handleReject(req)} disabled={reviewMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700 text-xs h-8">
                  Confirm Reject
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleApprove(req)} disabled={reviewMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700 text-xs h-8">
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve & Delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectingId(req.id)} className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-xs h-8">
                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </div>
          )}
        </>
      )}

      {req.status !== 'Pending' && req.reviewed_by && (
        <p className="text-xs text-gray-400">
          Reviewed by {req.reviewed_by} · {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : ''}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-yellow-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Pending Requests ({pending.length})</h3>
          </div>
          <div className="space-y-2">
            {pending.map(req => <RequestCard key={req.id} req={req} />)}
          </div>
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-600 text-sm mb-3">Reviewed ({reviewed.length})</h3>
          <div className="space-y-2">
            {reviewed.map(req => <RequestCard key={req.id} req={req} />)}
          </div>
        </div>
      )}
    </div>
  );
}