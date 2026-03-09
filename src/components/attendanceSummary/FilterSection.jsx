import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Filter, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function FilterSection({ filters, setFilters, onGenerate, classes, sections = ['A'] }) {
  const { academicYear } = useAcademicYear();
  const [academicYearData, setAcademicYearData] = useState(null);
  const [errors, setErrors] = useState([]);

  // Fetch academic year start/end dates and initialize date filters
  useEffect(() => {
    const fetchAcademicYear = async () => {
      try {
        const data = await base44.entities.AcademicYear.filter({ year: academicYear });
        if (data.length > 0) {
          const yearData = data[0];
          setAcademicYearData(yearData);
          
          // Auto-initialize date filters to academic year range on first load
          if (!filters.fromDate) {
            setFilters(prev => ({ ...prev, fromDate: yearData.start_date }));
          }
          if (!filters.toDate) {
            setFilters(prev => ({ ...prev, toDate: yearData.end_date }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch academic year:', err);
      }
    };
    if (academicYear) fetchAcademicYear();
  }, [academicYear]);

  const handleDateChange = (field, value) => {
    const newErrors = [];
    let finalValue = value;

    if (field === 'fromDate' && academicYearData) {
      if (value < academicYearData.start_date) {
        finalValue = academicYearData.start_date;
        newErrors.push(`Start date adjusted to ${academicYearData.start_date} (academic year start)`);
        toast.warning(`Start date adjusted to ${academicYearData.start_date}`);
      }
    }

    if (field === 'toDate' && academicYearData) {
      if (value > academicYearData.end_date) {
        finalValue = academicYearData.end_date;
        newErrors.push(`End date adjusted to ${academicYearData.end_date} (academic year end)`);
        toast.warning(`End date adjusted to ${academicYearData.end_date}`);
      }
    }

    setFilters({ ...filters, [field]: finalValue });
    setErrors(newErrors);
  };

  const handleGenerate = () => {
    if (!filters.class || !filters.section || !filters.fromDate || !filters.toDate) {
      alert('Please select class, section, and date range');
      return;
    }
    if (filters.fromDate > filters.toDate) {
      alert('From date cannot be after to date');
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

        {errors.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              {errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

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
                onChange={(e) => handleDateChange('fromDate', e.target.value)}
                min={academicYearData?.start_date}
                max={academicYearData?.end_date}
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
                onChange={(e) => handleDateChange('toDate', e.target.value)}
                min={academicYearData?.start_date}
                max={academicYearData?.end_date}
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