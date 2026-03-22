import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getStaffSession } from '@/components/useStaffSession';

export default function StaffDeletionRequestsTab() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => base44.entities.DeletionRequest.list('-requested_at'),
  });

  const staffRequests = requests.filter(r => r.account_type === 'staff');

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, rejection_reason, entity_db_id }) => {
      const session = getStaffSession();
      await base44.entities.DeletionRequest.update(id, {
        status,
        reviewed_by: session?.username || 'admin',
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejection_reason || null,
      });

      if (status === 'Approved' && entity_db_id) {
        await base44.entities.StaffAccount.update(entity_db_id, { is_active: false });
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries(['deletion-requests']);
      queryClient.invalidateQueries(['staff-accounts-rbac']);
      toast.success(status === 'Approved' ? 'Request approved — staff account deactivated' : 'Request rejected');
      setRejectingId(null);
      setRejectReason('');
    },
    onError: (err) => toast.error(err.message),
  });

  const statusBadge = (status) => {
    if (status === 'Pending') return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    if (status === 'Approved') return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400 text-sm">Loading requests...</div>;

  if (staffRequests.length === 0) {
    return (
      <div className="p-12 text-center">
        <Trash2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No staff deletion requests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {staffRequests.map((req) => (
        <div key={req.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{req.display_name || req.username}</p>
                {statusBadge(req.status)}
              </div>
              <p className="text-xs text-gray-500">@{req.username} · Staff</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1"><span className="font-medium">Reason:</span> {req.reason}</p>
              {req.additional_notes && (
                <p className="text-xs text-gray-500 mt-0.5 italic">"{req.additional_notes}"</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Requested: {req.requested_at ? new Date(req.requested_at).toLocaleString() : new Date(req.created_date).toLocaleString()}
              </p>
              {req.rejection_reason && (
                <p className="text-xs text-red-500 mt-1">Rejected: {req.rejection_reason}</p>
              )}
            </div>

            {req.status === 'Pending' && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-xs h-8"
                  disabled={reviewMutation.isPending}
                  onClick={() => {
                    if (!window.confirm(`Approve deletion for ${req.display_name || req.username}? Their staff account will be deactivated.`)) return;
                    reviewMutation.mutate({ id: req.id, status: 'Approved', entity_db_id: req.entity_db_id });
                  }}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
                {rejectingId === req.id ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-full"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => reviewMutation.mutate({ id: req.id, status: 'Rejected', rejection_reason: rejectReason, entity_db_id: req.entity_db_id })}
                        className="flex-1 bg-red-600 text-white rounded-lg py-1 text-xs font-semibold"
                      >Confirm</button>
                      <button onClick={() => setRejectingId(null)} className="flex-1 border border-gray-200 rounded-lg py-1 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-8"
                    onClick={() => setRejectingId(req.id)}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}