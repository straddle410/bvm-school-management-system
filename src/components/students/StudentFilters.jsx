import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function StudentFilters({ search, onSearch, filterClass, onFilterClass, filterSection, onFilterSection, filterStatus, onFilterStatus, showArchived, onToggleArchived, showDeleted, onToggleDeleted }) {
  return (
    <div className="bg-white rounded-xl shadow-sm px-3 py-2.5 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search name or Student ID…"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="pl-8 h-8 text-sm rounded-lg border-gray-200 bg-gray-50"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Select value={filterClass} onValueChange={onFilterClass}>
            <SelectTrigger className="w-full sm:w-32 h-8 text-sm rounded-lg border-gray-200 bg-gray-50">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSection} onValueChange={onFilterSection}>
            <SelectTrigger className="w-full sm:w-28 h-8 text-sm rounded-lg border-gray-200 bg-gray-50">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {SECTIONS.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={onFilterStatus}>
            <SelectTrigger className="w-full sm:w-32 h-8 text-sm rounded-lg border-gray-200 bg-gray-50">
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
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={onToggleArchived}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
            showArchived ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${showArchived ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`} />
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </button>
        {onToggleDeleted && (
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
        )}
      </div>
    </div>
  );
}