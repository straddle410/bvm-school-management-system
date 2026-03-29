import React from 'react';
import { Search, Bus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StudentFilters({
  search, onSearch,
  filterClass, onFilterClass,
  filterSection, onFilterSection,
  filterTransport, onFilterTransport,
  filterHostel, onFilterHostel,
  filterDaysColor, onFilterDaysColor,
  showDeleted, onToggleDeleted,
  availableClasses = [],
  availableSections = []
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-3 py-2.5 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search name or Student ID…"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="pl-8 h-8 text-sm rounded-lg border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
          />
        </div>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {/* Class filter */}
          <Select value={filterClass} onValueChange={onFilterClass}>
            <SelectTrigger className="w-full sm:w-32 h-8 text-sm rounded-lg border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent className="max-h-[260px] overflow-y-auto">
              <SelectItem value="all">All Classes</SelectItem>
              {availableClasses.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Section filter */}
          <Select value={filterSection} onValueChange={onFilterSection}>
            <SelectTrigger className="w-full sm:w-28 h-8 text-sm rounded-lg border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent className="max-h-[260px] overflow-y-auto">
              <SelectItem value="all">All Sections</SelectItem>
              {availableSections.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Transport filter — only shown on Active tab */}
          {onFilterTransport && (
            <Select value={filterTransport} onValueChange={onFilterTransport}>
              <SelectTrigger className="w-full sm:w-36 h-8 text-sm rounded-lg border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                <Bus className="h-3.5 w-3.5 mr-1 text-blue-500 flex-shrink-0" />
                <SelectValue placeholder="Transport" />
              </SelectTrigger>
              <SelectContent className="max-h-[260px] overflow-y-auto">
                <SelectItem value="all">All Transport</SelectItem>
                <SelectItem value="on">Transport ON</SelectItem>
                <SelectItem value="off">Transport OFF</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Hostel filter — only shown on Active tab */}
          {onFilterHostel && (
            <Select value={filterHostel} onValueChange={onFilterHostel}>
              <SelectTrigger className="w-full sm:w-32 h-8 text-sm rounded-lg border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                <span className="mr-1 text-green-500">🏠</span>
                <SelectValue placeholder="Hostel" />
              </SelectTrigger>
              <SelectContent className="max-h-[260px] overflow-y-auto">
                <SelectItem value="all">All Hostel</SelectItem>
                <SelectItem value="on">Hostel ON</SelectItem>
                <SelectItem value="off">Hostel OFF</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Days/Color filter — only shown on Active tab */}
          {onFilterDaysColor && (
            <Select value={filterDaysColor} onValueChange={onFilterDaysColor}>
              <SelectTrigger className="w-full sm:w-40 h-8 text-sm rounded-lg border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                <SelectValue placeholder="Days Color" />
              </SelectTrigger>
              <SelectContent className="max-h-[260px] overflow-y-auto">
                <SelectItem value="all">All Days</SelectItem>
                <SelectItem value="weekend">Weekend Only</SelectItem>
                <SelectItem value="color-coded">Color-Coded Days</SelectItem>
              </SelectContent>
            </Select>
          )}
          </div>
          </div>

      {/* Show Deleted — admin only, active tab only */}
      {onToggleDeleted && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleDeleted}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              showDeleted ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${showDeleted ? 'bg-red-400 border-red-400' : 'border-gray-300'}`} />
            {showDeleted ? 'Showing Deleted' : 'Show Deleted'}
          </button>
        </div>
      )}
    </div>
  );
}