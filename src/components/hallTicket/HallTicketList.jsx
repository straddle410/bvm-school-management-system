import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Lock, Printer } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import HallTicketPreviewModal from './HallTicketPreviewModal';
import { printHallTickets } from './PrintHallTickets';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function HallTicketList() {
  const { academicYear } = useAcademicYear();
  const [selected, setSelected] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterExamType, setFilterExamType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [previewTicket, setPreviewTicket] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const queryClient = useQueryClient();

  const { data: schoolProfile } = useQuery({
    queryKey: ['schoolProfile'],
    queryFn: async () => { const p = await base44.entities.SchoolProfile.list(); return p[0] || null; }
  });

  const { data: examTypes = [] } = useQuery({
   queryKey: ['examTypes', academicYear],
   queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const { data: hallTickets = [] } = useQuery({
    queryKey: ['hallTickets', filterExamType, filterClass, filterStatus, academicYear],
    queryFn: async () => {
      const query = { academic_year: academicYear, status: { $ne: 'Draft' } };
      if (filterExamType) query.exam_type = filterExamType;
      if (filterClass) query.class_name = filterClass;
      if (filterStatus) query.status = filterStatus;
      return base44.entities.HallTicket.filter(query, '-created_date');
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (ticketIds) => {
      for (const id of ticketIds) {
        await base44.entities.HallTicket.update(id, { status: 'Approved', is_locked: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hallTickets'] });
      setSelected([]);
      toast.success('Hall tickets approved and locked');
    }
  });

  const publishMutation = useMutation({
    mutationFn: async (ticketIds) => {
      const res = await base44.functions.invoke('publishHallTickets', {
        ticketIds,
        academicYear
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hallTickets'] });
      setSelected([]);
      toast.success(`Published ${data.count} hall tickets. Notifications sent to students.`);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || error.message;
      toast.error(errorMsg);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ticketIds) => {
      for (const id of ticketIds) {
        await base44.entities.HallTicket.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hallTickets'] });
      setSelected([]);
      toast.success('Hall tickets deleted');
    }
  });

  const handleBulkPrint = async () => {
    const ticketsToPrint = hallTickets.filter(t => selected.includes(t.id));
    if (!ticketsToPrint.length) { toast.error('No tickets selected to print'); return; }
    setIsPrinting(true);
    toast.info(`Fetching timetables for ${ticketsToPrint.length} ticket(s)...`);
    try {
      // Group by class + exam_type to minimize queries
      const groups = {};
      for (const t of ticketsToPrint) {
        const key = `${t.exam_type}__${t.class_name}__${t.academic_year}`;
        if (!groups[key]) groups[key] = { exam_type: t.exam_type, class_name: t.class_name, academic_year: t.academic_year, tickets: [] };
        groups[key].tickets.push(t);
      }
      const timetableMap = {};
      await Promise.all(Object.values(groups).map(async (g) => {
        const tt = await base44.entities.ExamTimetable.filter(
          { exam_type: g.exam_type, class_name: g.class_name, academic_year: g.academic_year },
          'exam_date'
        );
        for (const t of g.tickets) timetableMap[t.id] = tt;
      }));
      const examTypesMap = {};
      for (const et of examTypes) examTypesMap[et.id] = et.name;
      printHallTickets(ticketsToPrint, timetableMap, schoolProfile, examTypesMap);
    } catch (e) {
      toast.error('Failed to fetch timetables: ' + e.message);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-row justify-between items-center flex-wrap gap-2">
            <CardTitle>Hall Tickets ({hallTickets.length})</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => approveMutation.mutate(selected)} disabled={selected.length === 0 || approveMutation.isPending} className="gap-2 bg-green-600" size="sm">
                <Lock className="w-4 h-4" /> Approve & Lock ({selected.length})
              </Button>
              <Button onClick={() => {
                if (confirm('Delete selected hall tickets? This cannot be undone.')) {
                  deleteMutation.mutate(selected);
                }
              }} disabled={selected.length === 0 || deleteMutation.isPending} className="gap-2 bg-red-600 hover:bg-red-700" size="sm">
                Delete ({selected.length})
              </Button>
            </div>
          </div>
          {/* Print Selected Row */}
          <div className="flex items-center gap-2 flex-wrap bg-blue-50 rounded-lg p-2 border border-blue-100">
            <Printer className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-blue-800 font-medium">
              {selected.length > 0 ? `${selected.length} ticket(s) selected` : 'Select tickets to print'}
            </span>
            <Button
              size="sm"
              onClick={handleBulkPrint}
              disabled={isPrinting || selected.length === 0}
              className="gap-2 bg-blue-600 hover:bg-blue-700 ml-auto"
            >
              <Printer className="w-4 h-4" />
              {isPrinting ? 'Preparing...' : `Print Selected (${selected.length})`}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={filterClass}
              onChange={e => { setFilterClass(e.target.value); setSelected([]); }}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Classes</option>
              {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select
              value={filterExamType}
              onChange={e => { setFilterExamType(e.target.value); setSelected([]); }}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Exam Types</option>
              {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setSelected([]); }}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Statuses</option>
              <option value="Generated">Generated</option>
              <option value="Approved">Approved</option>
              <option value="Published">Published</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 text-left">
                    <Checkbox
                      checked={selected.length === hallTickets.length && hallTickets.length > 0}
                      onCheckedChange={(checked) => setSelected(checked ? hallTickets.map(t => t.id) : [])}
                    />
                  </th>
                  <th className="p-2 text-left">Hall Ticket No</th>
                  <th className="p-2 text-left">Student Name</th>
                  <th className="p-2 text-left">Roll No</th>
                  <th className="p-2 text-left">Class</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {hallTickets.map(ticket => (
                  <tr key={ticket.id} className="border-b hover:bg-slate-50">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.includes(ticket.id)}
                        onCheckedChange={(checked) => {
                          setSelected(checked ? [...selected, ticket.id] : selected.filter(id => id !== ticket.id));
                        }}
                      />
                    </td>
                    <td className="p-2 font-semibold">{ticket.hall_ticket_number}</td>
                    <td className="p-2">{ticket.student_name}</td>
                    <td className="p-2">{ticket.roll_number}</td>
                    <td className="p-2">{ticket.class_name}-{ticket.section}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        ticket.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        ticket.status === 'Published' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="p-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        onClick={() => setPreviewTicket(ticket)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {hallTickets.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-400">No hall tickets found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {previewTicket && (
        <HallTicketPreviewModal
          ticket={previewTicket}
          onClose={() => setPreviewTicket(null)}
        />
      )}
    </>
  );
}