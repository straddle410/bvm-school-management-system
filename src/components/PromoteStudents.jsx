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
  const [blockedYear, setBlockedYear] = useState(null); // non-null = blocked dialog

  const nextYear = getNextAcademicYear(academicYear);

  const handleOpenDialog = async () => {
    // Pre-check: does next academic year exist?
    const allYears = await base44.entities.AcademicYear.list();
    const nextYearRecord = allYears.find(y => y.year === nextYear);
    if (!nextYearRecord) {
      // Log the block
      await base44.entities.AuditLog.create({
        action: 'PROMOTION_BLOCKED',
        module: 'Student',
        performed_by: 'admin',
        details: `Promotion blocked: Academic year ${nextYear} not found in system.`,
        academic_year: academicYear,
      });
      setBlockedYear(nextYear);
      return;
    }
    setOpen(true);
  };

  const handlePromote = async () => {
    setPromoting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('promoteStudents', { academicYear });
      const data = res.data;

      if (data.blocked) {
        setOpen(false);
        setBlockedYear(data.nextYear);
        return;
      }

      setResult(data);
      toast.success(`${data.promoted} students promoted to ${data.nextYear}`);
      if (onPromoted) onPromoted(data.nextYear);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message;
      toast.error('Promotion failed: ' + msg);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleOpenDialog}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        <ArrowUpCircle className="mr-2 h-4 w-4" />
        Promote Students
      </Button>

      {/* BLOCKED: Next year not found */}
      <Dialog open={!!blockedYear} onOpenChange={(v) => { if (!v) setBlockedYear(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Promotion Blocked
            </DialogTitle>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 space-y-2">
            <p className="font-semibold">Academic Year <strong>{blockedYear}</strong> is not created.</p>
            <p>Please create it in <strong>Settings → Academic Years</strong> before promoting students.</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setBlockedYear(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRM: Normal promotion */}
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
                    <li>Only <strong>Published</strong> students in <strong>{academicYear}</strong> will be promoted</li>
                    <li>A <strong>new record</strong> is created in <strong>{nextYear}</strong> — old records are preserved</li>
                    <li>Each student's class will be advanced by one (e.g. Class 5 → Class 6)</li>
                    <li>Class 10 students will be marked as <strong>Passed Out</strong></li>
                    <li>Student IDs remain the same across years; roll numbers are reassigned</li>
                    <li>Previous year data remains intact and viewable in the year selector</li>
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
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-green-700">{result.promoted}</p>
                    <p className="text-sm text-slate-500">Promoted</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-slate-600">{result.graduated}</p>
                    <p className="text-sm text-slate-500">Graduated</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                    <p className="text-sm text-slate-500">Skipped</p>
                  </div>
                </div>
                {result.warnings?.length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 text-left space-y-0.5">
                    {result.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
                  </div>
                )}
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