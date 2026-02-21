import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Eye, Lock, CheckCircle, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function HallTicketList({ examTypeId, classFilter }) {
  const { academicYear } = useAcademicYear();
  const [selected, setSelected] = useState([]);
  const queryClient = useQueryClient();

  const { data: hallTickets = [] } = useQuery({
    queryKey: ['hallTickets', examTypeId, classFilter, academicYear],
    queryFn: async () => {
      const query = { academic_year: academicYear, status: { $ne: 'Draft' } };
      if (examTypeId) query.exam_type = examTypeId;
      if (classFilter) query.class_name = classFilter;
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

  const downloadPDF = async () => {
    if (selected.length === 0) {
      toast.error('Please select hall tickets');
      return;
    }

    try {
      const staffSession = localStorage.getItem('staff_session');
      const payload = { hallTicketIds: selected };
      if (staffSession) {
        payload.staffSession = staffSession;
      }
      const res = await base44.functions.invoke('generateHallTicketPDF', payload);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hall_tickets.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Hall Tickets</CardTitle>
        <div className="flex gap-2">
          <Button onClick={downloadPDF} disabled={selected.length === 0} className="gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          <Button onClick={() => approveMutation.mutate(selected)} disabled={selected.length === 0} className="gap-2 bg-green-600">
            <Lock className="w-4 h-4" /> Approve & Lock
          </Button>
          <Button onClick={() => {
            if (confirm('Delete selected hall tickets? This cannot be undone.')) {
              deleteMutation.mutate(selected);
            }
          }} disabled={selected.length === 0} className="gap-2 bg-red-600 hover:bg-red-700">
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
                      ticket.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="p-2 flex gap-1">
                    <Button size="icon" variant="ghost" className="text-blue-600">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}