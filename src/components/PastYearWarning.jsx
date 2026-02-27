import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertCircle } from 'lucide-react';

/**
 * Checks if the given academic year is in the past
 * Current year is 2025-26
 */
export const isPastAcademicYear = (academicYear) => {
  if (!academicYear) return false;
  
  const currentYear = 2025;
  const [yearPart] = academicYear.split('-');
  const recordYear = parseInt(yearPart);
  
  return recordYear < currentYear;
};

export default function PastYearWarning({ open, academicYear, onConfirm, onCancel }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertDialogTitle>Past Academic Year Warning</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2">
            You are creating a record for academic year <strong>{academicYear}</strong>, which is in the past. Please confirm if this is intentional.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-3">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-yellow-600 hover:bg-yellow-700">
            Yes, Proceed
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}