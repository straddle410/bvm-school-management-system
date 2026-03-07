import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeStudentData, namesMatch } from '@/components/normalizeStudentData';
import { getClassSectionMap } from '@/components/classSectionHelper';

export default function StudentBulkUpload({ open, onClose, academicYear, onSuccess }) {
  const fileInput = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const downloadTemplate = async () => {
    try {
      const response = await base44.functions.invoke('generateStudentImportTemplate', {});
      const csvContent = response.data;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_import_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (err) {
      toast.error('Failed to download template');
    }
  };

  const handleFileSelect = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type)) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    setLoading(true);
    try {
      // Fetch valid class-section config for this academic year upfront
      const { map: classSectionMap } = await getClassSectionMap(academicYear);
      // classSectionMap: { "5": ["A","B"], "6": ["A"], ... }

      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      
      const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: uploadRes.file_url,
        json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            class_name: { type: 'string' },
            section: { type: 'string' },
            parent_name: { type: 'string' },
            parent_phone: { type: 'string' },
            parent_email: { type: 'string' },
            roll_no: { type: ['number', 'string'] },
            dob: { type: 'string' },
            gender: { type: 'string' },
            address: { type: 'string' },
            blood_group: { type: 'string' },
            admission_date: { type: 'string' },
            status: { type: 'string' }
          }
        }
      });

      if (extractRes.status !== 'success') {
        toast.error('Failed to extract data from file');
        setLoading(false);
        return;
      }

      const records = Array.isArray(extractRes.output) ? extractRes.output : [extractRes.output];

      // Fetch existing students for uniqueness checks
      const existingStudents = await base44.entities.Student.filter({ academic_year: academicYear });

      const toCreate = [];
      const errors = [];
      const rollCounters = {}; // key: `class_name|section` → max roll_no

      // Initialize roll counters from existing students
      for (const s of existingStudents) {
        const key = `${s.class_name}|${s.section}`;
        const roll = parseInt(s.roll_no);
        if (!isNaN(roll) && roll > (rollCounters[key] || 0)) {
          rollCounters[key] = roll;
        }
      }

      const hasConfig = Object.keys(classSectionMap).length > 0;

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const rowNum = i + 1;

        // 1. Required fields
        if (!r.name || !r.class_name || !r.parent_name || !r.parent_phone) {
          errors.push({ row: rowNum, name: r.name || '—', reason: 'Missing required fields: name, class_name, parent_name, parent_phone' });
          continue;
        }

        const className = (r.class_name || '').trim();
        const sectionRaw = (r.section || '').trim();

        // 2. Validate class against SectionConfig (only when config exists)
        if (hasConfig && !classSectionMap[className]) {
          errors.push({ row: rowNum, name: r.name || '—', reason: `Class "${className}" is not configured for academic year ${academicYear}. Check Settings → Class Sections.` });
          continue;
        }

        // 3. Resolve section — use from CSV, or auto-select if only one available
        let section = sectionRaw;
        if (hasConfig) {
          const validSections = classSectionMap[className] || [];
          if (!section) {
            // Auto-select if only one section exists for the class
            if (validSections.length === 1) {
              section = validSections[0];
            } else {
              errors.push({ row: rowNum, name: r.name || '—', reason: `Section is required for Class ${className} (available: ${validSections.join(', ')})` });
              continue;
            }
          } else if (!validSections.includes(section)) {
            errors.push({ row: rowNum, name: r.name || '—', reason: `Section "${section}" is not valid for Class ${className} in ${academicYear} (available: ${validSections.join(', ')})` });
            continue;
          }
        } else {
          // No SectionConfig — use whatever is in the CSV, default to 'A' only as last resort
          section = section || 'A';
        }

        const enriched = normalizeStudentData({
          ...r,
          academic_year: academicYear,
          student_id: null,
          username: null,
          password: r.password || 'BVM123',
          status: r.status || 'Pending',
          section,
          roll_no: null,
          parent_email: r.parent_email || ''
        });

        // 4. Duplicate check (name + dob + class)
        if (enriched.name && enriched.dob && enriched.class_name) {
          const dupConflict = existingStudents.find(s =>
            namesMatch(s.name, enriched.name) &&
            s.dob === enriched.dob &&
            s.class_name === enriched.class_name
          );
          if (dupConflict) {
            errors.push({ row: rowNum, name: r.name || '—', reason: 'Possible duplicate student already exists' });
            continue;
          }
        }

        // 5. Auto-assign roll_no
        if (enriched.class_name && enriched.section) {
          const key = `${enriched.class_name}|${enriched.section}`;
          rollCounters[key] = (rollCounters[key] || 0) + 1;
          enriched.roll_no = rollCounters[key];
        }

        // 6. student_id generated on Approved — leave null
        enriched.student_id = null;
        enriched.username = null;

        toCreate.push(enriched);
      }

      if (toCreate.length > 0) {
        await base44.entities.Student.bulkCreate(toCreate);
      }

      setResult({ success: toCreate.length, failed: errors.length, errors });
      if (toCreate.length > 0) toast.success(`Added ${toCreate.length} students`);
      if (errors.length > 0) toast.warning(`${errors.length} row(s) skipped`);
      if (toCreate.length > 0) onSuccess?.();
      if (errors.length === 0) setTimeout(() => { onClose(); setResult(null); }, 2000);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
      setResult({ success: 0, failed: 1 });
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Import Students</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
            <p className="text-xs text-blue-700">
              <strong>Required:</strong> name, class_name, section, parent_name, parent_phone
            </p>
            <p className="text-xs text-blue-600">
              <strong>Optional:</strong> parent_email, dob, gender, address, blood_group
            </p>
            <p className="text-xs text-blue-600">
              ⚠ <strong>class_name</strong> and <strong>section</strong> must match your Class Sections configuration for the selected academic year (Settings → Class Sections).
            </p>
            <p className="text-xs text-blue-500">
              ℹ Student IDs are auto-generated on Approval. Do not include student_id in CSV.
            </p>
          </div>

          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="w-full rounded-xl gap-2"
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            Download CSV Template
          </Button>

          {result ? (
            <div className="space-y-3">
              {result.success > 0 && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm"><strong>{result.success}</strong> student(s) added successfully</p>
                </div>
              )}
              {result.failed > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg p-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm"><strong>{result.failed}</strong> row(s) skipped</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-lg divide-y text-xs">
                    {result.errors.map((e, i) => (
                      <div key={i} className="px-3 py-2 flex gap-2">
                        <span className="font-semibold text-gray-500 whitespace-nowrap">Row {e.row}</span>
                        <span className="text-gray-700">{e.name}</span>
                        <span className="text-red-600 ml-auto text-right">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.success === 0 && result.failed === 0 && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg p-3">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">Upload failed. Please check your file format.</p>
                </div>
              )}
            </div>
          ) : (
            <label className="block">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                disabled={loading}
                className="hidden"
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={loading}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#1a237e] hover:bg-blue-50 transition disabled:opacity-50"
              >
                <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">{loading ? 'Processing...' : 'Click to upload CSV or Excel'}</p>
                <p className="text-xs text-gray-400 mt-1">Max 1000 records per file</p>
              </button>
            </label>
          )}

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full rounded-xl"
            disabled={loading}
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}