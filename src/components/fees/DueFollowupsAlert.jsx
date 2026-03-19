import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DueFollowupsAlert({ academicYear, onSelectStudent }) {
  const [showExpanded, setShowExpanded] = useState(false);

  const { data: dueFollowups = [], isLoading } = useQuery({
    queryKey: ['due-followups', academicYear],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get all follow-ups for this academic year
      const followUps = await base44.entities.StudentFollowUp.list();
      
      // Filter for due/overdue (next_followup_date <= today)
      const dueItems = followUps.filter(fu => {
        if (!fu.next_followup_date) return false;
        if (fu.academic_year !== academicYear) return false;
        return fu.next_followup_date <= today;
      });

      // Fetch student names for display
      const uniqueStudentIds = [...new Set(dueItems.map(f => f.student_id))];
      const studentMap = {};
      
      for (const id of uniqueStudentIds) {
        try {
          const students = await base44.entities.Student.filter({ student_id: id });
          if (students.length > 0) {
            studentMap[id] = students[0];
          }
        } catch {}
      }

      return dueItems.map(fu => ({
        ...fu,
        student: studentMap[fu.student_id] || { name: 'Unknown' }
      }));
    },
    refetchInterval: 60000 // Refresh every 60 seconds
  });

  if (isLoading || dueFollowups.length === 0) {
    return null;
  }

  const isOverdue = (date) => date < new Date().toISOString().split('T')[0];

  return (
    <Card className="border-l-4 border-l-orange-500 bg-orange-50 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-base text-orange-900">
            {dueFollowups.length} Follow-up(s) Due Today
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {!showExpanded ? (
          <button
            onClick={() => setShowExpanded(true)}
            className="text-sm text-orange-700 hover:text-orange-900 font-medium"
          >
            View {dueFollowups.length > 1 ? 'all' : ''} →
          </button>
        ) : (
          <div className="space-y-2">
            {dueFollowups.slice(0, 10).map((fu, idx) => (
              <div
                key={idx}
                onClick={() => onSelectStudent?.(fu.student_id)}
                className="flex items-center justify-between p-2 bg-white rounded hover:bg-orange-100 cursor-pointer transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fu.student?.name || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-600">{fu.student?.student_id || ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {isOverdue(fu.next_followup_date) && (
                    <Badge className="bg-red-100 text-red-800">OVERDUE</Badge>
                  )}
                  <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fu.next_followup_date}
                  </span>
                </div>
              </div>
            ))}
            {dueFollowups.length > 10 && (
              <p className="text-xs text-gray-600 text-center mt-2">
                +{dueFollowups.length - 10} more
              </p>
            )}
            <button
              onClick={() => setShowExpanded(false)}
              className="text-xs text-orange-700 hover:text-orange-900 mt-2"
            >
              Hide
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}