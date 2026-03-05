import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, Check, Zap } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// Normalize class name to match entity enum
const normalizeClassName = (cls) => cls?.trim() || '';

// Dev-only test helper
const testClassMapping = async (cls, subjects) => {
  try {
    console.log(`[TEST] Saving ${cls} with subjects:`, subjects);
    const res = await base44.functions.invoke('setSubjectsForClass', {
      academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1 - 2000),
      class_name: cls,
      subject_names: subjects
    });
    console.log(`[TEST] Save response:`, res.data);
    
    // Immediate refetch
    const configs = await base44.entities.ClassSubjectConfig.filter({
      academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1 - 2000),
      class_name: cls
    });
    console.log(`[TEST] Refetch for ${cls}:`, configs[0]?.subject_names);
    return { saved: res.data.success, fetched: configs[0]?.subject_names };
  } catch (err) {
    console.error(`[TEST] Error:`, err.message);
  }
};

export default function ClassSubjectConfigTab() {
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [saving, setSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['subjects-global'],
    queryFn: async () => {
      const subs = await base44.entities.Subject.list();
      return subs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
  });

  const { data: config, isLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['class-subject-config', academicYear, selectedClass],
    queryFn: async () => {
      const normalized = normalizeClassName(selectedClass);
      console.log('[CLASS_CFG_LOAD] year=', academicYear, 'class=', normalized);
      const configs = await base44.entities.ClassSubjectConfig.filter({
        academic_year: academicYear,
        class_name: normalized
      });
      if (configs.length > 0 && configs[0].subject_names) {
        console.log('[CLASS_CFG_LOAD_RES] found subjects:', configs[0].subject_names);
        return { exists: true, subject_names: configs[0].subject_names };
      }
      console.log('[CLASS_CFG_LOAD_RES] not configured');
      return { exists: false, subject_names: [] };
    },
    enabled: !!academicYear && !!selectedClass
  });

  const [selected, setSelected] = useState(null); // null = loading/unknown

  // Reset selection whenever year, class, or fetched config changes
  useEffect(() => {
    if (config === undefined) return; // query not yet resolved
    if (config === null || !config.exists) {
      setSelected([]); // not configured → empty
    } else {
      setSelected(config.subject_names);
    }
  }, [academicYear, selectedClass, config]);

  const toggle = (name) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await base44.functions.invoke('setSubjectsForClass', {
        academic_year: academicYear,
        class_name: selectedClass,
        subject_names: selected
      });

      if (!response.data.success) {
        toast.error(response.data.error || 'Save failed');
        return;
      }

      // Immediately update local state from server response
      if (response.data.config && response.data.config.subject_names) {
        setSelected(response.data.config.subject_names);
      }

      // Invalidate queries to re-fetch fresh data
      queryClient.invalidateQueries({ queryKey: ['class-subject-config', academicYear, selectedClass] });
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      
      toast.success(`✓ Saved subjects for Class ${selectedClass}`);
      setShowSuccessModal(true);
    } catch (err) {
      toast.error(`Error: ${err.message || 'Failed to save'}`);
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Class → Subjects Mapping</CardTitle>
        <CardDescription>
          Configure which subjects are taught per class for <strong>{academicYear}</strong>.
          Other modules (Marks, Timetable) will use this list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Class Selector */}
        <div className="flex flex-wrap gap-2">
          {CLASSES.map(cls => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                selectedClass === cls
                  ? 'bg-[#1a237e] text-white border-[#1a237e]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#1a237e]'
              }`}
            >
              Class {cls}
            </button>
          ))}
        </div>

        {/* Subject Checkboxes */}
        {isLoading || selected === null ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : allSubjects.length === 0 ? (
          <p className="text-slate-400 text-sm">No subjects in the global master list yet. Add them in the Subjects tab first.</p>
        ) : (
          <>
            {!config?.exists && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Not configured — Marks &amp; Timetable will fall back to the global subjects list until you save a configuration here.
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">
                Select subjects for Class {selectedClass}
                <span className="ml-2 text-xs text-slate-400">({selected.length}/{allSubjects.length} selected)</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(
                  selected.length === allSubjects.length ? [] : allSubjects.map(s => s.name)
                )}
                className="text-xs h-7"
              >
                {selected.length === allSubjects.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allSubjects.map(sub => (
                <label
                  key={sub.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected.includes(sub.name)
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 ${
                    selected.includes(sub.name) ? 'bg-[#1a237e]' : 'border-2 border-slate-300'
                  }`}>
                    {selected.includes(sub.name) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected.includes(sub.name)}
                    onChange={() => toggle(sub.name)}
                  />
                  <span className="text-sm font-medium text-slate-700">{sub.name}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#1a237e] hover:bg-[#283593] gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : `Save for Class ${selectedClass}`}
          </Button>
        </div>
      </CardContent>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-green-600">✓ Saved Successfully</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Subjects for <span className="font-semibold">Class {selectedClass}</span> have been saved.
            </p>
            <p className="text-sm text-slate-600">
              The configuration for <span className="font-semibold">{academicYear}</span> has been updated.
            </p>
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}