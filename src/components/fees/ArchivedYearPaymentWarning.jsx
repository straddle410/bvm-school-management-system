import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ArchivedYearPaymentWarning({ academicYear, studentName }) {
  return (
    <Card className="border-l-4 border-l-amber-500 bg-amber-50 mb-4">
      <CardContent className="p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-amber-900">Previous Year Balance Collection</p>
          <p className="text-sm text-amber-800 mt-1">
            You are collecting a previous-year balance in archived academic year <strong>{academicYear}</strong> for student <strong>{studentName}</strong>. This payment will be recorded in the {academicYear} ledger. Reversals are not permitted for archived-year collections.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}