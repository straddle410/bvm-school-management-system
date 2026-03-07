import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

export default function TeacherAssignmentSection({
  form,
  setForm,
  subjects,
  sectionConfigs,
  getSectionsForClass,
  academicYear,
}) {
  const [showClassesModal, setShowClassesModal] = useState(false);

  // Derive CLASSES directly from sectionConfigs for real-time updates
  const CLASSES = useMemo(() => {
    const classMap = new Map(sectionConfigs.map(sc => [sc.class_name, sc.class_display_order]));
    return Array.from(classMap.entries())
      .sort(([, orderA], [, orderB]) => (orderA || 0) - (orderB || 0))
      .map(([className]) => className);
  }, [sectionConfigs]);

  // DEBUG: Log state for visibility
  const debugInfo = {
    sectionConfigsCount: sectionConfigs.length,
    sectionConfigsSample: sectionConfigs.slice(0, 3).map(sc => ({
      class_name: sc.class_name,
      section: sc.section,
      academic_year: sc.academic_year,
      is_active: sc.is_active,
    })),
    classesArrayFinal: CLASSES,
  };

  return (
    <div className="border-t pt-4">
      <Label className="flex items-center gap-2 mb-4">
        <Checkbox checked={form.is_teacher} onCheckedChange={(checked) => setForm(f => ({ ...f, is_teacher: checked }))} />
        This is a Teacher
      </Label>

      {form.is_teacher && (
        <div className="space-y-4 ml-6">
          {/* DEBUG: Visible runtime values */}
          <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900">
            <p className="font-semibold mb-2">DEBUG INFO:</p>
            <p>sectionConfigs count: <span className="font-mono font-bold">{debugInfo.sectionConfigsCount}</span></p>
            <p>CLASSES array: <span className="font-mono font-bold">{JSON.stringify(debugInfo.classesArrayFinal)}</span></p>
            <p className="mt-2 text-amber-800">Sample records:</p>
            <pre className="text-xs bg-white border border-amber-200 p-2 mt-1 overflow-auto max-h-20">
              {JSON.stringify(debugInfo.sectionConfigsSample, null, 2)}
            </pre>
          </div>

          {/* Subjects */}
          <div>
            <Label>Subjects</Label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
              {subjects.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.subjects.includes(s.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setForm(f => ({ ...f, subjects: [...f.subjects, s.name] }));
                      } else {
                        setForm(f => ({ ...f, subjects: f.subjects.filter(x => x !== s.name) }));
                      }
                    }}
                  />
                  <span className="text-sm">{s.name}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Subjects will be saved when you update staff</p>
          </div>

          {/* Classes - Modal-based UI */}
          <div>
            <Label>Classes</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded min-h-[44px] items-center bg-slate-50">
              {form.classes.length === 0 ? (
                <span className="text-xs text-slate-500 italic">No classes selected</span>
              ) : (
                form.classes.map(c => (
                  <Badge key={c} variant="secondary" className="flex items-center gap-1">
                    {c}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, classes: f.classes.filter(x => x !== c) }))}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowClassesModal(true)}
              >
                {form.classes.length === 0 ? 'Select Classes' : 'Edit'}
              </Button>
            </div>
          </div>

          {/* Sections - Grid-based, depends on selected classes */}
          <div>
            <Label>Sections</Label>
            {form.classes.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Select at least one class to enable section selection</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {(() => {
                  const uniqueSections = Array.from(
                    new Set(
                      form.classes.flatMap(cls => getSectionsForClass(cls))
                    )
                  ).sort();
                  return uniqueSections.map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <Checkbox
                        checked={form.sections.includes(s)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setForm(f => ({ ...f, sections: [...f.sections, s] }));
                          } else {
                            setForm(f => ({ ...f, sections: f.sections.filter(x => x !== s) }));
                          }
                        }}
                      />
                      <span className="text-sm">{s}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Class Teacher Of - Dropdown, depends on selected classes */}
          <div>
            <Label>Class Teacher Of</Label>
            {form.classes.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Select at least one class to enable class teacher assignment</p>
            ) : (
              <Select value={form.class_teacher_of} onValueChange={(v) => setForm(f => ({ ...f, class_teacher_of: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class-section" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const classSectionOptions = form.classes.flatMap(cls => {
                      const sections = getSectionsForClass(cls);
                      return sections.map(sec => ({ class: cls, section: sec, display: `${cls}-${sec}` }));
                    });
                    return classSectionOptions.map(opt => (
                      <SelectItem key={opt.display} value={opt.display}>{opt.display}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {/* Classes Selection Modal */}
      <Dialog open={showClassesModal} onOpenChange={setShowClassesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Select Classes</DialogTitle>
          </DialogHeader>
          <div className="space-y-0 max-h-[70vh] overflow-y-auto border rounded">
            {CLASSES.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-slate-500">No classes available for this academic year</p>
              </div>
            ) : (
              CLASSES.map(c => (
                <div
                  key={c}
                  className="flex items-center gap-3 p-3 border-b hover:bg-slate-100 cursor-pointer transition"
                  onClick={() => {
                    if (form.classes.includes(c)) {
                      setForm(f => ({ ...f, classes: f.classes.filter(x => x !== c) }));
                    } else {
                      setForm(f => ({ ...f, classes: [...f.classes, c] }));
                    }
                  }}
                >
                  <Checkbox
                    checked={form.classes.includes(c)}
                    onCheckedChange={() => {
                      // Checkbox handles the state change via parent onClick
                    }}
                    className="cursor-pointer"
                  />
                  <span className="text-sm font-medium flex-1">{c}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowClassesModal(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => setShowClassesModal(false)}
              className="bg-[#1a237e] hover:bg-[#283593] text-xs"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}