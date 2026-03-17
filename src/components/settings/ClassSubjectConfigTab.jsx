import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Check, Zap, GripVertical, Trash2 } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// Import canonical normalizer from helper
import { getSubjectsForClass, getAllSubjectsForYear } from '@/components/subjectHelper';

// Drag-and-drop list item component
const SubjectListItem = ({ index, subject, isNew, onMoveUp, onMoveDown, onRemove }) => (
  <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors group">
    <div className="flex flex-col gap-1">
      <button
        onClick={onMoveUp}
        className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition"
        title="Move up"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
          <path d="M10.293 5.293a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L8.707 9.707a1 1 0 01-1.414-1.414l3-3z" />
        </svg>
      </button>
      <button
        onClick={onMoveDown}
        className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition"
        title="Move down"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
          <path d="M10.707 14.707a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 12.586V5a1 1 0 012 0v7.586l1.293-1.293a1 1 0 011.414 1.414l-3 3z" />
        </svg>
      </button>
    </div>
    <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
    <span className={`flex-1 text-sm font-medium ${isNew ? 'text-green-700' : 'text-slate-700'}`}>
      {subject}
      {isNew && <span className="ml-2 text-xs text-green-600">(new)</span>}
    </span>
    <button
      onClick={onRemove}
      className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
      title="Remove subject"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

// Inline canonical normalizer (same as subjectHelper)
const normalizeClassName = (cls) => {
  if (!cls) return '';
  
  const input = cls.toString().trim().toLowerCase();
  
  // Return early for special cases
  if (input === 'nursery') return 'Nursery';
  if (input === 'lkg') return 'LKG';
  if (input === 'ukg') return 'UKG';
  
  // Strip "class" prefix if present
  let stripped = input.replace(/^class\s*/, '').trim();
  
  // Return numeric string (1-12)
  const num = parseInt(stripped, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return String(num);
  }
  
  // Fallback to original trimmed input if no match
  return cls.toString().trim();
};

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
   const [draggedFrom, setDraggedFrom] = useState(null);
   const [selectedSubjectToAdd, setSelectedSubjectToAdd] = useState('');

  const { data: allSubjects = [], refetch: refetchSubjects } = useQuery({
    queryKey: ['all-subjects-for-year', academicYear],
    queryFn: async () => {
      const subjects = await base44.entities.Subject.list();
      // Map to objects and sort by name
      return subjects.map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!academicYear,
    staleTime: 0 // Always fetch fresh data
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

  const handleAddSubject = () => {
    if (!selectedSubjectToAdd) {
      toast.error('Please select a subject');
      return;
    }
    if (selected.includes(selectedSubjectToAdd)) {
      toast.error('Subject already added to this class');
      return;
    }
    setSelected(prev => [...prev, selectedSubjectToAdd]);
    setSelectedSubjectToAdd('');
    refetchSubjects(); // Refresh dropdown data
    toast.success(`Subject "${selectedSubjectToAdd}" added`);
  };

  const handleSave = async () => {
    setSaving(true);
    const normalized = normalizeClassName(selectedClass);
    console.log('[CLASS_CFG_SAVE] year=', academicYear, 'class=', normalized, 'subjects=', selected);
    
    try {
      const response = await base44.functions.invoke('setSubjectsForClass', {
        academic_year: academicYear,
        class_name: normalized,
        subject_names: selected
      });

      console.log('[CLASS_CFG_SAVE_RES]', response.data);

      // STRICT validation: response must contain config with matching class & year
      if (!response?.data?.success || 
          !response?.data?.config || 
          response.data.config.class_name !== normalized ||
          response.data.config.academic_year !== academicYear) {
        toast.error('Save failed: invalid server response');
        console.error('[CLASS_CFG_SAVE] Invalid response:', response.data);
        return;
      }

      // Immediately update local state from server response
      setSelected(response.data.config.subject_names || []);

      // Force refetch from DB to confirm persistence
      await refetchConfig();

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['class-subject-config', academicYear, selectedClass] });
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      await refetchSubjects(); // Refresh dropdown with latest subjects

      toast.success(`✓ Saved subjects for Class ${selectedClass}`);
      setShowSuccessModal(true);
    } catch (err) {
      toast.error(`Error: ${err.message || 'Failed to save'}`);
      console.error('[CLASS_CFG_SAVE_ERR]', err);
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
              onClick={() => {
                const normalized = normalizeClassName(cls);
                console.log('[CLASS_TAB_SWITCH] to:', normalized);
                setSelectedClass(normalized);
              }}
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
        ) : (
          <>
            {!config?.exists && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Not configured — Marks &amp; Timetable will have no subjects for this class until you save a configuration here.
              </div>
            )}

            {/* Add Subject from Dropdown */}
             <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
               <p className="text-xs font-medium text-blue-900 mb-2">Select a subject to add</p>
               <div className="flex gap-2">
                 <Select value={selectedSubjectToAdd} onValueChange={setSelectedSubjectToAdd}>
                   <SelectTrigger className="flex-1">
                     <SelectValue placeholder="Choose a subject..." />
                   </SelectTrigger>
                   <SelectContent>
                     {allSubjects
                       .filter(s => !selected.includes(s.name))
                       .map(s => (
                         <SelectItem key={s.id} value={s.name}>
                           {s.name}
                         </SelectItem>
                       ))
                     }
                   </SelectContent>
                 </Select>
                 <Button
                   onClick={handleAddSubject}
                   size="sm"
                   className="bg-blue-600 hover:bg-blue-700"
                   disabled={!selectedSubjectToAdd}
                 >
                   Add
                 </Button>
               </div>
             </div>

            {/* Ordered Subjects List with Drag & Drop */}
            {selected.length === 0 ? (
              <p className="text-slate-400 text-sm">No subjects yet. Add one using the text input above.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Subjects for Class {selectedClass} (drag to reorder)
                </p>
                <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                  {selected.map((subName, idx) => (
                    <SubjectListItem
                      key={`${subName}-${idx}`}
                      index={idx}
                      subject={subName}
                      isNew={!allSubjects.find(x => x.name === subName)}
                      onMoveUp={() => {
                        if (idx > 0) {
                          const updated = [...selected];
                          [updated[idx], updated[idx - 1]] = [updated[idx - 1], updated[idx]];
                          setSelected(updated);
                        }
                      }}
                      onMoveDown={() => {
                        if (idx < selected.length - 1) {
                          const updated = [...selected];
                          [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                          setSelected(updated);
                        }
                      }}
                      onRemove={() => {
                        setSelected(prev => prev.filter((_, i) => i !== idx));
                        refetchSubjects(); // Refresh dropdown after removal
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex justify-between items-center pt-2">
           <Button
             onClick={handleSave}
             disabled={saving}
             className="bg-[#1a237e] hover:bg-[#283593] gap-2"
           >
             <Save className="h-4 w-4" />
             {saving ? 'Saving...' : `Save for Class ${selectedClass}`}
           </Button>
           {/* Dev-only test button */}
           {process.env.NODE_ENV === 'development' && (
             <Button
               onClick={() => testClassMapping(selectedClass, selected)}
               variant="outline"
               size="sm"
               className="gap-2 text-xs"
             >
               <Zap className="h-3 w-3" />
               Test Save
             </Button>
           )}
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