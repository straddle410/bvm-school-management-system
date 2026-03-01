import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function ReceiptSettings() {
  const queryClient = useQueryClient();
  const { academicYear, academicYears } = useAcademicYear();
  const [selectedYear, setSelectedYear] = useState(academicYear || '');
  const [form, setForm] = useState({ prefix: 'RCPT', next_number: 1, padding: 4 });

  const { data: config, isLoading } = useQuery({
    queryKey: ['fee-receipt-config', selectedYear],
    queryFn: () => base44.entities.FeeReceiptConfig.filter({ academic_year: selectedYear }).then(r => r[0] || null),
    enabled: !!selectedYear
  });

  useEffect(() => {
    if (config) {
      setForm({ prefix: config.prefix || 'RCPT', next_number: config.next_number || 1, padding: config.padding || 4 });
    } else {
      setForm({ prefix: 'RCPT', next_number: 1, padding: 4 });
    }
  }, [config, selectedYear]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { academic_year: selectedYear, prefix: form.prefix, next_number: parseInt(form.next_number) || 1, padding: parseInt(form.padding) || 4 };
      if (config?.id) return base44.entities.FeeReceiptConfig.update(config.id, data);
      return base44.entities.FeeReceiptConfig.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-receipt-config', selectedYear] });
      toast.success('Receipt settings saved');
    },
    onError: (e) => toast.error(e.message)
  });

  const activeYears = (academicYears || []).filter(y => y.status !== 'Archived');
  const seq = String(form.next_number || 1).padStart(parseInt(form.padding) || 4, '0');
  const preview = `${form.prefix || 'RCPT'}/${selectedYear}/${seq}`;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Receipt Number Settings</CardTitle>
          <CardDescription>Configure the format for fee receipt numbers. Format: PREFIX/YEAR/SEQUENCE</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Academic Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-48 mt-1"><SelectValue placeholder="Select year" /></SelectTrigger>
              <SelectContent>
                {activeYears.map(y => <SelectItem key={y.year} value={y.year}>{y.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedYear && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Prefix</Label>
                  <Input className="mt-1" value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value.toUpperCase() })} placeholder="RCPT" maxLength={10} />
                  <p className="text-xs text-slate-400 mt-1">e.g. RCPT, FEE, PAY</p>
                </div>
                <div>
                  <Label>Next Sequence Number</Label>
                  <Input className="mt-1" type="number" min="1" value={form.next_number} onChange={e => setForm({ ...form, next_number: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Next receipt will use this number</p>
                </div>
                <div>
                  <Label>Zero Padding</Label>
                  <Select value={String(form.padding)} onValueChange={v => setForm({ ...form, padding: parseInt(v) })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 digits (001)</SelectItem>
                      <SelectItem value="4">4 digits (0001)</SelectItem>
                      <SelectItem value="5">5 digits (00001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <Eye className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-emerald-700 font-medium uppercase tracking-wider">Next Receipt Preview</p>
                  <p className="text-xl font-mono font-bold text-emerald-800 mt-0.5">{preview}</p>
                </div>
              </div>

              {!config && !isLoading && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No config found for {selectedYear} — default settings will be used (RCPT/{selectedYear}/0001). Save to lock in your settings.
                </p>
              )}

              <div className="flex justify-end">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !selectedYear}>
                  <Save className="h-4 w-4 mr-1" />{saveMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}