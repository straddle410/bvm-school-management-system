import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function GenerateInvoices({ academicYear }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [result, setResult] = useState(null);

  const { data: plan } = useQuery({
    queryKey: ['fee-plan', academicYear, selectedClass],
    queryFn: () => base44.entities.FeePlan.filter({ academic_year: academicYear, class_name: selectedClass }).then(r => r[0] || null),
    enabled: !!selectedClass && !!academicYear
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', selectedClass, academicYear],
    queryFn: () => base44.entities.Student.filter({ class_name: selectedClass, academic_year: academicYear, status: 'Published' }),
    enabled: !!selectedClass && !!academicYear
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generateFeeInvoices', {
        feePlanId: plan.id,
        academicYear,
        className: selectedClass
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.created > 0) toast.success(`Generated ${data.created} annual invoices`);
      else toast.info('No new invoices created (all already exist)');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message)
  });

  return (
    <div className="space-y-4">
      <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setResult(null); }}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Select Class" /></SelectTrigger>
        <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
      </Select>

      {selectedClass && !plan && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex gap-2 items-center text-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            No fee plan defined for Class {selectedClass} in {academicYear}. Create one in the Fee Plans tab first.
          </CardContent>
        </Card>
      )}

      {plan && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Annual Fee — Class {selectedClass}</h3>
                <p className="text-sm text-slate-500">
                  {plan.due_date ? `Due: ${plan.due_date} · ` : ''}{students.length} published students
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Per student</p>
                <p className="text-lg font-bold text-emerald-700">₹{(plan.total_amount || 0).toLocaleString()}</p>
              </div>
            </div>

            <table className="w-full text-sm border-t pt-2">
              <tbody>
                {(plan.fee_items || []).filter(f => f.amount > 0).map((fh, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-600">{fh.fee_head_name}</td>
                    <td className="py-1.5 text-right font-medium">₹{(fh.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-slate-50">
                  <td className="py-2 px-1">Total per student</td>
                  <td className="py-2 text-right text-emerald-700">₹{(plan.total_amount || 0).toLocaleString()}</td>
                </tr>
                <tr className="font-bold">
                  <td className="py-1 px-1 text-slate-700">Expected Collection ({students.length} students)</td>
                  <td className="py-1 text-right text-emerald-800">₹{((plan.total_amount || 0) * students.length).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            {result && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${result.created > 0 ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Created: <strong>{result.created}</strong> new invoices · Skipped (already existed): <strong>{result.skipped}</strong></span>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || students.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <FileText className="h-4 w-4 mr-1" />
                {generateMutation.isPending ? 'Generating...' : `Generate Annual Invoices for ${students.length} Students`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}