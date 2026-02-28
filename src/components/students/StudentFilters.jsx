import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function StudentFilters({ search, onSearch, filterClass, onFilterClass, filterSection, onFilterSection, filterStatus, onFilterStatus, showArchived, onToggleArchived, showDeleted, onToggleDeleted }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or Student ID..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="pl-9 rounded-xl border-gray-200 bg-gray-50"
          />
        </div>
        <Select value={filterClass} onValueChange={onFilterClass}>
          <SelectTrigger className="w-full sm:w-36 rounded-xl border-gray-200 bg-gray-50">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSection} onValueChange={onFilterSection}>
          <SelectTrigger className="w-full sm:w-32 rounded-xl border-gray-200 bg-gray-50">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {SECTIONS.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={onFilterStatus}>
          <SelectTrigger className="w-full sm:w-36 rounded-xl border-gray-200 bg-gray-50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Verified">Verified</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Published">Active</SelectItem>
            <SelectItem value="Passed Out">Passed Out</SelectItem>
            <SelectItem value="Transferred">Transferred</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 flex-wrap">
        {/* Show Archived Toggle */}
        <button
          type="button"
          onClick={onToggleArchived}
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors w-fit ${
            showArchived
              ? 'bg-orange-50 border-orange-300 text-orange-700'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${showArchived ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`} />
          {showArchived ? 'Showing Archived Students' : 'Show Archived Students'}
        </button>
        {/* Show Deleted Toggle — Admin only */}
        {onToggleDeleted && (
          <button
            type="button"
            onClick={onToggleDeleted}
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors w-fit ${
              showDeleted
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${showDeleted ? 'bg-red-400 border-red-400' : 'border-gray-300'}`} />
            {showDeleted ? 'Showing Deleted Students' : 'Show Deleted Students'}
          </button>
        )}
      </div>
    </div>
  );
}