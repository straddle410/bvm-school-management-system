import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, AlertTriangle, ChevronUp, ChevronDown, Layers } from 'lucide-react';
import { normalizeClassName } from '@/components/classSectionHelper';

// Default class display order map for pre-populating new classes
const CLASS_ORDER = {
  Nursery: 1, LKG: 2, UKG: 3,
  '1': 4, '2': 5, '3': 6, '4': 7, '5': 8,
  '6': 9, '7': 10, '8': 11, '9': 12, '10': 13,
};

export default function ClassSectionConfigTab() {
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();

  const [newClassName, setNewClassName] = useState('');
  const [newSectionInputs, setNewSectionInputs] = useState({}); // { class_name: sectionInput }

  // Fetch all SectionConfig records for current year (including inactive)
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['section-config', academicYear],
    queryFn: () => base44.entities.SectionConfig.filter({ academic_year: academicYear }),
    enabled: !!academicYear,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['section-config', academicYear] });

  // Group records by class, sorted by class_display_order then section_display_order
  const grouped = React.useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const co = (a.class_display_order ?? 999) - (b.class_display_order ?? 999);
      if (co !== 0) return co;
      return (a.section_display_order ?? 999) - (b.section_display_order ?? 999);
    });
    const map = {};
    const classOrder = {};
    sorted.forEach(r => {
      const cls = normalizeClassName(r.class_name);
      if (!map[cls]) { map[cls] = []; classOrder[cls] = r.class_display_order ?? 999; }
      map[cls].push(r);
    });
    // Return as ordered array of { className, classDisplayOrder, sections[] }
    return Object.entries(map)
      .map(([cls, sections]) => ({ className: cls, classDisplayOrder: classOrder[cls], sections }))
      .sort((a, b) => a.classDisplayOrder - b.classDisplayOrder);
  }, [records]);

  // Add a new class (creates one section 'A' by default)
  const addClassMutation = useMutation({
    mutationFn: async () => {
      const cls = normalizeClassName(newClassName.trim());
      if (!cls) throw new Error('Enter a valid class name');
      const exists = records.some(r => normalizeClassName(r.class_name) === cls);
      if (exists) throw new Error(`Class "${cls}" already exists for ${academicYear}`);
      const order = CLASS_ORDER[cls] ?? (grouped.length + 20);
      await base44.entities.SectionConfig.create({
        academic_year: academicYear,
        class_name: cls,
        section: 'A',
        class_display_order: order,
        section_display_order: 1,
        is_active: true,
      });
    },
    onSuccess: () => { invalidate(); setNewClassName(''); toast.success('Class added with Section A'); },
    onError: (e) => toast.error(e.message),
  });

  // Add a section to an existing class
  const addSectionMutation = useMutation({
    mutationFn: async ({ className, section }) => {
      const sec = section.trim().toUpperCase();
      if (!sec) throw new Error('Enter a section name');
      const classRecords = records.filter(r => normalizeClassName(r.class_name) === className);
      const exists = classRecords.some(r => r.section?.toUpperCase() === sec);
      if (exists) throw new Error(`Section ${sec} already exists in Class ${className}`);
      const maxSecOrder = classRecords.reduce((m, r) => Math.max(m, r.section_display_order ?? 0), 0);
      const classOrder = classRecords[0]?.class_display_order ?? 999;
      await base44.entities.SectionConfig.create({
        academic_year: academicYear,
        class_name: className,
        section: sec,
        class_display_order: classOrder,
        section_display_order: maxSecOrder + 1,
        is_active: true,
      });
    },
    onSuccess: (_, { className }) => {
      invalidate();
      setNewSectionInputs(prev => ({ ...prev, [className]: '' }));
      toast.success('Section added');
    },
    onError: (e) => toast.error(e.message),
  });

  // Toggle active status
  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.SectionConfig.update(id, { is_active }),
    onSuccess: () => invalidate(),
  });

  // Delete a section record
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SectionConfig.delete(id),
    onSuccess: () => { invalidate(); toast.success('Section removed'); },
  });

  // Move section up/down within a class (swap section_display_order)
  const moveSectionMutation = useMutation({
    mutationFn: async ({ classRecords, index, direction }) => {
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= classRecords.length) return;
      const a = classRecords[index];
      const b = classRecords[swapIndex];
      await Promise.all([
        base44.entities.SectionConfig.update(a.id, { section_display_order: b.section_display_order ?? swapIndex + 1 }),
        base44.entities.SectionConfig.update(b.id, { section_display_order: a.section_display_order ?? index + 1 }),
      ]);
    },
    onSuccess: () => invalidate(),
  });

  // Move class up/down (swap class_display_order for all records of that class)
  const moveClassMutation = useMutation({
    mutationFn: async ({ groupIndex, direction }) => {
      const swapIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;
      if (swapIndex < 0 || swapIndex >= grouped.length) return;
      const groupA = grouped[groupIndex];
      const groupB = grouped[swapIndex];
      const orderA = groupA.classDisplayOrder;
      const orderB = groupB.classDisplayOrder;
      const aIds = groupA.sections.map(r => r.id);
      const bIds = groupB.sections.map(r => r.id);
      await Promise.all([
        ...aIds.map(id => base44.entities.SectionConfig.update(id, { class_display_order: orderB })),
        ...bIds.map(id => base44.entities.SectionConfig.update(id, { class_display_order: orderA })),
      ]);
    },
    onSuccess: () => invalidate(),
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#1a237e]" /> Class-Section Configuration
        </CardTitle>
        <CardDescription>
          Configure active classes and sections for <strong>{academicYear}</strong>.
          This will power all module dropdowns in Phase 3.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* No config warning */}
        {!isLoading && records.length === 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                No class-section configuration found for {academicYear}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Add your classes below. Until configured, all modules fall back to the built-in class list with Section A only.
              </p>
            </div>
          </div>
        )}

        {/* Add new class */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">Add New Class</p>
          <div className="flex gap-2">
            <Input
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              placeholder="e.g., Nursery, LKG, 1, 10"
              className="max-w-xs"
              onKeyDown={e => e.key === 'Enter' && addClassMutation.mutate()}
            />
            <Button
              onClick={() => addClassMutation.mutate()}
              disabled={!newClassName.trim() || addClassMutation.isPending}
              className="bg-[#1a237e] hover:bg-[#283593]"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Class
            </Button>
          </div>
          <p className="text-xs text-slate-400">A default Section A is created automatically. Add more sections after.</p>
        </div>

        {/* Loading */}
        {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}

        {/* Grouped class → section view */}
        <div className="space-y-4">
          {grouped.map((group, groupIdx) => (
            <div key={group.className} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Class header */}
              <div className="flex items-center justify-between bg-slate-100 px-4 py-2">
                <span className="font-semibold text-slate-800 text-sm">
                  Class {group.className}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveClassMutation.mutate({ groupIndex: groupIdx, direction: 'up' })}
                    disabled={groupIdx === 0}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                    title="Move class up"
                  >
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => moveClassMutation.mutate({ groupIndex: groupIdx, direction: 'down' })}
                    disabled={groupIdx === grouped.length - 1}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                    title="Move class down"
                  >
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Section rows */}
              <div className="divide-y divide-slate-100">
                {group.sections.map((record, secIdx) => (
                  <div key={record.id} className={`flex items-center justify-between px-4 py-2 ${!record.is_active ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700 w-24">Section {record.section}</span>
                      {!record.is_active && (
                        <span className="text-xs text-slate-400 italic">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Reorder within class */}
                      <button
                        onClick={() => moveSectionMutation.mutate({ classRecords: group.sections, index: secIdx, direction: 'up' })}
                        disabled={secIdx === 0}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        title="Move section up"
                      >
                        <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => moveSectionMutation.mutate({ classRecords: group.sections, index: secIdx, direction: 'down' })}
                        disabled={secIdx === group.sections.length - 1}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        title="Move section down"
                      >
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                      {/* Active toggle */}
                      <Switch
                        checked={!!record.is_active}
                        onCheckedChange={v => toggleMutation.mutate({ id: record.id, is_active: v })}
                      />
                      {/* Delete */}
                      <button
                        onClick={() => {
                          if (confirm(`Remove Section ${record.section} from Class ${group.className}?`)) {
                            deleteMutation.mutate(record.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                        title="Remove section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add section to this class */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex gap-2">
                <Input
                  value={newSectionInputs[group.className] || ''}
                  onChange={e => setNewSectionInputs(prev => ({ ...prev, [group.className]: e.target.value }))}
                  placeholder="New section (e.g., B)"
                  className="h-8 text-sm max-w-[140px]"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      addSectionMutation.mutate({ className: group.className, section: newSectionInputs[group.className] || '' });
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => addSectionMutation.mutate({ className: group.className, section: newSectionInputs[group.className] || '' })}
                  disabled={!newSectionInputs[group.className]?.trim() || addSectionMutation.isPending}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Section
                </Button>
              </div>
            </div>
          ))}
        </div>

        {grouped.length > 0 && (
          <p className="text-xs text-slate-400 text-center">
            {records.filter(r => r.is_active).length} active section(s) across {grouped.length} class(es) for {academicYear}
          </p>
        )}
      </CardContent>
    </Card>
  );
}