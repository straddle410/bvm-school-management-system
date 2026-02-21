import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import { Printer, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function StudentHallTicketView() {
  const [studentSession, setStudentSession] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);

  useEffect(() => {
    const ss = localStorage.getItem('student_session');
    if (ss) {
      setStudentSession(JSON.parse(ss));
      loadSchoolProfile();
    }
  }, []);

  const loadSchoolProfile = async () => {
    try {
      const profiles = await base44.entities.SchoolProfile.list();
      if (profiles.length > 0) setSchoolProfile(profiles[0]);
    } catch (e) {
      console.error('Failed to load school profile');
    }
  };

  const { data: hallTickets = [] } = useQuery({
    queryKey: ['studentHallTickets', studentSession?.id],
    queryFn: async () => {
      try {
        const query = { status: 'Published' };
        if (studentSession?.id) query.student_id = studentSession.id;
        if (studentSession?.student_id) query.student_id = studentSession.student_id;
        const result = await base44.entities.HallTicket.filter(query);
        console.log('Hall tickets found:', result);
        return result;
      } catch (error) {
        console.error('Hall ticket fetch error:', error);
        return [];
      }
    },
    enabled: !!studentSession
  });

  if (!studentSession) {
    return <div className="p-6 text-center text-slate-600">Please log in first</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <PageHeader title="My Hall Tickets" />

      <div className="mt-6 grid gap-4">
        {hallTickets.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-slate-600">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
              <p>No hall tickets published yet</p>
            </CardContent>
          </Card>
        ) : (
          hallTickets.map(ticket => (
            <Card key={ticket.id} className="overflow-hidden">
              <CardHeader className="bg-slate-50">
                <CardTitle className="text-lg">
                  {ticket.exam_type} - {ticket.student_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600 font-semibold">Hall Ticket No</p>
                    <p className="text-lg font-bold text-blue-600">{ticket.hall_ticket_number}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-semibold">Roll No</p>
                    <p className="text-lg">{ticket.roll_number}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-semibold">Class</p>
                    <p className="text-lg">{ticket.class_name}-{ticket.section}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-semibold">Status</p>
                    <p className="text-lg text-green-600 font-semibold">Published</p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Download and print your hall ticket from your browser's print function for authorized access.
                  </p>
                </div>

                <Button
                  onClick={() => window.print()}
                  className="gap-2 w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="w-4 h-4" /> Print Hall Ticket
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}