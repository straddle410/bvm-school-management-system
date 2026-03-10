import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload } from 'lucide-react';

export default function MarksHeader({
  selectedClass,
  setSelectedClass,
  selectedSection,
  setSelectedSection,
  selectedExam,
  setSelectedExam,
  classes,
  sections,
  examTypes,
  viewMode,
  setViewMode,
  onExport,
  onImport
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger>
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger>
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        
        <Select value={selectedExam} onValueChange={setSelectedExam}>
          <SelectTrigger>
            <SelectValue placeholder="Exam" />
          </SelectTrigger>
          <SelectContent>
            {examTypes.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={viewMode} onValueChange={setViewMode}>
          <SelectTrigger>
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="entry">Entry</SelectItem>
            <SelectItem value="review">Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
          <Upload className="h-4 w-4" /> Import
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>
    </div>
  );
}