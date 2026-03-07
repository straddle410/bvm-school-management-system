import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Filter } from 'lucide-react';

export default function FilterSection({ filters, setFilters, onGenerate, classes, sections = ['A'] }) {
  const handleGenerate = () => {
    if (!filters.class || !filters.section || !filters.fromDate || !filters.toDate) {
      alert('Please select class, section, and date range');
      return;
    }
    onGenerate();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Report Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Class Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Class *</label>
            <Select value={filters.class} onValueChange={(v) => setFilters({...filters, class: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c} value={c}>Class {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Section</label>
            <Select
              value={filters.section}
              onValueChange={(v) => setFilters({ ...filters, section: v })}
              disabled={!filters.class || sections.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map(s => (
                  <SelectItem key={s} value={s}>Section {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">From Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
                className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* To Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">To Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Generate Button */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">&nbsp;</label>
            <Button 
              onClick={handleGenerate}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Generate Report
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}