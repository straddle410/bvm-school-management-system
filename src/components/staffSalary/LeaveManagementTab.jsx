import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

const STATUS_STYLES = {
  Pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Approved: 'bg-green-50 text-green-700 border-green-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
};

const PAY_STYLES = {
  Paid: 'bg-blue-50 text-blue-700 border-blue-200',
  Unpaid: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function LeaveManagementTab({ academicYear }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('Pending');
  const [remarkModal, setRemarkModal] = useState(null); // { leave, action }
  const [remark, setRemark] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadLeaves = async () => {
    setLoading(true);
    const all = await base44.entities.StaffLeave.filter({ academic_year: academicYear });
    all.sort((a, b) => b.created_date?.localeCompare(a.created_date));
    setLeaves(all);
    setLoading(false);
  };

  useEffect(() => { loadLeaves(); }, [academicYear]);

  const handleAction = async () => {
    if (!remarkModal) return;
    const { leave, action } = remarkModal;
    setProcessing(true);
    const admin = await base44.auth.me().catch(() => null);
    await base44.entities.StaffLeave.update(leave.id, {
      status: action === 'approve' ? 'Approved' : 'Rejected',
      reviewed_by: admin?.email || '',
      review_remarks: remark,
      reviewed_at: new Date().toISOString(),
    });

    // If approved, update the StaffAttendance records in that range to "Leave"
    if (action === 'approve') {
      const from = moment(leave.from_date);
      const to = moment(leave.to_date);
      for (let d = from.clone(); d.isSameOrBefore(to, 'day'); d.add(1, 'day')) {
        const dateStr = d.format('YYYY-MM-DD');
        const existing = await base44.entities.StaffAttendance.filter({
          staff_id: leave.staff_id,
          date: dateStr,
          academic_year: academicYear,
        });
        if (existing.length > 0) {
          await base44.entities.StaffAttendance.update(existing[0].id, { status: 'Leave', remarks: `Leave approved: ${leave.reason}` });
        } else {
          await base44.entities.StaffAttendance.create({
            staff_id: leave.staff_id,
            staff_name: leave.staff_name,
            date: dateStr,
            status: 'Leave',
            academic_year: academicYear,
            marked_by: admin?.email || 'ADMIN',
            remarks: `Leave approved: ${leave.reason}`,
          });
        }
      }
    }

    toast.success(`Leave ${action === 'approve' ? 'Approved' : 'Rejected'}`);
    setRemarkModal(null);
    setRemark('');
    setProcessing(false);
    loadLeaves();
  };

  const filtered = leaves.filter(l => filterStatus === 'All' || l.status === filterStatus);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['Pending', 'Approved', 'Rejected', 'All'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterStatus === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>
            {s} {s !== 'All' && <span className="ml-1 text-xs opacity-70">({leaves.filter(l => l.status === s).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {filterStatus.toLowerCase()} leave requests.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(leave => (
            <div key={leave.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white">{leave.staff_name}</span>
                    {leave.designation && <span className="text-xs text-gray-400">· {leave.designation}</span>}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {moment(leave.from_date).format('MMM D')} → {moment(leave.to_date).format('MMM D, YYYY')} · {leave.days} day(s)
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{leave.leave_type}: {leave.reason}</div>
                  {leave.review_remarks && (
                    <div className="text-xs text-gray-400 mt-1 italic">Remark: {leave.review_remarks}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[leave.status]}`}>{leave.status}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAY_STYLES[leave.pay_type]}`}>{leave.pay_type} Leave</span>
                </div>
              </div>
              {leave.status === 'Pending' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1"
                    onClick={() => { setRemarkModal({ leave, action: 'approve' }); setRemark(''); }}>
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 gap-1"
                    onClick={() => { setRemarkModal({ leave, action: 'reject' }); setRemark(''); }}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {remarkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
              {remarkModal.action === 'approve' ? '✅ Approve Leave' : '❌ Reject Leave'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {remarkModal.leave.staff_name} · {remarkModal.leave.days} day(s) · {remarkModal.leave.pay_type} Leave
            </p>
            <textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="Optional remark..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRemarkModal(null)}>Cancel</Button>
              <Button
                onClick={handleAction} disabled={processing}
                className={remarkModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (remarkModal.action === 'approve' ? 'Approve' : 'Reject')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}