import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import MarksTable from './MarksTable';
import MobileMarksEntry from './MobileMarksEntry';
import VirtualMarksTable from './VirtualMarksTable';
import VirtualMobileMarksEntry from './VirtualMobileMarksEntry';
import MarksImportExport from './MarksImportExport';
import StatusBadge from '@/components/ui/StatusBadge';

export default function MarksEntrySection({
  selectedExam,
  maxMarks,
  passingMarks,
  currentStatus,
  filteredStudents,
  subjectList,
  marksData,
  canEdit,
  isLocked,
  isPublished,
  isAdmin,
  isSubmitted,
  onMarkChange,
  onImport,
  onAddSubject,
  onRevoke,
  onUnlock,
  unlockPending,
  selectedExamType,
  selectedClass,
  selectedSection
}) {
  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-semibold text-base">{selectedExam}</h3>
                <p className="text-xs text-slate-500">
                  Max Marks: <span className="font-semibold">{maxMarks}</span> | 
                  Pass: <span className="font-semibold">{passingMarks}</span>
                </p>
              </div>
              <StatusBadge status={currentStatus} />
            </div>
            <MarksImportExport
              students={filteredStudents}
              subjects={subjectList}
              marksData={marksData}
              onImport={onImport}
              examInfo={{ exam: selectedExam }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Subject Columns</h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={onAddSubject}
            >
              <Plus className="h-4 w-4" />
              Add Subject
            </Button>
          </div>

          {isPublished && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-900 flex items-center gap-2">
                  🔒 Marks Published
                </p>
                <p className="text-xs text-red-700 mt-1">Published marks cannot be edited. Admin must revoke publication first.</p>
              </div>
              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onRevoke(selectedExamType?.id || selectedExam)}
                  className="whitespace-nowrap"
                >
                  Revoke Publication
                </Button>
              )}
            </div>
          )}

          {isSubmitted && !isPublished && !isAdmin && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-center">
              <p className="text-sm font-medium text-blue-900">✓ Marks Submitted</p>
              <p className="text-xs text-blue-700 mt-1">Editing is not allowed for submitted marks</p>
            </div>
          )}

          {isSubmitted && !isPublished && isAdmin && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-900">✓ Marks Submitted</p>
                <p className="text-xs text-amber-700 mt-1">These marks are locked. Click unlock to allow editing.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onUnlock}
                disabled={unlockPending}
                className="whitespace-nowrap"
              >
                {unlockPending ? 'Unlocking...' : 'Unlock for Editing'}
              </Button>
            </div>
          )}

          <div className="hidden md:block">
            <MarksTable
              students={filteredStudents}
              subjects={subjectList}
              marksData={marksData}
              onMarkChange={canEdit ? onMarkChange : undefined}
              maxMarks={maxMarks}
              passingMarks={passingMarks}
              isLocked={isLocked}
            />
          </div>
          <div className="md:hidden">
            <MobileMarksEntry
              students={filteredStudents}
              subjects={subjectList}
              marksData={marksData}
              onMarkChange={canEdit ? onMarkChange : undefined}
              maxMarks={maxMarks}
              passingMarks={passingMarks}
              isLocked={isLocked}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}