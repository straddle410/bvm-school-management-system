import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowUpCircle, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";

const CLASS_ORDER = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function getNextClass(currentClass) {
  const idx = CLASS_ORDER.indexOf(currentClass);
  if (idx === -1 || idx === CLASS_ORDER.length - 1) return null; // Class 10 → passed out
  return CLASS_ORDER[idx + 1];
}

function getNextAcademicYear(currentYear) {
  // e.g. "2025-26" → "2026-27"
  const match = currentYear.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const startYear = parseInt(match[1]) + 1;
  const endYear = (startYear + 1).toString().slice(2);
  return `${startYear}-${endYear}`;
}

export default function PromoteStudents({ academicYear, onPromoted }) {
  const [open, setOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [result, setResult] = useState(null);

  const nextYear = getNextAcademicYear(academicYear);

  const handlePromote = async () => {
    setPromoting(true);
    setResult(null);

    try {
      // 1. Fetch all active students in current year
      const students = await base44.entities.Student.filter({ academic_year: academicYear });
      const activeStudents = students.filter(s => !['Passed Out', 'Transferred'].includes(s.status));

      // 2. Check if next academic year exists, if not create it
      const allYears = await base44.entities.AcademicYear.list();
      let nextYearRecord = allYears.find(y => y.year === nextYear);

      if (!nextYearRecord) {
        // Auto-create next year
        const currentYearRecord = allYears.find(y => y.year === academicYear);
        const startDate = currentYearRecord?.end_date
          ? new Date(new Date(currentYearRecord.end_date).getTime() + 86400000).toISOString().split('T')[0]
          : `${parseInt(academicYear.split('-')[0]) + 1}-04-01`;
        const endDate = `${parseInt(academicYear.split('-')[0]) + 2}-03-31`;

        nextYearRecord = await base44.entities.AcademicYear.create({
          year: nextYear,
          start_date: startDate,
          end_date: endDate,
          is_current: false,
          is_locked: false,
          status: 'Active'
        });
      }

      // 3. Mark next year as current, unset old
      await Promise.all(allYears.map(y =>
        base44.entities.AcademicYear.update(y.id, { is_current: false })
      ));
      await base44.entities.AcademicYear.update(nextYearRecord.id, { is_current: true });

      // 4. Promote each student
      let promoted = 0, passedOut = 0;
      await Promise.all(activeStudents.map(async (student) => {
        const nextClass = getNextClass(student.class_name);
        if (nextClass) {
          await base44.entities.Student.update(student.id, {
            class_name: nextClass,
            academic_year: nextYear,
            status: 'Approved'
          });
          promoted++;
        } else {
          // Class 10 students pass out
          await base44.entities.Student.update(student.id, {
            academic_year: nextYear,
            status: 'Passed Out'
          });
          passedOut++;
        }
      }));

      setResult({ promoted, passedOut, nextYear });
      toast.success(`${promoted} students promoted to ${nextYear}`);
      if (onPromoted) onPromoted(nextYear);
    } catch (err) {
      toast.error('Promotion failed: ' + err.message);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        <ArrowUpCircle className="mr-2 h-4 w-4" />
        Promote Students
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!promoting) { setOpen(v); if (!v) setResult(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote All Students</DialogTitle>
            <DialogDescription>
              This will move all students from <strong>{academicYear}</strong> to <strong>{nextYear}</strong> and advance each student to the next class.
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Before you proceed:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>All students in <strong>{academicYear}</strong> will move to <strong>{nextYear}</strong></li>
                    <li>Each student's class will be advanced by one (e.g. Class 5 → Class 6)</li>
                    <li>Class 10 students will be marked as <strong>Passed Out</strong></li>
                    <li>Next academic year <strong>{nextYear}</strong> will be auto-created if not existing</li>
                    <li>You can still view previous year data by switching the year in the header</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={promoting}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {promoting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Promoting...</>
                  ) : (
                    <><ArrowUpCircle className="mr-2 h-4 w-4" /> Confirm Promote</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-lg font-bold text-green-800">Promotion Complete!</p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-green-700">{result.promoted}</p>
                    <p className="text-sm text-slate-500">Students Promoted</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-slate-600">{result.passedOut}</p>
                    <p className="text-sm text-slate-500">Passed Out</p>
                  </div>
                </div>
                <p className="text-sm text-green-700">Current year is now <strong>{result.nextYear}</strong></p>
              </div>
              <Button className="w-full" onClick={() => { setOpen(false); setResult(null); }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}