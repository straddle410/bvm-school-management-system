import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function StudentProgressSegmentation({
  submissions = [],
  assignedStudents = [],
}) {
  // Normalize status helper
  const normalizeStatus = (status) => {
    if (!status) return 'SUBMITTED';
    const normalized = String(status).trim().toUpperCase();
    const map = {
      'SUBMITTED': 'SUBMITTED',
      'RESUBMITTED': 'RESUBMITTED',
      'GRADED': 'GRADED',
      'REVISION_REQUIRED': 'REVISION_REQUIRED',
      'SUBMITTED': 'SUBMITTED',
      'GRADED': 'GRADED',
      'Submitted': 'SUBMITTED',
      'Graded': 'GRADED',
    };
    return map[normalized] || normalized;
  };

  // Create a map of student_id -> latest submission
  const submissionMap = new Map();
  submissions.forEach((sub) => {
    const key = sub.student_id;
    const current = submissionMap.get(key);
    if (!current || new Date(sub.submitted_at) > new Date(current.submitted_at)) {
      submissionMap.set(key, { ...sub, status: normalizeStatus(sub.status) });
    }
  });

  // Segment students by status
  const pendingStudents = assignedStudents.filter((s) => !submissionMap.has(s.student_id));
  const submittedAwaitingReview = Array.from(submissionMap.values()).filter(
    (s) => s.status === 'SUBMITTED' || s.status === 'RESUBMITTED'
  );
  const revisionRequired = Array.from(submissionMap.values()).filter((s) => s.status === 'REVISION_REQUIRED');
  const graded = Array.from(submissionMap.values()).filter((s) => s.status === 'GRADED');
  const late = Array.from(submissionMap.values()).filter((s) => s.is_late);

  const tabs = [
    { key: 'pending', label: 'Pending', count: pendingStudents.length, students: pendingStudents, icon: Clock },
    { key: 'submitted', label: 'Submitted/Review', count: submittedAwaitingReview.length, students: submittedAwaitingReview, icon: CheckCircle2 },
    { key: 'revision', label: 'Revision Required', count: revisionRequired.length, students: revisionRequired, icon: AlertCircle },
    { key: 'graded', label: 'Graded', count: graded.length, students: graded, icon: CheckCircle2 },
    { key: 'late', label: 'Late', count: late.length, students: late, icon: AlertCircle },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full gap-0 bg-gray-50 border-b border-gray-200 rounded-none p-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex-1 rounded-none border-r border-gray-200 last:border-r-0 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-indigo-600"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <Badge variant="secondary" className="ml-1">{tab.count}</Badge>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="p-4 space-y-2">
            {tab.students.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No students in this category</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tab.students.map((student) => {
                  const isSubmission = student.student_id !== undefined && submissions.some((s) => s.student_id === student.student_id);
                  return (
                    <div key={student.id || student.student_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{student.name || student.student_name || 'N/A'}</p>
                        <p className="text-xs text-gray-600">{student.student_id} • Class {student.class_name}</p>
                      </div>
                      {isSubmission && (
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-700">{student.status}</p>
                          {student.teacher_marks !== undefined && student.teacher_marks !== null && (
                            <p className="text-sm font-bold text-indigo-600">{student.teacher_marks} marks</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}