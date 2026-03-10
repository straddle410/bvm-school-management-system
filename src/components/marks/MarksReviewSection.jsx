import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Download, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from '@/components/ui/StatusBadge';

export default function MarksReviewSection({
  reviewGroupedData,
  reviewSortBy,
  onSortChange,
  onPublish,
  onDownloadExcel,
  publishPending
}) {
  if (reviewGroupedData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-16 text-center">
          <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700">No marks to review</h3>
          <p className="text-slate-500 mt-2">No submitted marks for this class and section</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviewGroupedData.map((group, idx) => {
         const allMarkIds = group.students.flatMap(s => 
           Object.values(s.subjects).map(m => m.id)
         );
         const firstMark = group.students.length > 0 && Object.values(group.students[0].subjects).length > 0 ? Object.values(group.students[0].subjects)[0] : null;
         const isPublished = firstMark?.status === 'Published';
         const isSubmitted = firstMark?.status === 'Submitted';

         console.log('[PUB_REVIEW_DATA] Group:', { exam_type: group.exam_type, exam_name: group.exam_name, studentCount: group.students.length, markIdCount: allMarkIds.length, firstMarkId: allMarkIds[0], firstMarkStatus: firstMark?.status });

        return (
          <Card key={idx} className="border-0 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-4 py-3">
              <h3 className="text-white font-semibold flex items-center justify-between">
                <span>{group.exam_name || group.exam_type}</span>
                <span className="text-sm">({group.students.length} students)</span>
              </h3>
            </div>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={reviewSortBy === 'rank' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSortChange('rank')}
                >
                  Sort by Rank
                </Button>
                <Button
                  variant={reviewSortBy === 'name' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSortChange('name')}
                >
                  Sort by Name
                </Button>
                <Button
                  variant={reviewSortBy === 'total' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSortChange('total')}
                >
                  Sort by Total
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-center p-2 font-semibold text-slate-700 w-16">Roll No</th>
                      <th className="text-left p-2 font-semibold text-slate-700 w-16">Rank</th>
                      <th className="text-left p-2 font-semibold text-slate-700 min-w-40">Student Name</th>
                      {group.subjects.map(subject => (
                        <th key={subject} className="text-center p-2 font-semibold text-slate-700 min-w-24">
                          {subject}
                        </th>
                      ))}
                      <th className="text-center p-2 font-semibold text-slate-700 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let sorted = [...group.students];
                      if (reviewSortBy === 'name') {
                        sorted.sort((a, b) => a.student_name.localeCompare(b.student_name));
                      } else if (reviewSortBy === 'total') {
                        sorted.sort((a, b) => b.total - a.total);
                      }
                      return sorted.map((student) => (
                        <tr key={student.student_id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="text-center p-2 text-slate-700">{student.roll_no || '-'}</td>
                          <td className="p-2 font-semibold text-slate-700">{student.rank}</td>
                          <td className="p-2">{student.student_name}</td>
                          {group.subjects.map(subject => {
                            const mark = student.subjects[subject];
                            return (
                              <td key={subject} className="text-center p-2">
                                {mark ? mark.marks_obtained : '-'}
                              </td>
                            );
                          })}
                          <td className="text-center p-2 font-semibold text-slate-700">{student.total}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 items-center">
                {isPublished ? (
                  <StatusBadge status="Published" />
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDownloadExcel(group.exam_type)}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export to Excel
                    </Button>
                    <Button
                       onClick={() => { console.log('[REVIEW_SECTION] Publish clicked - allMarkIds:', allMarkIds); onPublish(allMarkIds); }}
                       disabled={publishPending || !isSubmitted}
                       className="bg-green-600 hover:bg-green-700 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                       size="sm"
                       title={!isSubmitted ? 'Marks must be submitted before publishing' : ''}
                     >
                       <Check className="h-4 w-4" />
                       {publishPending ? 'Publishing...' : 'Publish Results'}
                     </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}